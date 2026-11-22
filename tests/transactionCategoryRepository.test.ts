import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';
import type { TestContext } from 'node:test';
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

test('lists only the users default categories including default subcategories', async (t) => {
    const { user } = await createTestUser(t, 'defaults.owner');
    const { user: other } = await createTestUser(t, 'defaults.other');
    assert.deepStrictEqual(await categories.findAllDefaultByUserId(user.id), []);

    const parent = await categories.create(new TransactionCategory(-1, 'Default root', TransactionType.EXPENSE, null, user.id, true));
    await categories.create(new TransactionCategory(-1, 'Custom', TransactionType.EXPENSE, null, user.id));
    const child = await categories.create(new TransactionCategory(-1, 'Default child', TransactionType.EXPENSE, parent.id, user.id, true));
    await categories.create(new TransactionCategory(-1, 'Custom child', TransactionType.EXPENSE, parent.id, user.id));
    const foreign = await categories.create(new TransactionCategory(-1, 'Other default', TransactionType.EXPENSE, null, other.id, true));

    assert.deepStrictEqual(await categories.findAllDefaultByUserId(user.id), [parent, child]);
    assert.deepStrictEqual(await categories.findAllDefaultByUserId(other.id), [foreign]);
    assert.deepStrictEqual(await categories.findAllDefaultByUserId('missing-user'), []);
    for (const userId of ['', ' owner ']) {
        await assert.rejects(() => categories.findAllDefaultByUserId(userId), /User identifier is invalid/);
    }
});

test('creates the default root categories for one user idempotently', async (t) => {
    assert.ok(prisma);
    const { user } = await createTestUser(t, 'default.catalog');

    const firstRun = await categories.createDefaultCategoriesForUser(user.id);
    const secondRun = await categories.createDefaultCategoriesForUser(user.id);

    assert.equal(firstRun.length, 21);
    assert.ok(firstRun.every(category => category.isDefault && category.parentId === null));
    assert.ok(firstRun.some(category => category.label === 'CDI' && category.type === TransactionType.INVESTMENT));
    assert.ok(firstRun.some(category => category.label === 'Locação' && category.type === TransactionType.INVESTMENT));
    assert.deepStrictEqual(secondRun, firstRun);
    assert.equal(await prisma.transactionCategory.count({ where: { userId: user.id } }), 21);

    const { user: otherUser } = await createTestUser(t, 'default.other-owner');
    assert.deepStrictEqual(await categories.findAllByUserId(otherUser.id), []);
});

test('updates root and children together without changing another users categories', async (t) => {
    assert.ok(prisma);
    const { user } = await createTestUser(t, 'type.owner');
    const { user: other } = await createTestUser(t, 'type.other');
    const parent = await prisma.transactionCategory.create({ data: { label: 'Root', type: 'EXPENSE', userId: user.id } });
    const child = await prisma.transactionCategory.create({ data: { label: 'Child', type: 'EXPENSE', userId: user.id, parentId: parent.id } });
    const unrelated = await prisma.transactionCategory.create({ data: { label: 'Other', type: 'EXPENSE', userId: other.id } });

    assert.equal((await categories.updateType(parent.id, user.id, TransactionType.INCOME)).type, TransactionType.INCOME);
    assert.deepStrictEqual(await prisma.transactionCategory.findUnique({ where: { id: parent.id } }), { ...parent, type: 'INCOME' });
    assert.deepStrictEqual(await prisma.transactionCategory.findUnique({ where: { id: child.id } }), { ...child, type: 'INCOME' });
    assert.deepStrictEqual(await prisma.transactionCategory.findUnique({ where: { id: unrelated.id } }), unrelated);
});

test('creates roots and direct children with generated IDs and preserves their fields', async (t) => {
    const { user } = await createTestUser(t, 'creation.owner');

    const newParent = new TransactionCategory(-1,'Root', TransactionType.EXPENSE, null, user.id, true);
    assert.equal(newParent.id, -1);

    const parent = await categories.create(newParent);
    const child = await categories.create(new TransactionCategory(-1,'Child', TransactionType.EXPENSE, parent.id, user.id));

    assert.ok(parent.id > 0);
    assert.ok(child.id > 0);
    assert.notEqual(parent.id, child.id);
    assert.equal(newParent.id, -1);
    assert.equal(child.parentId, parent.id);
    assert.equal(parent.isDefault, true);
    assert.equal(child.isDefault, false);
    assert.deepStrictEqual(await categories.findCategoryById(parent.id, user.id), parent);
    assert.deepStrictEqual(await categories.findCategoryById(child.id, user.id), child);
    assert.ok(prisma);
    assert.equal(await prisma.transactionCategory.count({ where: { id: -1 } }), 0);
    const count = await prisma.transactionCategory.count({ where: { userId: user.id } });
    await assert.rejects(() => categories.create(parent), /Only new categories/);
    assert.equal(await prisma.transactionCategory.count({ where: { userId: user.id } }), count);
});

test('rejects invalid parents without creating or modifying categories', async (t) => {
    assert.ok(prisma);
    const { user } = await createTestUser(t, 'parent.owner');
    const { user: other } = await createTestUser(t, 'parent.other');
    const parent = await categories.create(new TransactionCategory(-1,'Root', TransactionType.EXPENSE, null, user.id));
    const child = await categories.create(new TransactionCategory(-1,'Child', TransactionType.EXPENSE, parent.id, user.id));
    const otherParent = await categories.create(new TransactionCategory(-1,'Other', TransactionType.EXPENSE, null, other.id));
    const attempts = [
        { parentId: child.id, type: TransactionType.EXPENSE, error: /must belong to a root/ },
        { parentId: parent.id, type: TransactionType.INCOME, error: /must match its parent/ },
        { parentId: otherParent.id, type: TransactionType.EXPENSE, error: { code: 'P2025' } },
        { parentId: 2147483647, type: TransactionType.EXPENSE, error: { code: 'P2025' } },
        ...[-1, 0, 1.5, NaN].map(parentId => ({ parentId, type: TransactionType.EXPENSE, error: /identifier is invalid/ })),
    ];
    const original = await prisma.transactionCategory.findMany({ orderBy: { id: 'asc' } });
    for (const attempt of attempts) {
        await assert.rejects(
            async () => categories.create(new TransactionCategory(-1,'Rejected', attempt.type, attempt.parentId, user.id)),
            attempt.error,
        );
        assert.deepStrictEqual(await prisma.transactionCategory.findMany({ orderBy: { id: 'asc' } }), original);
    }
});

test('rejects invalid IDs in queries and updates without changing stored categories', async (t) => {
    assert.ok(prisma);
    const { user } = await createTestUser(t, 'ids.owner');
    const category = await categories.create(new TransactionCategory(-1,'Root', TransactionType.EXPENSE, null, user.id));
    const invalidIds: unknown[] = [-1, 0, -2, 1.5, NaN, Infinity, 2147483648, '1', null, undefined, true];
    for (const value of invalidIds) {
        const id = value as number;
        await assert.rejects(() => categories.findCategoryById(id, user.id), /identifier is invalid/);
        await assert.rejects(() => categories.findAllSubCategories(id, user.id), /identifier is invalid/);
        await assert.rejects(() => categories.updateLabel(id, user.id, 'Changed'), /identifier is invalid/);
        await assert.rejects(() => categories.updateType(id, user.id, TransactionType.INCOME), /identifier is invalid/);
    }
    assert.deepStrictEqual(await categories.findCategoryById(category.id, user.id), category);
    assert.equal(await prisma.transactionCategory.count({ where: { userId: user.id } }), 1);
});

test('deletes custom leaf categories and preserves their parent and other users data', async (t) => {
    const { user } = await createTestUser(t, 'delete.owner');
    const { user: other } = await createTestUser(t, 'delete.other');
    const parent = await categories.create(new TransactionCategory(-1, 'Root', TransactionType.EXPENSE, null, user.id));
    const child = await categories.create(new TransactionCategory(-1, 'Child', TransactionType.EXPENSE, parent.id, user.id));
    const otherCategory = await categories.create(new TransactionCategory(-1, 'Other', TransactionType.EXPENSE, null, other.id));

    assert.deepStrictEqual(await categories.delete(child.id, user.id), child);
    assert.equal(await categories.findCategoryById(child.id, user.id), null);
    assert.deepStrictEqual(await categories.findCategoryById(parent.id, user.id), parent);
    assert.deepStrictEqual(await categories.delete(parent.id, user.id), parent);
    assert.equal(await categories.findCategoryById(parent.id, user.id), null);
    assert.deepStrictEqual(await categories.findCategoryById(otherCategory.id, other.id), otherCategory);
});

test('rejects deletion of default categories, parents, missing records and another users categories', async (t) => {
    assert.ok(prisma);
    const { user } = await createTestUser(t, 'protected.owner');
    const parent = await categories.create(new TransactionCategory(-1, 'Root', TransactionType.EXPENSE, null, user.id));
    const child = await categories.create(new TransactionCategory(-1, 'Child', TransactionType.EXPENSE, parent.id, user.id));
    const standard = await categories.create(new TransactionCategory(-1, 'Default', TransactionType.EXPENSE, null, user.id, true));
    const standardChild = await categories.create(new TransactionCategory(-1, 'Default child', TransactionType.EXPENSE, parent.id, user.id, true));
    const before = await prisma.transactionCategory.findMany({ orderBy: { id: 'asc' } });

    for (const id of [parent.id, standard.id, standardChild.id, 2147483647]) {
        await assert.rejects(() => categories.delete(id, user.id), { code: 'P2025' });
    }
    await assert.rejects(() => categories.delete(child.id, 'another-user'), { code: 'P2025' });
    await assert.rejects(() => categories.delete(child.id, ''), /User identifier is invalid/);
    for (const value of [-1, 0, 1.5, NaN, Infinity, 2147483648, '1', null, undefined]) {
        await assert.rejects(() => categories.delete(value as number, user.id), /identifier is invalid/);
    }
    assert.deepStrictEqual(await prisma.transactionCategory.findMany({ orderBy: { id: 'asc' } }), before);
});

test('preserves categories and linked transactions or investments when deletion is rejected', async (t) => {
    assert.ok(prisma);
    const { user } = await createTestUser(t, 'history.owner');
    const expense = await categories.create(new TransactionCategory(-1, 'Expense', TransactionType.EXPENSE, null, user.id));
    const investmentCategory = await categories.create(new TransactionCategory(-1, 'Investment', TransactionType.INVESTMENT, null, user.id));
    const transaction = await prisma.transaction.create({ data: { categoryId: expense.id, userId: user.id, amountCents: 100, dateTimestamp: 1795000000123n } });
    const investment = await prisma.investment.create({ data: { categoryId: investmentCategory.id, userId: user.id, amountCents: 100, dateTimestamp: 1795000000123n, monthlyRate: 0.01, monthsDuration: 12 } });

    for (const category of [expense, investmentCategory]) {
        await assert.rejects(() => categories.delete(category.id, user.id), { code: 'P2003' });
        assert.deepStrictEqual(await categories.findCategoryById(category.id, user.id), category);
    }
    assert.deepStrictEqual(await prisma.transaction.findUnique({ where: { id: transaction.id } }), transaction);
    assert.deepStrictEqual(await prisma.investment.findUnique({ where: { id: investment.id } }), investment);
});

test('moves a subcategory and promotes it to a root while preserving its transactions', async (t) => {
    assert.ok(prisma);
    const { user } = await createTestUser(t, 'move.owner');
    const first = await categories.create(new TransactionCategory(-1, 'First', TransactionType.EXPENSE, null, user.id));
    const second = await categories.create(new TransactionCategory(-1, 'Second', TransactionType.EXPENSE, null, user.id, true));
    const child = await categories.create(new TransactionCategory(-1, 'Child', TransactionType.EXPENSE, first.id, user.id));
    const transaction = await prisma.transaction.create({ data: { categoryId: child.id, userId: user.id, amountCents: 100, dateTimestamp: 1795000000123n } });

    for (const parentId of [second.id, null, first.id]) {
        const updated = await categories.updateParent(child.id, user.id, parentId);
        const expected = new TransactionCategory(child.id, child.label, child.type, parentId, user.id);
        assert.deepStrictEqual(updated, expected);
        assert.deepStrictEqual(await categories.findCategoryById(child.id, user.id), expected);
        assert.deepStrictEqual(await prisma.transaction.findUnique({ where: { id: transaction.id } }), transaction);
    }
    assert.deepStrictEqual(await categories.findCategoryById(first.id, user.id), first);
    assert.deepStrictEqual(await categories.findCategoryById(second.id, user.id), second);
});

test('rejects invalid parent changes without modifying categories', async (t) => {
    assert.ok(prisma);
    const { user } = await createTestUser(t, 'move.blocked');
    const { user: other } = await createTestUser(t, 'move.other');
    const root = await categories.create(new TransactionCategory(-1, 'Root', TransactionType.EXPENSE, null, user.id));
    const child = await categories.create(new TransactionCategory(-1, 'Child', TransactionType.EXPENSE, root.id, user.id));
    const target = await categories.create(new TransactionCategory(-1, 'Target', TransactionType.EXPENSE, null, user.id));
    const income = await categories.create(new TransactionCategory(-1, 'Income', TransactionType.INCOME, null, user.id));
    const standard = await categories.create(new TransactionCategory(-1, 'Standard', TransactionType.EXPENSE, root.id, user.id, true));
    const foreign = await categories.create(new TransactionCategory(-1, 'Foreign', TransactionType.EXPENSE, null, other.id));
    const original = await prisma.transactionCategory.findMany({ orderBy: { id: 'asc' } });
    const attempts = [
        { id: child.id, owner: user.id, parent: child.id, error: /own parent/ },
        { id: target.id, owner: user.id, parent: child.id, error: /root category/ },
        { id: root.id, owner: user.id, parent: target.id, error: /with children/ },
        { id: child.id, owner: user.id, parent: income.id, error: /match its parent/ },
        { id: child.id, owner: user.id, parent: foreign.id, error: { code: 'P2025' } },
        { id: child.id, owner: other.id, parent: null, error: { code: 'P2025' } },
        { id: standard.id, owner: user.id, parent: null, error: { code: 'P2025' } },
        { id: standard.id, owner: user.id, parent: target.id, error: { code: 'P2025' } },
        { id: child.id, owner: user.id, parent: 2147483647, error: { code: 'P2025' } },
        { id: 2147483647, owner: user.id, parent: null, error: { code: 'P2025' } },
        { id: -1, owner: user.id, parent: null, error: /identifier is invalid/ },
        { id: child.id, owner: user.id, parent: -1, error: /identifier is invalid/ },
        { id: child.id, owner: '', parent: null, error: /User identifier is invalid/ },
    ];
    for (const attempt of attempts) {
        await assert.rejects(() => categories.updateParent(attempt.id, attempt.owner, attempt.parent), attempt.error);
        assert.deepStrictEqual(await prisma.transactionCategory.findMany({ orderBy: { id: 'asc' } }), original);
    }
});

test('rejects forbidden type changes and preserves all stored records', async (t) => {
    assert.ok(prisma);
    const client = prisma;
    const { user } = await createTestUser(t, 'blocked.owner');
    const parent = await client.transactionCategory.create({ data: { label: 'Root', type: 'EXPENSE', userId: user.id } });
    const child = await client.transactionCategory.create({ data: { label: 'Child', type: 'EXPENSE', userId: user.id, parentId: parent.id } });
    const snapshot = () => client.transactionCategory.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } });
    async function rejected(update: () => Promise<unknown>, error: RegExp | { code: string }) {
        const before = await snapshot();
        await assert.rejects(update, error);
        assert.deepStrictEqual(await snapshot(), before);
    }
    await rejected(() => categories.updateType(parent.id, 'another-owner', TransactionType.INCOME), { code: 'P2025' });
    await rejected(() => categories.updateType(2147483647, user.id, TransactionType.INCOME), { code: 'P2025' });
    await rejected(() => categories.updateType(parent.id, user.id, 'INVALID' as TransactionType), /Transaction type is invalid/);
    await rejected(() => categories.updateType(child.id, user.id, TransactionType.INCOME), /Only root/);

    for (const id of [parent.id, child.id]) {
        await client.transactionCategory.update({ where: { id }, data: { isDefault: true } });
        await rejected(() => categories.updateType(parent.id, user.id, TransactionType.INCOME), /Default categories/);
        await client.transactionCategory.update({ where: { id }, data: { isDefault: false } });
    }

    for (const categoryId of [parent.id, child.id]) {
        const transaction = await client.transaction.create({ data: { categoryId, userId: user.id, amountCents: 100, dateTimestamp: 1795000000123n } });
        await rejected(() => categories.updateType(parent.id, user.id, TransactionType.INCOME), /with transactions or investments/);
        await client.transaction.delete({ where: { id: transaction.id } });
    }
    await categories.updateType(parent.id, user.id, TransactionType.INVESTMENT);
    for (const categoryId of [parent.id, child.id]) {
        const investment = await client.investment.create({ data: { categoryId, userId: user.id, amountCents: 100, dateTimestamp: 1795000000123n, monthlyRate: 0.01, monthsDuration: 12 } });
        await rejected(() => categories.updateType(parent.id, user.id, TransactionType.INCOME), /with transactions or investments/);
        await client.investment.delete({ where: { id: investment.id } });
    }
});
