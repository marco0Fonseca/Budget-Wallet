import { useState, type ReactNode } from 'react';
import './planningStyles.css';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (cents: number) => currency.format(cents / 100);
const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function PlanIcon({ name }: { name: 'income' | 'expense' | 'saving' | 'calendar' }) {
  const paths: Record<typeof name, ReactNode> = {
    income: <path d="M12 20V4m-7 7 7-7 7 7"/>,
    expense: <path d="M12 4v16m7-7-7 7-7-7"/>,
    saving: <><path d="M5 8h14l2 4-2 4H5a4 4 0 0 1 0-8Z"/><path d="M8 12h.01M12 12h4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
  };
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function PlanningWorkspace({ selectedMonth }: { selectedMonth: string }) {
  const [selectedDay, setSelectedDay] = useState(18);
  const date = new Date(`${selectedMonth}-01T12:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const dailySpendByDay: Record<number, number> = { 10: 8000, 15: 44315, 18: 4000 };
  const spentCents = dailySpendByDay[selectedDay] ?? 0;
  const dailyBudgetCents = 5000;
  const dailyDifference = dailyBudgetCents - spentCents;

  return <div className="planning-workspace">
    <div className="planning-heading"><div><span className="eyebrow">PLANEJAMENTO DO MÊS</span><h2>Acompanhe seu dia a dia</h2><p>Prévia de orçamento diário para {monthLabel}</p></div><span className="planning-sample-badge">Dados de exemplo</span></div>
    <div className="planning-summary">
      <article className="planned-income"><span><PlanIcon name="income"/></span><div><small>Receita prevista</small><strong>{money(520000)}</strong></div></article>
      <article className="planned-expenses"><span><PlanIcon name="expense"/></span><div><small>Despesas fixas</small><strong>{money(235000)}</strong></div></article>
      <article className="planned-saving"><span><PlanIcon name="saving"/></span><div><small>Meta para guardar</small><strong>{money(100000)}</strong></div></article>
      <article className="planned-daily"><span><PlanIcon name="calendar"/></span><div><small>Orçamento por dia</small><strong>{money(dailyBudgetCents)}</strong></div></article>
    </div>
    <div className="planning-layout">
      <section className="planning-calendar-card"><header><div><span className="planning-calendar-icon"><PlanIcon name="calendar"/></span><div><h3>Calendário mensal</h3><p>Selecione um dia para ver o acompanhamento</p></div></div><span>{monthLabel}</span></header>
        <div className="planning-calendar-grid">{weekDays.map(day=><span className="planning-weekday" key={day}>{day}</span>)}{Array.from({length:firstDayOffset},(_,index)=><span className="planning-calendar-empty" key={`empty-${index}`}/>)}{Array.from({length:daysInMonth},(_,index)=>{const day=index+1;const spent=dailySpendByDay[day];return <button key={day} type="button" className={`planning-day${selectedDay===day?' selected':''}${spent ? ' has-spending':''}`} onClick={()=>setSelectedDay(day)} aria-pressed={selectedDay===day}><strong>{day}</strong>{spent ? <span>{money(spent)}</span> : <span className="planning-day-budget">{money(dailyBudgetCents)}</span>}</button>})}</div>
        <footer><span><i className="spent-dot"/>Dia com movimentação</span><span><i className="budget-dot"/>Orçamento diário</span></footer>
      </section>
      <aside className="planning-day-card"><span className="eyebrow">ACOMPANHAMENTO DO DIA</span><h3>{selectedDay} de {monthLabel}</h3><div className="planning-day-metric"><span>Orçamento previsto</span><strong>{money(dailyBudgetCents)}</strong></div><div className="planning-day-metric"><span>Gasto no dia</span><strong>{money(spentCents)}</strong></div><div className={`planning-day-balance${dailyDifference<0?' over':''}`}><span>{dailyDifference>=0?'Disponível para redistribuir':'Valor acima do orçamento'}</span><strong>{dailyDifference>=0?'+ ': '− '}{money(Math.abs(dailyDifference))}</strong></div><p>{dailyDifference>=0?'A sobra pode ser distribuída pelos dias restantes do mês.':'O excedente pode ser compensado nos dias restantes do mês.'}</p><button type="button" disabled title="Disponível após definir as regras de redistribuição">Ajustar distribuição</button></aside>
    </div>
  </div>;
}
