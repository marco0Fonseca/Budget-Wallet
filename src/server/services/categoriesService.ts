import type { Express, Request, Response, NextFunction } from 'express';
import { TransactionCategoryRepository } from '../../repository/transactionCategoryRepository.ts';
import { TransactionCategory } from '../../entities/transactions/transactionCategory.ts';
import { authenticateToken } from '../auth.ts';
import { prisma } from '../../repository/repository.ts';
import { TransactionRepository } from '../../repository/transactionRepository.ts';
import { InvestmentRepository } from '../../repository/investmentRepository.ts';

const categoryRepo = new TransactionCategoryRepository();
const transactionRepo = new TransactionRepository();
const investmentRepo = new InvestmentRepository();

/** Register category endpoints on the already-configured Express app. */
export function registerCategoriesRoutes(app: Express): void {
  /**
   * GET /api/categories
   * Get all categories for the authenticated user.
   * Authorization: Bearer <token>
   */
  app.get('/api/categories', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    }

    try {
      TransactionCategory.validateUserId(req.userId);
    } catch {
      return res.status(401).json({ error: 'Authenticated user is invalid.' });
    }

    try {
      const categories = await categoryRepo.findAllByUserId(req.userId);
      return res.status(200).json({ categories });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/categories
   * Create a custom category for the authenticated user.
   * Body: { label: string, type: TransactionType, parentId?: number | null }
   */
  app.post('/api/categories', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    }

    const { label, type, parentId } = req.body ?? {};
    const categoryParentId = parentId === undefined ? null : parentId;

    let category: TransactionCategory;
    try {
      category = new TransactionCategory(-1, label, type, categoryParentId, req.userId, false);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid category data.',
      });
    }

    if (category.parentId !== null) {
      try {
        const parent = await categoryRepo.findCategoryById(category.parentId, req.userId);
        if (!parent) {
          return res.status(400).json({ error: 'Parent category was not found for this user.' });
        }
        if (parent.parentId !== null) {
          return res.status(400).json({ error: 'Subcategories must belong to a root category.' });
        }
        if (parent.type !== category.type) {
          return res.status(400).json({ error: 'Subcategory type must match its parent.' });
        }
      } catch (error) {
        return next(error);
      }
    }

    try {
      const created = await categoryRepo.create(category);
      return res.status(201).json({ category: created });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * PATCH /api/categories/:id
   * Update a custom category owned by the authenticated user.
   * Body: { label: string, type: TransactionType, parentId: number | null }
   */
  app.patch('/api/categories/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    }

    let id: number;
    try {
      id = TransactionCategory.validateId(Number(req.params.id));
      TransactionCategory.validateUserId(req.userId);
    } catch {
      return res.status(400).json({ error: 'Category identifier is invalid.' });
    }

    let current: TransactionCategory | null;
    try {
      current = await categoryRepo.findCategoryById(id, req.userId);
    } catch (error) {
      return next(error);
    }

    if (!current) {
      return res.status(404).json({ error: 'Category was not found.' });
    }
    if (current.isDefault) {
      return res.status(403).json({ error: 'Default categories cannot be edited.' });
    }

    const { label, type, parentId } = req.body ?? {};
    const targetParentId = parentId === undefined ? current.parentId : parentId;
    let updatedCategory: TransactionCategory;
    try {
      updatedCategory = new TransactionCategory(id, label, type, targetParentId, req.userId, false);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid category data.',
      });
    }

    if (current.parentId !== null && updatedCategory.type !== current.type) {
      return res.status(400).json({ error: 'Subcategories cannot change type.' });
    }

    if (updatedCategory.parentId !== null) {
      try {
        const parent = await categoryRepo.findCategoryById(updatedCategory.parentId, req.userId);
        if (!parent) {
          return res.status(400).json({ error: 'Parent category was not found for this user.' });
        }
        if (parent.parentId !== null) {
          return res.status(400).json({ error: 'Subcategories must belong to a root category.' });
        }
        if (parent.type !== updatedCategory.type) {
          return res.status(400).json({ error: 'Subcategory type must match its parent.' });
        }
        if (parent.id === id) {
          return res.status(400).json({ error: 'A category cannot be its own parent.' });
        }
      } catch (error) {
        return next(error);
      }
    }

    if (current.parentId === null && updatedCategory.parentId !== null) {
      try {
        const children = await categoryRepo.findAllSubCategories(id, req.userId);
        if (children.length > 1) {
          return res.status(400).json({ error: 'Categories with children cannot become subcategories.' });
        }
      } catch (error) {
        return next(error);
      }
    }

    try {
      let saved = current;
      if (updatedCategory.type !== current.type) {
        saved = await categoryRepo.updateType(id, req.userId, updatedCategory.type);
      }
      if (updatedCategory.label !== current.label) {
        saved = await categoryRepo.updateLabel(id, req.userId, updatedCategory.label);
      }
      if (updatedCategory.parentId !== current.parentId) {
        saved = await categoryRepo.updateParent(id, req.userId, updatedCategory.parentId);
      }

      const categories = await categoryRepo.findAllByUserId(req.userId);
      return res.status(200).json({ category: saved, categories });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
        return res.status(404).json({ error: 'Category could not be updated.' });
      }
      if (error instanceof Error && (
        error.message === 'Only root categories can change type.'
        || error.message === 'Default categories cannot change type.'
        || error.message === 'Categories with transactions or investments cannot change type.'
        || error.message === 'Categories with children cannot become subcategories.'
      )) {
        return res.status(400).json({ error: error.message });
      }
      return next(error);
    }
  });

  app.get('/api/categories/:id/deletion-status', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    let id: number;
    try {
      id = TransactionCategory.validateId(Number(req.params.id));
      TransactionCategory.validateUserId(req.userId);
    } catch {
      return res.status(400).json({ error: 'Category identifier is invalid.' });
    }
    try {
      const category = await categoryRepo.findCategoryById(id, req.userId);
      if (!category) return res.status(404).json({ error: 'Category was not found.' });
      const [children, transactions, investments] = await Promise.all([
        prisma.transactionCategory.count({ where: { userId: req.userId, parentId: id } }),
        transactionRepo.findAllByCategory(id, req.userId),
        investmentRepo.findAllByCategory(id, req.userId),
      ]);
      return res.status(200).json({
        canDelete: !category.isDefault && children === 0 && transactions.length === 0 && investments.length === 0,
        blockers: { isDefault: category.isDefault, children, transactions: transactions.length, investments: investments.length },
      });
    } catch (error) {
      return next(error);
    }
  });

  app.delete('/api/categories/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Authenticated user is unavailable.' });
    let id: number;
    try {
      id = TransactionCategory.validateId(Number(req.params.id));
      TransactionCategory.validateUserId(req.userId);
    } catch {
      return res.status(400).json({ error: 'Category identifier is invalid.' });
    }
    try {
      const category = await categoryRepo.findCategoryById(id, req.userId);
      if (!category) return res.status(404).json({ error: 'Category was not found.' });
      if (category.isDefault) return res.status(403).json({ error: 'Default categories cannot be deleted.' });
      const [children, transactions, investments] = await Promise.all([
        prisma.transactionCategory.count({ where: { userId: req.userId, parentId: id } }),
        transactionRepo.findAllByCategory(id, req.userId),
        investmentRepo.findAllByCategory(id, req.userId),
      ]);
      if (children || transactions.length || investments.length) {
        return res.status(409).json({ error: 'Category has subcategories, transactions, or investments and cannot be deleted.' });
      }
      await categoryRepo.delete(id, req.userId);
      return res.status(204).send();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2003') return res.status(409).json({ error: 'Category is in use and cannot be deleted.' });
        if (error.code === 'P2025') return res.status(404).json({ error: 'Category could not be deleted.' });
      }
      return next(error);
    }
  });
}
