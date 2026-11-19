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
