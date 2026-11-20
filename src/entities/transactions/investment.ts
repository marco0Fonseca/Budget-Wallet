import { TransactionCategory } from './transactions/transactionCategory.ts';
import { TransactionType } from './transactions/transactionType.ts';

export class Investment {
  public readonly id: number = -1;
  public readonly category: TransactionCategory;
  public readonly dateTimestamp: number;

  public readonly amountCents: number;

  // Decimal monthly rate: 0.01 represents 1% per month
  public readonly monthlyRate: number;
  public readonly monthsDuration: number;

  public readonly userId: string;

  public readonly description?: string;

  constructor(
    category: TransactionCategory,
    dateTimestamp: number,
    amountCents: number,
    monthlyRate: number,
    monthsDuration: number,
    userId: string,
    description?: string,
  ) {
    if (typeof userId !== 'string' || !userId.trim() || userId !== userId.trim()) {
      throw new Error('User identifier is invalid.');
    }
    if (!(category instanceof TransactionCategory) || category.type !== TransactionType.INVESTMENT) {
      throw new Error('An investment category is required.');
    }
    if (category.userId !== userId) {
      throw new Error('Investment category must belong to the same user.');
    }
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 2_147_483_647) {
      throw new Error('Amount must be an integer between 1 and 2147483647 cents.');
    }
    if (!Number.isSafeInteger(dateTimestamp) || !Number.isFinite(new Date(dateTimestamp).getTime())) {
      throw new Error('Investment start timestamp is invalid.');
    }
    if (!Number.isFinite(monthlyRate) || monthlyRate <= -1) {
      throw new Error('Monthly rate must be finite and greater than -1.');
    }
    if (!Number.isSafeInteger(monthsDuration) || monthsDuration <= 0) {
      throw new Error('Duration must be a positive integer number of months.');
    }
    if (description !== undefined && typeof description !== 'string') {
      throw new Error('Description must be a string.');
    }

    this.category = category;
    this.amountCents = amountCents;
    this.dateTimestamp = dateTimestamp;
    this.userId = userId;
    this.monthlyRate = monthlyRate;
    this.monthsDuration = monthsDuration;

    if (description?.trim()) this.description = description.trim();

    Object.freeze(this);
  }

  // Total amount including the initial contribution, rounded to the nearest cent only in the final result.
  projectedAmountCents(months: number = this.monthsDuration): number {
    if (!Number.isSafeInteger(months) || months < 0) {
      throw new Error('Elapsed months must be a non-negative integer.');
    }

    const elapsed = Math.min(months, this.monthsDuration);
    const amount = Math.round(this.amountCents * Math.pow(1 + this.monthlyRate, elapsed));

    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new Error('Projected amount exceeds the supported range.');
    }
    
    return amount;
  }

  // Projected return; a negative rate may result in losses. 
  projectedGainCents(months: number = this.monthsDuration): number {
    return this.projectedAmountCents(months) - this.amountCents;
  }

  projectedAmountOn(dateTimestamp: number): number {
    return this.projectedAmountCents(this.completedMonthsOn(dateTimestamp));
  }

  projectedGainOn(dateTimestamp: number): number {
    return this.projectedGainCents(this.completedMonthsOn(dateTimestamp));
  }

  projectedGainUntilNow(): number {
    return this.projectedGainOn(Date.now());
  }

  private completedMonthsOn(dateTimestamp: number): number {
    if (!Number.isSafeInteger(dateTimestamp) || !Number.isFinite(new Date(dateTimestamp).getTime())) {
      throw new Error('Projection timestamp is invalid.');
    }
    if (dateTimestamp < this.dateTimestamp) {
      throw new Error('Projection date cannot precede the investment start.');
    }
    const start = new Date(this.dateTimestamp);
    const target = new Date(dateTimestamp);
    let months = (target.getUTCFullYear() - start.getUTCFullYear()) * 12
      + target.getUTCMonth() - start.getUTCMonth();

    // Monthly anniversaries in UTC; a non-existent day falls on the last day of the month.
    const anniversary = new Date(this.dateTimestamp);
    anniversary.setUTCDate(1);
    anniversary.setUTCFullYear(target.getUTCFullYear(), target.getUTCMonth(), 1);
    const monthEnd = new Date(anniversary.getTime());
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
    anniversary.setUTCDate(Math.min(start.getUTCDate(), monthEnd.getUTCDate()));
    if (dateTimestamp < anniversary.getTime()) months -= 1;
    return Math.min(months, this.monthsDuration);
  }
}
