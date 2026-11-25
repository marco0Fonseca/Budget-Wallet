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
const testSecret = 'investments-service-test-secret';
let directory: string | undefined;
let prisma: typeof import('../src/repository/repository.ts').prisma;
let server: ReturnType<Express['listen']>;
let baseUrl: string;
let ownerId: string;
let otherId: string;
let investmentCategoryId: number;
let otherCategoryId: number;
let incomeCategoryId: number;

before(async () => {
  directory = mkdtempSync(join(tmpdir(), 'budget-wallet-investments-service-test-'));
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
  const { registerInvestmentsRoutes } = await import('../src/server/services/investmentsService.ts');
  prisma = (await import('../src/repository/repository.ts')).prisma;
  const owner = await prisma.user.create({ data: { name: 'Owner', email: 'investment.owner@example.com', username: 'investment.owner', passwordHash: 'test-hash', createdAtTimestamp: 1790000000000n } });
  const other = await prisma.user.create({ data: { name: 'Other', email: 'investment.other@example.com', username: 'investment.other', passwordHash: 'test-hash', createdAtTimestamp: 1790000000000n } });
  ownerId = owner.id;
  otherId = other.id;
  investmentCategoryId = (await prisma.transactionCategory.create({ data: { label: 'CDI', type: 'INVESTMENT', userId: ownerId } })).id;
  otherCategoryId = (await prisma.transactionCategory.create({ data: { label: 'Other CDI', type: 'INVESTMENT', userId: otherId } })).id;
  incomeCategoryId = (await prisma.transactionCategory.create({ data: { label: 'Salary', type: 'INCOME', userId: ownerId } })).id;

  const app = express();
  app.use(express.json());
  registerInvestmentsRoutes(app);
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

async function postInvestment(userId: string | undefined, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/investments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(userId ? { authorization: `Bearer ${jwt.sign({ userId }, testSecret)}` } : {}) },
    body: JSON.stringify(body),
  });
  return { response, data: await response.json() as { investment?: { id: number; category: { id: number; label: string; type: string; parentId: number | null }; amountCents: number; dateTimestamp: number; monthlyRate: number; monthsDuration: number; description: string | null }; error?: string } };
}

async function getInvestments(userId?: string) {
  const response = await fetch(`${baseUrl}/api/investments`, {
    headers: userId ? { authorization: `Bearer ${jwt.sign({ userId }, testSecret)}` } : {},
  });
  return { response, data: await response.json() as { investments?: { id: number; category: { id: number; type: string }; amountCents: number; dateTimestamp: number; monthlyRate: number; monthsDuration: number; description: string | null }[]; error?: string } };
}

test('creates an investment with exact cents for the authenticated owner', async () => {
  const dateTimestamp = Date.parse('2026-11-25T12:00:00.000Z');
  const { response, data } = await postInvestment(ownerId, {
    categoryId: investmentCategoryId, amountCents: 12345, dateTimestamp,
    monthlyRate: 0.01, monthsDuration: 12, description: '  Emergency reserve  ', userId: otherId,
  });
  assert.equal(response.status, 201, data.error);
  assert.ok(data.investment?.id && data.investment.id > 0);
  assert.deepEqual(data.investment.category, { id: investmentCategoryId, label: 'CDI', type: 'INVESTMENT', parentId: null });
  assert.equal(data.investment.amountCents, 12345);
  assert.equal(data.investment.dateTimestamp, dateTimestamp);
  assert.equal(data.investment.monthlyRate, 0.01);
  assert.equal(data.investment.monthsDuration, 12);
  assert.equal(data.investment.description, 'Emergency reserve');
  const stored = await prisma.investment.findUniqueOrThrow({ where: { id: data.investment.id } });
  assert.equal(stored.userId, ownerId);
  assert.equal(stored.amountCents, 12345);
  assert.equal(stored.dateTimestamp, BigInt(dateTimestamp));
  assert.equal(await prisma.investment.count({ where: { userId: otherId } }), 0);
});

test('lists only the authenticated user investments and returns an empty list for another user', async () => {
  const emptyUser = await prisma.user.create({ data: { name: 'Empty', email: 'investment.empty@example.com', username: 'investment.empty', passwordHash: 'test-hash', createdAtTimestamp: 1790000000000n } });
  const ownerRecord = await prisma.investment.create({ data: {
    categoryId: investmentCategoryId, userId: ownerId, amountCents: 4321,
    dateTimestamp: 1795000000123n, monthlyRate: 0, monthsDuration: 6,
  } });
  const otherRecord = await prisma.investment.create({ data: {
    categoryId: otherCategoryId, userId: otherId, amountCents: 9999,
    dateTimestamp: 1795000000123n, monthlyRate: 0, monthsDuration: 6,
  } });
  const owner = await getInvestments(ownerId);
  assert.equal(owner.response.status, 200);
  assert.ok(owner.data.investments?.some(item => item.id === ownerRecord.id && item.amountCents === 4321));
  assert.equal(owner.data.investments?.some(item => item.id === otherRecord.id), false);
  assert.deepEqual(owner.data.investments?.map(item => item.id), [...owner.data.investments.map(item => item.id)].sort((a, b) => a - b));
  const other = await getInvestments(otherId);
  assert.equal(other.response.status, 200);
  assert.deepEqual(other.data.investments?.map(item => item.id), [otherRecord.id]);
  assert.deepEqual((await getInvestments(emptyUser.id)).data.investments, []);
  assert.equal((await getInvestments()).response.status, 401);
});

test('rejects unauthenticated requests and foreign or incompatible categories', async () => {
  const base = { categoryId: investmentCategoryId, amountCents: 10000, dateTimestamp: Date.now(), monthlyRate: 0, monthsDuration: 12 };
  const count = await prisma.investment.count();
  assert.equal((await postInvestment(undefined, base)).response.status, 401);
  for (const categoryId of [otherCategoryId, incomeCategoryId, -1, 999999]) {
    const { response } = await postInvestment(ownerId, { ...base, categoryId });
    assert.equal(response.status, 400, String(categoryId));
  }
  assert.equal(await prisma.investment.count(), count);
});

test('rejects invalid investment fields without writing records', async () => {
  const base = { categoryId: investmentCategoryId, amountCents: 10000, dateTimestamp: Date.now(), monthlyRate: 0.01, monthsDuration: 12 };
  const count = await prisma.investment.count();
  for (const change of [
    { amountCents: 0 }, { amountCents: 1.5 }, { amountCents: 2_147_483_648 },
    { dateTimestamp: '2026-11-25' }, { dateTimestamp: Number.MAX_SAFE_INTEGER },
    { monthlyRate: -1 }, { monthlyRate: '0.01' },
    { monthsDuration: 0 }, { monthsDuration: 1.5 }, { monthsDuration: 2_147_483_648 },
    { description: 42 },
  ]) {
    const { response } = await postInvestment(ownerId, { ...base, ...change });
    assert.equal(response.status, 400, JSON.stringify(change));
  }
  assert.equal(await prisma.investment.count(), count);
});
