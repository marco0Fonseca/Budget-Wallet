import { TransactionCategory } from './transactionCategory.ts';

// Initial limit compatible with a 32-bit integer in the ORM mapping
const MAX_AMOUNT_CENTS = 2_147_483_647;

export class Transaction {
  public readonly id: number;
  public readonly category: TransactionCategory;
  public readonly dateTimestamp: number;
  
  public readonly amountCents: number;

  public readonly userId: string;

  public readonly description?: string;

  constructor(id: number = -1, category: TransactionCategory, amountCents: number, dateTimestamp: number, userId: string, description?: string) {
    this.id = id === -1 ? -1 : Transaction.validateId(id);
    this.userId = Transaction.validateUserId(userId);
    this.category = Transaction.validateCategory(category, this.userId);
    this.amountCents = Transaction.validateAmount(amountCents);
    this.dateTimestamp = Transaction.validateDateTimestamp(dateTimestamp);

    const validatedDescription = Transaction.validateDescription(description);
    if (validatedDescription !== undefined) {
      this.description = validatedDescription;
    }
  }

  static validateId(id: number): number {
    if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) {
      throw new Error('Transaction identifier is invalid.');
    }
    return id;
  }

  static validateUserId(userId: string): string {
    if (typeof userId !== 'string' || userId.trim().length === 0 || userId !== userId.trim()) {
      throw new Error('User identifier is invalid.');
    }

    return userId;
  }

  static validateCategory(category: TransactionCategory, userId: string): TransactionCategory {
    if (!(category instanceof TransactionCategory)) {
      throw new Error('Transaction category is invalid.');
    }

    if (category.userId !== userId) {
      throw new Error('Transaction category must belong to the same user.');
    }

    return category;
  }

  static validateDateTimestamp(dateTimestamp: number): number {
    if (!Number.isSafeInteger(dateTimestamp) || !Number.isFinite(new Date(dateTimestamp).getTime())) {
      throw new Error('Date is invalid');
    }

    return dateTimestamp;
  }

  static validateDescription(description: string | undefined): string | undefined {
    if (description !== undefined && typeof description !== 'string') {
      throw new Error('Description must be a string.');
    }

    return description?.trim() || undefined;
  }

  static validateAmount(amountCents: number): number {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > MAX_AMOUNT_CENTS) {
      throw new Error('Amount must be an integer between 1 and 2147483647 cents.');
    }
    return amountCents;
  }

  monetaryValue(): string {
    return (this.amountCents / 100).toFixed(2);
  }
}
