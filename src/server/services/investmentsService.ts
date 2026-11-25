import type { Express, NextFunction, Request, Response } from 'express';
import { Investment } from '../../entities/transactions/investment.ts';
import { TransactionCategory } from '../../entities/transactions/transactionCategory.ts';
import { InvestmentRepository } from '../../repository/investmentRepository.ts';
import { TransactionCategoryRepository } from '../../repository/transactionCategoryRepository.ts';
import { Prisma } from '../../generated/prisma/client.ts';
import { authenticateToken } from '../auth.ts';

const investments = new InvestmentRepository();
const categories = new TransactionCategoryRepository();

function serializeInvestment(investment: Investment) {
  return {
    id: investment.id,
    category: {
      id: investment.category.id,
      label: investment.category.label,
      type: investment.category.type,
      parentId: investment.category.parentId,
    },
    amountCents: investment.amountCents,
    dateTimestamp: investment.dateTimestamp,
    monthlyRate: investment.monthlyRate,
    monthsDuration: investment.monthsDuration,
    description: investment.description ?? null,
  };
}

function parseInvestmentId(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return null;
  try { return Investment.validateId(Number(raw)); } catch { return null; }
}

function safeSumCents(values: (number | null)[]): number | null {
  if (values.some(value => value === null)) return null;
  const sum = values.reduce<bigint>((total, value) => total + BigInt(value!), 0n);
  return sum <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(sum) : null;
}

function projectedCents(investment: Investment, timestamp?: number): number | null {
  try {
    return timestamp === undefined ? investment.projectedAmountCents() : investment.projectedAmountOn(timestamp);
  } catch {
    return null;
  }
}

function portfolioOverview(owned: Investment[]) {
  const contributionCents = safeSumCents(owned.map(item => item.amountCents));
  const projectedTotalCents = safeSumCents(owned.map(item => projectedCents(item)));
  const projectedGainCents = contributionCents === null || projectedTotalCents === null
    ? null : projectedTotalCents - contributionCents;
  const now = new Date();
  const trend = Array.from({ length: 6 }, (_, index) => {
    const asOf = index === 0 ? now.getTime()
      : Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + index + 1, 0, 23, 59, 59, 999);
    const started = owned.filter(item => item.dateTimestamp <= asOf);
    return {
      asOf,
      contributionCents: safeSumCents(started.map(item => item.amountCents)),
      estimatedCents: safeSumCents(started.map(item => projectedCents(item, asOf))),
    };
  });
  return { summary: { contributionCents, projectedTotalCents, projectedGainCents }, trend };
}

export function registerInvestmentsRoutes(app: Express): void {
  app.get('/api/investments', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    try {
      Investment.validateUserId(req.userId);
    } catch {
      return res.status(401).json({ error: 'Authenticated user is invalid.' });
    }

    try {
      const owned = await investments.findAllByUserId(req.userId);
      return res.status(200).json({ investments: owned.map(serializeInvestment), ...portfolioOverview(owned) });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/investments', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    try {
      Investment.validateUserId(req.userId);
    } catch {
      return res.status(401).json({ error: 'Authenticated user is invalid.' });
    }

    const { categoryId, amountCents, dateTimestamp, monthlyRate, monthsDuration, description } = req.body ?? {};
    try {
      TransactionCategory.validateId(categoryId);
    } catch {
      return res.status(400).json({ error: 'Selecione uma categoria válida.' });
    }
    try {
      Investment.validateAmount(amountCents);
    } catch {
      return res.status(400).json({ error: 'Informe um aporte positivo em centavos, dentro do limite permitido.' });
    }
    try {
      Investment.validateDateTimestamp(dateTimestamp);
    } catch {
      return res.status(400).json({ error: 'Informe uma data válida.' });
    }
    try {
      Investment.validateMonthlyRate(monthlyRate);
    } catch {
      return res.status(400).json({ error: 'A taxa mensal deve ser finita e maior que -1.' });
    }
    try {
      Investment.validateMonthsDuration(monthsDuration);
    } catch {
      return res.status(400).json({ error: 'Informe um prazo válido em meses inteiros.' });
    }
    try {
      Investment.validateDescription(description);
    } catch {
      return res.status(400).json({ error: 'A descrição deve ser um texto.' });
    }

    try {
      const category = await categories.findCategoryById(categoryId, req.userId);
      if (!category) return res.status(400).json({ error: 'Categoria não encontrada na sua conta.' });
      if (category.type !== 'INVESTMENT') return res.status(400).json({ error: 'Selecione uma categoria de investimento.' });

      const investment = new Investment(-1, category, dateTimestamp, amountCents, monthlyRate, monthsDuration, req.userId, description);
      const created = await investments.create(investment);
      return res.status(201).json({ investment: serializeInvestment(created) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2003', 'P2025'].includes(error.code)) {
        return res.status(409).json({ error: 'A categoria não está mais disponível. Atualize a página e tente novamente.' });
      }
      return next(error);
    }
  });

  app.patch('/api/investments/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    try { Investment.validateUserId(req.userId); } catch { return res.status(401).json({ error: 'Authenticated user is invalid.' }); }
    const id = parseInvestmentId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Identificador do investimento inválido.' });
    const rawBody: unknown = req.body;
    if (typeof rawBody !== 'object' || rawBody === null || Array.isArray(rawBody)) {
      return res.status(400).json({ error: 'Informe os dados a alterar.' });
    }
    const body = rawBody as Record<string, unknown>;
    if (!['categoryId', 'amountCents', 'dateTimestamp', 'monthlyRate', 'monthsDuration', 'description'].some(field => Object.hasOwn(body, field))) {
      return res.status(400).json({ error: 'Informe ao menos um campo para alterar.' });
    }

    try {
      const current = await investments.findById(id, req.userId);
      if (!current) return res.status(404).json({ error: 'Investimento não encontrado.' });
      const categoryId = Object.hasOwn(body, 'categoryId') ? body.categoryId : current.category.id;
      const amountCents = Object.hasOwn(body, 'amountCents') ? body.amountCents : current.amountCents;
      const dateTimestamp = Object.hasOwn(body, 'dateTimestamp') ? body.dateTimestamp : current.dateTimestamp;
      const monthlyRate = Object.hasOwn(body, 'monthlyRate') ? body.monthlyRate : current.monthlyRate;
      const monthsDuration = Object.hasOwn(body, 'monthsDuration') ? body.monthsDuration : current.monthsDuration;
      const description = Object.hasOwn(body, 'description') ? body.description === null ? undefined : body.description : current.description;

      try { TransactionCategory.validateId(categoryId as number); } catch { return res.status(400).json({ error: 'Selecione uma categoria válida.' }); }
      try { Investment.validateAmount(amountCents as number); } catch { return res.status(400).json({ error: 'Informe um aporte positivo em centavos, dentro do limite permitido.' }); }
      try { Investment.validateDateTimestamp(dateTimestamp as number); } catch { return res.status(400).json({ error: 'Informe uma data válida.' }); }
      try { Investment.validateMonthlyRate(monthlyRate as number); } catch { return res.status(400).json({ error: 'A taxa mensal deve ser finita e maior que -1.' }); }
      try { Investment.validateMonthsDuration(monthsDuration as number); } catch { return res.status(400).json({ error: 'Informe um prazo válido em meses inteiros.' }); }
      try { Investment.validateDescription(description as string | undefined); } catch { return res.status(400).json({ error: 'A descrição deve ser um texto.' }); }

      const category = await categories.findCategoryById(categoryId as number, req.userId);
      if (!category) return res.status(400).json({ error: 'Categoria não encontrada na sua conta.' });
      if (category.type !== 'INVESTMENT') return res.status(400).json({ error: 'Selecione uma categoria de investimento.' });
      const updated = await investments.update(new Investment(
        id, category, dateTimestamp as number, amountCents as number, monthlyRate as number,
        monthsDuration as number, req.userId, description as string | undefined,
      ));
      return res.status(200).json({ investment: serializeInvestment(updated) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') return res.status(404).json({ error: 'Investimento ou categoria não encontrado.' });
        if (error.code === 'P2003') return res.status(409).json({ error: 'A categoria não está mais disponível.' });
      }
      return next(error);
    }
  });

  app.delete('/api/investments/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    try { Investment.validateUserId(req.userId); } catch { return res.status(401).json({ error: 'Authenticated user is invalid.' }); }
    const id = parseInvestmentId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Identificador do investimento inválido.' });
    try {
      await investments.delete(id, req.userId);
      return res.status(204).send();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({ error: 'Investimento não encontrado.' });
      }
      return next(error);
    }
  });
}
