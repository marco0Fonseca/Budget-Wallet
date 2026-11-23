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
const testSecret = 'authentication-service-test-secret';
let directory: string | undefined;
let app: Express;
let prisma: typeof import('../src/repository/repository.ts').prisma;
let server: ReturnType<Express['listen']>;
let baseUrl: string;

before(async () => {
  directory = mkdtempSync(join(tmpdir(), 'budget-wallet-auth-test-'));
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
  const { registerAuthenticationRoutes } = await import('../src/server/services/autheticationService.ts');
  prisma = (await import('../src/repository/repository.ts')).prisma;
  app = express();
  app.use(express.json());
  registerAuthenticationRoutes(app);
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

async function signup(body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, data: await response.json() as Record<string, unknown> };
}

test('creates a user, stores only the password hash, and returns a verifiable JWT', async () => {
  const { response, data } = await signup({
    name: 'Test User', email: 'auth@example.com', username: 'auth.user',
    password: 'secret-password', confirmPassword: 'secret-password',
  });

  assert.equal(response.status, 201);
  assert.equal(typeof data.token, 'string');
  assert.deepStrictEqual(data.user && Object.keys(data.user as object).sort(), ['email', 'id', 'name']);
  assert.equal('passwordHash' in (data.user as object), false);
  const payload = jwt.verify(data.token as string, testSecret);
  assert.equal(typeof payload === 'object' && payload.userId, (data.user as { id: string }).id);

  const saved = await prisma.user.findUnique({ where: { email: 'auth@example.com' } });
  assert.ok(saved);
  assert.notEqual(saved.passwordHash, 'secret-password');
});

test('rejects invalid profile data and mismatched passwords without creating a user', async () => {
  const invalidProfile = await signup({
    name: ' ', email: 'invalid@example.com', username: 'invalid.user',
    password: 'secret-password', confirmPassword: 'secret-password',
  });
  assert.equal(invalidProfile.response.status, 400);

  const mismatch = await signup({
    name: 'Test User', email: 'mismatch@example.com', username: 'mismatch.user',
    password: 'secret-password', confirmPassword: 'different-password',
  });
  assert.equal(mismatch.response.status, 400);
  assert.equal(await prisma.user.findUnique({ where: { email: 'mismatch@example.com' } }), null);
});

test('rejects duplicate emails and usernames with conflict status', async () => {
  const duplicateEmail = await signup({
    name: 'Another User', email: 'auth@example.com', username: 'other.email',
    password: 'secret-password', confirmPassword: 'secret-password',
  });
  assert.equal(duplicateEmail.response.status, 409);

  const duplicateUsername = await signup({
    name: 'Another User', email: 'other@example.com', username: 'auth.user',
    password: 'secret-password', confirmPassword: 'secret-password',
  });
  assert.equal(duplicateUsername.response.status, 409);
});
