import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Investment } from '../src/entities/investment.ts';
import { TransactionCategory } from '../src/entities/transactions/transactionCategory.ts';
import { TransactionType } from '../src/entities/transactions/transactionType.ts';

const category = new TransactionCategory('Investimentos', TransactionType.INVESTMENT, null, 'user-id');
const start = Date.parse('2024-01-31T12:00:00.000Z');
const create = (rate = 0.01, duration = 12) => new Investment(category, start, 10000, rate, duration, 'user-id');

test('separates the projected total from the projected gain in cents', () => {
  const investment = create();
  assert.equal(investment.projectedAmountCents(0), 10000);
  assert.equal(investment.projectedGainCents(0), 0);
  assert.equal(investment.projectedAmountCents(1), 10100);
  assert.equal(investment.projectedGainCents(1), 100);
  assert.equal(investment.projectedAmountCents(2), 10201);
  assert.equal(investment.projectedGainCents(2), 201);
});

test('preserves principal at zero interest and supports projected losses', () => {
  assert.equal(create(0).projectedAmountCents(), 10000);
  assert.equal(create(0).projectedGainCents(), 0);
  assert.equal(create(-0.01).projectedAmountCents(1), 9900);
  assert.equal(create(-0.01).projectedGainCents(1), -100);
});

test('caps projections at the investment duration', () => {
  const investment = create(0.01, 2);
  assert.equal(investment.projectedAmountCents(), 10201);
  assert.equal(investment.projectedAmountCents(100), 10201);
  assert.equal(investment.projectedGainOn(Date.parse('2030-01-01T00:00:00Z')), 201);
});

test('counts completed months and clamps anniversaries to the last day of the month', () => {
  const investment = create();
  assert.equal(investment.projectedGainOn(start), 0);
  assert.equal(investment.projectedGainOn(Date.parse('2024-02-29T11:59:59.999Z')), 0);
  assert.equal(investment.projectedGainOn(Date.parse('2024-02-29T12:00:00.000Z')), 100);
  assert.equal(investment.projectedGainOn(Date.parse('2024-03-30T12:00:00.000Z')), 100);
  assert.equal(investment.projectedGainOn(Date.parse('2024-03-31T12:00:00.000Z')), 201);

  const ordinaryYear = new Investment(category, Date.parse('2025-01-31T00:00:00Z'), 10000, 0.01, 12, 'user-id');
  assert.equal(ordinaryYear.projectedGainOn(Date.parse('2025-02-28T00:00:00Z')), 100);

  const leapStart = new Investment(category, Date.parse('2024-02-29T00:00:00Z'), 10000, 0.01, 24, 'user-id');
  assert.equal(leapStart.projectedAmountOn(Date.parse('2025-02-28T00:00:00Z')), leapStart.projectedAmountCents(12));
});

test('uses the current timestamp when projecting gains until now', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2024-02-29T12:00:00Z') });
  assert.equal(create().projectedGainUntilNow(), 100);
});

test('rejects dates before the investment and invalid projection inputs', () => {
  const investment = create();
  assert.throws(() => investment.projectedAmountOn(start - 1), /precede/);
  for (const timestamp of [NaN, Infinity, 8_640_000_000_000_001, 1.5]) {
    assert.throws(() => investment.projectedGainOn(timestamp), /timestamp/);
  }
  for (const months of [-1, 1.5, NaN, Infinity]) {
    assert.throws(() => investment.projectedAmountCents(months), /Elapsed months/);
  }
});

test('rejects invalid rates, durations, principal amounts, and start timestamps', () => {
  for (const rate of [NaN, Infinity, -Infinity, -1, -2]) {
    assert.throws(() => create(rate), /Monthly rate/);
  }
  for (const duration of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => create(0.01, duration), /Duration/);
  }
  for (const amount of [0, -1, 1.5, NaN, Infinity, 2_147_483_648]) {
    assert.throws(() => new Investment(category, start, amount, 0.01, 12,'user-id'), /Amount/);
  }
  for (const timestamp of [NaN, Infinity, 1.5, 8_640_000_000_000_001]) {
    assert.throws(() => new Investment(category, timestamp, 10000, 0.01, 12 , 'user-id'), /timestamp/);
  }
});

test('requires an investment category belonging to a valid owner', () => {
  const expense = new TransactionCategory('Mercado', TransactionType.EXPENSE, null, 'user-id');
  assert.throws(() => new Investment(expense, start, 10000, 0.01, 12 , 'user-id'), /investment category/);
  assert.throws(() => new Investment(category, start, 10000, 0.01, 12,'another-user'), /same user/);
  assert.throws(() => new Investment(category, start, 10000, 0.01, 12,' '), /identifier/);
});

test('rounds only the final projected amount and rejects unsafe results', () => {
  const investment = new Investment(category, start, 1, 0.5, 2 , 'user-id');
  assert.equal(investment.projectedAmountCents(2), 2);
  assert.throws(() => create(Number.MAX_VALUE).projectedAmountCents(2), /supported range/);
});

test('trims descriptions and protects investment fields from direct changes', () => {
  const investment = new Investment(category, start, 10000, 0.01, 12 , 'user-id', '  Aporte  ');
  assert.equal(investment.description, 'Aporte');
  assert.equal(Reflect.set(investment, 'monthlyRate', NaN), false);
  assert.equal(Reflect.set(investment, 'amountCents', -1), false);
  assert.equal('recurrenceAdd' in investment, false);
});
