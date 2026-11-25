import type { Express, NextFunction, Request, Response } from 'express';
import { TransactionRepository } from '../../repository/transactionRepository.ts';
import { TransactionCategoryRepository } from '../../repository/transactionCategoryRepository.ts';
import { Transaction } from '../../entities/transactions/transaction.ts';
import { TransactionCategory } from '../../entities/transactions/transactionCategory.ts';
import { Prisma } from '../../generated/prisma/client.ts';
import { authenticateToken } from '../auth.ts';

const transactionRepo = new TransactionRepository();
const categoryRepo = new TransactionCategoryRepository();
const monthPattern = /^(\d{4})-(0[1-9]|1[0-2])$/;
const localParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function saoPauloMidnight(year: number, monthIndex: number): number {
  const utcMidnight = Date.UTC(year, monthIndex, 1);
  let result = utcMidnight;
  for (let attempt = 0; attempt < 2; attempt++) {
    const parts = Object.fromEntries(localParts.formatToParts(new Date(result)).map(part => [part.type, Number(part.value)]));
    const localAsUtc = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!);
    result = utcMidnight - (localAsUtc - result);
  }
  return result;
}

function serializeTransaction(transaction: Transaction) {
  return {
    id: transaction.id,
    category: {
      id: transaction.category.id,
      label: transaction.category.label,
      type: transaction.category.type,
      parentId: transaction.category.parentId,
    },
    amountCents: transaction.amountCents,
    dateTimestamp: transaction.dateTimestamp,
    label: transaction.label ?? null,
    description: transaction.description ?? null,
  };
}

export function registerTransactionsRoutes(app: Express): void {
  app.post('/api/transactions', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    try {
      Transaction.validateUserId(req.userId);
    } catch {
      return res.status(401).json({ error: 'Authenticated user is invalid.' });
    }

    const { type, categoryId, amountCents, dateTimestamp, description, label } = req.body ?? {};
    if (type !== 'INCOME' && type !== 'EXPENSE') {
      return res.status(400).json({ error: 'Selecione receita ou despesa.' });
    }
    try {
      TransactionCategory.validateId(categoryId);
    } catch {
      return res.status(400).json({ error: 'Selecione uma categoria válida.' });
    }
    try {
      Transaction.validateAmount(amountCents);
    } catch {
      return res.status(400).json({ error: 'Informe um valor positivo em centavos, dentro do limite permitido.' });
    }
    try {
      Transaction.validateDateTimestamp(dateTimestamp);
    } catch {
      return res.status(400).json({ error: 'Informe uma data válida.' });
    }
    try {
      Transaction.validateDescription(description);
    } catch {
      return res.status(400).json({ error: 'A descrição deve ser um texto.' });
    }
    try {
      Transaction.validateLabel(label);
    } catch {
      return res.status(400).json({ error: 'O nome do lançamento deve ser um texto.' });
    }

    try {
      const category = await categoryRepo.findCategoryById(categoryId, req.userId);
      if (!category) return res.status(400).json({ error: 'Categoria não encontrada na sua conta.' });
      if (category.type !== type) return res.status(400).json({ error: 'O tipo da categoria não corresponde ao lançamento.' });

      const transaction = new Transaction(-1, category, amountCents, dateTimestamp, req.userId, description, label);
      const created = await transactionRepo.create(transaction);
      return res.status(201).json({ transaction: serializeTransaction(created) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        return res.status(409).json({ error: 'A categoria não está mais disponível. Atualize a página e tente novamente.' });
      }
      return next(error);
    }
  });

  app.patch('/api/transactions/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    try {
      Transaction.validateUserId(req.userId);
    } catch {
      return res.status(401).json({ error: 'Authenticated user is invalid.' });
    }
    let id: number;
    try {
      if (typeof req.params.id !== 'string' || !/^[1-9]\d*$/.test(req.params.id)) throw new Error('Invalid ID');
      id = Transaction.validateId(Number(req.params.id));
    } catch {
      return res.status(400).json({ error: 'Identificador do lançamento inválido.' });
    }

    const rawBody: unknown = req.body;
    if (typeof rawBody !== 'object' || rawBody === null || Array.isArray(rawBody)) {
      return res.status(400).json({ error: 'Informe os dados a alterar.' });
    }
    const body = rawBody as Record<string, unknown>;
    if (!['type', 'categoryId', 'amountCents', 'dateTimestamp', 'label', 'description'].some(field => Object.hasOwn(body, field))) {
      return res.status(400).json({ error: 'Informe ao menos um campo para alterar.' });
    }

    try {
      const current = await transactionRepo.findById(id, req.userId);
      if (!current) return res.status(404).json({ error: 'Lançamento não encontrado.' });

      const type = body.type === undefined ? current.category.type : body.type;
      const categoryId = body.categoryId === undefined ? current.category.id : body.categoryId;
      const amountCents = body.amountCents === undefined ? current.amountCents : body.amountCents;
      const dateTimestamp = body.dateTimestamp === undefined ? current.dateTimestamp : body.dateTimestamp;
      const label = Object.hasOwn(body, 'label') ? body.label === null ? undefined : body.label : current.label;
      const description = Object.hasOwn(body, 'description') ? body.description === null ? undefined : body.description : current.description;

      if (type !== 'INCOME' && type !== 'EXPENSE') return res.status(400).json({ error: 'Selecione receita ou despesa.' });
      if (typeof categoryId !== 'number') return res.status(400).json({ error: 'Selecione uma categoria válida.' });
      try { TransactionCategory.validateId(categoryId); } catch { return res.status(400).json({ error: 'Selecione uma categoria válida.' }); }
      if (typeof amountCents !== 'number') return res.status(400).json({ error: 'Informe um valor válido em centavos.' });
      try { Transaction.validateAmount(amountCents); } catch { return res.status(400).json({ error: 'Informe um valor válido em centavos.' }); }
      if (typeof dateTimestamp !== 'number') return res.status(400).json({ error: 'Informe uma data válida.' });
      try { Transaction.validateDateTimestamp(dateTimestamp); } catch { return res.status(400).json({ error: 'Informe uma data válida.' }); }
      if (label !== undefined && typeof label !== 'string') return res.status(400).json({ error: 'O nome do lançamento deve ser um texto.' });
      if (description !== undefined && typeof description !== 'string') return res.status(400).json({ error: 'A descrição deve ser um texto.' });

      const category = await categoryRepo.findCategoryById(categoryId, req.userId);
      if (!category) return res.status(400).json({ error: 'Categoria não encontrada na sua conta.' });
      if (category.type !== type) return res.status(400).json({ error: 'O tipo da categoria não corresponde ao lançamento.' });

      const transaction = new Transaction(id, category, amountCents, dateTimestamp, req.userId, description, label);
      const updated = await transactionRepo.update(transaction);
      return res.status(200).json({ transaction: serializeTransaction(updated) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') return res.status(404).json({ error: 'Lançamento ou categoria não encontrado.' });
        if (error.code === 'P2003') return res.status(409).json({ error: 'A categoria não está mais disponível.' });
      }
      return next(error);
    }
  });

  app.delete('/api/transactions/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    try {
      Transaction.validateUserId(req.userId);
    } catch {
      return res.status(401).json({ error: 'Authenticated user is invalid.' });
    }
    let id: number;
    try {
      if (typeof req.params.id !== 'string' || !/^[1-9]\d*$/.test(req.params.id)) throw new Error('Invalid ID');
      id = Transaction.validateId(Number(req.params.id));
    } catch {
      return res.status(400).json({ error: 'Identificador do lançamento inválido.' });
    }

    try {
      await transactionRepo.delete(id, req.userId);
      return res.status(204).send();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({ error: 'Lançamento não encontrado.' });
      }
      return next(error);
    }
  });

  app.get('/api/transactions', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    try {
      Transaction.validateUserId(req.userId);
    } catch {
      return res.status(401).json({ error: 'Authenticated user is invalid.' });
    }

    const month = req.query.month;
    if (month !== undefined && (typeof month !== 'string' || !monthPattern.test(month) || Number(month.slice(0, 4)) < 100)) {
      return res.status(400).json({ error: 'Month must use YYYY-MM.' });
    }

    try {
      const transactions = month
        ? await transactionRepo.findByPeriod(
          req.userId,
          saoPauloMidnight(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1),
          saoPauloMidnight(Number(month.slice(0, 4)), Number(month.slice(5, 7))),
        )
        : (await transactionRepo.findAllByUserId(req.userId)).sort((a, b) => b.dateTimestamp - a.dateTimestamp || b.id - a.id);

      let income = 0n;
      let expense = 0n;
      for (const transaction of transactions) {
        if (transaction.category.type === 'INCOME') income += BigInt(transaction.amountCents);
        else expense += BigInt(transaction.amountCents);
      }
      const result = income - expense;
      if ([income, expense, result].some(value => value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER))) {
        return res.status(422).json({ error: 'Transaction total exceeds the supported range.' });
      }
      return res.status(200).json({
        transactions: transactions.map(serializeTransaction),
        totals: { incomeCents: Number(income), expenseCents: Number(expense), resultCents: Number(result) },
      });
    } catch (error) {
      return next(error);
    }
  });
}
