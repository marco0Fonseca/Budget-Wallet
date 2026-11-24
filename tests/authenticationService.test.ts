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

async function post(path: '/api/auth/signup' | '/api/auth/signin' | '/api/auth/recover', body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, data: await response.json() as Record<string, unknown> };
}

const validSignup = {
  name: 'Test User', email: 'auth@example.com', username: 'auth.user',
  password: 'secret-password', confirmPassword: 'secret-password',
};

test('creates a user, stores a password hash, and adds default categories without returning a token', async () => {
  const { response, data } = await post('/api/auth/signup', validSignup);

  assert.equal(response.status, 201);
  assert.equal(data.message, 'User created successfully');
  assert.deepStrictEqual(data.user && Object.keys(data.user as object).sort(), ['email', 'id', 'name']);
  assert.equal('passwordHash' in (data.user as object), false);
  assert.equal('token' in data, false);

  const userId = (data.user as { id: string }).id;
  const saved = await prisma.user.findUnique({ where: { email: validSignup.email } });
  assert.ok(saved);
  assert.notEqual(saved.passwordHash, validSignup.password);
  assert.equal(await prisma.transactionCategory.count({ where: { userId, isDefault: true } }), 21);
});

test('rejects invalid signup fields and mismatched passwords without creating users', async () => {
  const invalidRequests = [
    { ...validSignup, name: ' ', email: 'empty-name@example.com', username: 'empty.name' },
    { ...validSignup, email: 'invalid-email', username: 'invalid.email' },
    { ...validSignup, email: 'uppercase@example.com', username: 'Uppercase' },
    { ...validSignup, email: 'missing-password@example.com', username: 'missing.password', password: '' },
    { ...validSignup, email: 'mismatch@example.com', username: 'mismatch.user', confirmPassword: 'different-password' },
  ];

  for (const payload of invalidRequests) {
    const { response } = await post('/api/auth/signup', payload);
    assert.equal(response.status, 400, `Expected invalid signup to be rejected for ${payload.email}`);
    assert.equal(await prisma.user.findUnique({ where: { email: payload.email } }), null);
  }
});

test('rejects duplicate emails and usernames with conflict status', async () => {
  const duplicateEmail = await post('/api/auth/signup', {
    ...validSignup, name: 'Another User', username: 'other.email',
  });
  assert.equal(duplicateEmail.response.status, 409);

  const duplicateUsername = await post('/api/auth/signup', {
    ...validSignup, name: 'Another User', email: 'other@example.com',
  });
  assert.equal(duplicateUsername.response.status, 409);
});

test('signs in with an email or username and returns a valid JWT without exposing the password hash', async () => {
  for (const identifier of [validSignup.email, validSignup.username]) {
    const { response, data } = await post('/api/auth/signin', { identifier, password: validSignup.password });
    assert.equal(response.status, 200);
    assert.equal(typeof data.token, 'string');
    assert.deepStrictEqual(data.user && Object.keys(data.user as object).sort(), ['email', 'id', 'name', 'username']);
    assert.equal('passwordHash' in (data.user as object), false);
    const payload = jwt.verify(data.token as string, testSecret);
    assert.equal(typeof payload === 'object' && payload.userId, (data.user as { id: string }).id);
  }
});

test('rejects missing or invalid signin credentials with appropriate status codes', async () => {
  const missingIdentifier = await post('/api/auth/signin', { password: validSignup.password });
  assert.equal(missingIdentifier.response.status, 400);

  const missingPassword = await post('/api/auth/signin', { identifier: validSignup.email });
  assert.equal(missingPassword.response.status, 400);

  for (const identifier of [validSignup.email, 'unknown.user']) {
    const { response, data } = await post('/api/auth/signin', { identifier, password: 'incorrect-password' });
    assert.equal(response.status, 401);
    assert.equal(data.error, 'E-mail/username ou senha inválidos.');
  }
});

test('recovers a password by email or username and accepts the replacement on signin', async () => {
  const replacements = [
    { identifier: validSignup.username, newPassword: 'username-reset-password' },
    { identifier: validSignup.email, newPassword: 'email-reset-password' },
  ];

  for (const { identifier, newPassword } of replacements) {
    const { response, data } = await post('/api/auth/recover', {
      identifier, newPassword, confirmPassword: newPassword,
    });
    assert.equal(response.status, 200);
    assert.equal(data.message, 'Senha redefinida com sucesso.');
    assert.equal('passwordHash' in data, false);

    const login = await post('/api/auth/signin', { identifier, password: newPassword });
    assert.equal(login.response.status, 200);
    assert.equal(typeof login.data.token, 'string');
  }

  const oldPassword = await post('/api/auth/signin', {
    identifier: validSignup.email, password: validSignup.password,
  });
  assert.equal(oldPassword.response.status, 401);
});

test('rejects invalid password recovery requests without changing the password', async () => {
  const recoveryUser = {
    ...validSignup,
    email: 'recovery-invalid@example.com',
    username: 'recovery.invalid',
  };
  const createdUser = await post('/api/auth/signup', recoveryUser);
  assert.equal(createdUser.response.status, 201);

  const invalidRequests = [
    { identifier: '', newPassword: 'new-password', confirmPassword: 'new-password', status: 400 },
    { identifier: recoveryUser.email, newPassword: '', confirmPassword: '', status: 400 },
    { identifier: recoveryUser.email, newPassword: 'new-password', confirmPassword: 'different-password', status: 400 },
    { identifier: 'unknown.user', newPassword: 'new-password', confirmPassword: 'new-password', status: 404 },
  ];

  for (const { status, ...payload } of invalidRequests) {
    const { response } = await post('/api/auth/recover', payload);
    assert.equal(response.status, status);
  }

  const originalPassword = await post('/api/auth/signin', {
    identifier: recoveryUser.email, password: recoveryUser.password,
  });
  assert.equal(originalPassword.response.status, 200);
});
