import type { TransactionType } from './transactionType.ts';

export type DefaultCategoryDefinition = {
    label: string;
    type: TransactionType;
};


// Copied for each user when an account is created. All are root categories.

export const defaultCategories = [
    { label: 'Salário', type: 'INCOME' },
    { label: 'Freelance', type: 'INCOME' },
    { label: 'Renda extra', type: 'INCOME' },
    { label: 'Alimentação', type: 'EXPENSE' },
    { label: 'Moradia', type: 'EXPENSE' },
    { label: 'Transporte', type: 'EXPENSE' },
    { label: 'Saúde', type: 'EXPENSE' },
    { label: 'Educação', type: 'EXPENSE' },
    { label: 'Entretenimento', type: 'EXPENSE' },
    { label: 'Compras', type: 'EXPENSE' },
    { label: 'Contas e serviços', type: 'EXPENSE' },
    { label: 'Assinaturas', type: 'EXPENSE' },
    { label: 'Cuidados pessoais', type: 'EXPENSE' },
    { label: 'Impostos e taxas', type: 'EXPENSE' },
    { label: 'Investimentos', type: 'INVESTMENT' },
    { label: 'CDI', type: 'INVESTMENT' },
    { label: 'Locação', type: 'INVESTMENT' },
    { label: 'Tesouro Direto', type: 'INVESTMENT' },
    { label: 'CDB', type: 'INVESTMENT' },
    { label: 'Ações', type: 'INVESTMENT' },
    { label: 'Fundos imobiliários', type: 'INVESTMENT' },
] as const satisfies readonly DefaultCategoryDefinition[];
