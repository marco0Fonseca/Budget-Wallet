import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';
import type { TestContext } from 'node:test';
import { Transaction } from '../src/entities/transactions/transaction.ts';
import type { TransactionRepository } from '../src/repository/transactionRepository.ts';
let transactions: TransactionRepository;
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
    const category = await categories.create(new TransactionCategory(-1, 'Food', TransactionType.EXPENSE, null, user.id));
    const secondCategory = await categories.create(new TransactionCategory(-1, 'Market', TransactionType.EXPENSE, category.id, user.id));
    const draft = new Transaction(-1, category, 1550, 1795000000123, user.id, '  Purchase  ');
    const transaction = await transactions.create(draft);
    return { user, category, secondCategory, draft, transaction };
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

    // Configurar a conexão antes de importar o módulo que instancia o Prisma.
    process.env.DATABASE_URL = `file:${databasePath}`;
    const repositoryModule = await import('../src/repository/userRepository.ts');
    prisma = (await import('../src/repository/repository.ts')).prisma;
    userRepository = new repositoryModule.UserRepository();
    const categoryModule = await import('../src/repository/transactionCategoryRepository.ts');
    categories = new categoryModule.TransactionCategoryRepository();
    const transactionModule = await import('../src/repository/transactionRepository.ts');
    transactions = new transactionModule.TransactionRepository();
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


test('creates and queries transactions with generated IDs, exact cents and original timestamps', async (t) => {
    const a = await fixture(t, 'transactions.a');
    const b = await fixture(t, 'transactions.b');
    const second = await transactions.create(new Transaction(-1, a.secondCategory, 1, 1795000000999, a.user.id));
    assert.equal(a.draft.id, -1);
    assert.ok(a.transaction.id > 0);
    assert.notEqual(a.transaction.id, second.id);
    assert.equal(a.transaction.amountCents, 1550);
    assert.equal(a.transaction.dateTimestamp, 1795000000123);
    assert.equal(a.transaction.description, 'Purchase');
    assert.equal(second.description, undefined);
    assert.deepStrictEqual(a.transaction.category, a.category);
    assert.deepStrictEqual(await transactions.findById(a.transaction.id, a.user.id), a.transaction);
    assert.deepStrictEqual(await transactions.findAllByUserId(a.user.id), [a.transaction, second]);
    assert.deepStrictEqual(await transactions.findAllByCategory(a.category.id, a.user.id), [a.transaction]);
    assert.deepStrictEqual(await transactions.findAllByCategory(a.secondCategory.id, a.user.id), [second]);
    assert.deepStrictEqual(await categories.findAllByUserId(a.user.id), [a.category, a.secondCategory]);
    assert.deepStrictEqual(await categories.findAllByUserId(b.user.id), [b.category, b.secondCategory]);
    assert.equal(await transactions.findById(a.transaction.id, b.user.id), null);
    assert.equal(await transactions.findById(2147483647, a.user.id), null);
    assert.deepStrictEqual(await transactions.findAllByCategory(a.category.id, b.user.id), []);
    assert.deepStrictEqual(await transactions.findAllByUserId('missing-user'), []);
    assert.deepStrictEqual(await categories.findAllByUserId('missing-user'), []);
    await assert.rejects(() => transactions.create(a.transaction), /Only new transactions/);
    assert.ok(prisma);
    assert.equal(await prisma.transaction.count({ where: { id: -1 } }), 0);
});

test('persists updates and deletes only the selected transaction', async (t) => {
    const a = await fixture(t, 'updates.a');
    const b = await fixture(t, 'updates.b');
    const changed = await transactions.updateCategory(a.transaction.id, a.user.id, a.secondCategory.id);
    assert.deepStrictEqual(changed.category, a.secondCategory);
    const amount = await transactions.updateAmountCents(changed.id, a.user.id, 2147483647);
    assert.equal(amount.amountCents, 2147483647);
    assert.equal(amount.dateTimestamp, a.transaction.dateTimestamp);
    const description = await transactions.updateDescription(changed.id, a.user.id, '  New description  ');
    assert.equal(description.description, 'New description');
    assert.deepStrictEqual(await transactions.findById(changed.id, a.user.id), description);
    for (const text of ['', '   ', undefined]) {
        await transactions.updateDescription(changed.id, a.user.id, 'Temporary');
        const cleared = await transactions.updateDescription(changed.id, a.user.id, text);
        assert.equal(cleared.description, undefined);
        assert.ok(prisma);
        assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: changed.id } })).description, null);
    }
    const beforeDelete = await transactions.findById(changed.id, a.user.id);
    assert.deepStrictEqual(await transactions.delete(changed.id, a.user.id), beforeDelete);
    assert.equal(await transactions.findById(changed.id, a.user.id), null);
    assert.deepStrictEqual(await transactions.findAllByUserId(a.user.id), []);
    assert.deepStrictEqual(await transactions.findById(b.transaction.id, b.user.id), b.transaction);
    assert.deepStrictEqual(await categories.findCategoryById(a.secondCategory.id, a.user.id), a.secondCategory);
});

test('rejects investment categories when changing a transaction category', async (t) => {
    const { user, transaction } = await fixture(t, 'investment.category');
    assert.ok(prisma);
    const investmentCategory = await categories.create(
        new TransactionCategory(-1, 'CDI', TransactionType.INVESTMENT, null, user.id),
    );

    await assert.rejects(
        () => transactions.updateCategory(transaction.id, user.id, investmentCategory.id),
        /income or expense/,
    );
    assert.deepStrictEqual(await transactions.findById(transaction.id, user.id), transaction);
});

test('rejects invalid updates, missing records and cross-user operations without changing records', async (t) => {
    assert.ok(prisma);
    const a = await fixture(t, 'reject.a');
    const b = await fixture(t, 'reject.b');
    const original = await prisma.transaction.findMany({ orderBy: { id: 'asc' } });
    for (const [id, userId] of [[a.transaction.id, b.user.id], [2147483647, a.user.id]] as const) {
        await assert.rejects(() => transactions.updateCategory(id, userId, b.category.id), { code: 'P2025' });
        await assert.rejects(() => transactions.updateAmountCents(id, userId, 100), { code: 'P2025' });
        await assert.rejects(() => transactions.updateDescription(id, userId, 'Rejected'), { code: 'P2025' });
        await assert.rejects(() => transactions.delete(id, userId), { code: 'P2025' });
    }
    for (const categoryId of [b.category.id, 2147483647]) {
        await assert.rejects(() => transactions.updateCategory(a.transaction.id, a.user.id, categoryId), { code: 'P2025' });
        const forgedCategory = new TransactionCategory(categoryId, 'Forged', TransactionType.EXPENSE, null, a.user.id);
        await assert.rejects(() => transactions.create(new Transaction(-1, forgedCategory, 100, 1795000000123, a.user.id)), { code: 'P2003' });
    }
    const unsaved = new TransactionCategory(-1, 'Unsaved', TransactionType.EXPENSE, null, a.user.id);
    await assert.rejects(() => transactions.create(new Transaction(-1, unsaved, 100, 1795000000123, a.user.id)), /identifier is invalid/);
    for (const value of [0, -1, 1.5, NaN, Infinity, 2147483648]) {
        await assert.rejects(() => transactions.updateAmountCents(a.transaction.id, a.user.id, value), /Amount/);
    }
    await assert.rejects(() => transactions.updateDescription(a.transaction.id, a.user.id, 123 as unknown as string), /Description/);
    assert.deepStrictEqual(await prisma.transaction.findMany({ orderBy: { id: 'asc' } }), original);
});

test('validates IDs and owners at repository boundaries', async () => {
    for (const value of [-1, 0, 1.5, NaN, Infinity, 2147483648, '1', null, undefined]) {
        const id = value as number;
        await assert.rejects(() => transactions.findById(id, 'owner'), /identifier is invalid/);
        await assert.rejects(() => transactions.findAllByCategory(id, 'owner'), /identifier is invalid/);
        await assert.rejects(() => transactions.updateCategory(id, 'owner', 1), /identifier is invalid/);
        await assert.rejects(() => transactions.updateCategory(1, 'owner', id), /identifier is invalid/);
        await assert.rejects(() => transactions.updateAmountCents(id, 'owner', 1), /identifier is invalid/);
        await assert.rejects(() => transactions.updateDescription(id, 'owner', 'Text'), /identifier is invalid/);
        await assert.rejects(() => transactions.delete(id, 'owner'), /identifier is invalid/);
    }
    for (const userId of ['', ' owner ']) {
        await assert.rejects(() => transactions.findById(1, userId), /User identifier/);
        await assert.rejects(() => transactions.findAllByUserId(userId), /User identifier/);
        await assert.rejects(() => categories.findAllByUserId(userId), /User identifier/);
        await assert.rejects(() => transactions.findAllByCategory(1, userId), /User identifier/);
        await assert.rejects(() => transactions.updateCategory(1, userId, 1), /User identifier/);
        await assert.rejects(() => transactions.updateAmountCents(1, userId, 100), /User identifier/);
        await assert.rejects(() => transactions.updateDescription(1, userId, 'Text'), /User identifier/);
        await assert.rejects(() => transactions.delete(1, userId), /User identifier/);
    }
});
