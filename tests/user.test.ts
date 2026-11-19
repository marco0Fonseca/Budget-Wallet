import assert from 'node:assert/strict';
import { test } from 'node:test';
import { User } from '../src/entities/user.ts';

test('creates a user with a unique ID and the provided profile', () => {
  const before = Date.now();
  const user = new User(null,'João Lucas','joaolucas@example.com','joao.lucas');
  const other = new User(null,'João Lucas','joaolucas@example.com','joao.lucas');

  //Test Random UUID
  assert.match(user.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

  //Test indentifiers unique for each user
  assert.notEqual(user.id, other.id);

  //Test fields
  assert.equal(user.name, 'João Lucas');
  assert.equal(user.email, 'joaolucas@example.com');
  assert.equal(user.username, 'joao.lucas');

  assert.ok(user.createdAtTimestamp >= before);
  assert.ok(user.createdAtTimestamp <= Date.now());

  assert.equal('password' in user, false);
});

test('preserves the provided user ID and creation timestamp', () => {
  const createdAtTimestamp = Date.parse('2026-11-01T12:00:00.000Z');
  const user = new User('existing-user-id', 'João Lucas', 'joaolucas@example.com', 'joao.lucas', createdAtTimestamp);

  assert.equal(user.id, 'existing-user-id');
  assert.equal(user.createdAtTimestamp, createdAtTimestamp);
});

test('trims surrounding whitespace from profile fields', () => {
  const user = new User(null, '  João Lucas  ', '  joaolucas@example.com  ', '  joao.lucas  ');

  assert.equal(user.name, 'João Lucas');
  assert.equal(user.email, 'joaolucas@example.com');
  assert.equal(user.username, 'joao.lucas');
});

test('prevents direct changes to user properties', () => {
  const user = new User(null, 'João Lucas', 'joaolucas@example.com', 'joao.lucas');

  for (const property of ['id', 'name', 'email', 'username']) {
    assert.equal(Reflect.set(user, property, ''), false);
  }

  const originalTimestamp = user.createdAtTimestamp;
  assert.equal(Reflect.set(user, 'createdAtTimestamp', 0), false);
  assert.equal(user.createdAtTimestamp, originalTimestamp);
});

test('rejects empty or whitespace-only names', () => {
  for (const name of ['', '   ']) {
    assert.throws(() => new User(null, name, 'joaolucas@example.com', 'joao.lucas'), { message: 'Name is required.' });
  }
});

test('rejects invalid email addresses', () => {
  for (const email of ['', 'joao', 'joao@', '@example.com', 'jo ao@example.com']) {
    assert.throws(() => new User(null, 'João', email, 'joao.lucas'), /Invalid E-mail/);
  }
});

test('rejects empty usernames and usernames containing spaces, email addresses, or uppercase letters', () => {
  for (const username of ['', '   ', 'joao lucas', 'joaolucas@example.com', 'JOAO.LUCAS']) {
    assert.throws(() => new User(null, 'João', 'joaolucas@example.com', username), {
      message: 'Username must contain only lowercase letters, numbers, dots, hyphens or underscores.',
    });
  }
});

test('rejects invalid user IDs or creation timestamps', () => {
  for (const id of ['', '   ', ' id ']) {
    assert.throws(
      () => new User(id, 'João Lucas', 'joaolucas@example.com', 'joao.lucas'),
      /User identifier is invalid/,
    );
  }

  assert.throws(
    () => new User(null, 'João Lucas', 'joaolucas@example.com', 'joao.lucas', new Date('invalid').getTime()),
    /Creation date is invalid/,
  );
});
