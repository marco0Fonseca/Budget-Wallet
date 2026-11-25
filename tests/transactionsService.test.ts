import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import express, { type ErrorRequestHandler, type Express } from 'express';
import jwt from 'jsonwebtoken';
import { after, before, test } from 'node:test';

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalJwtSecret = process.env.JWT_SECRET;
const testSecret = 'transactions-service-test-secret';
let directory: string | undefined;
let prisma: typeof import('../src/repository/repository.ts').prisma;
let server: ReturnType<Express['listen']>;
let baseUrl: string;
let ownerId: string;
let otherId: string;
let salaryId: number;
let foodId: number;
let privateId: number;

before(async () => {
  directory = mkdtempSync(join(tmpdir(), 'budget-wallet-transactions-test-'));
  const databasePath = join(directory, 'test.db');
  const db = new DatabaseSync(databasePath);
  try {
    const migrations = new URL('../prisma/migrations/', import.meta.url);
    for (const entry of readdirSync(migrations, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory()) db.exec(readFileSync(new URL(`${entry.name}/migration.sql`, migrations), 'utf8'));
    }
  } finally {
    db.close();
  }
  process.env.DATABASE_URL = `file:${databasePath}`;
  process.env.JWT_SECRET = testSecret;
  const { registerTransactionsRoutes } = await import('../src/server/services/transactionsService.ts');
  prisma = (await import('../src/repository/repository.ts')).prisma;
  const owner = await prisma.user.create({ data: { name: 'Owner', email: 'tx.owner@example.com', username: 'tx.owner', passwordHash: 'test-hash', createdAtTimestamp: 1790000000000n } });
  const other = await prisma.user.create({ data: { name: 'Other', email: 'tx.other@example.com', username: 'tx.other', passwordHash: 'test-hash', createdAtTimestamp: 1790000000000n } });
  ownerId = owner.id;
  otherId = other.id;
  salaryId = (await prisma.transactionCategory.create({ data: { label: 'Salary', type: 'INCOME', userId: ownerId } })).id;
  foodId = (await prisma.transactionCategory.create({ data: { label: 'Food', type: 'EXPENSE', userId: ownerId } })).id;
  privateId = (await prisma.transactionCategory.create({ data: { label: 'Private', type: 'EXPENSE', userId: otherId } })).id;
  await prisma.transaction.createMany({ data: [
    { categoryId: foodId, userId: ownerId, amountCents: 999, dateTimestamp: BigInt(Date.parse('2026-11-01T02:59:59.999Z')) },
    { categoryId: salaryId, userId: ownerId, amountCents: 5000, dateTimestamp: BigInt(Date.parse('2026-11-01T03:00:00.000Z')) },
    { categoryId: foodId, userId: ownerId, amountCents: 1250, dateTimestamp: BigInt(Date.parse('2026-11-15T12:00:00.000Z')), label: 'Restaurant', description: 'Lunch' },
    { categoryId: foodId, userId: ownerId, amountCents: 700, dateTimestamp: BigInt(Date.parse('2026-12-01T02:59:59.999Z')) },
    { categoryId: foodId, userId: ownerId, amountCents: 800, dateTimestamp: BigInt(Date.parse('2026-12-01T03:00:00.000Z')) },
    { categoryId: privateId, userId: otherId, amountCents: 3333, dateTimestamp: BigInt(Date.parse('2026-11-15T12:00:00.000Z')) },
  ] });
  const app = express();
  app.use(express.json());
  registerTransactionsRoutes(app);
  const errors: ErrorRequestHandler = (_error, _req, res, _next) => { res.status(500).json({ error: 'Internal error.' }); };
  app.use(errors);
  server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (prisma) await prisma.$disconnect();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
  if (directory) {
    for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(join(directory, `test.db${suffix}`), { force: true });
    rmdirSync(directory);
  }
});

async function getTransactions(userId?: string, query = '') {
  const response = await fetch(`${baseUrl}/api/transactions${query}`, { headers: userId ? { authorization: `Bearer ${jwt.sign({ userId }, testSecret)}` } : {} });
  return { response, data: await response.json() as { transactions?: { id: number; amountCents: number; dateTimestamp: number; label: string | null; description: string | null; category: { id: number; type: string; label: string } }[]; totals?: { incomeCents: number; expenseCents: number; resultCents: number }; error?: string } };
}

async function postTransaction(userId: string | undefined, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/transactions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(userId ? { authorization: `Bearer ${jwt.sign({ userId }, testSecret)}` } : {}) },
    body: JSON.stringify(body),
  });
  return { response, data: await response.json() as { transaction?: { id: number; amountCents: number; dateTimestamp: number; label: string | null; description: string | null; category: { id: number; type: string } }; error?: string } };
}

async function patchTransaction(userId: string | undefined, id: number | string, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...(userId ? { authorization: `Bearer ${jwt.sign({ userId }, testSecret)}` } : {}) },
    body: JSON.stringify(body),
  });
  return { response, data: await response.json() as { transaction?: { id: number; category: { id: number; type: string }; amountCents: number; dateTimestamp: number; label: string | null; description: string | null }; error?: string } };
}

async function deleteTransaction(userId: string | undefined, id: number | string) {
  return fetch(`${baseUrl}/api/transactions/${id}`, {
    method: 'DELETE',
    headers: userId ? { authorization: `Bearer ${jwt.sign({ userId }, testSecret)}` } : {},
  });
}

test('lists only the authenticated user’s transactions within São Paulo month boundaries', async () => {
  const { response, data } = await getTransactions(ownerId, '?month=2026-11');
  assert.equal(response.status, 200);
  assert.deepEqual(data.transactions?.map(item => item.amountCents), [700, 1250, 5000]);
  assert.deepEqual(data.totals, { incomeCents: 5000, expenseCents: 1950, resultCents: 3050 });
  assert.equal(data.transactions?.[1]?.category.label, 'Food');
  assert.equal(data.transactions?.[1]?.label, 'Restaurant');
  assert.equal(data.transactions?.[1]?.description, 'Lunch');
  assert.equal(data.transactions?.[0]?.label, null);
});

test('supports all time, empty months, and negative results without exposing another user', async () => {
  const all = await getTransactions(ownerId);
  assert.equal(all.response.status, 200);
  assert.deepEqual(all.data.transactions?.map(item => item.amountCents), [800, 700, 1250, 5000, 999]);
  assert.deepEqual(all.data.totals, { incomeCents: 5000, expenseCents: 3749, resultCents: 1251 });
  const december = await getTransactions(ownerId, '?month=2026-12');
  assert.deepEqual(december.data.totals, { incomeCents: 0, expenseCents: 800, resultCents: -800 });
  const january = await getTransactions(ownerId, '?month=2027-01');
  assert.deepEqual(january.data.transactions, []);
  assert.deepEqual(january.data.totals, { incomeCents: 0, expenseCents: 0, resultCents: 0 });
  const other = await getTransactions(otherId, '?month=2026-11');
  assert.deepEqual(other.data.transactions?.map(item => item.amountCents), [3333]);
});

test('requires a valid session and month', async () => {
  assert.equal((await getTransactions()).response.status, 401);
  assert.equal((await getTransactions(ownerId, '?month=2026-13')).response.status, 400);
  assert.equal((await getTransactions(ownerId, '?month=0000-01')).response.status, 400);
  assert.equal((await getTransactions(ownerId, '?month=2026-11&month=2026-12')).response.status, 400);
});

test('creates an exact-cent transaction for the authenticated owner and lists it', async () => {
  const dateTimestamp = Date.parse('2026-11-24T15:00:00.000Z');
  const { response, data } = await postTransaction(ownerId, {
    type: 'EXPENSE', categoryId: foodId, amountCents: 12345, dateTimestamp,
    label: '  Weekly market  ', description: '  Groceries  ', userId: otherId,
  });
  assert.equal(response.status, 201, data.error);
  assert.ok(data.transaction?.id && data.transaction.id > 0);
  assert.equal(data.transaction.category.id, foodId);
  assert.equal(data.transaction.amountCents, 12345);
  assert.equal(data.transaction.dateTimestamp, dateTimestamp);
  assert.equal(data.transaction.label, 'Weekly market');
  assert.equal(data.transaction.description, 'Groceries');
  const owner = await getTransactions(ownerId, '?month=2026-11');
  assert.equal(owner.data.transactions?.find(item => item.amountCents === 12345)?.label, 'Weekly market');
  assert.equal(owner.data.transactions?.find(item => item.amountCents === 12345)?.description, 'Groceries');
  assert.deepEqual(owner.data.totals, { incomeCents: 5000, expenseCents: 14295, resultCents: -9295 });
  const other = await getTransactions(otherId, '?month=2026-11');
  assert.equal(other.data.transactions?.some(item => item.amountCents === 12345), false);
});

test('rejects invalid transaction fields and categories without writing records', async () => {
  const base = { type: 'EXPENSE', categoryId: foodId, amountCents: 1, dateTimestamp: Date.parse('2026-11-24T15:00:00.000Z') };
  const originalCount = await prisma.transaction.count();
  for (const change of [
    { type: 'INVESTMENT' },
    { type: 'INCOME' },
    { categoryId: salaryId },
    { categoryId: privateId },
    { categoryId: -1 },
    { amountCents: 0 },
    { amountCents: 12.5 },
    { amountCents: 2_147_483_648 },
    { dateTimestamp: '2026-11-24' },
    { dateTimestamp: Number.MAX_SAFE_INTEGER },
    { description: 123 },
    { label: 123 },
  ]) {
    const { response } = await postTransaction(ownerId, { ...base, ...change });
    assert.equal(response.status, 400, JSON.stringify(change));
  }
  assert.equal((await postTransaction(undefined, base)).response.status, 401);
  assert.equal(await prisma.transaction.count(), originalCount);
});

test('edits a transaction, preserves omitted fields, and refreshes the affected monthly totals', async () => {
  const november = await getTransactions(ownerId, '?month=2026-11');
  const target = november.data.transactions?.find(item => item.amountCents === 1250);
  assert.ok(target);
  assert.ok(november.data.totals);
  const decemberBefore = await getTransactions(ownerId, '?month=2026-12');
  assert.ok(decemberBefore.data.totals);

  const partial = await patchTransaction(ownerId, target.id, { label: '  Updated lunch  ' });
  assert.equal(partial.response.status, 200, partial.data.error);
  assert.equal(partial.data.transaction?.label, 'Updated lunch');
  assert.equal(partial.data.transaction?.description, 'Lunch');
  assert.equal(partial.data.transaction?.amountCents, 1250);
  assert.equal(partial.data.transaction?.dateTimestamp, target.dateTimestamp);

  const movedDate = Date.parse('2026-12-04T15:00:00.000Z');
  const edited = await patchTransaction(ownerId, target.id, {
    type: 'INCOME', categoryId: salaryId, amountCents: 2400, dateTimestamp: movedDate,
    label: null, description: '  Corrected income  ', userId: otherId,
  });
  assert.equal(edited.response.status, 200, edited.data.error);
  assert.equal(edited.data.transaction?.category.id, salaryId);
  assert.equal(edited.data.transaction?.amountCents, 2400);
  assert.equal(edited.data.transaction?.dateTimestamp, movedDate);
  assert.equal(edited.data.transaction?.label, null);
  assert.equal(edited.data.transaction?.description, 'Corrected income');

  const novemberAfter = await getTransactions(ownerId, '?month=2026-11');
  assert.equal(novemberAfter.data.transactions?.some(item => item.id === target.id), false);
  assert.equal(novemberAfter.data.totals?.expenseCents, november.data.totals.expenseCents - 1250);
  assert.equal(novemberAfter.data.totals?.resultCents, november.data.totals.resultCents + 1250);
  const decemberAfter = await getTransactions(ownerId, '?month=2026-12');
  assert.equal(decemberAfter.data.transactions?.find(item => item.id === target.id)?.description, 'Corrected income');
  assert.equal(decemberAfter.data.totals?.incomeCents, decemberBefore.data.totals.incomeCents + 2400);
  assert.equal((await getTransactions(otherId)).data.transactions?.some(item => item.id === target.id), false);
});

test('rejects invalid edits and access to another user’s transaction without changing it', async () => {
  const target = (await getTransactions(ownerId)).data.transactions?.find(item => item.amountCents === 5000);
  assert.ok(target);
  const original = await prisma.transaction.findUniqueOrThrow({ where: { id: target.id } });
  assert.equal((await patchTransaction(undefined, target.id, { label: 'Unauthorized' })).response.status, 401);
  assert.equal((await patchTransaction(otherId, target.id, { label: 'Foreign' })).response.status, 404);
  assert.equal((await patchTransaction(ownerId, 'invalid', { label: 'Invalid' })).response.status, 400);
  assert.equal((await patchTransaction(ownerId, `${target.id}.0`, { label: 'Invalid' })).response.status, 400);
  assert.equal((await patchTransaction(ownerId, 2147483647, { label: 'Missing' })).response.status, 404);

  for (const change of [
    {}, { type: 'INVESTMENT' }, { type: 'EXPENSE' }, { categoryId: privateId },
    { categoryId: -1 }, { amountCents: 0 }, { amountCents: 1.5 },
    { dateTimestamp: '2026-11-24' }, { label: 123 }, { description: 123 },
  ]) {
    const response = await patchTransaction(ownerId, target.id, change);
    assert.equal(response.response.status, 400, JSON.stringify(change));
  }
  assert.deepStrictEqual(await prisma.transaction.findUniqueOrThrow({ where: { id: target.id } }), original);
});

test('deletes only the authenticated user’s transaction and refreshes totals', async () => {
  const created = await postTransaction(ownerId, {
    type: 'EXPENSE', categoryId: foodId, amountCents: 4567,
    dateTimestamp: Date.parse('2026-11-25T15:00:00.000Z'), label: 'Delete test',
  });
  assert.equal(created.response.status, 201);
  const id = created.data.transaction?.id;
  assert.ok(id);
  const before = await getTransactions(ownerId, '?month=2026-11');
  assert.ok(before.data.totals);
  const otherBefore = await getTransactions(otherId, '?month=2026-11');

  assert.equal((await deleteTransaction(undefined, id)).status, 401);
  assert.equal((await deleteTransaction(otherId, id)).status, 404);
  assert.equal((await deleteTransaction(ownerId, 'invalid')).status, 400);
  assert.equal((await deleteTransaction(ownerId, `${id}.0`)).status, 400);
  assert.ok(await prisma.transaction.findUnique({ where: { id } }));

  const deleted = await deleteTransaction(ownerId, id);
  assert.equal(deleted.status, 204);
  assert.equal(await deleted.text(), '');
  assert.equal(await prisma.transaction.findUnique({ where: { id } }), null);
  assert.equal((await deleteTransaction(ownerId, id)).status, 404);
  const after = await getTransactions(ownerId, '?month=2026-11');
  assert.equal(after.data.transactions?.some(item => item.id === id), false);
  assert.equal(after.data.totals?.expenseCents, before.data.totals.expenseCents - 4567);
  assert.equal(after.data.totals?.resultCents, before.data.totals.resultCents + 4567);
  assert.deepEqual((await getTransactions(otherId, '?month=2026-11')).data, otherBefore.data);
});
