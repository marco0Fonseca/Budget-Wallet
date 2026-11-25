import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBrlAmountCents } from '../frontend/src/money.ts';

test('converts Brazilian currency input to exact cents', () => {
  assert.equal(parseBrlAmountCents('0,01'), 1);
  assert.equal(parseBrlAmountCents('15,50'), 1550);
  assert.equal(parseBrlAmountCents(' 1.234,56 '), 123456);
  assert.equal(parseBrlAmountCents('21.474.836,47'), 2_147_483_647);
});

test('rejects rounding, invalid grouping, zero, and values outside the database range', () => {
  for (const value of ['0', '0,00', '-1,00', '1,234', '1.23', '12.34,56', '21.474.836,48', '99999999999999999999999999']) {
    assert.equal(parseBrlAmountCents(value), null, value);
  }
});
