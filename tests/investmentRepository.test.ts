import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';
import type { TestContext } from 'node:test';
import { Investment } from '../src/entities/transactions/investment.ts';
import type { InvestmentRepository } from '../src/repository/investmentRepository.ts';
let investments: InvestmentRepository;
import { User } from '../src/entities/user.ts';
import { TransactionType } from '../src/entities/transactions/transactionType.ts';
import { TransactionCategory } from '../src/entities/transactions/transactionCategory.ts';
import type { TransactionCategoryRepository } from '../src/repository/transactionCategoryRepository.ts';
let categories: TransactionCategoryRepository;

import type { UserRepository } from '../src/repository/userRepository.ts';
import { hashPassword } from '../src/server/auth.ts';

let userRepository: UserRepository;
let prisma: typeof import('../src/repository/repository.ts').prisma | undefined;
let directory: string | undefined;
const originalDatabaseUrl = process.env.DATABASE_URL;

async function fixture(t: TestContext, username: string) {
    const { user } = await createTestUser(t, username);
    const category = await categories.create(new TransactionCategory(-1, 'Food', TransactionType.INVESTMENT, null, user.id));
    const secondCategory = await categories.create(new TransactionCategory(-1, 'Market', TransactionType.INVESTMENT, category.id, user.id));
    const draft = new Investment(-1, category, 1795000000123, 10000, 0.01, 12, user.id, '  Purchase  ');
    const investment = await investments.create(draft);
    return { user, category, secondCategory, draft, investment };
}

async function createTestUser(t: TestContext, username: string) {
    assert.ok(prisma);
    const client = prisma;
    const user = new User(null, 'Test user', `${username}@example.com`, username);
    const passwordHash = await hashPassword('plainPassword');
    await userRepository.create(user, passwordHash);
    t.after(async () => {
        await client.user.deleteMany({ where: { id: user.id } });
    });
    return { user, passwordHash };
}

before(async () => {
    directory = mkdtempSync(join(tmpdir(), 'budget-wallet-test-'));
    const databasePath = join(directory, 'test.db');
    const db = new DatabaseSync(databasePath);
    try {
        const migrations = new URL('../prisma/migrations/', import.meta.url);
        for (const entry of readdirSync(migrations, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            if (entry.isDirectory()) {
                db.exec(readFileSync(new URL(`${entry.name}/migration.sql`, migrations), 'utf8'));
            }
        }
    } finally {
        db.close();
    }

    process.env.DATABASE_URL = `file:${databasePath}`;
    const repositoryModule = await import('../src/repository/userRepository.ts');
    prisma = (await import('../src/repository/repository.ts')).prisma;
    userRepository = new repositoryModule.UserRepository();
    const categoryModule = await import('../src/repository/transactionCategoryRepository.ts');
    categories = new categoryModule.TransactionCategoryRepository();
    const transactionModule = await import('../src/repository/investmentRepository.ts');
    investments = new transactionModule.InvestmentRepository();
});

after(async () => {
    try {
        await prisma?.$disconnect();
    } finally {
        if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = originalDatabaseUrl;

        if (directory) {
            for (const suffix of ['', '-journal', '-wal', '-shm']) {
                rmSync(join(directory, `test.db${suffix}`), { force: true });
            }
            rmdirSync(directory);
        }
    }
});


test('persists investments and queries only the requested owners records', async (t) => {
    const a = await fixture(t, 'investments.a');
    const b = await fixture(t, 'investments.b');
    assert.equal(a.draft.id, -1);
    assert.ok(a.investment.id > 0);
    assert.deepStrictEqual(a.investment.category, a.category);
    assert.equal(a.investment.dateTimestamp, a.draft.dateTimestamp);
    assert.equal(a.investment.amountCents, 10000);
    assert.equal(a.investment.monthlyRate, 0.01);
    assert.equal(a.investment.monthsDuration, 12);
    assert.equal(a.investment.projectedAmountCents(1), 10100);
    assert.deepStrictEqual(await investments.findById(a.investment.id, a.user.id), a.investment);
    assert.deepStrictEqual(await investments.findAllByUserId(a.user.id), [a.investment]);
    assert.deepStrictEqual(await investments.findAllByUserId(b.user.id), [b.investment]);
    assert.equal(await investments.findById(a.investment.id, b.user.id), null);
    assert.equal(await investments.findById(2147483647, a.user.id), null);
    assert.deepStrictEqual(await investments.findAllByUserId('missing-user'), []);
    await assert.rejects(() => investments.create(a.investment), /Only new investments/);
});

test('updates investment fields, clears descriptions and deletes without affecting another owner', async (t) => {
    const a = await fixture(t, 'updates.a');
    const b = await fixture(t, 'updates.b');
    const id = a.investment.id;
    const userId = a.user.id;
    assert.equal((await investments.updateAmountCents(id, userId, 20000)).amountCents, 20000);
    assert.equal((await investments.updateMonthlyRate(id, userId, -0.01)).monthlyRate, -0.01);
    assert.equal((await investments.updateMonthsDuration(id, userId, 24)).monthsDuration, 24);
    assert.equal((await investments.updateDescription(id, userId, '  New  ')).description, 'New');
    const stored = await investments.findById(id, userId);
    assert.ok(stored);
    assert.equal(stored.amountCents, 20000);
    assert.equal(stored.monthlyRate, -0.01);
    assert.equal(stored.monthsDuration, 24);
    assert.equal(stored.dateTimestamp, a.draft.dateTimestamp);
    assert.deepStrictEqual(stored.category, a.category);
    assert.equal(stored.projectedAmountCents(1), 19800);
    for (const value of ['', '   ', undefined]) {
        await investments.updateDescription(id, userId, 'Temporary');
        assert.equal((await investments.updateDescription(id, userId, value)).description, undefined);
        assert.ok(prisma);
        assert.equal((await prisma.investment.findUniqueOrThrow({ where: { id } })).description, null);
    }
    const before = await investments.findById(id, userId);
    assert.deepStrictEqual(await investments.delete(id, userId), before);
    assert.equal(await investments.findById(id, userId), null);
    assert.deepStrictEqual(await investments.findById(b.investment.id, b.user.id), b.investment);
});

test('rejects invalid fields and cross-user operations without changing persisted investments', async (t) => {
    assert.ok(prisma);
    const a = await fixture(t, 'reject.a');
    const b = await fixture(t, 'reject.b');
    const original = await prisma.investment.findMany({ orderBy: { id: 'asc' } });
    for (const [id, userId] of [[a.investment.id, b.user.id], [2147483647, a.user.id]] as const) {
        await assert.rejects(() => investments.updateAmountCents(id, userId, 100), { code: 'P2025' });
        await assert.rejects(() => investments.updateMonthlyRate(id, userId, 0), { code: 'P2025' });
        await assert.rejects(() => investments.updateMonthsDuration(id, userId, 1), { code: 'P2025' });
        await assert.rejects(() => investments.updateDescription(id, userId, 'No'), { code: 'P2025' });
        await assert.rejects(() => investments.delete(id, userId), { code: 'P2025' });
    }
    for (const value of [0, -1, 1.5, NaN, Infinity, 2147483648]) {
        await assert.rejects(() => investments.updateAmountCents(a.investment.id, a.user.id, value), /Amount/);
        await assert.rejects(() => investments.updateMonthsDuration(a.investment.id, a.user.id, value), /Duration/);
    }
    for (const value of [-1, -2, NaN, Infinity]) {
        await assert.rejects(() => investments.updateMonthlyRate(a.investment.id, a.user.id, value), /Monthly rate/);
    }
    await assert.rejects(() => investments.updateDescription(a.investment.id, a.user.id, 123 as unknown as string), /Description/);
    assert.deepStrictEqual(await prisma.investment.findMany({ orderBy: { id: 'asc' } }), original);
});

test('validates the persisted category type and owner before creating an investment', async (t) => {
    assert.ok(prisma);
    const a = await fixture(t, 'category.a');
    const b = await fixture(t, 'category.b');
    const expense = await categories.create(new TransactionCategory(-1, 'Expense', TransactionType.EXPENSE, null, a.user.id));
    const original = await prisma.investment.findMany({ orderBy: { id: 'asc' } });
    for (const id of [expense.id, b.category.id, 2147483647]) {
        const forged = new TransactionCategory(id, 'Forged', TransactionType.INVESTMENT, null, a.user.id);
        await assert.rejects(() => investments.create(new Investment(-1, forged, 1795000000123, 100, 0, 1, a.user.id)), { code: 'P2025' });
    }
    const unsaved = new TransactionCategory(-1, 'New', TransactionType.INVESTMENT, null, a.user.id);
    await assert.rejects(() => investments.create(new Investment(-1, unsaved, 1795000000123, 100, 0, 1, a.user.id)), /identifier/);
    assert.deepStrictEqual(await prisma.investment.findMany({ orderBy: { id: 'asc' } }), original);
});

test('rejects invalid identifiers and owner values', async () => {
    for (const value of [-1, 0, 1.5, NaN, Infinity, 2147483648, '1', null]) {
        const id = value as number;
        await assert.rejects(() => investments.findById(id, 'owner'), /identifier/);
        await assert.rejects(() => investments.updateAmountCents(id, 'owner', 100), /identifier/);
        await assert.rejects(() => investments.updateMonthlyRate(id, 'owner', 0), /identifier/);
        await assert.rejects(() => investments.updateMonthsDuration(id, 'owner', 1), /identifier/);
        await assert.rejects(() => investments.updateDescription(id, 'owner', 'Text'), /identifier/);
        await assert.rejects(() => investments.delete(id, 'owner'), /identifier/);
    }
    await assert.rejects(() => investments.findAllByUserId(''), /User identifier/);
    await assert.rejects(() => investments.findById(1, ' owner '), /User identifier/);
});

