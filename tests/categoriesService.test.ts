import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, rmdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import express, { type ErrorRequestHandler, type Express } from 'express';
import jwt from 'jsonwebtoken';
import { after, before, test } from 'node:test';

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalJwtSecret = process.env.JWT_SECRET;
const testSecret = 'categories-service-test-secret';
let directory: string | undefined;
let app: Express;
let prisma: typeof import('../src/repository/repository.ts').prisma;
let server: ReturnType<Express['listen']>;
let baseUrl: string;
let ownerId: string;
let otherUserId: string;

before(async () => {
  directory = mkdtempSync(join(tmpdir(), 'budget-wallet-categories-test-'));
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
  process.env.JWT_SECRET = testSecret;

  const { registerCategoriesRoutes } = await import('../src/server/services/categoriesService.ts');
  const { TransactionCategoryRepository } = await import('../src/repository/transactionCategoryRepository.ts');
  const { TransactionCategory } = await import('../src/entities/transactions/transactionCategory.ts');
  const { TransactionType } = await import('../src/entities/transactions/transactionType.ts');
  prisma = (await import('../src/repository/repository.ts')).prisma;

  const owner = await prisma.user.create({
    data: {
      name: 'Category Owner', email: 'owner@example.com', username: 'category.owner',
      passwordHash: 'test-hash', createdAtTimestamp: BigInt(Date.now()),
    },
  });
  const otherUser = await prisma.user.create({
    data: {
      name: 'Other User', email: 'other@example.com', username: 'other.user',
      passwordHash: 'test-hash', createdAtTimestamp: BigInt(Date.now()),
    },
  });
  ownerId = owner.id;
  otherUserId = otherUser.id;

  const categories = new TransactionCategoryRepository();
  const root = await categories.create(new TransactionCategory(-1, 'Food', TransactionType.EXPENSE, null, ownerId));
  await categories.create(new TransactionCategory(-1, 'Groceries', TransactionType.EXPENSE, root.id, ownerId));
  await categories.create(new TransactionCategory(-1, 'Salary', TransactionType.INCOME, null, ownerId));
  await categories.create(new TransactionCategory(-1, 'Private', TransactionType.EXPENSE, null, otherUserId));

  app = express();
  app.use(express.json());
  registerCategoriesRoutes(app);
  const testErrorHandler: ErrorRequestHandler = (_error, _req, res, _next) => {
    res.status(500).json({ error: 'Falha interna do servidor.' });
  };
  app.use(testErrorHandler);

  server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await prisma.$disconnect();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
  if (directory) {
    for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(join(directory, `test.db${suffix}`), { force: true });
    rmdirSync(directory);
  }
});

async function getCategories(token?: string, query = '') {
  const response = await fetch(`${baseUrl}/api/categories${query}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { response, data: await response.json() as Record<string, unknown> };
}

async function postCategory(token: string | undefined, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/categories`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { response, data: await response.json() as Record<string, unknown> };
}

async function patchCategory(token: string | undefined, id: number, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/categories/${id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { response, data: await response.json() as Record<string, unknown> };
}

test('returns only the authenticated user categories in repository order', async () => {
  const token = jwt.sign({ userId: ownerId }, testSecret);
  const { response, data } = await getCategories(token);

  assert.equal(response.status, 200);
  const categories = data.categories as Array<{ label: string; userId: string }>;
  assert.deepStrictEqual(categories.map(category => category.label), ['Food', 'Groceries', 'Salary']);
  assert.ok(categories.every(category => category.userId === ownerId));
});

test('rejects requests without a valid bearer token', async () => {
  const missing = await getCategories();
  assert.equal(missing.response.status, 401);

  for (const token of ['invalid-token', jwt.sign({ userId: ownerId }, 'different-secret')]) {
    const invalid = await getCategories(token);
    assert.equal(invalid.response.status, 401);
  }
});

test('uses the authenticated identity even when the request includes another user ID', async () => {
  const token = jwt.sign({ userId: ownerId }, testSecret);
  const { response, data } = await getCategories(token, `?userId=${encodeURIComponent(otherUserId)}`);

  assert.equal(response.status, 200);
  const categories = data.categories as Array<{ label: string; userId: string }>;
  assert.ok(categories.every(category => category.userId === ownerId));
  assert.equal(categories.some(category => category.label === 'Private'), false);
});

test('rejects tokens that do not contain a valid user ID', async () => {
  const token = jwt.sign({ userId: ' ' }, testSecret);
  const { response } = await getCategories(token);

  assert.equal(response.status, 401);
  assert.equal(await prisma.transactionCategory.count({ where: { userId: ownerId } }), 3);
});

test('creates root categories and subcategories for the authenticated user', async () => {
  const token = jwt.sign({ userId: ownerId }, testSecret);
  const rootResult = await postCategory(token, {
    label: 'Pets', type: 'EXPENSE', userId: otherUserId, isDefault: true,
  });

  assert.equal(rootResult.response.status, 201);
  const root = rootResult.data.category as { id: number; label: string; type: string; userId: string; isDefault: boolean; parentId: number | null };
  assert.ok(root.id > 0);
  assert.equal(root.label, 'Pets');
  assert.equal(root.userId, ownerId);
  assert.equal(root.isDefault, false);
  assert.equal(root.parentId, null);

  const childResult = await postCategory(token, {
    label: 'Veterinarian', type: 'EXPENSE', parentId: root.id,
  });
  assert.equal(childResult.response.status, 201);
  const child = childResult.data.category as { parentId: number; userId: string; isDefault: boolean };
  assert.equal(child.parentId, root.id);
  assert.equal(child.userId, ownerId);
  assert.equal(child.isDefault, false);

  const refreshed = await getCategories(token);
  assert.equal(refreshed.response.status, 200);
  const categories = refreshed.data.categories as Array<{ label: string }>;
  assert.ok(categories.some(category => category.label === 'Pets'));
  assert.ok(categories.some(category => category.label === 'Veterinarian'));
});

test('rejects invalid category data and parent links without creating records', async () => {
  const token = jwt.sign({ userId: ownerId }, testSecret);
  const foreignCategory = await prisma.transactionCategory.findFirstOrThrow({ where: { userId: otherUserId } });
  const originalCount = await prisma.transactionCategory.count({ where: { userId: ownerId } });
  const invalidBodies = [
    { label: ' ', type: 'EXPENSE' },
    { label: 'Invalid type', type: 'UNKNOWN' },
    { label: 'Missing parent', type: 'EXPENSE', parentId: 2147483647 },
    { label: 'Foreign parent', type: 'EXPENSE', parentId: foreignCategory.id },
    { label: 'Wrong type', type: 'INCOME', parentId: (await prisma.transactionCategory.findFirstOrThrow({ where: { userId: ownerId, label: 'Food' } })).id },
  ];

  for (const body of invalidBodies) {
    const { response } = await postCategory(token, body);
    assert.equal(response.status, 400);
  }

  assert.equal(await prisma.transactionCategory.count({ where: { userId: ownerId } }), originalCount);
});

test('requires authentication to create categories', async () => {
  const { response } = await postCategory(undefined, { label: 'Not allowed', type: 'EXPENSE' });
  assert.equal(response.status, 401);
});

test('updates a custom category and returns the refreshed hierarchy', async () => {
  const token = jwt.sign({ userId: ownerId }, testSecret);
  const child = await prisma.transactionCategory.findFirstOrThrow({
    where: { userId: ownerId, label: 'Groceries' },
  });
  const { response, data } = await patchCategory(token, child.id, {
    label: 'Supermarket',
    type: 'EXPENSE',
    parentId: null,
  });

  assert.equal(response.status, 200);
  const category = data.category as { id: number; label: string; type: string; parentId: number | null; userId: string };
  assert.equal(category.id, child.id);
  assert.equal(category.label, 'Supermarket');
  assert.equal(category.parentId, null);
  assert.equal(category.userId, ownerId);

  const categories = data.categories as Array<{ id: number; label: string; parentId: number | null }>;
  assert.ok(categories.some(item => item.id === child.id && item.label === 'Supermarket' && item.parentId === null));
  assert.equal((await prisma.transactionCategory.findUniqueOrThrow({ where: { id: child.id } })).label, 'Supermarket');
});

test('rejects edits to default categories, foreign categories, and invalid category hierarchy', async () => {
  const token = jwt.sign({ userId: ownerId }, testSecret);
  const standard = await prisma.transactionCategory.create({
    data: { label: 'Default root', type: 'EXPENSE', userId: ownerId, isDefault: true },
  });
  const foreign = await prisma.transactionCategory.findFirstOrThrow({ where: { userId: otherUserId } });
  const root = await prisma.transactionCategory.create({
    data: { label: 'Custom root', type: 'EXPENSE', userId: ownerId },
  });
  const mismatchedParent = await prisma.transactionCategory.create({
    data: { label: 'Income root', type: 'INCOME', userId: ownerId },
  });

  const defaultEdit = await patchCategory(token, standard.id, { label: 'Changed', type: 'EXPENSE', parentId: null });
  const foreignEdit = await patchCategory(token, foreign.id, { label: 'Changed', type: 'EXPENSE', parentId: null });
  const invalidParent = await patchCategory(token, root.id, { label: 'Custom root', type: 'EXPENSE', parentId: mismatchedParent.id });
  const unauthenticated = await patchCategory(undefined, root.id, { label: 'Changed', type: 'EXPENSE', parentId: null });

  assert.equal(defaultEdit.response.status, 403);
  assert.equal(foreignEdit.response.status, 404);
  assert.equal(invalidParent.response.status, 400);
  assert.equal(unauthenticated.response.status, 401);
  assert.equal((await prisma.transactionCategory.findUniqueOrThrow({ where: { id: standard.id } })).label, 'Default root');
  assert.equal((await prisma.transactionCategory.findUniqueOrThrow({ where: { id: root.id } })).label, 'Custom root');
});

test('updates a root category type together with its direct subcategories', async () => {
  const token = jwt.sign({ userId: ownerId }, testSecret);
  const root = await prisma.transactionCategory.create({
    data: { label: 'Flexible root', type: 'EXPENSE', userId: ownerId },
  });
  const child = await prisma.transactionCategory.create({
    data: { label: 'Flexible child', type: 'EXPENSE', parentId: root.id, userId: ownerId },
  });

  const { response, data } = await patchCategory(token, root.id, {
    label: root.label,
    type: 'INCOME',
    parentId: null,
  });

  assert.equal(response.status, 200);
  assert.equal((data.category as { type: string }).type, 'INCOME');
  const updatedChild = (data.categories as Array<{ id: number; type: string; parentId: number | null }>).find(category => category.id === child.id);
  assert.ok(updatedChild);
  assert.equal(updatedChild.type, 'INCOME');
  assert.equal(updatedChild.parentId, root.id);
});

test('deletes only an unused custom category owned by the authenticated user', async () => {
  const token = jwt.sign({ userId: ownerId }, testSecret);
  const category = await prisma.transactionCategory.create({
    data: { label: 'Temporary category', type: 'EXPENSE', userId: ownerId },
  });
  const status = await fetch(`${baseUrl}/api/categories/${category.id}/deletion-status`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal((await status.json() as { canDelete: boolean }).canDelete, true);
  const deleted = await fetch(`${baseUrl}/api/categories/${category.id}`, {
    method: 'DELETE', headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(deleted.status, 204);
  assert.equal(await prisma.transactionCategory.findUnique({ where: { id: category.id } }), null);
  const repeat = await fetch(`${baseUrl}/api/categories/${category.id}`, {
    method: 'DELETE', headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(repeat.status, 404);
});

test('blocks deletion when a category has children, transactions, investments, or another owner', async () => {
  const token = jwt.sign({ userId: ownerId }, testSecret);
  const root = await prisma.transactionCategory.create({
    data: { label: 'Linked root', type: 'EXPENSE', userId: ownerId },
  });
  const child = await prisma.transactionCategory.create({
    data: { label: 'Linked child', type: 'EXPENSE', parentId: root.id, userId: ownerId },
  });
  await prisma.transaction.create({
    data: { categoryId: child.id, userId: ownerId, amountCents: 1500, dateTimestamp: 1795000000123n },
  });
  const investmentCategory = await prisma.transactionCategory.create({
    data: { label: 'Linked investment', type: 'INVESTMENT', userId: ownerId },
  });
  await prisma.investment.create({
    data: { categoryId: investmentCategory.id, userId: ownerId, amountCents: 10000, dateTimestamp: 1795000000123n, monthlyRate: 0.01, monthsDuration: 12 },
  });
  const standard = await prisma.transactionCategory.create({
    data: { label: 'Protected for deletion', type: 'EXPENSE', userId: ownerId, isDefault: true },
  });
  const foreign = await prisma.transactionCategory.findFirstOrThrow({ where: { userId: otherUserId } });
  for (const id of [root.id, child.id, investmentCategory.id]) {
    const status = await fetch(`${baseUrl}/api/categories/${id}/deletion-status`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal((await status.json() as { canDelete: boolean }).canDelete, false);
    const deletion = await fetch(`${baseUrl}/api/categories/${id}`, {
      method: 'DELETE', headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(deletion.status, 409);
    assert.ok(await prisma.transactionCategory.findUnique({ where: { id } }));
  }
  const foreignDelete = await fetch(`${baseUrl}/api/categories/${foreign.id}`, {
    method: 'DELETE', headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(foreignDelete.status, 404);
  const standardDelete = await fetch(`${baseUrl}/api/categories/${standard.id}`, {
    method: 'DELETE', headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(standardDelete.status, 403);
  const unauthenticated = await fetch(`${baseUrl}/api/categories/${root.id}`, { method: 'DELETE' });
  assert.equal(unauthenticated.status, 401);
});
