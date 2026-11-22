import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TransactionCategory } from '../src/entities/transactions/transactionCategory.ts';
import { TransactionType } from '../src/entities/transactions/transactionType.ts';

test('creates a category with a trimmed label and the provided owner and parent', () => {
  const category = new TransactionCategory('  Mercado  ', TransactionType.EXPENSE, 1, 'user-id');

  assert.equal(category.label, 'Mercado');
  assert.equal(category.type, TransactionType.EXPENSE);
  assert.equal(category.parentId, 1);
  assert.equal(category.userId, 'user-id');
  assert.equal(category.isDefault, false);
  assert.equal(category.id, -1);
});

test('accepts persisted IDs and reserves -1 for new categories', () => {
  for (const id of [1, 42, 2147483647]) {
    assert.equal(TransactionCategory.validateId(id), id);
    assert.equal(TransactionCategory.validateParentId(id), id);
    const category = new TransactionCategory('Category', TransactionType.EXPENSE, null, 'user-id', false, id);
    assert.equal(category.id, id);
  }
  assert.equal(TransactionCategory.validateParentId(null), null);
  assert.throws(() => TransactionCategory.validateId(-1), /identifier is invalid/);
  assert.throws(() => TransactionCategory.validateParentId(-1), /identifier is invalid/);
});

test('rejects invalid numeric IDs without coercing strings or other types', () => {
  const invalidIds: unknown[] = [0, -2, 1.5, NaN, Infinity, -Infinity, 2147483648, Number.MAX_SAFE_INTEGER + 1, '1', '', null, undefined, true];
  for (const value of invalidIds) {
    const id = value as number;
    assert.throws(() => TransactionCategory.validateId(id), /identifier is invalid/);
    if (value !== undefined) {
      assert.throws(() => new TransactionCategory('Category', TransactionType.EXPENSE, null, 'user-id', false, id), /identifier is invalid/);
    }
    if (value !== null) {
      assert.throws(() => new TransactionCategory('Category', TransactionType.EXPENSE, id, 'user-id'), /identifier is invalid/);
    }
  }
});

test('preserves the default category flag and rejects non-boolean flags', () => {
  const category = new TransactionCategory('Mercado', TransactionType.EXPENSE, null, 'user-id', true);
  assert.equal(category.isDefault, true);

  for (const flag of ['true', 1, null]) {
    assert.throws(
      () => new TransactionCategory('Mercado', TransactionType.EXPENSE, null, 'user-id', flag as unknown as boolean),
      /Default category flag must be a boolean/,
    );
  }
});

test('accepts each defined transaction type and categories without a parent', () => {
  for (const type of Object.values(TransactionType)) {
    const category = new TransactionCategory('Category', type, null, 'user-id');

    assert.equal(category.type, type);
    assert.equal(category.parentId, null);
  }
});

test('rejects empty, whitespace-only, or non-string labels', () => {
  for (const label of ['', '   ', null, undefined, 123]) {
    assert.throws(
      () => new TransactionCategory(label as string, TransactionType.EXPENSE, null, 'user-id'),
      { message: 'Category label is required.' },
    );
  }
});

test('rejects missing, non-string, or untrimmed user identifiers', () => {
  for (const userId of ['', '   ', ' user-id ', null, undefined, 123]) {
    assert.throws(
      () => new TransactionCategory('Mercado', TransactionType.EXPENSE, null, userId as string),
      { message: 'User identifier is invalid.' },
    );
  }
});

test('rejects values outside the defined transaction types', () => {
  for (const type of ['', 'expense', 'UNKNOWN', null, undefined, 123]) {
    assert.throws(
      () => new TransactionCategory('Mercado', type as TransactionType, null, 'user-id'),
      { message: 'Transaction type is invalid.' },
    );
  }
});
