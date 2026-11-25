import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Transaction } from '../src/entities/transactions/transaction.ts';
import { TransactionCategory } from '../src/entities/transactions/transactionCategory.ts';
import { TransactionType } from '../src/entities/transactions/transactionType.ts';

const category = new TransactionCategory(-1, 'Mercado', TransactionType.EXPENSE, null, 'user-id');

test('stores exact cents, a timestamp, and a trimmed description', () => {
  const transaction = new Transaction(-1, category, 1550, Date.parse('2024-02-29T00:00:00.000Z'), 'user-id', '  Compra  ');

  assert.equal(transaction.amountCents, 1550);
  assert.equal(transaction.dateTimestamp, Date.parse('2024-02-29T00:00:00.000Z'));
  assert.equal(transaction.description, 'Compra');
  assert.equal(transaction.category, category);
  assert.equal(transaction.userId, 'user-id');
  assert.equal('recurrence' in transaction, false);
  assert.equal(transaction.id, -1);
});

test('preserves persisted IDs and rejects invalid IDs and non-integer timestamps', () => {
  for (const id of [1, 2147483647]) {
    assert.equal(Transaction.validateId(id), id);
    assert.equal(new Transaction(id, category, 100, 1795000000123, 'user-id').id, id);
  }
  assert.throws(() => Transaction.validateId(-1), /Transaction identifier/);
  for (const value of [0, -2, 1.5, NaN, Infinity, 2147483648, '1', null, true]) {
    assert.throws(() => new Transaction(value as number, category, 100, 1795000000123, 'user-id'), /Transaction identifier/);
  }
  for (const value of [1.5, '123', null]) {
    assert.throws(() => new Transaction(-1, category, 100, value as number, 'user-id'), /Date is invalid/);
  }
});

test('accepts the minimum and maximum amounts without rounding', () => {
  for (const amount of [1, 2_147_483_647]) {
    assert.equal(new Transaction(-1, category, amount, Date.parse('2024-01-01T00:00:00.000Z'), 'user-id').amountCents, amount);
  }
});

test('rejects non-positive, fractional, non-finite, and out-of-range amounts', () => {
  for (const amount of [0, -100, 1.005, 15.5, NaN, Infinity, 2_147_483_648]) {
    assert.throws(() => new Transaction(-1, category, amount, Date.parse('2024-01-01T00:00:00.000Z'), 'user-id'), /Amount/);
  }
});

test('rejects an invalid owner, a missing category, or another users category', () => {
  for (const userId of ['', ' ', ' user-id ']) {
    assert.throws(() => new Transaction(-1, category, 100, Date.parse('2024-01-01T00:00:00.000Z'), userId), /User identifier/);
  }
  assert.throws(() => new Transaction(-1, category, 100, Date.parse('2024-01-01T00:00:00.000Z'), 'other-user'), /same user/);
  assert.throws(
    () => new Transaction(-1, null as unknown as TransactionCategory, 100, Date.parse('2024-01-01T00:00:00.000Z'), 'user-id'),
    /category is invalid/,
  );
});

test('rejects investment categories for income and expense transactions', () => {
  const investmentCategory = new TransactionCategory(-1, 'CDI', TransactionType.INVESTMENT, null, 'user-id');
  assert.throws(
    () => new Transaction(-1, investmentCategory, 100, Date.parse('2024-01-01T00:00:00.000Z'), 'user-id'),
    /income or expense/,
  );
});

test('rejects invalid timestamps', () => {
  for (const timestamp of [NaN, Infinity, -Infinity, 8_640_000_000_000_001]) {
    assert.throws(() => new Transaction(-1, category, 100, timestamp, 'user-id'), /Date is invalid/);
  }
});

test('allows future timestamps while recurrence rules are pending', () => {
  const futureTimestamp = Date.now() + 86_400_000;
  const transaction = new Transaction(-1, category, 100, futureTimestamp, 'user-id');
  assert.equal(transaction.dateTimestamp, futureTimestamp);
});

test('formats cents as a monetary string with exactly two decimal places', () => {
  const examples: [number, string][] = [
    [1, '0.01'],
    [10, '0.10'],
    [100, '1.00'],
    [1550, '15.50'],
    [2599, '25.99'],
    [2_147_483_647, '21474836.47'],
  ];

  for (const [amount, expected] of examples) {
    const transaction = new Transaction(-1, category, amount, Date.now(), 'user-id');
    assert.equal(transaction.monetaryValue(), expected);
    assert.equal(transaction.amountCents, amount);
    assert.equal('value' in transaction, false);
  }
});

test('allows an omitted or blank description and rejects non-string descriptions', () => {
  for (const description of [undefined, '', '   ']) {
    assert.equal(new Transaction(-1, category, 100, Date.parse('2024-01-01T00:00:00.000Z'), 'user-id', description).description, undefined);
  }
  assert.throws(
    () => new Transaction(-1, category, 100, Date.parse('2024-01-01T00:00:00.000Z'), 'user-id', 123 as unknown as string),
    /Description/,
  );
});

test('keeps an optional label separate from the description', () => {
  const withLabel = new Transaction(-1, category, 100, 1795000000123, 'user-id', '  Details  ', '  Groceries  ');
  assert.equal(withLabel.label, 'Groceries');
  assert.equal(withLabel.description, 'Details');
  for (const label of [undefined, '', '   ']) {
    assert.equal(new Transaction(-1, category, 100, 1795000000123, 'user-id', undefined, label).label, undefined);
  }
  assert.throws(() => Transaction.validateLabel(123 as unknown as string), /Label must be a string/);
});
