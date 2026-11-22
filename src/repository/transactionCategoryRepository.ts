import type { TransactionCategory as PrismaTransactionCategory } from '../generated/prisma/client.ts';
import { TransactionCategory } from '../entities/transactions/transactionCategory.ts';
import { TransactionType } from '../entities/transactions/transactionType.ts';
import { prisma } from '../repository/repository.ts';

export class TransactionCategoryRepository {

    async delete(id: number, userId: string): Promise<TransactionCategory> {
        TransactionCategory.validateId(id);
        TransactionCategory.validateUserId(userId);

        const categoryData = await prisma.transactionCategory.delete({
            where: {
                id_userId: { id, userId },
                isDefault: false,
                children: { none: {} },
            },
        });

        return this.toEntity(categoryData);
    }

    private toEntity(category: PrismaTransactionCategory): TransactionCategory {
        return new TransactionCategory(
            category.id,
            category.label,
            category.type,
            category.parentId,
            category.userId,
            category.isDefault,
        );
    }

    async create(category: TransactionCategory): Promise<TransactionCategory> {
        if (category.id !== -1) {
            throw new Error('Only new categories with id -1 can be created.');
        }
        TransactionCategory.validateParentId(category.parentId);
        if (category.parentId !== null) {
            const parent = await prisma.transactionCategory.findUniqueOrThrow({
                where: { id_userId: { id: category.parentId, userId: category.userId } },
            });
            if (parent.parentId !== null) {
                throw new Error('Subcategories must belong to a root category.');
            }
            if (parent.type !== category.type) {
                throw new Error('Subcategory type must match its parent.');
            }
        }
        const created = await prisma.transactionCategory.create({
            data: {
                label: category.label,
                type: category.type,
                parentId: category.parentId,
                userId: category.userId,
                isDefault: category.isDefault,
            },
        });
        return this.toEntity(created);
    }

    async findCategoryById(id: number, userId : string) : Promise<TransactionCategory | null> {
        TransactionCategory.validateId(id);
        const categoryData = await prisma.transactionCategory.findUnique({
            where: {
                id_userId: { id, userId },
            },
        });

        if (!categoryData) return null;

        return this.toEntity(categoryData);
    }

    async findCategoriesByType(type: TransactionType,userId: string): Promise<TransactionCategory[]> {
        const categoriesData = await prisma.transactionCategory.findMany({
            where: { type, userId },
            orderBy: { id: 'asc' },
        });

        return categoriesData.map(category => this.toEntity(category));
    }

    async findAllSubCategories(parentId: number, userId: string): Promise<TransactionCategory[]> {
        TransactionCategory.validateId(parentId);
        const categoriesData = await prisma.transactionCategory.findMany({
            where: {
                userId,
                OR: [{ id: parentId }, { parentId }],
            },
            orderBy: { id: 'asc' },
        });

        const parent = categoriesData.find(category => category.id === parentId);
        if (!parent) return [];

        const children = categoriesData.filter(category => category.id !== parentId);
        return [parent, ...children].map(category => this.toEntity(category));
    }

    async updateLabel(id: number, userId: string, newLabel: string) : Promise<TransactionCategory> {
        TransactionCategory.validateId(id);
        const validatedLabel = TransactionCategory.validateLabel(newLabel);

        const categoryData = await prisma.transactionCategory.update({
            where: { id_userId: { id, userId },
                     isDefault: false
            },
            data:  { label: validatedLabel },
        });

        return this.toEntity(categoryData);
    }

    async updateParent(id: number, userId: string, newParentId: number | null): Promise<TransactionCategory> {
        TransactionCategory.validateId(id);
        TransactionCategory.validateUserId(userId);
        TransactionCategory.validateParentId(newParentId);
        if (newParentId === id) {
            throw new Error('A category cannot be its own parent.');
        }

        // A hierarquia consultada deve permanecer válida até a gravação.
        return prisma.$transaction(async (tx) => {
            const category = await tx.transactionCategory.findUniqueOrThrow({
                where: { id_userId: { id, userId }, isDefault: false },
            });

            if (newParentId !== null) {
                const parent = await tx.transactionCategory.findUniqueOrThrow({
                    where: { id_userId: { id: newParentId, userId } },
                });
                if (parent.parentId !== null) {
                    throw new Error('Subcategories must belong to a root category.');
                }
                if (parent.type !== category.type) {
                    throw new Error('Subcategory type must match its parent.');
                }
                const childrenCount = await tx.transactionCategory.count({ where: { userId, parentId: id } });
                if (childrenCount > 0) {
                    throw new Error('Categories with children cannot become subcategories.');
                }
            }

            const updated = await tx.transactionCategory.update({
                where: { id_userId: { id, userId }, isDefault: false },
                data: { parentId: newParentId },
            });
            return this.toEntity(updated);
        });
    }

    async updateType(id: number, userId: string, newType: TransactionType): Promise<TransactionCategory> {
        TransactionCategory.validateId(id);
        const validatedType = TransactionCategory.validateType(newType);

        return prisma.$transaction(async (tx) => {
            const parent = await tx.transactionCategory.findUniqueOrThrow({
                where: { id_userId: { id, userId } },
            });
            if (parent.parentId !== null) {
                throw new Error('Only root categories can change type.');
            }

            const categories = await tx.transactionCategory.findMany({
                where: { userId, OR: [{ id }, { parentId: id }] },
            });
            if (categories.some(category => category.isDefault)) {
                throw new Error('Default categories cannot change type.');
            }

            const categoryIds = categories.map(category => category.id);
            const childrenIds = categories.filter(category => category.id !== id).map(category => category.id);
            const transactions = await tx.transaction.count({ where: { userId, categoryId: { in: categoryIds } } });
            const investments = await tx.investment.count({ where: { userId, categoryId: { in: categoryIds } } });
            if (transactions > 0 || investments > 0) {
                throw new Error('Categories with transactions or investments cannot change type.');
            }
            await tx.transactionCategory.updateMany({
                where: { userId, id: { in: childrenIds } },
                data: { parentId: null, type: validatedType },
            });

            const updated = await tx.transactionCategory.update({
                where: { id_userId: { id, userId } },
                data: { type: validatedType },
            });
            await tx.transactionCategory.updateMany({
                where: { userId, id: { in: childrenIds } },
                data: { parentId: id },
            });

            return this.toEntity(updated);
        });
    }
}
