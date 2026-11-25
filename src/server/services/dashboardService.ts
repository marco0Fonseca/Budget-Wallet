import type { Express, NextFunction, Request, Response } from 'express';
import { Transaction } from '../../entities/transactions/transaction.ts';
import { TransactionRepository } from '../../repository/transactionRepository.ts';
import { TransactionCategoryRepository } from '../../repository/transactionCategoryRepository.ts';
import { authenticateToken } from '../auth.ts';

const transactions = new TransactionRepository();
const categories = new TransactionCategoryRepository();
const monthFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' });
const maximum = BigInt(Number.MAX_SAFE_INTEGER);

function monthOf(timestamp: number): string {
  const parts = Object.fromEntries(monthFormat.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}`;
}

function safeCents(value: bigint): number {
  if (value > maximum || value < -maximum) throw new RangeError('Financial total exceeds the supported range.');
  return Number(value);
}

function previousMonths(selected: string): string[] {
  const year = Number(selected.slice(0, 4));
  const month = Number(selected.slice(5, 7));
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 6 + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

export function registerDashboardRoutes(app: Express): void {
  app.get('/api/dashboard', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    try { Transaction.validateUserId(req.userId); }
    catch { return res.status(401).json({ error: 'Authenticated user is invalid.' }); }

    const month = req.query.month;
    if (typeof month !== 'string' || !/^(\d{4})-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 100) {
      return res.status(400).json({ error: 'Month must use YYYY-MM.' });
    }

    try {
      const [owned, ownedCategories] = await Promise.all([
        transactions.findAllByUserId(req.userId), categories.findAllByUserId(req.userId),
      ]);
      const byCategoryId = new Map(ownedCategories.map(category => [category.id, category]));
      const months = previousMonths(month);
      const monthlyTotals = new Map(months.map(key => [key, { income: 0n, expense: 0n }]));
      const selected = [] as typeof owned;
      const expenseGroups = new Map<number, { id: number; label: string; cents: bigint }>();

      for (const transaction of owned) {
        const key = monthOf(transaction.dateTimestamp);
        const totals = monthlyTotals.get(key);
        if (totals) {
          if (transaction.category.type === 'INCOME') totals.income += BigInt(transaction.amountCents);
          else totals.expense += BigInt(transaction.amountCents);
        }
        if (key !== month) continue;
        selected.push(transaction);
        if (transaction.category.type === 'EXPENSE') {
          const rootId = transaction.category.parentId ?? transaction.category.id;
          const label = byCategoryId.get(rootId)?.label ?? transaction.category.label;
          const group = expenseGroups.get(rootId) ?? { id: rootId, label, cents: 0n };
          group.cents += BigInt(transaction.amountCents);
          expenseGroups.set(rootId, group);
        }
      }

      const monthlyTrend = months.map(key => {
        const values = monthlyTotals.get(key)!;
        return {
          month: key,
          incomeCents: safeCents(values.income),
          expenseCents: safeCents(values.expense),
          resultCents: safeCents(values.income - values.expense),
        };
      });
      const current = monthlyTrend.at(-1)!;
      const expenseByCategory = [...expenseGroups.values()]
        .map(group => ({ id: group.id, label: group.label, amountCents: safeCents(group.cents) }))
        .sort((a, b) => b.amountCents - a.amountCents || a.label.localeCompare(b.label, 'pt-BR'));
      const recent = selected.sort((a, b) => b.dateTimestamp - a.dateTimestamp || b.id - a.id).slice(0, 4).map(transaction => ({
        id: transaction.id,
        label: transaction.label ?? null,
        categoryLabel: transaction.category.label,
        type: transaction.category.type,
        amountCents: transaction.amountCents,
        dateTimestamp: transaction.dateTimestamp,
      }));
      return res.status(200).json({
        month,
        totals: { incomeCents: current.incomeCents, expenseCents: current.expenseCents, resultCents: current.resultCents },
        monthlyTrend,
        expenseByCategory,
        recent,
      });
    } catch (error) {
      if (error instanceof RangeError) return res.status(422).json({ error: 'Os totais excedem a precisão permitida.' });
      return next(error);
    }
  });
}
