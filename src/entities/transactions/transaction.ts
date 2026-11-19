import { TransactionCategory } from './transactionCategory.ts';

// Initial limit compatible with a 32-bit integer in the ORM mapping
const MAX_AMOUNT_CENTS = 2_147_483_647;

export class Transaction {
  public readonly id: number = -1;
  public readonly category: TransactionCategory;
  public readonly dateTimestamp: number;
  
  public readonly amountCents: number;

  public readonly userId: string;

  public readonly description?: string;

  constructor(
    category: TransactionCategory,
    amountCents: number,
    dateTimestamp: number,
    userId: string,
    description?: string,
  ) {
    if (typeof userId !== 'string' || userId.trim().length === 0 || userId !== userId.trim()) {
      throw new Error('User identifier is invalid.');
    }

    if (!(category instanceof TransactionCategory)) {
      throw new Error('Transaction category is invalid.');
    }

    if (category.userId !== userId) {
      throw new Error('Transaction category must belong to the same user.');
    }

    const date = new Date(dateTimestamp);
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
      throw new Error('Date is invalid');
    }

    if (description !== undefined && typeof description !== 'string') {
      throw new Error('Description must be a string.');
    }

    this.category = category;
    this.amountCents = Transaction.validateAmount(amountCents);
    this.dateTimestamp = dateTimestamp;
    this.userId = userId;

    const trimmedDescription = description?.trim();
    if (trimmedDescription) {
      this.description = trimmedDescription;
    }
  }

  private static validateAmount(amountCents: number): number {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > MAX_AMOUNT_CENTS) {
      throw new Error('Amount must be an integer between 1 and 2147483647 cents.');
    }
    return amountCents;
  }

  monetaryValue(): string {
    return (this.amountCents / 100).toFixed(2);
  }
}
