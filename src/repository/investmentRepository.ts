import type { Investment as PrismaInvestment, TransactionCategory as PrismaCategory } from '../generated/prisma/client.ts';
import { Investment } from '../entities/transactions/investment.ts';
import { TransactionCategory } from '../entities/transactions/transactionCategory.ts';
import { prisma } from '../repository/repository.ts';

export class InvestmentRepository {
    private toEntity(investment: PrismaInvestment & { category: PrismaCategory }): Investment {
        const category = new TransactionCategory(
            investment.category.id, investment.category.label, investment.category.type,
            investment.category.parentId, investment.category.userId, investment.category.isDefault,
        );
        return new Investment(
            investment.id,
            category,
            Number(investment.dateTimestamp),
            Number(investment.amountCents),
            Number(investment.monthlyRate),
            Number(investment.monthsDuration),
            investment.userId,
            investment.description ?? undefined,
        );
    }

    async create(investment: Investment): Promise<Investment> {
        if (investment.id !== -1) throw new Error('Only new investments with id -1 can be created.');
        Investment.validateCategory(investment.category, investment.userId);
        TransactionCategory.validateId(investment.category.id);
        const created = await prisma.investment.create({
            data: {
                user: { connect: { id: investment.userId } },
                category: { connect: {
                    id_userId: { id: investment.category.id, userId: investment.userId },
                    type: 'INVESTMENT',
                } },
                dateTimestamp: BigInt(investment.dateTimestamp),
                amountCents: investment.amountCents,
                monthlyRate: investment.monthlyRate,
                monthsDuration: Investment.validateMonthsDuration(investment.monthsDuration),
                description: investment.description ?? null,
            },
            include: { category: true },
        });
        return this.toEntity(created);
    }

    async findById(id: number, userId: string): Promise<Investment | null> {
        Investment.validateId(id);
        Investment.validateUserId(userId);
        const investment = await prisma.investment.findUnique({
            where: { id, userId },
            include: { category: true },
        });
        return investment ? this.toEntity(investment) : null;
    }

    async findAllByUserId(userId: string): Promise<Investment[]> {
        Investment.validateUserId(userId);
        const investments = await prisma.investment.findMany({
            where: { userId },
            orderBy: { id: 'asc' },
            include: { category: true },
        });
        return investments.map(investment => this.toEntity(investment));
    }

    async findAllByCategory(categoryId: number, userId: string): Promise<Investment[]> {
        TransactionCategory.validateId(categoryId);
        Investment.validateUserId(userId);
        const investments = await prisma.investment.findMany({
            where: { categoryId, userId },
            orderBy: { id: 'asc' },
            include: { category: true },
        });
        return investments.map(investment => this.toEntity(investment));
    }

    async update(investment: Investment): Promise<Investment> {
        const id = Investment.validateId(investment.id);
        const userId = Investment.validateUserId(investment.userId);
        const categoryId = TransactionCategory.validateId(investment.category.id);
        const category = await prisma.transactionCategory.findUniqueOrThrow({
            where: { id_userId: { id: categoryId, userId }, type: 'INVESTMENT' },
        });
        const validated = new Investment(
            id,
            new TransactionCategory(category.id, category.label, category.type, category.parentId, category.userId, category.isDefault),
            investment.dateTimestamp, investment.amountCents, investment.monthlyRate,
            investment.monthsDuration, userId, investment.description,
        );
        const updated = await prisma.investment.update({
            where: { id, userId },
            data: {
                categoryId,
                dateTimestamp: BigInt(validated.dateTimestamp),
                amountCents: validated.amountCents,
                monthlyRate: validated.monthlyRate,
                monthsDuration: validated.monthsDuration,
                description: validated.description ?? null,
            },
            include: { category: true },
        });
        return this.toEntity(updated);
    }

    async updateAmountCents(id: number, userId: string, newAmountCents: number): Promise<Investment> {
        Investment.validateId(id);
        Investment.validateUserId(userId);
        const amountCents = Investment.validateAmount(newAmountCents);
        const updated = await prisma.investment.update({
            where: { id, userId },
            data: { amountCents: amountCents },
            include: { category: true },
        });
        return this.toEntity(updated);
    }

    async updateMonthlyRate(id: number, userId: string, newMonthlyRate: number): Promise<Investment> {
        Investment.validateId(id);
        Investment.validateUserId(userId);
        const monthlyRate = Investment.validateMonthlyRate(newMonthlyRate);
        const updated = await prisma.investment.update({
            where: { id, userId },
            data: { monthlyRate: monthlyRate },
            include: { category: true },
        });
        return this.toEntity(updated);
    }

    async updateMonthsDuration(id: number, userId: string, newMonthsDuration: number): Promise<Investment> {
        Investment.validateId(id);
        Investment.validateUserId(userId);
        const monthsDuration = Investment.validateMonthsDuration(newMonthsDuration);
        const updated = await prisma.investment.update({
            where: { id, userId },
            data: { monthsDuration: monthsDuration },
            include: { category: true },
        });
        return this.toEntity(updated);
    }

    async updateDescription(id: number, userId: string, newDescription: string | undefined): Promise<Investment> {
        Investment.validateId(id);
        Investment.validateUserId(userId);
        const description = Investment.validateDescription(newDescription);
        const updated = await prisma.investment.update({
            where: { id, userId },
            data: { description: description ?? null },
            include: { category: true },
        });
        return this.toEntity(updated);
    }

    async delete(id: number, userId: string): Promise<Investment> {
        Investment.validateId(id);
        Investment.validateUserId(userId);
        const deleted = await prisma.investment.delete({
            where: { id, userId },
            include: { category: true },
        });
        return this.toEntity(deleted);
    }
}
