import { TransactionType } from './transactionType.ts';

export class TransactionCategory {
    public readonly id: number;
    public readonly label: string;
    public readonly type: TransactionType;
    public readonly parentId : number | null;
    public readonly userId: string;
    public readonly isDefault: boolean;

    constructor(id: number = -1, label: string, type: TransactionType, parentId : number | null, userId : string, isDefault: boolean = false) {
        this.id = id === -1 ? -1 : TransactionCategory.validateId(id);
        this.label = TransactionCategory.validateLabel(label);
        this.type = TransactionCategory.validateType(type);
        this.parentId = TransactionCategory.validateParentId(parentId);
        this.userId = TransactionCategory.validateUserId(userId);
        this.isDefault = TransactionCategory.validateIsDefault(isDefault);
    }

    static validateId(id: number): number {
        if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
            throw new Error('Category identifier is invalid.');
        }

        return id;
    }

    static validateParentId(parentId: number | null): number | null {
        return parentId === null ? null : TransactionCategory.validateId(parentId);
    }

    static validateIsDefault(isDefault: boolean): boolean {
        if (typeof isDefault !== 'boolean') {
            throw new Error('Default category flag must be a boolean.');
        }

        return isDefault;
    }

    static validateLabel(label: string): string {
        if (typeof label !== 'string' || label.trim().length === 0) {
                throw new Error('Category label is required.');
        }

        return label.trim();
    }

    static validateUserId(userId: string): string {
        if (typeof userId !== 'string' || userId.trim().length === 0 || userId !== userId.trim()) {
            throw new Error('User identifier is invalid.');
        }

        return userId;
    }

    static validateType(type: TransactionType): TransactionType {
        if (!Object.values(TransactionType).includes(type)) {
            throw new Error('Transaction type is invalid.');
        }

        return type;
    }
}
