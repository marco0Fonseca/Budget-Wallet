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
const testSecret = 'dashboard-service-test-secret';
let directory: string | undefined;
let prisma: typeof import('../src/repository/repository.ts').prisma;
let server: ReturnType<Express['listen']>;
let baseUrl: string;
let ownerId: string;
let otherId: string;
let salaryId: number;
let foodId: number;
let marketId: number;
type DashboardPayload = {
  totals: { incomeCents: number; expenseCents: number; resultCents: number };
  expenseByCategory: { id: number; label: string; amountCents: number }[];
  recent: { label: string | null; categoryLabel: string }[];
  monthlyTrend: { month: string; incomeCents: number; expenseCents: number; resultCents: number }[];
};

before(async () => {
  directory = mkdtempSync(join(tmpdir(), 'budget-wallet-dashboard-service-test-'));
  const databasePath = join(directory, 'test.db');
  const db = new DatabaseSync(databasePath);
  try {
    const migrations = new URL('../prisma/migrations/', import.meta.url);
    for (const entry of readdirSync(migrations, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory()) db.exec(readFileSync(new URL(`${entry.name}/migration.sql`, migrations), 'utf8'));
    }
  } finally { db.close(); }
  process.env.DATABASE_URL = `file:${databasePath}`;
  process.env.JWT_SECRET = testSecret;
  const { registerDashboardRoutes } = await import('../src/server/services/dashboardService.ts');
  prisma = (await import('../src/repository/repository.ts')).prisma;
  const owner = await prisma.user.create({ data: { name: 'Owner', email: 'dashboard.owner@example.com', username: 'dashboard.owner', passwordHash: 'test-hash', createdAtTimestamp: 1790000000000n } });
  const other = await prisma.user.create({ data: { name: 'Other', email: 'dashboard.other@example.com', username: 'dashboard.other', passwordHash: 'test-hash', createdAtTimestamp: 1790000000000n } });
  ownerId = owner.id;
  otherId = other.id;
  const salary = await prisma.transactionCategory.create({ data: { label: 'Salary', type: 'INCOME', userId: ownerId } });
  const food = await prisma.transactionCategory.create({ data: { label: 'Food', type: 'EXPENSE', userId: ownerId } });
  const market = await prisma.transactionCategory.create({ data: { label: 'Market', type: 'EXPENSE', parentId: food.id, userId: ownerId } });
  salaryId = salary.id;
  foodId = food.id;
  marketId = market.id;

  const app = express();
  registerDashboardRoutes(app);
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

function dashboard(month: string, userId?: string) {
  return fetch(`${baseUrl}/api/dashboard?month=${encodeURIComponent(month)}`, {
    headers: userId ? { authorization: `Bearer ${jwt.sign({ userId }, testSecret)}` } : {},
  });
}

test('returns zero totals and an empty chart for a month without transactions', async () => {
  const response = await dashboard('2026-09', ownerId);
  assert.equal(response.status, 200);
  const data = await response.json() as DashboardPayload;
  assert.deepEqual(data.totals, { incomeCents: 0, expenseCents: 0, resultCents: 0 });
  assert.deepEqual(data.expenseByCategory, []);
  assert.deepEqual(data.recent, []);
  assert.deepEqual(data.monthlyTrend.map((item: { month: string }) => item.month), ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
});

test('groups direct and child expenses by root and respects Sao Paulo month boundaries', async () => {
  await prisma.transaction.createMany({ data: [
    { userId: ownerId, categoryId: salaryId, amountCents: 10000, dateTimestamp: BigInt(Date.parse('2026-11-01T03:00:00Z')), label: 'Monthly pay' },
    { userId: ownerId, categoryId: marketId, amountCents: 2500, dateTimestamp: BigInt(Date.parse('2026-11-15T15:00:00Z')) },
    { userId: ownerId, categoryId: foodId, amountCents: 1000, dateTimestamp: BigInt(Date.parse('2026-11-20T15:00:00Z')) },
    { userId: ownerId, categoryId: salaryId, amountCents: 2000, dateTimestamp: BigInt(Date.parse('2026-11-30T23:59:00Z')) },
    { userId: ownerId, categoryId: foodId, amountCents: 700, dateTimestamp: BigInt(Date.parse('2026-11-01T02:59:59Z')) },
    { userId: ownerId, categoryId: foodId, amountCents: 9000, dateTimestamp: BigInt(Date.parse('2026-12-01T03:00:00Z')) },
  ] });
  const foreignCategory = await prisma.transactionCategory.create({ data: { label: 'Other expense', type: 'EXPENSE', userId: otherId } });
  await prisma.transaction.create({ data: { userId: otherId, categoryId: foreignCategory.id, amountCents: 8000, dateTimestamp: BigInt(Date.parse('2026-11-15T15:00:00Z')) } });

  const response = await dashboard('2026-11', ownerId);
  assert.equal(response.status, 200);
  const data = await response.json() as DashboardPayload;
  assert.deepEqual(data.totals, { incomeCents: 12000, expenseCents: 3500, resultCents: 8500 });
  assert.deepEqual(data.expenseByCategory, [{ id: foodId, label: 'Food', amountCents: 3500 }]);
  assert.equal(data.recent.length, 4);
  const latest = data.recent[0];
  const oldest = data.recent.at(-1);
  assert.ok(latest && oldest);
  assert.equal(latest.label, null);
  assert.equal(latest.categoryLabel, 'Salary');
  assert.equal(oldest.label, 'Monthly pay');
  assert.deepEqual(data.monthlyTrend.at(-1), { month: '2026-11', incomeCents: 12000, expenseCents: 3500, resultCents: 8500 });
  const october = data.monthlyTrend.at(-2);
  assert.ok(october);
  assert.equal(october.expenseCents, 700);
  assert.deepEqual((await (await dashboard('2026-11', otherId)).json() as DashboardPayload).totals, { incomeCents: 0, expenseCents: 8000, resultCents: -8000 });
  assert.deepEqual((await (await dashboard('2026-12', ownerId)).json() as DashboardPayload).totals, { incomeCents: 0, expenseCents: 9000, resultCents: -9000 });
});

test('rejects missing authentication and invalid months', async () => {
  assert.equal((await dashboard('2026-11')).status, 401);
  for (const month of ['2026-00', '2026-13', '2026-1', 'abc', '0099-12']) {
    assert.equal((await dashboard(month, ownerId)).status, 400, month);
  }
});
