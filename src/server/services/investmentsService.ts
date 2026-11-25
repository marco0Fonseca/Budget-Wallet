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
      return res.status(200).json({ investments: owned.map(serializeInvestment) });
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
}
