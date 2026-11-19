import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { TestContext } from 'node:test';

const migration = readFileSync(
  new URL('../prisma/migrations/20261118000000_init/migration.sql', import.meta.url),
  'utf8',
);
const timestamp = 1_795_000_000_123;

function migratedDatabase(t: TestContext): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(migration);
  const insertUser = db.prepare('INSERT INTO User (id, name, email, username, createdAtTimestamp) VALUES (?, ?, ?, ?, ?)');
  insertUser.run('user-a', 'Alice', 'alice@example.com', 'alice', timestamp);
  insertUser.run('user-b', 'Bob', 'bob@example.com', 'bob', timestamp);
  db.prepare('INSERT INTO TransactionCategory (label, type, userId) VALUES (?, ?, ?)').run('Alimentação', 'EXPENSE', 'user-a');
  return db;
}

test('initial migration creates all entities and preserves timestamps and cents', (t) => {
  const db = migratedDatabase(t);
  const categoryId = db.prepare('SELECT id FROM TransactionCategory').get()?.['id'];
  assert.equal(categoryId, 1);
  db.prepare('INSERT INTO "Transaction" (categoryId, amountCents, dateTimestamp, userId) VALUES (?, ?, ?, ?)')
    .run(1, 1550, timestamp, 'user-a');
  const transaction = db.prepare('SELECT id, amountCents, dateTimestamp, description FROM "Transaction"').get();
  assert.equal(transaction?.['id'], 1);
  assert.equal(transaction?.['amountCents'], 1550);
  assert.equal(transaction?.['dateTimestamp'], timestamp);
  assert.equal(transaction?.['description'], null);
  assert.equal(db.prepare('SELECT createdAtTimestamp FROM User WHERE id = ?').get('user-a')?.['createdAtTimestamp'], timestamp);
  db.prepare('INSERT INTO TransactionCategory (label, type, userId) VALUES (?, ?, ?)').run('Investimentos', 'INVESTMENT', 'user-a');
  db.prepare('INSERT INTO Investment (categoryId, amountCents, dateTimestamp, monthlyRate, monthsDuration, userId) VALUES (?, ?, ?, ?, ?, ?)')
    .run(2, 10000, timestamp, 0.01, 12, 'user-a');
  assert.equal(db.prepare('SELECT monthlyRate FROM Investment').get()?.['monthlyRate'], 0.01);
});

test('migration rejects duplicate email and username values', (t) => {
  const db = migratedDatabase(t);
  const insert = db.prepare('INSERT INTO User (id, name, email, username, createdAtTimestamp) VALUES (?, ?, ?, ?, ?)');
  assert.throws(() => insert.run('user-c', 'Other', 'alice@example.com', 'other', timestamp), /UNIQUE constraint/);
  assert.throws(() => insert.run('user-c', 'Other', 'other@example.com', 'alice', timestamp), /UNIQUE constraint/);
});

test('migration prevents transactions and investments from using another owners category', (t) => {
  const db = migratedDatabase(t);
  assert.throws(
    () => db.prepare('INSERT INTO "Transaction" (categoryId, amountCents, dateTimestamp, userId) VALUES (?, ?, ?, ?)').run(1, 100, timestamp, 'user-b'),
    /FOREIGN KEY constraint/,
  );
  assert.throws(
    () => db.prepare('INSERT INTO Investment (categoryId, amountCents, dateTimestamp, monthlyRate, monthsDuration, userId) VALUES (?, ?, ?, ?, ?, ?)').run(1, 100, timestamp, 0.01, 12, 'user-b'),
    /FOREIGN KEY constraint/,
  );
});

test('migration requires parent categories to have the same owner and type', (t) => {
  const db = migratedDatabase(t);
  const insert = db.prepare('INSERT INTO TransactionCategory (label, type, parentId, userId) VALUES (?, ?, ?, ?)');
  insert.run('Mercado', 'EXPENSE', 1, 'user-a');
  assert.throws(() => insert.run('Outro', 'EXPENSE', 1, 'user-b'), /FOREIGN KEY constraint/);
  assert.throws(() => insert.run('Outro', 'INCOME', 1, 'user-a'), /FOREIGN KEY constraint/);
  assert.throws(() => db.prepare('DELETE FROM TransactionCategory WHERE id = 1').run(), /FOREIGN KEY constraint/);
  assert.throws(() => db.prepare('DELETE FROM User WHERE id = ?').run('user-a'), /FOREIGN KEY constraint/);
});
