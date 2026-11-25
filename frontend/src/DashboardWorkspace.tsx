import { useEffect, useState, type ReactNode } from 'react';
import { apiBaseUrl, authTokenKey } from './api.ts';
import './dashboardStyles.css';

type DashboardSection = 'Transações' | 'Categorias' | 'Investimentos' | 'Planejamento diário';
type MonthTotals = { month: string; incomeCents: number; expenseCents: number; resultCents: number };
type ExpenseGroup = { id: number; label: string; amountCents: number };
type RecentTransaction = { id: number; label: string | null; categoryLabel: string; dateTimestamp: number; type: 'INCOME' | 'EXPENSE'; amountCents: number };
type DashboardData = {
  month: string;
  totals: Omit<MonthTotals, 'month'>;
  monthlyTrend: MonthTotals[];
  expenseByCategory: ExpenseGroup[];
  recent: RecentTransaction[];
};
type InvestmentOverview = { investments: unknown[]; summary: { contributionCents: number | null; projectedTotalCents: number | null; projectedGainCents: number | null } };
type LoadState = 'loading' | 'loaded' | 'error';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' });
const shortMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const formatMoney = (cents: number | null) => cents === null ? '—' : money.format(cents / 100);
const isCents = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
const isNullableCents = (value: unknown): value is number | null => value === null || isCents(value);

function isTotals(value: unknown): value is Omit<MonthTotals, 'month'> {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return isCents(item.incomeCents) && isCents(item.expenseCents) && isCents(item.resultCents);
}
function isMonthTotals(value: unknown): value is MonthTotals {
  return typeof value === 'object' && value !== null && 'month' in value
    && typeof value.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.month) && isTotals(value);
}
function isExpenseGroup(value: unknown): value is ExpenseGroup {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return Number.isInteger(item.id) && typeof item.label === 'string' && isCents(item.amountCents) && item.amountCents >= 0;
}
function isRecent(value: unknown): value is RecentTransaction {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return Number.isInteger(item.id) && (item.label === null || typeof item.label === 'string')
    && typeof item.categoryLabel === 'string' && isCents(item.dateTimestamp)
    && (item.type === 'INCOME' || item.type === 'EXPENSE') && isCents(item.amountCents);
}
function isDashboardData(value: unknown): value is DashboardData {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.month === 'string' && isTotals(item.totals)
    && Array.isArray(item.monthlyTrend) && item.monthlyTrend.length === 6 && item.monthlyTrend.every(isMonthTotals)
    && Array.isArray(item.expenseByCategory) && item.expenseByCategory.every(isExpenseGroup)
    && Array.isArray(item.recent) && item.recent.every(isRecent);
}
function isInvestmentOverview(value: unknown): value is InvestmentOverview {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  if (!Array.isArray(item.investments) || typeof item.summary !== 'object' || item.summary === null) return false;
  const summary = item.summary as Record<string, unknown>;
  return isNullableCents(summary.contributionCents) && isNullableCents(summary.projectedTotalCents)
    && isNullableCents(summary.projectedGainCents);
}
function apiError(value: unknown, fallback: string): string {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string' ? value.error : fallback;
}

function DashboardIcon({ name, size = 18 }: { name: 'income' | 'expense' | 'result' | 'tag' | 'trend' | 'arrow'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    income: <path d="M12 20V4m-7 7 7-7 7 7"/>,
    expense: <path d="M12 4v16m7-7-7 7-7-7"/>,
    result: <path d="M5 9h14M5 15h14"/>,
    tag: <><path d="M20 13 13 20l-9-9V4h7l9 9Z"/><circle cx="8" cy="8" r="1"/></>,
    trend: <path d="m3 17 6-6 4 3 8-9m-5 0h5v5"/>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Metric({ label, cents, tone, icon }: { label: string; cents: number; tone: string; icon: 'income' | 'expense' | 'result' }) {
  return <article className={`dashboard-metric ${tone}`}><span><DashboardIcon name={icon}/></span><div><small>{label}</small><strong>{formatMoney(cents)}</strong></div></article>;
}

export function DashboardWorkspace({ selectedMonth, onNavigate }: { selectedMonth: string; onNavigate: (section: DashboardSection) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [investment, setInvestment] = useState<InvestmentOverview | null>(null);
  const [investmentState, setInvestmentState] = useState<LoadState>('loading');
  const [investmentError, setInvestmentError] = useState('');
  const [investmentReload, setInvestmentReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const token = sessionStorage.getItem(authTokenKey);
    setLoadState('loading');
    setData(null);
    if (!token) { setLoadError('Sua sessão não foi encontrada. Entre novamente.'); setLoadState('error'); return; }
    async function load() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/dashboard?month=${encodeURIComponent(selectedMonth)}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(apiError(payload, 'Não foi possível carregar o resumo do mês.'));
        if (!isDashboardData(payload) || payload.month !== selectedMonth) throw new Error('O servidor retornou um resumo inválido.');
        setData(payload);
        setLoadState('loaded');
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'Não foi possível conectar ao servidor.');
        setLoadState('error');
      }
    }
    void load();
    return () => controller.abort();
  }, [selectedMonth, reload]);

  useEffect(() => {
    const controller = new AbortController();
    const token = sessionStorage.getItem(authTokenKey);
    setInvestmentState('loading');
    setInvestment(null);
    if (!token) { setInvestmentError('Sua sessão não foi encontrada.'); setInvestmentState('error'); return; }
    async function load() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/investments`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(apiError(payload, 'Não foi possível carregar os investimentos.'));
        if (!isInvestmentOverview(payload)) throw new Error('O servidor retornou dados de investimentos inválidos.');
        setInvestment(payload);
        setInvestmentState('loaded');
      } catch (error) {
        if (controller.signal.aborted) return;
        setInvestmentError(error instanceof Error ? error.message : 'Não foi possível conectar ao servidor.');
        setInvestmentState('error');
      }
    }
    void load();
    return () => controller.abort();
  }, [investmentReload]);

  const totals = data?.totals;
  const trend = data?.monthlyTrend ?? [];
  const maxTrend = Math.max(1, ...trend.flatMap(month => [month.incomeCents, month.expenseCents, Math.abs(month.resultCents)]));
  const scaleMax = Math.ceil(maxTrend / 100) * 100;
  const scaleValues = [scaleMax, Math.round(scaleMax * 2 / 3), Math.round(scaleMax / 3), 0];
  const expenseGroups = data?.expenseByCategory ?? [];
  const pieColors = ['#0870df', '#20ad71', '#f0a338', '#8c73d6', '#e14b55', '#25a9a1'];
  let offset = 0;
  const pieBackground = expenseGroups.length && totals?.expenseCents
    ? `conic-gradient(${expenseGroups.map((group, index) => {
      const start = offset;
      offset += group.amountCents / totals.expenseCents * 100;
      return `${pieColors[index % pieColors.length]} ${start}% ${offset}%`;
    }).join(', ')})` : 'conic-gradient(#e7eef7 0% 100%)';

  return <div className="dashboard-workspace">
    <div className="dashboard-welcome"><div><span className="eyebrow">VISÃO GERAL</span><h2>Resumo do seu dinheiro</h2><p>Receitas, despesas, categorias e investimentos em um só lugar.</p></div></div>
    {loadState === 'loading' && <section className="dashboard-state" role="status">Carregando resumo do mês…</section>}
    {loadState === 'error' && <section className="dashboard-state" role="alert"><p>{loadError}</p><button type="button" onClick={() => setReload(value => value + 1)}>Tentar novamente</button></section>}
    {loadState === 'loaded' && data && totals && <>
      <div className="dashboard-metrics"><Metric label="Receitas no mês" cents={totals.incomeCents} tone="income" icon="income"/><Metric label="Despesas no mês" cents={totals.expenseCents} tone="expense" icon="expense"/><Metric label="Resultado do mês" cents={totals.resultCents} tone="result" icon="result"/></div>
      <section className="dashboard-panel dashboard-monthly-chart"><header><div><span className="dashboard-panel-icon blue"><DashboardIcon name="trend"/></span><div><h3>Receitas, despesas e resultado</h3><p>Últimos seis meses até o período selecionado</p></div></div><div className="dashboard-chart-legend"><span><i className="income"/>Receitas</span><span><i className="expense"/>Despesas</span><span><i className="result"/>Resultado</span></div></header><div className="dashboard-chart-area" role="group" aria-label="Gráfico mensal de receitas, despesas e resultado"><div className="dashboard-chart-scale">{scaleValues.map((value, index) => <span key={index}>{compact.format(value / 100)}</span>)}</div><div className="dashboard-month-chart">{trend.map(month => <div className="dashboard-month-column" key={month.month}><div className="dashboard-month-bars">{([{ key: 'income', label: 'Receitas', value: month.incomeCents }, { key: 'expense', label: 'Despesas', value: month.expenseCents }, { key: 'result', label: 'Resultado', value: month.resultCents }] as const).map(series => <div key={series.key} className={`dashboard-chart-bar ${series.key}${series.value < 0 ? ' negative' : ''}`} style={{ height: `${Math.max(series.value ? 4 : 0, Math.abs(series.value) / scaleMax * 100)}%` }} tabIndex={0} role="img" aria-label={`${series.label} em ${month.month}: ${formatMoney(series.value)}`}><span>{series.label}: {formatMoney(series.value)}</span></div>)}</div><span>{shortMonth.format(new Date(`${month.month}-01T12:00:00Z`)).replace('.', '')}</span></div>)}</div></div></section>
      <div className="dashboard-overview-grid">
        <section className="dashboard-panel dashboard-categories"><header><div><span className="dashboard-panel-icon"><DashboardIcon name="tag"/></span><div><h3>Despesas por categoria</h3><p>Distribuição no período selecionado</p></div></div><button type="button" onClick={() => onNavigate('Categorias')}>Ver categorias <DashboardIcon name="arrow" size={14}/></button></header>{expenseGroups.length ? <div className="dashboard-category-content"><div className="dashboard-pie-chart" role="img" aria-label={`Despesas distribuídas por ${expenseGroups.length} categorias`} style={{ background: pieBackground }}><span>{formatMoney(totals.expenseCents)}</span></div><div className="dashboard-pie-legend">{expenseGroups.map((group, index) => <div className="dashboard-pie-item" key={group.id}><i style={{ background: pieColors[index % pieColors.length] }}/><span title={group.label}>{group.label}</span><strong>{formatMoney(group.amountCents)}</strong></div>)}</div></div> : <p className="dashboard-no-data">Sem despesas neste mês.</p>}<footer>{expenseGroups.length} {expenseGroups.length === 1 ? 'categoria com despesas' : 'categorias com despesas'}</footer></section>
        <section className="dashboard-panel dashboard-investments"><header><div><span className="dashboard-panel-icon blue"><DashboardIcon name="trend"/></span><div><h3>Investimentos</h3></div></div><button type="button" onClick={() => onNavigate('Investimentos')}>Ver painel <DashboardIcon name="arrow" size={14}/></button></header>
          {investmentState === 'loading' && <p className="dashboard-no-data" role="status">Carregando investimentos…</p>}
          {investmentState === 'error' && <div className="dashboard-investment-error" role="alert"><p>{investmentError}</p><button type="button" onClick={() => setInvestmentReload(value => value + 1)}>Tentar novamente</button></div>}
          {investmentState === 'loaded' && investment && (investment.investments.length ? <div className="dashboard-investment-summary"><span>{investment.investments.length} {investment.investments.length === 1 ? 'investimento cadastrado' : 'investimentos cadastrados'}</span><div><small>Aportes cadastrados</small><strong>{formatMoney(investment.summary.contributionCents)}</strong></div><div><small>Projeção ao fim dos prazos</small><strong>{formatMoney(investment.summary.projectedTotalCents)}</strong></div><p>Estimativas com as taxas informadas; não representam saldo disponível.</p></div> : <p className="dashboard-no-data">Nenhum investimento cadastrado.</p>)}
        </section>
      </div>
      <section className="dashboard-panel dashboard-recent"><header><div><span className="dashboard-panel-icon"><DashboardIcon name="result"/></span><div><h3>Últimas transações</h3><p>{data.recent.length} {data.recent.length === 1 ? 'lançamento' : 'lançamentos'} no mês</p></div></div><button type="button" onClick={() => onNavigate('Transações')}>Ver transações <DashboardIcon name="arrow" size={14}/></button></header>{data.recent.length ? <div className="dashboard-recent-list">{data.recent.map(item => <div className="dashboard-recent-row" key={item.id}><span className={`dashboard-transaction-icon ${item.type.toLowerCase()}`}><DashboardIcon name={item.type === 'INCOME' ? 'income' : 'expense'}/></span><span className="dashboard-transaction-copy"><strong title={item.label || item.categoryLabel}>{item.label || item.categoryLabel}</strong><small>{item.categoryLabel} · {shortDate.format(new Date(item.dateTimestamp))}</small></span><strong className={`dashboard-transaction-amount ${item.type.toLowerCase()}`}>{item.type === 'INCOME' ? '+' : '−'} {formatMoney(item.amountCents)}</strong></div>)}</div> : <p className="dashboard-no-data">Nenhuma transação neste mês.</p>}</section>
    </>}
  </div>;
}
