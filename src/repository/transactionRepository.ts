import type { Transaction as PrismaTransaction, TransactionCategory as PrismaCategory } from '../generated/prisma/client.ts';
import { Transaction } from '../entities/transactions/transaction.ts';
import { TransactionCategory } from '../entities/transactions/transactionCategory.ts';
import { prisma } from '../repository/repository.ts';

export class TransactionRepository {
    private toEntity(transaction: PrismaTransaction & { category: PrismaCategory }): Transaction {
        const category = new TransactionCategory(
            transaction.category.id, transaction.category.label, transaction.category.type,
            transaction.category.parentId, transaction.category.userId, transaction.category.isDefault,
        );
        return new Transaction(
            transaction.id,
            category,
            transaction.amountCents,
            Number(transaction.dateTimestamp),
            transaction.userId,
            transaction.description ?? undefined,
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
