import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { apiBaseUrl, authTokenKey } from './api.ts';
import { parseBrlAmountCents } from './money.ts';
import './transactionStyles.css';

type TransactionType = 'INCOME' | 'EXPENSE';
type TransactionItem = {
  id: number;
  title: string;
  category: string;
  categoryId: number;
  parentId: number | null;
  date: string;
  amountCents: number;
  type: TransactionType;
  description: string;
  label: string;
};

type ApiCategory = { id: number; label: string; type: 'INCOME' | 'EXPENSE' | 'INVESTMENT'; parentId: number | null };
type ApiTransaction = { id: number; category: ApiCategory; dateTimestamp: number; amountCents: number; label: string | null; description: string | null };
type ApiTotals = { incomeCents: number; expenseCents: number; resultCents: number };
const emptyTotals: ApiTotals = { incomeCents: 0, expenseCents: 0, resultCents: 0 };
const localDateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
function dateInSaoPaulo(timestamp: number): string {
  const parts = Object.fromEntries(localDateParts.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function isCategory(value: unknown): value is ApiCategory {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return Number.isInteger(item.id) && typeof item.label === 'string'
    && (item.type === 'INCOME' || item.type === 'EXPENSE' || item.type === 'INVESTMENT')
    && (item.parentId === null || Number.isInteger(item.parentId));
}
function isTransaction(value: unknown): value is ApiTransaction {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return Number.isInteger(item.id) && isCategory(item.category) && item.category.type !== 'INVESTMENT'
    && Number.isSafeInteger(item.dateTimestamp) && Number.isInteger(item.amountCents)
    && (item.label === null || typeof item.label === 'string')
    && (item.description === null || typeof item.description === 'string');
}
function isTotals(value: unknown): value is ApiTotals {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return Number.isSafeInteger(item.incomeCents) && Number.isSafeInteger(item.expenseCents) && Number.isSafeInteger(item.resultCents);
}
function getApiError(payload: unknown, fallback: string): string {
  return typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string' ? payload.error : fallback;
}
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDateFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const amount = (cents: number) => currency.format(cents / 100);

function TxIcon({ name, size = 18 }: { name: 'income' | 'expense' | 'search' | 'filter' | 'plus' | 'edit' | 'delete'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    income: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M7 6V4h10v2m-7 7 2-2 2 2m-2-2v6"/></>,
    expense: <><path d="M3 8h18v12H3zM3 8V5h18v3M16 14h3"/></>,
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

export function TransactionWorkspace({ selectedMonth, onSelectMonth }: { selectedMonth: string; onSelectMonth: (month: string) => void }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'ALL' | TransactionType>('ALL');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftType, setDraftType] = useState<'ALL' | TransactionType>('ALL');
  const [draftCategories, setDraftCategories] = useState<number[]>([]);
  const [draftWithDescription, setDraftWithDescription] = useState(false);
  const [onlyWithDescription, setOnlyWithDescription] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [records, setRecords] = useState<ApiTransaction[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [totals, setTotals] = useState<ApiTotals>(emptyTotals);
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [newType, setNewType] = useState<TransactionType>('EXPENSE');
  const [newCategory, setNewCategory] = useState<number | null>(null);
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(selectedMonth === 'all' ? dateInSaoPaulo(Date.now()).slice(0, 7) : selectedMonth);
  const newLabelRef = useRef<HTMLInputElement>(null);
  const newAmountRef = useRef<HTMLInputElement>(null);
  const createDialogRef = useRef<HTMLElement>(null);
  const deleteDialogRef = useRef<HTMLElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const categoryPickerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const categoriesByType: Record<TransactionType, ApiCategory[]> = {
    INCOME: categories.filter(category => category.type === 'INCOME'),
    EXPENSE: categories.filter(category => category.type === 'EXPENSE'),
  };
  const monthTransactions = useMemo<TransactionItem[]>(() => records.map(record => {
    const parent = categories.find(category => category.id === record.category.parentId);
    return {
      id: record.id,
      title: record.label || record.category.label,
      category: parent ? `${parent.label} › ${record.category.label}` : record.category.label,
      categoryId: record.category.id,
      parentId: record.category.parentId,
      date: dateInSaoPaulo(record.dateTimestamp),
      amountCents: record.amountCents,
      type: record.category.type as TransactionType,
      description: record.description ?? '',
      label: record.label ?? '',
    };
  }), [records, categories]);
  const filtered = useMemo(() => monthTransactions.filter(item => (type === 'ALL' || item.type === type)
    && (!selectedCategories.length || selectedCategories.includes(item.categoryId) || (item.parentId !== null && selectedCategories.includes(item.parentId)))
    && (!onlyWithDescription || Boolean(item.description))
    && `${item.title} ${item.category} ${item.description}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))), [monthTransactions, search, type, onlyWithDescription, selectedCategories]);
  const selected = filtered.find(item => item.id === selectedId) ?? null;
  const income = totals.incomeCents;
  const expense = totals.expenseCents;
  const grouped = [...new Set(filtered.map(item => item.date))].map(date => ({ date, items: filtered.filter(item => item.date === date) }));
  const formCategories = categoriesByType[newType];
  const calendarYear = Number(calendarMonth.slice(0, 4));
  const calendarMonthNumber = Number(calendarMonth.slice(5, 7));
  const firstWeekday = (new Date(Date.UTC(calendarYear, calendarMonthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(calendarYear, calendarMonthNumber, 0)).getUTCDate();
  const calendarTitle = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(calendarYear, calendarMonthNumber - 1, 1)));

  function changeCalendarMonth(offset: number) {
    const date = new Date(Date.UTC(calendarYear, calendarMonthNumber - 1 + offset, 1));
    setCalendarMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  function openFilters() {
    setDraftType(type);
    setDraftCategories(selectedCategories);
    setDraftWithDescription(onlyWithDescription);
    setFiltersOpen(open => !open);
  }

  function openCreateDialog() {
    setEditingId(null);
    setNewType('EXPENSE');
    setNewCategory(null);
    setNewAmount('');
    const today = dateInSaoPaulo(Date.now());
    setNewDate(today);
    setCalendarMonth(today.slice(0, 7));
    setNewLabel('');
    setNewDescription('');
    setCreateError('');
    setCategoryPickerOpen(false);
    setCalendarOpen(false);
    setCreateDialogOpen(true);
  }

  function openEditDialog(item: TransactionItem) {
    setEditingId(item.id);
    setNewType(item.type);
    setNewCategory(item.categoryId);
    const cents = String(item.amountCents).padStart(3, '0');
    setNewAmount(`${cents.slice(0, -2)},${cents.slice(-2)}`);
    setNewDate(item.date);
    setCalendarMonth(item.date.slice(0, 7));
    setNewLabel(item.label);
    setNewDescription(item.description);
    setCreateError('');
    setCategoryPickerOpen(false);
    setCalendarOpen(false);
    setCreateDialogOpen(true);
  }

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setCreateError('');
    const amountCents = parseBrlAmountCents(newAmount);
    if (amountCents === null) {
      setCreateError('Informe um valor positivo em reais, com até duas casas decimais.');
      newAmountRef.current?.focus();
      return;
    }
    if (newCategory === null) {
      setCreateError('Selecione uma categoria.');
      return;
    }
    const existing = editingId === null ? null : records.find(record => record.id === editingId);
    const dateTimestamp = existing && dateInSaoPaulo(existing.dateTimestamp) === newDate
      ? existing.dateTimestamp : Date.parse(`${newDate}T15:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || !Number.isSafeInteger(dateTimestamp) || new Date(dateTimestamp).toISOString().slice(0, 10) !== newDate) {
      setCreateError('Selecione uma data válida.');
      return;
    }
    const token = sessionStorage.getItem(authTokenKey);
    if (!token) {
      setCreateError('Sua sessão não foi encontrada. Entre novamente para salvar o lançamento.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/transactions${editingId === null ? '' : `/${editingId}`}`, {
        method: editingId === null ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: newType, categoryId: newCategory, amountCents, dateTimestamp, label: newLabel.trim(), description: newDescription.trim() }),
      });
      if (response.status !== (editingId === null ? 201 : 200)) {
        const payload: unknown = await response.json().catch(() => null);
        throw new Error(getApiError(payload, 'Não foi possível salvar o lançamento.'));
      }
      setCreateDialogOpen(false);
      if (editingId === null) {
        setSearch('');
        setType('ALL');
        setSelectedCategories([]);
        setOnlyWithDescription(false);
      }
      if (selectedMonth !== 'all' && selectedMonth !== newDate.slice(0, 7)) onSelectMonth('all');
      else setReloadVersion(version => version + 1);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Não foi possível conectar ao servidor.');
    } finally {
      setIsSaving(false);
    }
  }

  function openDeleteDialog(item: TransactionItem) {
    setDeleteError('');
    setDeletingTransaction(item);
  }

  async function confirmDeleteTransaction() {
    if (!deletingTransaction || isDeleting) return;
    const token = sessionStorage.getItem(authTokenKey);
    if (!token) {
      setDeleteError('Sua sessão não foi encontrada. Entre novamente para excluir o lançamento.');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');
    try {
      const response = await fetch(`${apiBaseUrl}/api/transactions/${deletingTransaction.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status !== 204) {
        const payload: unknown = await response.json().catch(() => null);
        throw new Error(getApiError(payload, 'Não foi possível excluir o lançamento.'));
      }
      setDeletingTransaction(null);
      setSelectedId(null);
      setReloadVersion(version => version + 1);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível conectar ao servidor.');
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoadState('loading');
    setLoadError('');
    setRecords([]);
    setTotals(emptyTotals);
    setSelectedId(null);
    const token = sessionStorage.getItem(authTokenKey);
    if (!token) {
      setLoadError('Sua sessão não foi encontrada. Entre novamente para consultar seus lançamentos.');
      setLoadState('error');
      return;
    }
    async function loadTransactions() {
      try {
        const query = selectedMonth === 'all' ? '' : `?month=${encodeURIComponent(selectedMonth)}`;
        const headers = { Authorization: `Bearer ${token}` };
        const [transactionsResponse, categoriesResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/transactions${query}`, { headers, signal: controller.signal }),
          fetch(`${apiBaseUrl}/api/categories`, { headers, signal: controller.signal }),
        ]);
        const transactionsPayload: unknown = await transactionsResponse.json();
        const categoriesPayload: unknown = await categoriesResponse.json();
        if (!transactionsResponse.ok) throw new Error(getApiError(transactionsPayload, 'Não foi possível carregar seus lançamentos.'));
        if (!categoriesResponse.ok) throw new Error(getApiError(categoriesPayload, 'Não foi possível carregar suas categorias.'));
        if (typeof transactionsPayload !== 'object' || transactionsPayload === null
          || !('transactions' in transactionsPayload) || !Array.isArray(transactionsPayload.transactions)
          || !transactionsPayload.transactions.every(isTransaction)
          || !('totals' in transactionsPayload) || !isTotals(transactionsPayload.totals)
          || typeof categoriesPayload !== 'object' || categoriesPayload === null
          || !('categories' in categoriesPayload) || !Array.isArray(categoriesPayload.categories)
          || !categoriesPayload.categories.every(isCategory)) {
          throw new Error('O servidor retornou dados financeiros inválidos.');
        }
        setRecords(transactionsPayload.transactions);
        setCategories(categoriesPayload.categories);
        setTotals(transactionsPayload.totals);
        setLoadState('loaded');
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar seus lançamentos.');
        setLoadState('error');
      }
    }
    void loadTransactions();
    return () => controller.abort();
  }, [selectedMonth, reloadVersion]);

  useEffect(() => {
    if (!createDialogOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    newLabelRef.current?.focus();
    return () => previousFocus?.focus();
  }, [createDialogOpen]);

  useEffect(() => {
    if (!createDialogOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (categoryPickerOpen) setCategoryPickerOpen(false);
        else if (calendarOpen) setCalendarOpen(false);
        else if (!isSaving) setCreateDialogOpen(false);
        event.preventDefault();
        return;
      }
      if (event.key !== 'Tab' || !createDialogRef.current) return;
      const focusable = Array.from(createDialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [createDialogOpen, categoryPickerOpen, calendarOpen, isSaving]);

  useEffect(() => {
    if (!filtersOpen && !categoryPickerOpen && !calendarOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (filtersOpen && !filterRef.current?.contains(event.target)) setFiltersOpen(false);
      if (categoryPickerOpen && !categoryPickerRef.current?.contains(event.target)) setCategoryPickerOpen(false);
      if (calendarOpen && !calendarRef.current?.contains(event.target)) setCalendarOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [filtersOpen, categoryPickerOpen, calendarOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setFiltersOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [filtersOpen]);

  useEffect(() => {
    if (!deletingTransaction) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    deleteCancelRef.current?.focus();
    return () => previousFocus?.focus();
  }, [deletingTransaction]);

  useEffect(() => {
    if (!deletingTransaction) return;
    function handleDeleteDialogKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) {
        event.preventDefault();
        setDeletingTransaction(null);
      }
      if (event.key !== 'Tab' || !deleteDialogRef.current) return;
      const buttons = Array.from(deleteDialogRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', handleDeleteDialogKeyDown);
    return () => document.removeEventListener('keydown', handleDeleteDialogKeyDown);
  }, [deletingTransaction, isDeleting]);

  return <div className="transaction-workspace">
    <div className="transaction-summary"><SummaryCard label="Receitas" cents={income} tone="income" icon="income"/><SummaryCard label="Despesas" cents={expense} tone="expense" icon="expense"/><SummaryCard label={selectedMonth === 'all' ? 'Resultado do período' : 'Resultado do mês'} cents={totals.resultCents} tone="result" icon="plus"/></div>
    <div className="transaction-search-row">
      <label className="transaction-search"><TxIcon name="search" size={19}/><span className="sr-only">Buscar transação</span><input type="search" placeholder="Buscar transação…" value={search} onChange={event => setSearch(event.target.value)}/></label>
      <div className="transaction-filter-wrap" ref={filterRef}>
        <button type="button" className={`transaction-filter-button${filtersOpen || type !== 'ALL' || selectedCategories.length || onlyWithDescription ? ' active' : ''}`} aria-expanded={filtersOpen} aria-controls="transaction-filter-popover" onClick={openFilters}><TxIcon name="filter" size={19}/>Filtros</button>
        {filtersOpen && <div className="transaction-filter-popover" id="transaction-filter-popover" role="group" aria-label="Filtros de transações">
          <div className="transaction-filter-options">
            <fieldset><legend>Tipo de transação</legend>{([{value:'ALL', label:'Todos'}, {value:'INCOME', label:'Receitas'}, {value:'EXPENSE', label:'Despesas'}] as const).map(option => <label key={option.value}><input type="radio" name="transactionFilterType" checked={draftType === option.value} onChange={() => { setDraftType(option.value); setDraftCategories([]); }}/>{option.label}</label>)}</fieldset>
            <fieldset><legend>Categorias</legend>{(['INCOME', 'EXPENSE'] as const).filter(group => draftType === 'ALL' || draftType === group).map(group => <div className="transaction-category-section" key={group}><strong>{group === 'INCOME' ? 'Receitas' : 'Despesas'}</strong>{categoriesByType[group].map(category => <label key={category.id}><input type="checkbox" checked={draftCategories.includes(category.id)} onChange={event => setDraftCategories(current => event.target.checked ? [...current, category.id] : current.filter(value => value !== category.id))}/>{category.label}</label>)}</div>)}</fieldset>
            <fieldset><legend>Detalhes</legend><label><input type="checkbox" checked={draftWithDescription} onChange={event => setDraftWithDescription(event.target.checked)}/>Com descrição</label></fieldset>
          </div>
          <div className="transaction-filter-actions"><button type="button" onClick={() => { setDraftType('ALL'); setDraftCategories([]); setDraftWithDescription(false); setType('ALL'); setSelectedCategories([]); setOnlyWithDescription(false); setFiltersOpen(false); }}>Limpar</button><button type="button" onClick={() => { setType(draftType); setSelectedCategories(draftCategories); setOnlyWithDescription(draftWithDescription); setSelectedId(null); setFiltersOpen(false); }}>Aplicar filtros</button></div>
        </div>}
      </div>
      <button className="primary-action transaction-create-button" type="button" onClick={openCreateDialog}><TxIcon name="plus" size={17}/>Nova transação</button>
    </div>
    <div className="transaction-type-row" role="group" aria-label="Filtros aplicados">
      {type === 'ALL' && !selectedCategories.length && !onlyWithDescription ? <span className="transaction-filter-empty">Todas as transações</span> : <>
        {type !== 'ALL' && <button type="button" className="transaction-applied-filter" onClick={() => setType('ALL')}>{type === 'INCOME' ? 'Receitas' : 'Despesas'}<span aria-hidden="true">×</span></button>}
        {selectedCategories.map(categoryId => <button type="button" className="transaction-applied-filter" key={categoryId} onClick={() => setSelectedCategories(current => current.filter(value => value !== categoryId))}>{categories.find(category => category.id === categoryId)?.label ?? 'Categoria'}<span aria-hidden="true">×</span></button>)}
        {onlyWithDescription && <button type="button" className="transaction-applied-filter" onClick={() => setOnlyWithDescription(false)}>Com descrição<span aria-hidden="true">×</span></button>}
      </>}
      <span aria-live="polite">{loadState === 'loaded' ? `${filtered.length} ${filtered.length === 1 ? 'lançamento' : 'lançamentos'}` : ''}</span>
    </div>
    <div className={`transaction-results-layout${selected ? '' : ' without-selection'}`}><section className="transaction-list-card" aria-label="Lista de transações">{loadState === 'loading' ? <div className="transaction-empty-results" role="status">Carregando lançamentos…</div> : loadState === 'error' ? <div className="transaction-empty-results" role="alert"><span>{loadError}</span><button type="button" onClick={() => setReloadVersion(value => value + 1)}>Tentar novamente</button></div> : grouped.length ? grouped.map(group => <div className="transaction-date-group" key={group.date}><h3>{shortDateFormat.format(new Date(`${group.date}T12:00:00Z`))}</h3>{group.items.map(item => <button type="button" key={item.id} className={`transaction-list-item${selected?.id === item.id ? ' selected' : ''}`} onClick={() => setSelectedId(current => current === item.id ? null : item.id)}><span className={`transaction-item-icon ${item.type.toLowerCase()}`}><TxIcon name={item.type === 'INCOME' ? 'income' : 'expense'}/></span><span className="transaction-item-copy"><strong>{item.title}</strong><small>{item.category} · {shortDateFormat.format(new Date(`${item.date}T12:00:00Z`))}</small></span><strong className={`transaction-item-amount ${item.type.toLowerCase()}`}>{item.type === 'INCOME' ? '+' : '−'} {amount(item.amountCents)}</strong></button>)}</div>) : <div className="transaction-empty-results">{records.length ? 'Nenhum lançamento corresponde aos filtros.' : 'Nenhum lançamento neste período.'}</div>}</section>
      {selected && <aside className="transaction-detail-card"><div className="transaction-detail-heading"><span className="eyebrow">LANÇAMENTO SELECIONADO</span><button className="transaction-clear-selection" type="button" onClick={() => setSelectedId(null)} aria-label="Limpar lançamento selecionado">×</button><h3>{selected.title}</h3></div><strong className={`transaction-detail-amount ${selected.type.toLowerCase()}`}>{selected.type === 'INCOME' ? '+' : '−'} {amount(selected.amountCents)}</strong><dl><div><dt>Tipo</dt><dd>{selected.type === 'INCOME' ? 'Receita' : 'Despesa'}</dd></div><div><dt>Categoria</dt><dd>{selected.category}</dd></div><div><dt>Data</dt><dd>{dateFormat.format(new Date(`${selected.date}T12:00:00Z`))}</dd></div><div><dt>Descrição</dt><dd>{selected.description}</dd></div></dl><div className="transaction-detail-actions"><button type="button" onClick={() => openEditDialog(selected)}><TxIcon name="edit"/>Editar</button><button type="button" onClick={() => openDeleteDialog(selected)}><TxIcon name="delete"/>Excluir</button></div></aside>}
    </div>
    {createDialogOpen && <div className="transaction-dialog-backdrop" onMouseDown={event => { if (!isSaving && event.target === event.currentTarget) setCreateDialogOpen(false); }}>
      <section className="transaction-create-dialog" ref={createDialogRef} role="dialog" aria-modal="true" aria-labelledby="transaction-dialog-title" aria-describedby="transaction-dialog-description">
        <header className="transaction-dialog-header"><div><span className="eyebrow">{editingId === null ? 'NOVO LANÇAMENTO' : 'EDITAR LANÇAMENTO'}</span><h2 id="transaction-dialog-title">{editingId === null ? 'Nova transação' : 'Editar transação'}</h2><p id="transaction-dialog-description">{editingId === null ? 'Registre uma receita ou despesa no seu mês.' : 'Atualize os dados deste lançamento.'}</p></div><button type="button" aria-label="Fechar formulário" disabled={isSaving} onClick={() => setCreateDialogOpen(false)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
        <form className="transaction-create-form" onSubmit={submitTransaction} noValidate>
          <div className="transaction-form-field"><label htmlFor="new-transaction-label">Nome do lançamento <span>(opcional)</span></label><input ref={newLabelRef} id="new-transaction-label" type="text" placeholder="Ex.: Aluguel de novembro" value={newLabel} onChange={event => setNewLabel(event.target.value)}/></div>
          <fieldset className="transaction-form-field transaction-kind-field"><legend>Tipo</legend><div className="transaction-kind-options">{([{ value: 'INCOME', label: 'Receita' }, { value: 'EXPENSE', label: 'Despesa' }] as const).map(option => <label key={option.value} className={newType === option.value ? 'selected' : ''}><input type="radio" name="newTransactionType" checked={newType === option.value} onChange={() => { setNewType(option.value); setNewCategory(null); }}/>{option.label}</label>)}</div></fieldset>
          <div className="transaction-form-grid">
            <div className="transaction-form-field"><label htmlFor="new-transaction-amount">Valor</label><div className="transaction-money-input"><span>R$</span><input ref={newAmountRef} id="new-transaction-amount" type="text" inputMode="decimal" placeholder="0,00" value={newAmount} onChange={event => { setNewAmount(event.target.value); setCreateError(''); }}/></div></div>
            <div className="transaction-form-field transaction-date-field" ref={calendarRef}>
              <label id="new-transaction-date-label">Data</label>
              <button id="new-transaction-date" className="transaction-picker-trigger" type="button" aria-labelledby="new-transaction-date-label new-transaction-date-value" aria-expanded={calendarOpen} aria-controls="transaction-calendar" onClick={() => { setCategoryPickerOpen(false); setCalendarOpen(open => !open); }}>
                <span id="new-transaction-date-value">{newDate ? dateFormat.format(new Date(`${newDate}T12:00:00Z`)) : 'Selecione uma data'}</span><span aria-hidden="true">▾</span>
              </button>
              {calendarOpen && <div className="transaction-calendar" id="transaction-calendar" role="group" aria-label="Escolher data">
                <div className="transaction-calendar-header"><button type="button" aria-label="Mês anterior" onClick={() => changeCalendarMonth(-1)}>‹</button><strong>{calendarTitle}</strong><button type="button" aria-label="Próximo mês" onClick={() => changeCalendarMonth(1)}>›</button></div>
                <div className="transaction-calendar-grid">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(day => <span className="weekday" key={day}>{day}</span>)}{Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const date = `${calendarMonth}-${String(day).padStart(2, '0')}`; return <button type="button" key={date} className={date === newDate ? 'selected' : ''} aria-label={dateFormat.format(new Date(`${date}T12:00:00Z`))} aria-pressed={date === newDate} onClick={() => { setNewDate(date); setCalendarOpen(false); }}>{day}</button>; })}</div>
              </div>}
            </div>
          </div>
          <div className="transaction-form-field transaction-category-field" ref={categoryPickerRef}>
            <label id="new-transaction-category-label">Categoria</label>
            <button id="new-transaction-category" className="transaction-picker-trigger" type="button" aria-labelledby="new-transaction-category-label new-transaction-category-value" aria-expanded={categoryPickerOpen} aria-controls="transaction-category-menu" onClick={() => { setCalendarOpen(false); setCategoryPickerOpen(open => !open); }}><span id="new-transaction-category-value">{formCategories.find(category => category.id === newCategory)?.label ?? 'Selecione uma categoria'}</span><span aria-hidden="true">▾</span></button>
            {categoryPickerOpen && <div className="transaction-category-menu" id="transaction-category-menu" role="group" aria-labelledby="new-transaction-category-label">{formCategories.length ? formCategories.map(category => <button type="button" key={category.id} className={newCategory === category.id ? 'selected' : ''} aria-pressed={newCategory === category.id} onClick={() => { setNewCategory(category.id); setCategoryPickerOpen(false); }}>{category.label}{newCategory === category.id && <span aria-hidden="true">✓</span>}</button>) : <p>Nenhuma categoria disponível.</p>}</div>}
          </div>
          <div className="transaction-form-field"><label htmlFor="new-transaction-description">Descrição <span>(opcional)</span></label><textarea id="new-transaction-description" rows={3} placeholder="Adicione um detalhe sobre este lançamento…" value={newDescription} onChange={event => setNewDescription(event.target.value)}/></div>
          {createError && <p className="transaction-create-error" role="alert">{createError}</p>}
          <footer className="transaction-dialog-actions"><span>O valor será registrado em reais, com precisão de centavos.</span><button type="submit" disabled={isSaving}>{isSaving ? 'Salvando…' : editingId === null ? 'Salvar transação' : 'Salvar alterações'}</button></footer>
        </form>
      </section>
    </div>}
    {deletingTransaction && <div className="transaction-dialog-backdrop" onMouseDown={event => { if (!isDeleting && event.target === event.currentTarget) setDeletingTransaction(null); }}>
      <section className="transaction-delete-dialog" ref={deleteDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="transaction-delete-title" aria-describedby="transaction-delete-description" aria-busy={isDeleting}>
        <span className="transaction-delete-icon"><TxIcon name="delete" size={23}/></span>
        <div className="transaction-delete-copy"><h2 id="transaction-delete-title">Excluir transação?</h2><p id="transaction-delete-description">Deseja realmente excluir <strong>{deletingTransaction.title}</strong>? Esta ação não pode ser desfeita.</p></div>
        {deleteError && <p className="transaction-delete-error" role="alert">{deleteError}</p>}
        <div className="transaction-delete-actions"><button ref={deleteCancelRef} type="button" disabled={isDeleting} onClick={() => setDeletingTransaction(null)}>Cancelar</button><button type="button" className="transaction-delete-confirm" disabled={isDeleting} onClick={() => void confirmDeleteTransaction()}>{isDeleting ? 'Excluindo…' : 'Excluir transação'}</button></div>
      </section>
    </div>}
  </div>;
}
