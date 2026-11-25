import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { apiBaseUrl, authTokenKey } from './api.ts';
import { parseBrlAmountCents } from './money.ts';
import './investmentStyles.css';

type InvestmentCategory = { id: number; label: string; type: 'INVESTMENT'; parentId: number | null };
type InvestmentItem = {
  id: number;
  category: InvestmentCategory;
  amountCents: number;
  dateTimestamp: number;
  monthlyRate: number;
  monthsDuration: number;
  description: string | null;
};
type LoadState = 'loading' | 'loaded' | 'error';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const investmentDateFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
const localDateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

function todayInSaoPaulo(): string {
  const parts = Object.fromEntries(localDateParts.formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getApiError(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string') return payload.error;
  return fallback;
}

function isInvestmentCategory(value: unknown): value is InvestmentCategory {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return Number.isInteger(item.id) && typeof item.label === 'string' && item.type === 'INVESTMENT'
    && (item.parentId === null || Number.isInteger(item.parentId));
}

function isInvestment(value: unknown): value is InvestmentItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return Number.isInteger(item.id) && isInvestmentCategory(item.category)
    && Number.isSafeInteger(item.amountCents) && typeof item.dateTimestamp === 'number'
    && Number.isSafeInteger(item.dateTimestamp) && Number.isFinite(new Date(item.dateTimestamp).getTime()) && typeof item.monthlyRate === 'number'
    && Number.isFinite(item.monthlyRate) && Number.isInteger(item.monthsDuration)
    && (item.description === null || typeof item.description === 'string');
}

function InvestmentIcon({ name, size = 20 }: { name: 'portfolio' | 'plus' | 'close' | 'calendar'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    portfolio: <><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    close: <path d="M6 6l12 12M18 6 6 18"/>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function InvestmentWorkspace() {
  const [investments, setInvestments] = useState<InvestmentItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [categories, setCategories] = useState<InvestmentCategory[]>([]);
  const [categoryState, setCategoryState] = useState<LoadState>('loading');
  const [categoryError, setCategoryError] = useState('');
  const [categoryReload, setCategoryReload] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState(todayInSaoPaulo);
  const [calendarMonth, setCalendarMonth] = useState(() => todayInSaoPaulo().slice(0, 7));
  const [ratePercent, setRatePercent] = useState('');
  const [months, setMonths] = useState('');
  const [description, setDescription] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const categoryButtonRef = useRef<HTMLButtonElement>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);
  const categoryPickerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const token = sessionStorage.getItem(authTokenKey);
    setLoadState('loading');
    setLoadError('');
    if (!token) {
      setLoadState('error');
      setLoadError('Sua sessão não foi encontrada. Entre novamente para consultar seus investimentos.');
      return;
    }
    async function loadInvestments() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/investments`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(getApiError(payload, 'Não foi possível carregar seus investimentos.'));
        if (typeof payload !== 'object' || payload === null || !('investments' in payload)
          || !Array.isArray(payload.investments) || !payload.investments.every(isInvestment)) {
          throw new Error('O servidor retornou uma lista de investimentos inválida.');
        }
        setInvestments(payload.investments);
        setLoadState('loaded');
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'Não foi possível conectar ao servidor.');
        setLoadState('error');
      }
    }
    void loadInvestments();
    return () => controller.abort();
  }, [reloadVersion]);

  useEffect(() => {
    const controller = new AbortController();
    const token = sessionStorage.getItem(authTokenKey);
    setCategoryState('loading');
    setCategoryError('');
    if (!token) {
      setCategoryState('error');
      setCategoryError('Sua sessão não foi encontrada. Entre novamente para escolher uma categoria.');
      return;
    }
    async function loadCategories() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/categories`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(getApiError(payload, 'Não foi possível carregar as categorias.'));
        if (typeof payload !== 'object' || payload === null || !('categories' in payload) || !Array.isArray(payload.categories)) {
          throw new Error('O servidor retornou uma lista de categorias inválida.');
        }
        const investmentCategories = payload.categories.filter((item: unknown): item is InvestmentCategory => isInvestmentCategory(item));
        setCategories(investmentCategories);
        setCategoryState('loaded');
      } catch (error) {
        if (controller.signal.aborted) return;
        setCategoryError(error instanceof Error ? error.message : 'Não foi possível conectar ao servidor.');
        setCategoryState('error');
      }
    }
    void loadCategories();
    return () => controller.abort();
  }, [categoryReload]);

  useEffect(() => {
    if (!dialogOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    amountRef.current?.focus();
    return () => previousFocus?.focus();
  }, [dialogOpen]);

  useEffect(() => {
    if (!dialogOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) {
        event.preventDefault();
        if (categoryOpen) setCategoryOpen(false);
        else if (calendarOpen) setCalendarOpen(false);
        else setDialogOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)'));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen, categoryOpen, calendarOpen, isSaving]);

  useEffect(() => {
    if (!categoryOpen && !calendarOpen) return;
    function closePickers(event: PointerEvent) {
      if (categoryOpen && !categoryPickerRef.current?.contains(event.target as Node)) setCategoryOpen(false);
      if (calendarOpen && !calendarRef.current?.contains(event.target as Node)) setCalendarOpen(false);
    }
    document.addEventListener('pointerdown', closePickers);
    return () => document.removeEventListener('pointerdown', closePickers);
  }, [categoryOpen, calendarOpen]);

  function openDialog() {
    const today = todayInSaoPaulo();
    setAmount('');
    setCategoryId(null);
    setDate(today);
    setCalendarMonth(today.slice(0, 7));
    setRatePercent('');
    setMonths('');
    setDescription('');
    setFormError('');
    setCategoryOpen(false);
    setCalendarOpen(false);
    setDialogOpen(true);
  }

  async function submitInvestment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setFormError('');
    const amountCents = parseBrlAmountCents(amount);
    if (amountCents === null) { setFormError('Informe um aporte positivo em reais, com até duas casas decimais.'); amountRef.current?.focus(); return; }
    if (categoryId === null) { setFormError('Selecione uma categoria de investimento.'); categoryButtonRef.current?.focus(); return; }
    const dateTimestamp = Date.parse(`${date}T15:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isSafeInteger(dateTimestamp) || new Date(dateTimestamp).toISOString().slice(0, 10) !== date) {
      setFormError('Selecione uma data válida.'); dateButtonRef.current?.focus(); return;
    }
    const rateText = ratePercent.trim();
    const monthlyRate = Number(rateText.replace(',', '.')) / 100;
    if (!/^-?\d+(?:[.,]\d{1,4})?$/.test(rateText) || !Number.isFinite(monthlyRate) || monthlyRate <= -1) {
      setFormError('Informe uma taxa mensal válida, em porcentagem maior que -100%.'); rateRef.current?.focus(); return;
    }
    if (!/^\d+$/.test(months.trim()) || !Number.isInteger(Number(months)) || Number(months) < 1 || Number(months) > 2_147_483_647) {
      setFormError('Informe um prazo positivo em meses inteiros.'); durationRef.current?.focus(); return;
    }
    const token = sessionStorage.getItem(authTokenKey);
    if (!token) { setFormError('Sua sessão não foi encontrada. Entre novamente para salvar o investimento.'); return; }

    setIsSaving(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/investments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ categoryId, amountCents, dateTimestamp, monthlyRate, monthsDuration: Number(months), description: description.trim() }),
      });
      if (response.status !== 201) {
        const payload: unknown = await response.json().catch(() => null);
        throw new Error(getApiError(payload, 'Não foi possível salvar o investimento.'));
      }
      setDialogOpen(false);
      setReloadVersion(version => version + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível conectar ao servidor.');
    } finally {
      setIsSaving(false);
    }
  }

  const year = Number(calendarMonth.slice(0, 4));
  const month = Number(calendarMonth.slice(5, 7));
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const calendarTitle = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
  function changeCalendarMonth(offset: number) {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    setCalendarMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const orderedCategories = categories.flatMap(root => root.parentId === null
    ? [root, ...categories.filter(child => child.parentId === root.id)] : []);

  return <div className="investment-workspace">
    <div className="investment-heading"><button className="primary-action" type="button" onClick={openDialog}><InvestmentIcon name="plus" size={18}/>Novo investimento</button></div>

    {loadState === 'loading' ? <section className="investment-empty-state" role="status"><span className="investment-empty-icon"><InvestmentIcon name="portfolio" size={26}/></span><h2>Carregando investimentos</h2></section>
      : loadState === 'error' ? <section className="investment-empty-state" role="alert"><span className="investment-empty-icon"><InvestmentIcon name="portfolio" size={26}/></span><h2>Não foi possível carregar os investimentos</h2><p>{loadError}</p><button type="button" onClick={() => setReloadVersion(version => version + 1)}>Tentar novamente</button></section>
        : investments.length === 0 ? <section className="investment-empty-state" aria-labelledby="investment-empty-title"><span className="investment-empty-icon"><InvestmentIcon name="portfolio" size={26}/></span><h2 id="investment-empty-title">Nenhum investimento cadastrado</h2><p>Registre seu primeiro investimento para acompanhar seus aportes aqui.</p></section>
          : <section className="investment-list-card" aria-labelledby="investment-list-title"><header><h2 id="investment-list-title">Minha carteira</h2><span>{investments.length} {investments.length === 1 ? 'investimento' : 'investimentos'}</span></header><div className="investment-table-scroll"><table><thead><tr><th>Categoria</th><th>Aporte</th><th>Data</th><th>Taxa mensal</th><th>Prazo</th></tr></thead><tbody>{investments.map(item => <tr key={item.id}><td><strong>{item.category.label}</strong>{item.description && <small>{item.description}</small>}</td><td>{money.format(item.amountCents / 100)}</td><td>{investmentDateFormat.format(new Date(item.dateTimestamp))}</td><td>{percent.format(item.monthlyRate)}</td><td>{item.monthsDuration} {item.monthsDuration === 1 ? 'mês' : 'meses'}</td></tr>)}</tbody></table></div></section>}

    {dialogOpen && <div className="investment-dialog-backdrop" onMouseDown={event => { if (!isSaving && event.target === event.currentTarget) setDialogOpen(false); }}>
      <section className="investment-create-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="investment-dialog-title">
        <header className="investment-dialog-header"><div><span className="eyebrow">NOVO APORTE</span><h2 id="investment-dialog-title">Novo investimento</h2><p>Registre um aporte inicial e os parâmetros da projeção.</p></div><button type="button" aria-label="Fechar formulário" disabled={isSaving} onClick={() => setDialogOpen(false)}><InvestmentIcon name="close" size={18}/></button></header>
        <form className="investment-create-form" onSubmit={submitInvestment} autoComplete="off" noValidate>
          <div className="investment-form-field"><label htmlFor="investment-amount">Aporte inicial</label><div className="investment-money-input"><span>R$</span><input ref={amountRef} id="investment-amount" name="amount" type="text" inputMode="decimal" placeholder="Ex.: 123,45" value={amount} onChange={event => { setAmount(event.target.value); setFormError(''); }}/></div></div>
          <div className="investment-form-field investment-picker-field" ref={categoryPickerRef}><label id="investment-category-label">Categoria</label><button ref={categoryButtonRef} className="investment-picker-trigger" type="button" aria-labelledby="investment-category-label investment-category-value" aria-controls="investment-category-options" aria-expanded={categoryOpen} onClick={() => { setCalendarOpen(false); setCategoryOpen(open => !open); }}><span id="investment-category-value">{categories.find(item => item.id === categoryId)?.label ?? 'Selecione uma categoria'}</span><span aria-hidden="true">▾</span></button>{categoryOpen && <div className="investment-picker-menu" id="investment-category-options" role="group" aria-labelledby="investment-category-label">{orderedCategories.length ? orderedCategories.map(item => <button key={item.id} type="button" className={item.parentId !== null ? 'child' : ''} aria-pressed={categoryId === item.id} onClick={() => { setCategoryId(item.id); setCategoryOpen(false); }}>{item.label}{categoryId === item.id && <span aria-hidden="true">✓</span>}</button>) : <p>Nenhuma categoria de investimento disponível.</p>}</div>}{categoryState === 'error' && <div className="investment-category-error"><span>{categoryError}</span><button type="button" onClick={() => setCategoryReload(version => version + 1)}>Tentar novamente</button></div>}{categoryState === 'loading' && <small>Carregando categorias…</small>}</div>
          <div className="investment-form-grid"><div className="investment-form-field investment-picker-field" ref={calendarRef}><label id="investment-date-label">Data do aporte</label><button ref={dateButtonRef} className="investment-picker-trigger" type="button" aria-labelledby="investment-date-label investment-date-value" aria-expanded={calendarOpen} aria-controls="investment-calendar" onClick={() => { setCategoryOpen(false); setCalendarOpen(open => !open); }}><span id="investment-date-value">{dateFormat.format(new Date(`${date}T12:00:00Z`))}</span><InvestmentIcon name="calendar" size={16}/></button>{calendarOpen && <div className="investment-calendar" id="investment-calendar" role="group" aria-label="Escolher data do aporte"><div className="investment-calendar-header"><button type="button" aria-label="Mês anterior" onClick={() => changeCalendarMonth(-1)}>‹</button><strong>{calendarTitle}</strong><button type="button" aria-label="Próximo mês" onClick={() => changeCalendarMonth(1)}>›</button></div><div className="investment-calendar-grid">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(day => <span className="weekday" key={day}>{day}</span>)}{Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} aria-hidden="true"/>)}{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const value = `${calendarMonth}-${String(day).padStart(2, '0')}`; return <button type="button" key={value} className={value === date ? 'selected' : ''} aria-label={dateFormat.format(new Date(`${value}T12:00:00Z`))} aria-pressed={value === date} onClick={() => { setDate(value); setCalendarOpen(false); }}>{day}</button>; })}</div></div>}</div><div className="investment-form-field"><label htmlFor="investment-duration">Prazo (meses)</label><input ref={durationRef} id="investment-duration" name="monthsDuration" type="number" min="1" max="2147483647" step="1" inputMode="numeric" placeholder="Ex.: 12" value={months} onChange={event => { setMonths(event.target.value); setFormError(''); }}/></div></div>
          <div className="investment-form-field"><label htmlFor="investment-rate">Taxa mensal estimada (%)</label><input ref={rateRef} id="investment-rate" name="monthlyRatePercent" type="text" inputMode="decimal" placeholder="Ex.: 1,00" value={ratePercent} onChange={event => { setRatePercent(event.target.value); setFormError(''); }}/><small>1,00% ao mês equivale a uma taxa de 0,01 na projeção. O rendimento real pode variar.</small></div>
          <div className="investment-form-field"><label htmlFor="investment-description">Descrição <span>(opcional)</span></label><textarea id="investment-description" name="description" rows={3} placeholder="Adicione um detalhe sobre este investimento…" value={description} onChange={event => setDescription(event.target.value)}/></div>
          {formError && <p className="investment-form-error" role="alert">{formError}</p>}
          <footer className="investment-dialog-actions"><button type="submit" disabled={isSaving}>{isSaving ? 'Salvando…' : 'Salvar investimento'}</button></footer>
        </form>
      </section>
    </div>}
  </div>;
}
