import type { ReactNode } from 'react';
import './dashboardStyles.css';

type DashboardSection = 'Transações' | 'Categorias' | 'Investimentos' | 'Planejamento diário';
type DashboardTransaction = { id: string; name: string; category: string; date: string; type: 'INCOME' | 'EXPENSE'; cents: number; icon: 'salary' | 'market' | 'food' | 'health' | 'work' };

const transactions: DashboardTransaction[] = [
  { id: 'salary', name: 'Salário', category: 'Salário', date: '2026-11-18', type: 'INCOME', cents: 520000, icon: 'salary' },
  { id: 'market', name: 'Mercado', category: 'Alimentação', date: '2026-11-15', type: 'EXPENSE', cents: 32045, icon: 'market' },
  { id: 'restaurant', name: 'Restaurante', category: 'Alimentação', date: '2026-11-15', type: 'EXPENSE', cents: 6890, icon: 'food' },
  { id: 'pharmacy', name: 'Farmácia', category: 'Saúde', date: '2026-11-15', type: 'EXPENSE', cents: 5480, icon: 'health' },
  { id: 'transport', name: 'Transporte', category: 'Transporte', date: '2026-11-10', type: 'EXPENSE', cents: 8000, icon: 'work' },
  { id: 'freelance', name: 'Freelance', category: 'Freelance', date: '2026-11-10', type: 'INCOME', cents: 90000, icon: 'work' },
  { id: 'oct-rent', name: 'Aluguel', category: 'Moradia', date: '2026-10-08', type: 'EXPENSE', cents: 145000, icon: 'work' },
  { id: 'oct-salary', name: 'Salário', category: 'Salário', date: '2026-10-05', type: 'INCOME', cents: 520000, icon: 'salary' },
  { id: 'sep-market', name: 'Compras do mês', category: 'Compras', date: '2026-09-12', type: 'EXPENSE', cents: 17890, icon: 'market' },
  { id: 'sep-freelance', name: 'Freelance', category: 'Freelance', date: '2026-09-03', type: 'INCOME', cents: 75000, icon: 'work' },
  { id: 'aug-salary', name: 'Salário', category: 'Salário', date: '2026-08-05', type: 'INCOME', cents: 520000, icon: 'salary' },
  { id: 'aug-rent', name: 'Aluguel', category: 'Moradia', date: '2026-08-08', type: 'EXPENSE', cents: 145000, icon: 'work' },
  { id: 'jul-salary', name: 'Salário', category: 'Salário', date: '2026-07-05', type: 'INCOME', cents: 520000, icon: 'salary' },
  { id: 'jul-market', name: 'Mercado', category: 'Alimentação', date: '2026-07-12', type: 'EXPENSE', cents: 92500, icon: 'market' },
  { id: 'jun-salary', name: 'Salário', category: 'Salário', date: '2026-06-05', type: 'INCOME', cents: 500000, icon: 'salary' },
  { id: 'jun-bills', name: 'Contas da casa', category: 'Contas e serviços', date: '2026-06-11', type: 'EXPENSE', cents: 137800, icon: 'work' },
];

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const formatMoney = (cents: number) => money.format(cents / 100);

function DashboardIcon({ name, size = 18 }: { name: 'income' | 'expense' | 'result' | 'market' | 'food' | 'health' | 'salary' | 'work' | 'tag' | 'trend' | 'arrow'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    income: <><path d="M12 20V4m-7 7 7-7 7 7"/></>,
    expense: <><path d="M12 4v16m7-7-7 7-7-7"/></>,
    result: <><path d="M5 9h14M5 15h14"/></>,
    market: <><path d="M3 10h18l-2 10H5L3 10Z"/><path d="m8 10 4-7 4 7m-7 4v3m6-3v3"/></>,
    food: <><path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M20 21V3c-4 3-5 7-5 11h5"/></>,
    health: <><path d="M10 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><path d="M14 3h4v4m-9 5h8m-4-4v8"/></>,
    salary: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M7 6V4h10v2m-5 4v7m-3-4 3-3 3 3"/></>,
    work: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3m-13 5h18"/></>,
    tag: <><path d="M20 13 13 20l-9-9V4h7l9 9Z"/><circle cx="8" cy="8" r="1"/></>,
    trend: <><path d="m3 17 6-6 4 3 8-9m-5 0h5v5"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Metric({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: 'income' | 'expense' | 'result' }) {
  return <article className={`dashboard-metric ${tone}`}><span><DashboardIcon name={icon}/></span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

export function DashboardWorkspace({ selectedMonth, onNavigate }: { selectedMonth: string; onNavigate: (section: DashboardSection) => void }) {
  const selectedTransactions = transactions.filter(item => item.date.startsWith(selectedMonth));
  const income = selectedTransactions.filter(item => item.type === 'INCOME').reduce((sum, item) => sum + item.cents, 0);
  const expenses = selectedTransactions.filter(item => item.type === 'EXPENSE').reduce((sum, item) => sum + item.cents, 0);
  const expenseByCategory = selectedTransactions.filter(item => item.type === 'EXPENSE').reduce<Record<string, number>>((totals, item) => ({ ...totals, [item.category]: (totals[item.category] ?? 0) + item.cents }), {});
  const categories = Object.entries(expenseByCategory).sort((a,b) => b[1] - a[1]);
  const recent = [...selectedTransactions].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 4);
  const monthDate = new Date(`${selectedMonth}-01T12:00:00`);
  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth() - 5 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const byMonth = transactions.filter(item => item.date.startsWith(key));
    return {
      key,
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', ''),
      income: byMonth.filter(item => item.type === 'INCOME').reduce((sum, item) => sum + item.cents, 0),
      expense: byMonth.filter(item => item.type === 'EXPENSE').reduce((sum, item) => sum + item.cents, 0),
    };
  }).map(month => ({ ...month, result: month.income - month.expense }));
  const maxTrend = Math.max(10000, ...monthlyTrend.flatMap(month => [month.income, month.expense, Math.abs(month.result)]));
  const scaleMax = Math.ceil(maxTrend / 100000) * 100000;
  const scaleValues = [scaleMax, Math.round(scaleMax * 2 / 3), Math.round(scaleMax / 3), 0];
  const pieColors = ['#0870df', '#20ad71', '#f0a338', '#8c73d6', '#e14b55', '#25a9a1'];
  let pieOffset = 0;
  const pieBackground = categories.length ? `conic-gradient(${categories.map(([, cents], index) => {
    const start = pieOffset;
    pieOffset += cents / Math.max(1, expenses) * 100;
    return `${pieColors[index % pieColors.length]} ${start}% ${pieOffset}%`;
  }).join(', ')})` : 'conic-gradient(#e7eef7 0% 100%)';

  return <div className="dashboard-workspace">
    <div className="dashboard-welcome"><div><span className="eyebrow">VISÃO GERAL</span><h2>Resumo do seu dinheiro</h2><p>Receitas, despesas, categorias e investimentos em um só lugar.</p></div><span className="dashboard-preview-label">Dados de exemplo</span></div>
    <div className="dashboard-metrics"><Metric label="Receitas no mês" value={formatMoney(income)} tone="income" icon="income"/><Metric label="Despesas no mês" value={formatMoney(expenses)} tone="expense" icon="expense"/><Metric label="Resultado do mês" value={formatMoney(income - expenses)} tone="result" icon="result"/></div>
    <section className="dashboard-panel dashboard-monthly-chart"><header><div><span className="dashboard-panel-icon blue"><DashboardIcon name="trend"/></span><div><h3>Receitas, despesas e resultado</h3><p>Últimos seis meses até o período selecionado</p></div></div><div className="dashboard-chart-legend"><span><i className="income"/>Receitas</span><span><i className="expense"/>Despesas</span><span><i className="result"/>Resultado</span></div></header><div className="dashboard-chart-area" role="group" aria-label="Gráfico mensal de receitas, despesas e resultado"><div className="dashboard-chart-scale">{scaleValues.map((value,index)=><span key={`${value}-${index}`}>{new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(value/100)}</span>)}</div><div className="dashboard-month-chart">{monthlyTrend.map(month=><div className="dashboard-month-column" key={month.key}><div className="dashboard-month-bars">{([{key:'income',label:'Receitas',value:month.income},{key:'expense',label:'Despesas',value:month.expense},{key:'result',label:'Resultado',value:month.result}] as const).map(series=><div key={series.key} className={`dashboard-chart-bar ${series.key}`} style={{height:`${Math.max(series.value ? 4 : 0,Math.abs(series.value)/scaleMax*100)}%`}} tabIndex={0} role="img" aria-label={`${series.label} em ${month.label}: ${formatMoney(series.value)}`}><span>{series.label}: {formatMoney(series.value)}</span></div>)}</div><span>{month.label}</span></div>)}</div></div></section>
    <div className="dashboard-overview-grid">
      <section className="dashboard-panel dashboard-categories"><header><div><span className="dashboard-panel-icon"><DashboardIcon name="tag"/></span><div><h3>Despesas por categoria</h3><p>Distribuição no período selecionado</p></div></div><button type="button" onClick={() => onNavigate('Categorias')}>Ver categorias <DashboardIcon name="arrow" size={14}/></button></header>{categories.length ? <div className="dashboard-category-content"><div className="dashboard-pie-chart" role="img" aria-label={`Despesas distribuídas por ${categories.length} categorias`} style={{background:pieBackground}}><span>{formatMoney(expenses)}</span></div><div className="dashboard-pie-legend">{categories.map(([name,cents],index)=><div className="dashboard-pie-item" key={name}><i style={{background:pieColors[index%pieColors.length]}}/><span>{name}</span><strong>{formatMoney(cents)}</strong></div>)}</div></div> : <p className="dashboard-no-data">Sem despesas neste mês.</p>}<footer>21 categorias padrão · 2 subcategorias de exemplo</footer></section>
      <section className="dashboard-panel dashboard-investments"><header><div><span className="dashboard-panel-icon blue"><DashboardIcon name="trend"/></span><div><h3>Investimentos</h3></div></div><button type="button" onClick={() => onNavigate('Investimentos')}>Ver painel <DashboardIcon name="arrow" size={14}/></button></header><p className="dashboard-no-data">Seus investimentos aparecerão aqui quando o cadastro estiver disponível.</p></section>
    </div>
    <section className="dashboard-panel dashboard-recent"><header><div><span className="dashboard-panel-icon"><DashboardIcon name="result"/></span><div><h3>Últimas transações</h3><p>{recent.length} lançamentos no mês</p></div></div><button type="button" onClick={() => onNavigate('Transações')}>Ver transações <DashboardIcon name="arrow" size={14}/></button></header>{recent.length ? <div className="dashboard-recent-list">{recent.map(item=><div className="dashboard-recent-row" key={item.id}><span className={`dashboard-transaction-icon ${item.type.toLowerCase()}`}><DashboardIcon name={item.icon}/></span><span className="dashboard-transaction-copy"><strong>{item.name}</strong><small>{item.category} · {shortDate.format(new Date(`${item.date}T12:00:00Z`))}</small></span><strong className={`dashboard-transaction-amount ${item.type.toLowerCase()}`}>{item.type==='INCOME'?'+':'−'} {formatMoney(item.cents)}</strong></div>)}</div> : <p className="dashboard-no-data">Nenhuma transação neste mês.</p>}</section>
  </div>;
}
