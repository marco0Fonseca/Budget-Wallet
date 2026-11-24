import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InvestmentRepository } from '../src/repository/investmentRepository.ts';

test('rejects invalid category or owner before querying investments', async () => {
  const repository = new InvestmentRepository();
  await assert.rejects(() => repository.findAllByCategory(-1, 'owner'), /identifier/);
  await assert.rejects(() => repository.findAllByCategory(1, ' '), /User identifier/);
});
