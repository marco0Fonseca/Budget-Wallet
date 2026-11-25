import type { Transaction as PrismaTransaction, TransactionCategory as PrismaCategory } from '../generated/prisma/client.ts';
import { Transaction } from '../entities/transactions/transaction.ts';
import { TransactionCategory } from '../entities/transactions/transactionCategory.ts';
import { prisma } from '../repository/repository.ts';

export class TransactionRepository {
    private toCategoryEntity(category: PrismaCategory): TransactionCategory {
        return new TransactionCategory(
            category.id, category.label, category.type,
            category.parentId, category.userId, category.isDefault,
        );
    }

    private toEntity(transaction: PrismaTransaction & { category: PrismaCategory }): Transaction {
        const category = this.toCategoryEntity(transaction.category);
        return new Transaction(
            transaction.id,
            category,
            transaction.amountCents,
            Number(transaction.dateTimestamp),
            transaction.userId,
            transaction.description ?? undefined,
            transaction.label ?? undefined,
        );
    }

    async create(transaction: Transaction): Promise<Transaction> {
        if (transaction.id !== -1) {
            throw new Error('Only new transactions with id -1 can be created.');
        }
        Transaction.validateCategory(transaction.category, transaction.userId);
        TransactionCategory.validateId(transaction.category.id);
        const created = await prisma.transaction.create({
            data: {
                categoryId: transaction.category.id,
                amountCents: transaction.amountCents,
                dateTimestamp: BigInt(transaction.dateTimestamp),
                userId: transaction.userId,
                description: transaction.description ?? null,
                label: transaction.label ?? null,
            },
            include: { category: true },
        });
        return this.toEntity(created);
    }

    async findById(id: number, userId: string): Promise<Transaction | null> {
        Transaction.validateId(id);
        Transaction.validateUserId(userId);
        const transaction = await prisma.transaction.findUnique({
            where: { id, userId },
            include: { category: true },
        });
        return transaction ? this.toEntity(transaction) : null;
    }

    async findAllByUserId(userId: string): Promise<Transaction[]> {
        Transaction.validateUserId(userId);
        const transactions = await prisma.transaction.findMany({
            where: { userId },
            orderBy: { id: 'asc' },
            include: { category: true },
        });
        return transactions.map(transaction => this.toEntity(transaction));
    }

    async findByPeriod(userId: string, startTimestamp: number, endTimestamp: number): Promise<Transaction[]> {
        Transaction.validateUserId(userId);
        Transaction.validateDateTimestamp(startTimestamp);
        Transaction.validateDateTimestamp(endTimestamp);
        if (endTimestamp <= startTimestamp) throw new Error('End date must follow start date.');
        const transactions = await prisma.transaction.findMany({
            where: { userId, dateTimestamp: { gte: BigInt(startTimestamp), lt: BigInt(endTimestamp) } },
            orderBy: [{ dateTimestamp: 'desc' }, { id: 'desc' }],
            include: { category: true },
        });
        return transactions.map(transaction => this.toEntity(transaction));
    }

    async findAllByCategory(categoryId: number, userId: string): Promise<Transaction[]> {
        TransactionCategory.validateId(categoryId);
        Transaction.validateUserId(userId);
        const transactions = await prisma.transaction.findMany({
            where: { categoryId, userId },
            orderBy: { id: 'asc' },
            include: { category: true },
        });
        return transactions.map(transaction => this.toEntity(transaction));
    }

    async updateCategory(id: number, userId: string, newCategoryId: number): Promise<Transaction> {
        Transaction.validateId(id);
        Transaction.validateUserId(userId);
        TransactionCategory.validateId(newCategoryId);

        const category = await prisma.transactionCategory.findUniqueOrThrow({
            where: { id_userId: { id: newCategoryId, userId } },
        });
        Transaction.validateCategory(this.toCategoryEntity(category), userId);

        const updated = await prisma.transaction.update({
            where: { id, userId },
            data: { categoryId: newCategoryId },
            include: { category: true },
        });
        return this.toEntity(updated);
    }

    async updateAmountCents(id: number, userId: string, newAmountCents: number): Promise<Transaction> {
        Transaction.validateId(id);
        Transaction.validateUserId(userId);
        const amountCents = Transaction.validateAmount(newAmountCents);
        const updated = await prisma.transaction.update({
            where: { id, userId },
            data: { amountCents },
            include: { category: true },
        });
        return this.toEntity(updated);
    }

    async updateDescription(id: number, userId: string, newDescription: string | undefined): Promise<Transaction> {
        Transaction.validateId(id);
        Transaction.validateUserId(userId);
        const description = Transaction.validateDescription(newDescription);
        const updated = await prisma.transaction.update({
            where: { id, userId },
            data: { description: description ?? null },
            include: { category: true },
        });
        return this.toEntity(updated);
    }

    async updateLabel(id: number, userId: string, newLabel: string | undefined): Promise<Transaction> {
        Transaction.validateId(id);
        Transaction.validateUserId(userId);
        const label = Transaction.validateLabel(newLabel);
        const updated = await prisma.transaction.update({
            where: { id, userId },
            data: { label: label ?? null },
            include: { category: true },
        });
        return this.toEntity(updated);
    }

    async update(transaction: Transaction): Promise<Transaction> {
        const id = Transaction.validateId(transaction.id);
        const userId = Transaction.validateUserId(transaction.userId);
        const categoryId = TransactionCategory.validateId(transaction.category.id);
        const category = await prisma.transactionCategory.findUniqueOrThrow({
            where: { id_userId: { id: categoryId, userId } },
        });
        const validated = new Transaction(
            id, this.toCategoryEntity(category), transaction.amountCents, transaction.dateTimestamp,
            userId, transaction.description, transaction.label,
        );
        const updated = await prisma.transaction.update({
            where: { id, userId },
            data: {
                categoryId,
                amountCents: validated.amountCents,
                dateTimestamp: BigInt(validated.dateTimestamp),
                description: validated.description ?? null,
                label: validated.label ?? null,
            },
            include: { category: true },
        });
        return this.toEntity(updated);
    }

    async delete(id: number, userId: string): Promise<Transaction> {
        Transaction.validateId(id);
        Transaction.validateUserId(userId);
        const deleted = await prisma.transaction.delete({
            where: { id, userId },
            include: { category: true },
        });
        return this.toEntity(deleted);
    }
}
