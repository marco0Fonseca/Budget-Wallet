import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { CategoryWorkspace } from './CategoryWorkspace.tsx';
import { TransactionWorkspace } from './TransactionWorkspace.tsx';
import { InvestmentWorkspace } from './InvestmentWorkspace.tsx';
import { DashboardWorkspace } from './DashboardWorkspace.tsx';
import { PlanningWorkspace } from './PlanningWorkspace.tsx';

const authTokenKey = 'budgetwallet-auth-token';
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percentFormatter = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2 });
const monthYearFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long' });
const shortMonthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const formatPreviewCurrency = (cents: number) => currencyFormatter.format(cents / 100);
const previewMonth = new Date(2026, 10, 1);
type LoginView = 'login' | 'create' | 'recover';
type LoginErrors = { identifier?: string; password?: string; form?: string };

function readLoginView(): LoginView {
  const view = new URLSearchParams(location.search).get('view');
  return view === 'create' || view === 'recover' ? view : 'login';
}

type IconName = 'wallet' | 'mail' | 'lock' | 'eye' | 'eyeOff' | 'chart' | 'calendar' | 'receipt' | 'trend' | 'arrowUp' | 'arrowDown' | 'equal' | 'restaurant' | 'market' | 'back' | 'success' | 'home' | 'transfer' | 'tag' | 'investment' | 'message' | 'sparkle' | 'plus';

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    wallet: <><path d="M3 7.5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z" /><path d="M3 8V6a2 2 0 0 1 1.5-1.94l11-2.75a2 2 0 0 1 2.5 1.94V7.5" /><path d="M17 14.5h4" /><circle cx="17" cy="14.5" r=".5" fill="currentColor" stroke="none" /></>,
    mail: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="m3.5 6 8.5 7 8.5-7" /></>,
    lock: <><rect x="4.5" y="10" width="15" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    eye: <><path d="M2 12s3.6-5.5 10-5.5S22 12 22 12s-3.6 5.5-10 5.5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    eyeOff: <><path d="m3 3 18 18" /><path d="M9.9 6.7A12 12 0 0 1 12 6.5c6.4 0 10 5.5 10 5.5a16 16 0 0 1-3.3 3.6M6.2 8.2C3.5 9.8 2 12 2 12s3.6 5.5 10 5.5c1.2 0 2.3-.2 3.3-.6" /><path d="M10 10a2.8 2.8 0 0 0 4 4" /></>,
    chart: <><path d="M4 19V12M10 19V8M16 19V4M22 19v-9" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    trend: <><path d="m3 17 6-6 4 3 8-9" /><path d="M16 5h5v5" /></>,
    arrowUp: <><path d="M12 20V4" /><path d="m5 11 7-7 7 7" /></>,
    arrowDown: <><path d="M12 4v16" /><path d="m5 13 7 7 7-7" /></>,
    equal: <><path d="M5 9h14M5 15h14" /></>,
    restaurant: <><path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M20 21V3c-4 3-5 7-5 11h5" /></>,
    market: <><path d="M3 10h18l-2 10H5L3 10Z" /><path d="m8 10 4-7 4 7M9 14v3M15 14v3" /></>,
    back: <><path d="m14 5-7 7 7 7" /><path d="M7 12h14" /></>,
    success: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></>,
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    transfer: <><path d="M4 7h15l-3-3M20 17H5l3 3" /></>,
    tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V4h9l8.6 8.6a.6.6 0 0 1 0 .8Z" /><circle cx="7.5" cy="8" r="1" /></>,
    investment: <><path d="m3 17 6-6 4 3 8-9" /><path d="M15 5h6v6" /></>,
    message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></>,
    sparkle: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Brand() {
  return <div className="brand"><span className="brand-icon"><Icon name="wallet" size={30} /></span><span translate="no">BudgetWallet</span></div>;
}

function PreviewPanels() {
  const bars = [58, 76, 53, 46, 64, 68];
  const months = bars.map((_, index) => shortMonthFormatter.format(new Date(2026, 5 + index, 1)));
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview-summary preview-card">
        <div className="preview-heading"><span className="preview-heading-icon"><Icon name="chart" size={23} /></span><strong>Resumo do mês</strong><span className="preview-period">{monthYearFormatter.format(previewMonth)}</span></div>
        <div className="summary-grid">
          <div className="summary-item income"><span className="summary-label"><span className="metric-arrow"><Icon name="arrowUp" size={17} /></span>Receitas</span><strong>{formatPreviewCurrency(520000)}</strong></div>
          <div className="summary-item expense"><span className="summary-label"><span className="metric-arrow"><Icon name="arrowDown" size={17} /></span>Despesas</span><strong>{formatPreviewCurrency(235000)}</strong></div>
          <div className="summary-item result"><span className="summary-label"><span className="metric-arrow"><Icon name="equal" size={17} /></span>Resultado</span><strong>{formatPreviewCurrency(285000)}</strong></div>
        </div>
      </div>

      <div className="preview-chart preview-card">
        <div className="preview-heading"><span className="preview-heading-icon"><Icon name="receipt" size={22} /></span><strong>Despesas mensais</strong><span className="preview-period">Últimos 6 meses</span></div>
        <div className="chart-area"><div className="chart-grid" /><div className="bar-list">{bars.map((height, index) => <div className="bar-slot" key={months[index]}><div className="bar" style={{ height: `${height}%` }} /><span>{months[index]}</span></div>)}</div></div>
      </div>

      <div className="preview-investment preview-card">
        <div className="preview-heading"><span className="preview-heading-icon"><Icon name="trend" size={22} /></span><strong>Investimentos</strong></div>
        <p></p><strong className="investment-number">+ {percentFormatter.format(0.0834)}</strong>
        <svg className="investment-curve" viewBox="0 0 240 72" preserveAspectRatio="none"><path d="M0 66C20 59 20 48 40 54S66 62 82 45s28 7 46-9 20 3 42-13 28 5 44-11 20-9 26-12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
      </div>

      <div className="preview-transactions preview-card">
        <div className="preview-heading"><span className="preview-heading-icon"><Icon name="receipt" size={22} /></span><strong>Transações recentes</strong></div>
        <div className="transaction-row"><span className="transaction-symbol food"><Icon name="restaurant" size={19} /></span><span className="transaction-text"><strong>Restaurante</strong><small>{shortDateFormatter.format(new Date(2026, 10, 15))}</small></span><strong className="transaction-value negative">− {formatPreviewCurrency(6890)}</strong></div>
        <div className="transaction-row"><span className="transaction-symbol market"><Icon name="market" size={19} /></span><span className="transaction-text"><strong>Mercado</strong><small>{shortDateFormatter.format(new Date(2026, 10, 13))}</small></span><strong className="transaction-value negative">− {formatPreviewCurrency(32045)}</strong></div>
        <div className="transaction-row"><span className="transaction-symbol salary"><Icon name="trend" size={19} /></span><span className="transaction-text"><strong>Salário</strong><small>{shortDateFormatter.format(new Date(2026, 10, 10))}</small></span><strong className="transaction-value positive">+ {formatPreviewCurrency(520000)}</strong></div>
      </div>

      <div className="preview-planning preview-card">
        <div className="preview-heading"><span className="preview-heading-icon"><Icon name="calendar" size={22} /></span><strong>Planejamento diário</strong><span className="preview-period">{monthFormatter.format(previewMonth)}</span></div>
        <div className="week-strip">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day, index) => <div className="day" key={day}><span>{day}</span><strong className={index === 2 ? 'selected-day' : ''}>{16 + index}</strong></div>)}</div>
      </div>
    </div>
  );
}

function readAuthenticatedSession() {
  return sessionStorage.getItem(authTokenKey) !== null;
}

type WorkspaceSection = 'Dashboard' | 'Transações' | 'Categorias' | 'Investimentos' | 'Planejamento diário';

const workspaceNav: { label: WorkspaceSection; icon: IconName }[] = [
  { label: 'Dashboard', icon: 'home' },
  { label: 'Transações', icon: 'transfer' },
  { label: 'Categorias', icon: 'tag' },
  { label: 'Investimentos', icon: 'investment' },
  { label: 'Planejamento diário', icon: 'calendar' },
];

function Workspace({ showLogoutDialog, onRequestSignOut, onCancelSignOut, onSignOut, logoutButtonRef, cancelLogoutButtonRef }: {
  showLogoutDialog: boolean;
  onRequestSignOut: () => void;
  onCancelSignOut: () => void;
  onSignOut: () => void;
  logoutButtonRef: RefObject<HTMLButtonElement | null>;
  cancelLogoutButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('Dashboard');
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const selectedMonthDate = new Date(`${selectedMonth}-01T12:00:00`);
  const selectedMonthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(selectedMonthDate);
  const sectionTitles: Record<WorkspaceSection, string> = {
    Dashboard: 'Dashboard',
    Transações: 'Transações',
    Categorias: 'Categorias',
    Investimentos: 'Investimentos',
    'Planejamento diário': 'Planejamento diário',
  };

  return (
    <main className="workspace-page">
      <div className="workspace-glow workspace-glow-one" />
      <div className="workspace-glow workspace-glow-two" />
      <div className="workspace-frame">
        <aside className="workspace-sidebar" aria-label="Navegação principal">
          <button className="workspace-brand" type="button" onClick={() => setActiveSection('Dashboard')} aria-label="Abrir Dashboard">
            <span className="workspace-brand-icon"><Icon name="wallet" size={20} /></span>
            <span>BudgetWallet</span>
          </button>

          <nav className="workspace-nav">
            {workspaceNav.map(item => (
              <button key={item.label} className={`workspace-nav-item${activeSection === item.label ? ' active' : ''}`} type="button" aria-current={activeSection === item.label ? 'page' : undefined} onClick={() => setActiveSection(item.label)}>
                <Icon name={item.icon} size={19} /><span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="workspace-sidebar-bottom">
            <div className="workspace-attribution">
              <a href="https://github.com/marco0Fonseca" target="_blank" rel="noreferrer">marco0fonseca</a>
              <a className="github-link" href="https://github.com/marco0Fonseca/Budget-Wallet" target="_blank" rel="noreferrer" aria-label="Repositório Budget-Wallet no GitHub" title="Repositório no GitHub">
                <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" /></svg>
              </a>
            </div>
          </div>
        </aside>

        <section className="workspace-main">
          <header className="workspace-topbar">
            <div className="workspace-mobile-brand"><span className="workspace-brand-icon"><Icon name="wallet" size={19} /></span><strong>BudgetWallet</strong></div>
            <div className="workspace-topbar-right">
              <label className="month-select"><Icon name="calendar" size={17} /><span className="sr-only">Mês</span><select value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)}><option value="2026-11">Novembro de 2026</option><option value="2026-10">Outubro de 2026</option><option value="2026-09">Setembro de 2026</option></select></label>
              <button ref={logoutButtonRef} className="workspace-signout" type="button" onClick={onRequestSignOut} aria-haspopup="dialog">Sair</button>
            </div>
          </header>

          <div className="workspace-content">
            <div className="workspace-page-heading">
              <div><span className="eyebrow">SEU ESPAÇO FINANCEIRO</span><h1>{sectionTitles[activeSection]}</h1></div>
              <span className="workspace-date">{selectedMonthLabel}</span>
            </div>

            {activeSection === 'Dashboard' ? <DashboardWorkspace selectedMonth={selectedMonth} onNavigate={setActiveSection} /> : <WorkspacePlaceholder section={activeSection} selectedMonth={selectedMonth} />}
          </div>
        </section>
        <button className="ai-chat-trigger" type="button" onClick={() => setChatOpen(open => !open)} aria-haspopup="dialog" aria-expanded={chatOpen} aria-label={chatOpen ? 'Fechar chat do assistente' : 'Abrir chat do assistente'}>
          <Icon name={chatOpen ? 'back' : 'message'} size={21} />
        </button>
        {chatOpen && (
          <section className="ai-chat-panel" role="dialog" aria-modal="false" aria-labelledby="ai-chat-title">
            <header><span className="ai-chat-avatar"><Icon name="sparkle" size={20} /></span><div><strong id="ai-chat-title">Assistente BudgetWallet</strong><small>Prévia visual</small></div><button type="button" onClick={() => setChatOpen(false)} aria-label="Fechar chat">×</button></header>
            <div className="ai-chat-body"><p className="ai-chat-bubble">Olá! Em breve vou ajudar você a entender e organizar suas finanças.</p></div>
            <form className="ai-chat-input" onSubmit={event => event.preventDefault()}><input name="message" autoComplete="off" aria-label="Mensagem para o assistente" placeholder="Escreva uma mensagem…" /><button type="submit" aria-label="Enviar mensagem"><Icon name="transfer" size={18} /></button></form>
          </section>
        )}
      </div>
      {showLogoutDialog && (
        <div className="logout-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onCancelSignOut(); }}>
          <section className="logout-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-dialog-title" aria-describedby="logout-dialog-description">
            <div className="logout-dialog-copy"><h2 id="logout-dialog-title">Sair da sua conta?</h2><p id="logout-dialog-description">Você precisará entrar novamente para acessar sua conta.</p></div>
            <div className="logout-dialog-actions"><button ref={cancelLogoutButtonRef} className="logout-cancel" type="button" onClick={onCancelSignOut}>Cancelar</button><button className="logout-confirm" type="button" onClick={onSignOut}>Sair</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

function WorkspacePlaceholder({ section, selectedMonth }: { section: Exclude<WorkspaceSection, 'Dashboard'>; selectedMonth: string }) {
  if (section === 'Transações') {
    return <TransactionWorkspace selectedMonth={selectedMonth} />;
  }

  if (section === 'Categorias') {
    return <CategoryWorkspace />;
  }

  if (section === 'Planejamento diário') {
    return <PlanningWorkspace selectedMonth={selectedMonth} />;
  }

  return <InvestmentWorkspace />;
}

export function App() {
  const [entered, setEntered] = useState(readAuthenticatedSession);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showConfirmedPassword, setShowConfirmedPassword] = useState(false);
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [showRecoveryConfirmation, setShowRecoveryConfirmation] = useState(false);
  const [signupSucceeded, setSignupSucceeded] = useState(false);
  const [recoverySucceeded, setRecoverySucceeded] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const createFormRef = useRef<HTMLFormElement>(null);
  const createPasswordRef = useRef<HTMLInputElement>(null);
  const confirmedPasswordRef = useRef<HTMLInputElement>(null);
  const recoveryPasswordRef = useRef<HTMLInputElement>(null);
  const recoveryConfirmationRef = useRef<HTMLInputElement>(null);
  const logoutButtonRef = useRef<HTMLButtonElement>(null);
  const cancelLogoutButtonRef = useRef<HTMLButtonElement>(null);
  const loginView = readLoginView();

  useEffect(() => {
    const titles: Record<LoginView, string> = { login: 'Entrar', create: 'Criar conta', recover: 'Recuperar senha' };
    document.title = entered ? 'Dashboard · BudgetWallet' : signupSucceeded ? 'Conta criada · BudgetWallet' : `${titles[loginView]} · BudgetWallet`;
  }, [entered, loginView, signupSucceeded]);

  useEffect(() => {
    const normalizeRoute = () => {
      if (location.pathname === '/dashboard' && !entered) history.replaceState(null, '', '/');
      if (location.pathname !== '/dashboard' && entered) history.replaceState(null, '', '/dashboard');
    };
    normalizeRoute();
    window.addEventListener('popstate', normalizeRoute);
    return () => window.removeEventListener('popstate', normalizeRoute);
  }, [entered]);

  useEffect(() => {
    if (!showLogoutDialog) return;

    cancelLogoutButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowLogoutDialog(false);
        logoutButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutDialog]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: LoginErrors = {};
    if (!identifier.trim()) nextErrors.identifier = 'Informe seu e-mail ou username.';
    if (!password.trim()) nextErrors.password = 'Informe sua senha.';
    if (nextErrors.identifier || nextErrors.password) {
      setErrors(nextErrors);
      (nextErrors.identifier ? identifierRef : passwordRef).current?.focus();
      return;
    }
    setIsSigningIn(true);
    setErrors({});
    try {
      const response = await fetch('http://localhost:5000/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const result: { error?: string; token?: string } = await response.json();

      if (!response.ok) {
        setErrors({ form: result.error ?? 'Não foi possível entrar. Confira seus dados e tente novamente.' });
        return;
      }
      if (typeof result.token !== 'string' || result.token.length === 0) {
        setErrors({ form: 'O servidor não retornou um token de acesso válido.' });
        return;
      }

      sessionStorage.setItem(authTokenKey, result.token);
      setPassword('');
      setEntered(true);
      history.pushState(null, '', '/dashboard');
    } catch {
      setErrors({ form: 'Não foi possível conectar ao servidor. Verifique se a API está em execução e tente novamente.' });
    } finally {
      setIsSigningIn(false);
    }
  }

  function clearFieldError(field: 'identifier' | 'password') {
    setErrors(current => {
      const next = { ...current };
      delete next[field];
      delete next.form;
      return next;
    });
  }

  function signOut() {
    setShowLogoutDialog(false);
    sessionStorage.removeItem(authTokenKey);
    setIdentifier('');
    setPassword('');
    setShowPassword(false);
    setEntered(false);
    history.pushState(null, '', '/');
  }

  function leaveCreateForm() {
    const form = createFormRef.current;
    const hasEnteredData = form
      ? Array.from(new FormData(form).values()).some(value => typeof value === 'string' && value.trim() !== '')
      : false;

    if (hasEnteredData && !window.confirm('Você já preencheu alguns dados. Quer descartá-los e voltar ao login?')) {
      return;
    }

    window.location.assign('/');
  }

  function validatePasswordConfirmation() {
    const password = createPasswordRef.current;
    const confirmation = confirmedPasswordRef.current;
    if (!password || !confirmation) return;
    confirmation.setCustomValidity(
      confirmation.value && confirmation.value !== password.value ? 'As senhas não coincidem.' : '',
    );
  }

  function validateRecoveryPasswordConfirmation() {
    const newPassword = recoveryPasswordRef.current;
    const confirmation = recoveryConfirmationRef.current;
    if (!newPassword || !confirmation) return;
    confirmation.setCustomValidity(
      confirmation.value && confirmation.value !== newPassword.value ? 'As senhas não coincidem.' : '',
    );
  }

  async function submitCreateAccount(event: FormEvent<HTMLFormElement>){
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.status === 201) {
        setSignupSucceeded(true);
        window.setTimeout(() => window.location.assign('/'), 3000);
        return;
      }

      const result: { error?: string } = await response.json();
      window.alert(result.error ?? 'Não foi possível criar sua conta. Tente novamente.');
    } catch {
      window.alert('Não foi possível conectar ao servidor. Verifique se a API está em execução e tente novamente.');
    }
  }

  async function submitPasswordRecovery(event: FormEvent<HTMLFormElement>){
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('http://localhost:5000/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.status === 200) {
        setRecoverySucceeded(true);
        window.setTimeout(() => window.location.assign('/'), 3000);
        return;
      }

      const result: { error?: string } = await response.json();
      window.alert(result.error ?? 'Não foi possível redefinir sua senha. Tente novamente.');
    } catch {
      window.alert('Não foi possível conectar ao servidor. Verifique se a API está em execução e tente novamente.');
    }
  }

  if (entered) {
    return <Workspace
      showLogoutDialog={showLogoutDialog}
      onRequestSignOut={() => setShowLogoutDialog(true)}
      onCancelSignOut={() => { setShowLogoutDialog(false); logoutButtonRef.current?.focus(); }}
      onSignOut={signOut}
      logoutButtonRef={logoutButtonRef}
      cancelLogoutButtonRef={cancelLogoutButtonRef}
    />;
  }

  return (
    <main className="login-page">
      <div className="login-layout">
        <section className={`login-card${loginView === 'create' ? ' create-card' : ''}`} aria-labelledby="login-title">
          <Brand />
          {loginView === 'login' ? (
            <div className="login-content">
              <h1 id="login-title" tabIndex={-1}>Organize seu<br /> dinheiro</h1>
              <p className="login-intro">Acompanhe receitas, despesas e seu resultado mensal em um só lugar.</p>
              <form onSubmit={submit} noValidate>
                <div className="field"><label htmlFor="identifier">E-mail ou username</label><div className="input-wrap"><Icon name="mail" /><input ref={identifierRef} id="identifier" name="identifier" type="text" autoComplete="username" spellCheck={false} placeholder="seu@email.com ou username…" value={identifier} onChange={event => { setIdentifier(event.target.value); clearFieldError('identifier'); }} aria-invalid={Boolean(errors.identifier)} aria-describedby={errors.identifier ? 'identifier-error' : undefined} /></div>{errors.identifier && <p className="field-error" id="identifier-error" role="alert">{errors.identifier}</p>}</div>
                <div className="field password-field"><label htmlFor="password">Senha</label><div className="input-wrap"><Icon name="lock" /><input ref={passwordRef} id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Digite sua senha…" value={password} onChange={event => { setPassword(event.target.value); clearFieldError('password'); }} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} /><button className="password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword}><Icon name={showPassword ? 'eyeOff' : 'eye'} /></button></div>{errors.password && <p className="field-error" id="password-error" role="alert">{errors.password}</p>}</div>
                <div className="recover-row"><a className="text-button" href="/?view=recover">Esqueceu a senha?</a></div>
                {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
                <button className="submit-button" type="submit" disabled={isSigningIn}>{isSigningIn ? 'Entrando…' : 'Entrar'}</button>
              </form>
              <p className="signup-prompt">Ainda não tem conta? <a className="text-button" href="/?view=create">Criar conta</a></p>
            </div>
          ) : signupSucceeded ? (
            <div className="login-content signup-success" role="status" aria-live="polite">
              <span className="signup-success-icon"><Icon name="success" size={34} /></span>
              <h1 id="login-title" tabIndex={-1}>Conta criada com Sucesso</h1>
              <p className="login-intro">Você já pode acessar sua conta.</p>
            </div>
          ) : loginView === 'create' ? (
            <div className="login-content create-user">
            <div className="create-heading">
              <button className="back-button" type="button" onClick={leaveCreateForm} aria-label="Voltar ao login" title="Voltar ao login"><Icon name="back" size={21} /></button>
              <h1 id="login-title" tabIndex={-1}>Criar conta</h1>
            </div>
            <p className="login-intro">Preencha seus dados para criar seu acesso.</p>
            <form ref={createFormRef} onSubmit={submitCreateAccount}>
              <div className="field">
                <label htmlFor="name">Nome Completo</label>
                <input id="name" name="name" type="text" autoComplete="name" />
              </div>

              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input id="email" name="email" type="email" autoComplete="email" />
              </div>

              <div className="field">
                <label htmlFor="username">Username</label>
                <input id="username" name="username" type="text" autoComplete="username" spellCheck={false} />
              </div>

              <div className="field">
                <label htmlFor="create-password">Senha</label>
                <div className="create-password-wrap">
                  <input ref={createPasswordRef} id="create-password" name="password" type={showCreatePassword ? 'text' : 'password'} autoComplete="new-password" onInput={validatePasswordConfirmation} required />
                  <button className="password-toggle" type="button" onClick={() => setShowCreatePassword(value => !value)} aria-label={showCreatePassword ? 'Ocultar senha do cadastro' : 'Mostrar senha do cadastro'} aria-pressed={showCreatePassword}><Icon name={showCreatePassword ? 'eyeOff' : 'eye'} /></button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="confirm-password">Confirmar Senha</label>
                <div className="create-password-wrap">
                  <input ref={confirmedPasswordRef} id="confirm-password" name="confirmPassword" type={showConfirmedPassword ? 'text' : 'password'} autoComplete="new-password" onInput={validatePasswordConfirmation} required />
                  <button className="password-toggle" type="button" onClick={() => setShowConfirmedPassword(value => !value)} aria-label={showConfirmedPassword ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'} aria-pressed={showConfirmedPassword}><Icon name={showConfirmedPassword ? 'eyeOff' : 'eye'} /></button>
                </div>
              </div>
              <button className="submit-button" type="submit">Criar conta</button>
            </form>
            </div>
          ) : (
            <div className="login-content recover-password">
              {recoverySucceeded ? (
                <div className="signup-success" role="status" aria-live="polite">
                  <span className="signup-success-icon"><Icon name="success" size={34} /></span>
                  <h1 id="login-title" tabIndex={-1}>Senha redefinida com sucesso</h1>
                  <p className="login-intro">Você será redirecionado ao login em instantes.</p>
                </div>
              ) : <>
              <div className="create-heading">
                <button className="back-button" type="button" onClick={() => window.location.assign('/')} aria-label="Voltar ao login" title="Voltar ao login"><Icon name="back" size={21} /></button>
                <h1 id="login-title" tabIndex={-1}>Redefinir senha</h1>
              </div>
              <p className="login-intro">Informe o e-mail ou username da sua conta e escolha uma nova senha.</p>
              <form onSubmit={submitPasswordRecovery}>
                <div className="field">
                  <label htmlFor="recovery-identifier">E-mail ou username</label>
                  <input id="recovery-identifier" name="identifier" type="text" autoComplete="username" required />
                </div>
                <div className="field">
                  <label htmlFor="recovery-password">Nova senha</label>
                  <div className="create-password-wrap">
                    <input ref={recoveryPasswordRef} id="recovery-password" name="newPassword" type={showRecoveryPassword ? 'text' : 'password'} autoComplete="new-password" onInput={validateRecoveryPasswordConfirmation} required />
                    <button className="password-toggle" type="button" onClick={() => setShowRecoveryPassword(value => !value)} aria-label={showRecoveryPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'} aria-pressed={showRecoveryPassword}><Icon name={showRecoveryPassword ? 'eyeOff' : 'eye'} /></button>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="recovery-confirm-password">Confirmar nova senha</label>
                  <div className="create-password-wrap">
                    <input ref={recoveryConfirmationRef} id="recovery-confirm-password" name="confirmPassword" type={showRecoveryConfirmation ? 'text' : 'password'} autoComplete="new-password" onInput={validateRecoveryPasswordConfirmation} required />
                    <button className="password-toggle" type="button" onClick={() => setShowRecoveryConfirmation(value => !value)} aria-label={showRecoveryConfirmation ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'} aria-pressed={showRecoveryConfirmation}><Icon name={showRecoveryConfirmation ? 'eyeOff' : 'eye'} /></button>
                  </div>
                </div>
                <button className="submit-button" type="submit">Confirmar redefinição</button>
              </form>
              </>}
            </div>
          )}
          {loginView === 'login' && <>
            <div className="demo-note" aria-hidden="true"><span /><span /></div>
          </>}
        </section>
        <PreviewPanels />
      </div>
    </main>
  );
}
