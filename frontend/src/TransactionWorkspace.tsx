import { useMemo, useState, type ReactNode } from 'react';
import './transactionStyles.css';

type TransactionType = 'INCOME' | 'EXPENSE';
type TransactionExample = {
  id: string;
  title: string;
  category: string;
  date: string;
  amountCents: number;
  type: TransactionType;
  description: string;
  icon: 'income' | 'market' | 'food' | 'health' | 'transport' | 'work';
};

const samples: TransactionExample[] = [
  { id: 'salary', title: 'Salário', category: 'Salário', date: '2026-11-18', amountCents: 520000, type: 'INCOME', description: 'Salário mensal', icon: 'income' },
  { id: 'market', title: 'Mercado', category: 'Alimentação › Mercado', date: '2026-11-15', amountCents: 32045, type: 'EXPENSE', description: 'Compras da semana', icon: 'market' },
  { id: 'restaurant', title: 'Restaurante', category: 'Alimentação › Delivery', date: '2026-11-15', amountCents: 6890, type: 'EXPENSE', description: 'Almoço', icon: 'food' },
  { id: 'pharmacy', title: 'Farmácia', category: 'Saúde', date: '2026-11-15', amountCents: 5480, type: 'EXPENSE', description: 'Itens de cuidado pessoal', icon: 'health' },
  { id: 'transport', title: 'Transporte', category: 'Transporte', date: '2026-11-10', amountCents: 8000, type: 'EXPENSE', description: 'Deslocamento', icon: 'transport' },
  { id: 'freelance', title: 'Freelance', category: 'Freelance', date: '2026-11-10', amountCents: 90000, type: 'INCOME', description: 'Projeto de design', icon: 'work' },
  { id: 'rent', title: 'Aluguel', category: 'Moradia', date: '2026-10-08', amountCents: 145000, type: 'EXPENSE', description: 'Aluguel mensal', icon: 'work' },
  { id: 'oct-salary', title: 'Salário', category: 'Salário', date: '2026-10-05', amountCents: 520000, type: 'INCOME', description: 'Salário mensal', icon: 'income' },
  { id: 'sep-market', title: 'Compras do mês', category: 'Compras', date: '2026-09-12', amountCents: 17890, type: 'EXPENSE', description: 'Itens para casa', icon: 'market' },
  { id: 'sep-freelance', title: 'Freelance', category: 'Freelance', date: '2026-09-03', amountCents: 75000, type: 'INCOME', description: 'Projeto de design', icon: 'work' },
];
const transactionCategories = ['Salário', 'Freelance', 'Renda extra', 'Alimentação', 'Mercado', 'Delivery', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Entretenimento', 'Compras', 'Contas e serviços', 'Assinaturas', 'Cuidados pessoais', 'Impostos e taxas'];
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDateFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const amount = (cents: number) => currency.format(cents / 100);

function TxIcon({ name, size = 18 }: { name: TransactionExample['icon'] | 'search' | 'filter' | 'plus' | 'edit' | 'delete' | 'expense'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    income: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M7 6V4h10v2m-7 7 2-2 2 2m-2-2v6"/></>,
    expense: <><path d="M3 8h18v12H3zM3 8V5h18v3M16 14h3"/></>,
    market: <><path d="M3 10h18l-2 10H5L3 10Z"/><path d="m8 10 4-7 4 7M9 14v3m6-3v3"/></>,
    food: <><path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M20 21V3c-4 3-5 7-5 11h5"/></>,
    health: <><path d="M10 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><path d="M14 3h4v4m-9 5h8m-4-4v8m1-10 4 4"/></>,
    transport: <><path d="M5 16V6h14v10M5 12h14M7 19h2m6 0h2M3 16h18"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></>,
    work: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3m-13 5h18m-11 0v2h4v-2"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5"/></>,
    filter: <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    edit: <><path d="m4 20 4.5-1 11-11-3.5-3.5-11 11L4 20Zm10-13 3.5 3.5"/></>,
    delete: <><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v6m4-6v6"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function SummaryCard({ label, cents, tone, icon }: { label: string; cents: number; tone: string; icon: 'income' | 'expense' | 'plus' }) {
  return <article className={`transaction-summary-card ${tone}`}><span className="transaction-summary-icon"><TxIcon name={icon} size={19}/></span><div><span>{label}</span><strong>{amount(cents)}</strong></div></article>;
}

export function TransactionWorkspace({ selectedMonth }: { selectedMonth: string }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'ALL' | TransactionType>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [onlyWithDescription, setOnlyWithDescription] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const monthTransactions = useMemo(() => samples.filter(item => item.date.startsWith(selectedMonth)), [selectedMonth]);
  const filtered = useMemo(() => monthTransactions.filter(item => (type === 'ALL' || item.type === type)
    && (!selectedCategories.length || selectedCategories.includes(item.category) || selectedCategories.includes(item.category.split(' › ')[0] ?? ''))
    && (!onlyWithDescription || Boolean(item.description))
    && `${item.title} ${item.category} ${item.description}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))), [monthTransactions, search, type, onlyWithDescription, selectedCategories]);
  const selected = filtered.find(item => item.id === selectedId) ?? null;
  const income = monthTransactions.filter(item => item.type === 'INCOME').reduce((sum, item) => sum + item.amountCents, 0);
  const expense = monthTransactions.filter(item => item.type === 'EXPENSE').reduce((sum, item) => sum + item.amountCents, 0);
  const grouped = [...new Set(filtered.map(item => item.date))].map(date => ({ date, items: filtered.filter(item => item.date === date) }));

  return <div className="transaction-workspace">
    <div className="transaction-heading"><div><span className="eyebrow">RECEITAS E DESPESAS</span><h2>Seus lançamentos</h2><p>Prévia com transações de exemplo</p></div><button className="primary-action" type="button" disabled title="Disponível após integração"><TxIcon name="plus"/>Nova transação</button></div>
    <div className="transaction-summary"><SummaryCard label="Receitas" cents={income} tone="income" icon="income"/><SummaryCard label="Despesas" cents={expense} tone="expense" icon="expense"/><SummaryCard label="Resultado do mês" cents={income - expense} tone="result" icon="plus"/></div>
    <div className="transaction-search-row"><label className="transaction-search"><TxIcon name="search"/><span className="sr-only">Buscar transação</span><input type="search" placeholder="Buscar transação…" value={search} onChange={event => setSearch(event.target.value)}/></label><div className="transaction-filter-wrap"><button type="button" className={`transaction-filter-button${filtersOpen ? ' active' : ''}`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)}><TxIcon name="filter"/>Filtros</button>{filtersOpen && <div className="transaction-filter-popover"><strong>Categorias</strong><div className="transaction-category-options">{transactionCategories.map(category => <label key={category}><input type="checkbox" checked={selectedCategories.includes(category)} onChange={event => setSelectedCategories(current => event.target.checked ? [...current, category] : current.filter(value => value !== category))}/>{category}</label>)}</div><label className="transaction-description-option"><input type="checkbox" checked={onlyWithDescription} onChange={event => setOnlyWithDescription(event.target.checked)}/>Com descrição</label><button type="button" onClick={() => setFiltersOpen(false)}>Concluir</button></div>}</div></div>
    <div className="transaction-type-row" role="group" aria-label="Tipo de transação">{([{value:'ALL', label:'Todas'}, {value:'INCOME', label:'Receitas'}, {value:'EXPENSE', label:'Despesas'}] as const).map(option => <button type="button" key={option.value} aria-pressed={type === option.value} className={type === option.value ? 'selected' : ''} onClick={() => { setType(option.value); setSelectedId(null); }}>{option.label}</button>)}{selectedCategories.map(category => <button type="button" className="transaction-applied-filter" key={category} onClick={() => setSelectedCategories(current => current.filter(value => value !== category))}>{category}<span aria-hidden="true">×</span></button>)}<span aria-live="polite">{filtered.length} {filtered.length === 1 ? 'lançamento' : 'lançamentos'}</span></div>
    <div className={`transaction-results-layout${selected ? '' : ' without-selection'}`}><section className="transaction-list-card" aria-label="Lista de transações">{grouped.length ? grouped.map(group => <div className="transaction-date-group" key={group.date}><h3>{shortDateFormat.format(new Date(`${group.date}T12:00:00Z`))}</h3>{group.items.map(item => <button type="button" key={item.id} className={`transaction-list-item${selected?.id === item.id ? ' selected' : ''}`} onClick={() => setSelectedId(current => current === item.id ? null : item.id)}><span className={`transaction-item-icon ${item.type.toLowerCase()}`}><TxIcon name={item.icon}/></span><span className="transaction-item-copy"><strong>{item.title}</strong><small>{item.category} · {shortDateFormat.format(new Date(`${item.date}T12:00:00Z`))}</small></span><strong className={`transaction-item-amount ${item.type.toLowerCase()}`}>{item.type === 'INCOME' ? '+' : '−'} {amount(item.amountCents)}</strong></button>)}</div>) : <div className="transaction-empty-results">Nenhum lançamento encontrado.</div>}</section>
      {selected && <aside className="transaction-detail-card"><div className="transaction-detail-heading"><span className="eyebrow">LANÇAMENTO SELECIONADO</span><button className="transaction-clear-selection" type="button" onClick={() => setSelectedId(null)} aria-label="Limpar lançamento selecionado">×</button><h3>{selected.title}</h3></div><strong className={`transaction-detail-amount ${selected.type.toLowerCase()}`}>{selected.type === 'INCOME' ? '+' : '−'} {amount(selected.amountCents)}</strong><dl><div><dt>Tipo</dt><dd>{selected.type === 'INCOME' ? 'Receita' : 'Despesa'}</dd></div><div><dt>Categoria</dt><dd>{selected.category}</dd></div><div><dt>Data</dt><dd>{dateFormat.format(new Date(`${selected.date}T12:00:00Z`))}</dd></div><div><dt>Descrição</dt><dd>{selected.description}</dd></div></dl><div className="transaction-detail-actions"><button type="button" disabled title="Disponível após integração"><TxIcon name="edit"/>Editar</button><button type="button" disabled title="Disponível após integração"><TxIcon name="delete"/>Excluir</button></div></aside>}
    </div>
  </div>;
}
