import { useState, type ReactNode } from 'react';
import './investmentStyles.css';

type InvestmentExample = {
  id: string;
  name: string;
  category: string;
  amountCents: number;
  monthlyRate: number;
  monthsDuration: number;
  date: string;
  description: string;
};

const investments: InvestmentExample[] = [
  { id: 'cdi', name: 'Reserva CDI', category: 'CDI', amountCents: 1_000_000, monthlyRate: 0.009, monthsDuration: 12, date: '2026-03-05', description: 'Reserva de médio prazo' },
  { id: 'treasury', name: 'Tesouro Selic', category: 'Tesouro Direto', amountCents: 500_000, monthlyRate: 0.008, monthsDuration: 18, date: '2026-08-05', description: 'Aporte para objetivos futuros' },
  { id: 'real-estate', name: 'Fundo imobiliário', category: 'Fundos imobiliários', amountCents: 350_000, monthlyRate: 0.0065, monthsDuration: 24, date: '2026-09-05', description: 'Aporte mensal' },
];
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (cents: number) => currency.format(cents / 100);
const projectedAmount = (item: InvestmentExample) => Math.round(item.amountCents * (1 + item.monthlyRate) ** item.monthsDuration);

function InvestmentIcon({ name, size = 18 }: { name: 'portfolio' | 'trend' | 'calendar' | 'plus' | 'edit' | 'delete'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    portfolio: <><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></>,
    trend: <><path d="m3 17 6-6 4 3 8-9"/><path d="M16 5h5v5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    edit: <><path d="m4 20 4.5-1 11-11-3.5-3.5-11 11L4 20Zm10-13 3.5 3.5"/></>,
    delete: <><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v6m4-6v6"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Summary({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: 'portfolio' | 'trend' | 'calendar' }) {
  return <article className={`investment-summary-card ${tone}`}><span><InvestmentIcon name={icon} size={20}/></span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

function PortfolioChart() {
  const actualPoints = '30,194 164,178 298,157 432,132';
  const projectionPoints = '432,132 566,111 700,89 834,66 968,42';
  const allPoints = [...actualPoints.split(' '), ...projectionPoints.split(' ').slice(1)].map(point => point.split(',').map(Number));
  return <section className="investment-chart-card" aria-label="Evolução estimada da carteira">
    <div className="investment-chart-heading"><div><span className="investment-chart-icon"><InvestmentIcon name="trend"/></span><h3>Evolução da carteira</h3></div><div className="investment-chart-legend"><span><i/>Total investido</span><span><i className="projection"/>Projeção estimada</span></div></div>
    <svg className="investment-chart" viewBox="0 0 1000 250" preserveAspectRatio="none" role="img" aria-label="Gráfico ilustrativo de crescimento ao longo de seis meses">
      <defs><linearGradient id="investmentArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4e99f1" stopOpacity=".2"/><stop offset="1" stopColor="#4e99f1" stopOpacity="0"/></linearGradient></defs>
      <path d={`M${actualPoints.replaceAll(' ', ' L')} L${projectionPoints.replaceAll(' ', ' L').slice(projectionPoints.indexOf(' ') + 1)} L968 220 L30 220 Z`} fill="url(#investmentArea)"/>
      <path d="M30 220H968M30 165H968M30 110H968M30 55H968" stroke="#e5edf7" strokeWidth="1"/>
      <polyline points={actualPoints} fill="none" stroke="#0866d8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points={projectionPoints} fill="none" stroke="#0866d8" strokeWidth="4" strokeDasharray="8 10" strokeLinecap="round"/>
      <g fill="#fff" stroke="#0866d8" strokeWidth="3">{allPoints.map(([cx,cy])=><circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5"/>)}</g>
      <g className="investment-chart-months"><text x="30" y="245">Mai</text><text x="217" y="245">Jun</text><text x="405" y="245">Jul</text><text x="593" y="245">Ago</text><text x="781" y="245">Set</text><text x="968" y="245">Out</text></g>
    </svg>
    <p className="investment-chart-note">A projeção considera as taxas mensais informadas e é apenas estimativa.</p>
  </section>;
}

export function InvestmentWorkspace() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = investments.find(item => item.id === selectedId) ?? null;
  const totalPrincipal = investments.reduce((sum, item) => sum + item.amountCents, 0);
  const totalProjected = investments.reduce((sum, item) => sum + projectedAmount(item), 0);
  const totalGain = totalProjected - totalPrincipal;

  return <div className="investment-workspace">
    <div className="investment-heading"><div><p>Aportes, taxas e projeções estimadas</p><small>Prévia com investimentos de exemplo</small></div><button className="primary-action" type="button" disabled title="Disponível após integração"><InvestmentIcon name="plus"/>Novo investimento</button></div>
    <div className="investment-summary"><Summary label="Total investido" value={formatMoney(totalPrincipal)} tone="principal" icon="portfolio"/><Summary label="Rendimento estimado" value={`+ ${formatMoney(totalGain)}`} tone="gain" icon="trend"/><Summary label="Valor projetado" value={formatMoney(totalProjected)} tone="projected" icon="calendar"/></div>
    {selected ? <section className="investment-selected-card"><header><div><span className="investment-selected-icon"><InvestmentIcon name="portfolio" size={20}/></span><div><span className="eyebrow">INVESTIMENTO SELECIONADO</span><h3>{selected.name} <span className="investment-category-pill">{selected.category}</span></h3></div></div><button className="investment-clear-selection" type="button" onClick={() => setSelectedId(null)} aria-label="Fechar detalhes do investimento">×</button></header><div className="investment-selected-metrics"><div><small>Aporte</small><strong>{formatMoney(selected.amountCents)}</strong></div><div><small>Taxa mensal</small><strong>{percent.format(selected.monthlyRate)}</strong></div><div><small>Prazo</small><strong>{selected.monthsDuration} meses</strong></div><div><small>Montante final estimado</small><strong className="projected-value">{formatMoney(projectedAmount(selected))}</strong></div></div><div className="investment-selected-progress"><span>Progresso do prazo</span><div><i style={{ width: `${Math.min(100, Math.max(8, Math.round(((Date.now() - new Date(`${selected.date}T00:00:00Z`).getTime()) / (selected.monthsDuration * 30 * 86400000)) * 100)))}%` }}/></div><small>Estimativa baseada em juros compostos constantes. O rendimento real pode variar.</small></div>
    </section> : <PortfolioChart/>}
    <section className="investment-table-card"><div className="investment-table-heading"><div><h3>Minha carteira</h3><span>{investments.length} investimentos</span></div></div><div className="investment-table-scroll"><table><thead><tr><th>Investimento</th><th>Categoria</th><th>Aporte</th><th>Taxa mensal</th><th>Prazo</th><th>Projeção estimada</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{investments.map(item=><tr key={item.id} className={selectedId === item.id ? 'active' : ''} onClick={() => setSelectedId(current => current === item.id ? null : item.id)} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(current => current === item.id ? null : item.id); } }}><td><strong>{item.name}</strong></td><td><span className="investment-category-pill">{item.category}</span></td><td>{formatMoney(item.amountCents)}</td><td>{percent.format(item.monthlyRate)}</td><td>{item.monthsDuration} meses</td><td><strong className="projected-value">{formatMoney(projectedAmount(item))}</strong></td><td><button type="button" disabled aria-label={`Editar ${item.name}`} title="Disponível após integração"><InvestmentIcon name="edit" size={15}/></button><button type="button" disabled aria-label={`Excluir ${item.name}`} title="Disponível após integração"><InvestmentIcon name="delete" size={15}/></button></td></tr>)}</tbody></table></div></section>
  </div>;
}
