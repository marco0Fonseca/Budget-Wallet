import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';
import type { TestContext } from 'node:test';
import { User } from '../src/entities/user.ts';
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

test('creates a user and retrieves it by ID, email, and username', async (t) => {
    const user = new User(null, 'Usuário de teste', 'test@example.com', 'test.user');
    const hashedPassword = await hashPassword('plainPassword');

    let dataBaseUser : User | null = await userRepository.create(user,hashedPassword);
    t.after(async () => {
        await userRepository.delete(user.id);
        assert.equal(await userRepository.findUserById(user.id), null);
    });
    assert.ok(dataBaseUser);
    assert.deepStrictEqual(dataBaseUser, user);

    dataBaseUser = await userRepository.findUserById(user.id);
    assert.ok(dataBaseUser);
    assert.deepStrictEqual(dataBaseUser, user);

    dataBaseUser = await userRepository.findUserByEmail(user.email);
    assert.ok(dataBaseUser);
    assert.deepStrictEqual(dataBaseUser, user);

    dataBaseUser = await userRepository.findUserByUsername(user.username);
    assert.ok(dataBaseUser);
    assert.deepStrictEqual(dataBaseUser, user);

    const result = await userRepository.findUserByEmailWithPassword(user.email);
    assert.ok(result);

    const {
        user: authenticatedUser,
        passwordHash: dataBasePassword,
    } = result;

    assert.deepStrictEqual(authenticatedUser, user);
    assert.equal(dataBasePassword, hashedPassword);
});

test('returns null for queries and rejects updates when the user does not exist', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    const email = 'missing@example.com';
    const username = 'missing.user';

    assert.equal(await userRepository.findUserById(id), null);
    assert.equal(await userRepository.findUserByEmail(email), null);
    assert.equal(await userRepository.findUserByUsername(username), null);
    assert.equal(await userRepository.findUserByEmailWithPassword(email), null);

    await assert.rejects(() => userRepository.updateName(id, 'Updated name'), { code: 'P2025' });
    await assert.rejects(() => userRepository.updateEmail(id, 'updated@example.com'), { code: 'P2025' });
    await assert.rejects(() => userRepository.updateUsername(id, 'updated.user'), { code: 'P2025' });

    const passwordHash = await hashPassword('updatedPassword');
    assert.equal(await userRepository.updatePasswordHashByIdentifier(email, passwordHash), null);
});

test('persists profile updates and preserves the other user fields', async (t) => {
    const { user } = await createTestUser(t, 'profile.user');

    const renamed = new User(user.id, 'Updated name', user.email, user.username, user.createdAtTimestamp);
    assert.deepStrictEqual(await userRepository.updateName(user.id, '  Updated name  '), renamed);
    assert.deepStrictEqual(await userRepository.findUserById(user.id), renamed);

    const newEmail = 'updated.profile@example.com';
    const changedEmail = new User(user.id, renamed.name, newEmail, user.username, user.createdAtTimestamp);
    assert.deepStrictEqual(await userRepository.updateEmail(user.id, `  ${newEmail}  `), changedEmail);
    assert.deepStrictEqual(await userRepository.findUserByEmail(newEmail), changedEmail);
    assert.equal(await userRepository.findUserByEmail(user.email), null);

    const changedUsername = new User(user.id, renamed.name, newEmail, 'updated.profile', user.createdAtTimestamp);
    assert.deepStrictEqual(await userRepository.updateUsername(user.id, '  updated.profile  '), changedUsername);
    assert.deepStrictEqual(await userRepository.findUserByUsername('updated.profile'), changedUsername);
    assert.equal(await userRepository.findUserByUsername(user.username), null);
});

test('rejects invalid profile updates without changing the stored user', async (t) => {
    const { user, passwordHash } = await createTestUser(t, 'invalid.user');

    const attempts = [
        { update: () => userRepository.updateName(user.id, ''), error: /Name is required/ },
        { update: () => userRepository.updateName(user.id, '   '), error: /Name is required/ },
        { update: () => userRepository.updateEmail(user.id, 'invalid-email'), error: /Invalid E-mail/ },
        { update: () => userRepository.updateUsername(user.id, 'JOAO'), error: /Username must contain/ },
    ];

    for (const { update, error } of attempts) {
        await assert.rejects(update, error);
        assert.deepStrictEqual(await userRepository.findUserByEmailWithPassword(user.email), { user, passwordHash });
    }
});

test('rejects duplicate emails and usernames on creation and update without changing records', async (t) => {
    assert.ok(prisma);
    const { user: first, passwordHash } = await createTestUser(t, 'unique.first');
    const { user: second } = await createTestUser(t, 'unique.second');
    const originalRecords = await prisma.user.findMany({ orderBy: { id: 'asc' } });

    const duplicateEmail = new User(null, 'Duplicate email', first.email, 'duplicate.email');
    const duplicateUsername = new User(null, 'Duplicate username', 'duplicate@example.com', first.username);
    const attempts = [
        () => userRepository.create(duplicateEmail, passwordHash),
        () => userRepository.create(duplicateUsername, passwordHash),
        () => userRepository.updateEmail(second.id, first.email),
        () => userRepository.updateUsername(second.id, first.username),
    ];

    for (const attempt of attempts) {
        await assert.rejects(attempt, { code: 'P2002' });
        assert.deepStrictEqual(await prisma.user.findMany({ orderBy: { id: 'asc' } }), originalRecords);
    }
});

test('persists a new password hash and exposes it only through the authentication query', async (t) => {
    const { user, passwordHash: oldHash } = await createTestUser(t, 'password.user');
    const newHash = await hashPassword('newPassword');
    assert.notEqual(newHash, oldHash);

    const updated = await userRepository.updatePasswordHashByIdentifier(user.username, newHash);
    const authentication = await userRepository.findUserByEmailWithPassword(user.email);
    assert.deepStrictEqual(authentication, { user, passwordHash: newHash });

    const profiles = [
        updated,
        await userRepository.findUserById(user.id),
        await userRepository.findUserByEmail(user.email),
        await userRepository.findUserByUsername(user.username),
        authentication?.user,
    ];
    for (const profile of profiles) {
        assert.ok(profile);
        assert.deepStrictEqual(profile, user);
        assert.equal('passwordHash' in profile, false);
        assert.equal('password' in profile, false);
    }
});

test('deletes a user without related records and returns null on subsequent queries', async (t) => {
    const { user } = await createTestUser(t, 'delete.user');

    assert.deepStrictEqual(await userRepository.delete(user.id), user);
    assert.equal(await userRepository.findUserById(user.id), null);
    assert.equal(await userRepository.findUserByEmail(user.email), null);
    assert.equal(await userRepository.findUserByUsername(user.username), null);
    assert.equal(await userRepository.findUserByEmailWithPassword(user.email), null);
});

test('cascades user deletion to all related records while preserving another users data', async (t) => {
    assert.ok(prisma);
    const client = prisma;
    const { user } = await createTestUser(t, 'linked.user');
    const other = await createTestUser(t, 'other.user');

    async function createRelatedRecords(userId: string) {
        const parent = await client.transactionCategory.create({
            data: { label: 'Food', type: 'EXPENSE', userId },
        });
        const child = await client.transactionCategory.create({
            data: { label: 'Groceries', type: 'EXPENSE', userId, parentId: parent.id },
        });
        const investmentCategory = await client.transactionCategory.create({
            data: { label: 'Investments', type: 'INVESTMENT', userId },
        });
        const transaction = await client.transaction.create({
            data: { categoryId: child.id, amountCents: 1500, dateTimestamp: 1795000000123n, userId },
        });
        const investment = await client.investment.create({
            data: {
                categoryId: investmentCategory.id, amountCents: 10000, dateTimestamp: 1795000000123n,
                monthlyRate: 0.01, monthsDuration: 12, userId,
            },
        });
        return { parent, child, investmentCategory, transaction, investment };
    }

    const related = await createRelatedRecords(user.id);
    const otherRelated = await createRelatedRecords(other.user.id);

    for (const category of [related.parent, related.child, related.investmentCategory]) {
        await assert.rejects(() => client.transactionCategory.delete({ where: { id: category.id } }), { code: 'P2003' });
    }

    assert.deepStrictEqual(await userRepository.delete(user.id), user);
    assert.equal(await userRepository.findUserById(user.id), null);
    assert.equal(await client.transactionCategory.count({ where: { userId: user.id } }), 0);
    assert.equal(await client.transaction.count({ where: { userId: user.id } }), 0);
    assert.equal(await client.investment.count({ where: { userId: user.id } }), 0);

    assert.deepStrictEqual(await userRepository.findUserByEmailWithPassword(other.user.email), other);
    assert.deepStrictEqual(
        await client.transactionCategory.findMany({ where: { userId: other.user.id }, orderBy: { id: 'asc' } }),
        [otherRelated.parent, otherRelated.child, otherRelated.investmentCategory],
    );
    assert.deepStrictEqual(await client.transaction.findMany({ where: { userId: other.user.id } }), [otherRelated.transaction]);
    assert.deepStrictEqual(await client.investment.findMany({ where: { userId: other.user.id } }), [otherRelated.investment]);
});
