import { TransactionType } from './transactionType.ts';

export class TransactionCategory {
    public readonly id: number = -1;
    public readonly label: string;
    public readonly type: TransactionType;
    public readonly parentId : number | null;
    public readonly userId: string;

    constructor(label: string, type: TransactionType, parentId : number | null, userId : string) {
        if (typeof label !== 'string' || label.trim().length === 0) {
            throw new Error('Category label is required.');
        }

        if (typeof userId !== 'string' || userId.trim().length === 0 || userId !== userId.trim()) {
            throw new Error('User identifier is invalid.');
        }

        if (!Object.values(TransactionType).includes(type)) {
            throw new Error('Transaction type is invalid.');
        }

        this.label = label.trim();
        this.type = type;
        this.parentId = parentId;
        this.userId = userId;
    }
}
