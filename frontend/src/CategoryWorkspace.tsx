import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import './categoryStyles.css';

type CategoryType = 'INCOME' | 'EXPENSE' | 'INVESTMENT';
type CategoryLevel = 'all' | 'root' | 'child';
type CategoryOrigin = 'all' | 'default' | 'custom';
type CategoryExample = {
  id: string;
  label: string;
  type: CategoryType;
  parentId?: string;
  isDefault: boolean;
};

const groups: { type: CategoryType; label: string; icon: 'income' | 'expense' | 'investment' }[] = [
  { type: 'INCOME', label: 'Receitas', icon: 'income' },
  { type: 'EXPENSE', label: 'Despesas', icon: 'expense' },
  { type: 'INVESTMENT', label: 'Investimentos', icon: 'investment' },
];

// Amostras locais para a interface; a API de categorias será integrada depois.
const categoryExamples: CategoryExample[] = [
  { id: 'salary', label: 'Salário', type: 'INCOME', isDefault: true },
  { id: 'freelance', label: 'Freelance', type: 'INCOME', isDefault: true },
  { id: 'extra', label: 'Renda extra', type: 'INCOME', isDefault: true },
  { id: 'food', label: 'Alimentação', type: 'EXPENSE', isDefault: true },
  { id: 'market', label: 'Mercado', type: 'EXPENSE', parentId: 'food', isDefault: false },
  { id: 'delivery', label: 'Delivery', type: 'EXPENSE', parentId: 'food', isDefault: false },
  { id: 'housing', label: 'Moradia', type: 'EXPENSE', isDefault: true },
  { id: 'transport', label: 'Transporte', type: 'EXPENSE', isDefault: true },
  { id: 'health', label: 'Saúde', type: 'EXPENSE', isDefault: true },
  { id: 'education', label: 'Educação', type: 'EXPENSE', isDefault: true },
  { id: 'entertainment', label: 'Entretenimento', type: 'EXPENSE', isDefault: true },
  { id: 'shopping', label: 'Compras', type: 'EXPENSE', isDefault: true },
  { id: 'bills', label: 'Contas e serviços', type: 'EXPENSE', isDefault: true },
  { id: 'subscriptions', label: 'Assinaturas', type: 'EXPENSE', isDefault: true },
  { id: 'care', label: 'Cuidados pessoais', type: 'EXPENSE', isDefault: true },
  { id: 'taxes', label: 'Impostos e taxas', type: 'EXPENSE', isDefault: true },
  { id: 'investments', label: 'Investimentos', type: 'INVESTMENT', isDefault: true },
  { id: 'cdi', label: 'CDI', type: 'INVESTMENT', isDefault: true },
  { id: 'rent', label: 'Locação', type: 'INVESTMENT', isDefault: true },
  { id: 'treasury', label: 'Tesouro Direto', type: 'INVESTMENT', isDefault: true },
  { id: 'cdb', label: 'CDB', type: 'INVESTMENT', isDefault: true },
  { id: 'stocks', label: 'Ações', type: 'INVESTMENT', isDefault: true },
  { id: 'real-estate', label: 'Fundos imobiliários', type: 'INVESTMENT', isDefault: true },
];

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function CategoryIcon({ name, size = 18 }: { name: 'search' | 'filter' | 'tag' | 'income' | 'expense' | 'investment' | 'plus' | 'edit' | 'delete'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4.5 4.5" /></>,
    filter: <><path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" /></>,
    tag: <><path d="M20.5 13.5 13.5 20.5a2 2 0 0 1-2.8 0L3 12.8V4h8.8l8.7 8.7a.6.6 0 0 1 0 .8Z" /><circle cx="7.5" cy="8" r="1" /></>,
    income: <><path d="M4 20v-6m5 6V9m5 11V5m5 15V2" /></>,
    expense: <><path d="M3 8h18v12H3zM3 8V5h18v3M16 14h3" /></>,
    investment: <><path d="m3 18 6-6 4 3 8-9m-5 0h5v5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    edit: <><path d="m4 20 4.5-1 11-11-3.5-3.5-11 11L4 20Zm10-13 3.5 3.5" /></>,
    delete: <><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v6m4-6v6" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function CategoryGroup({ type, label, icon, items }: { type: CategoryType; label: string; icon: 'income' | 'expense' | 'investment'; items: CategoryExample[] }) {
  return (
    <section className="category-group" aria-labelledby={`category-group-${type}`}>
      <header className="category-group-header">
        <div><CategoryIcon name={icon} size={21} /><h3 id={`category-group-${type}`}>{label}</h3></div>
        <span>{items.length} {items.length === 1 ? 'categoria' : 'categorias'}</span>
      </header>
      <div className="category-group-list" tabIndex={0} aria-label={`Lista de ${label.toLocaleLowerCase('pt-BR')}`}>
        {items.map(item => {
          const parent = categoryExamples.find(candidate => candidate.id === item.parentId);
          return (
            <div className={`category-list-row${parent ? ' child' : ''}`} key={item.id}>
              <span className="category-row-icon"><CategoryIcon name="tag" size={16} /></span>
              <span className="category-row-copy"><strong>{item.label}</strong>{parent && <small>em {parent.label}</small>}</span>
              {item.isDefault && <span className="category-default-badge">Padrão</span>}
              {!item.isDefault && <span className="category-row-actions"><button type="button" disabled aria-label={`Editar ${item.label}`} title="Disponível após a integração"><CategoryIcon name="edit" size={16} /></button><button type="button" disabled aria-label={`Excluir ${item.label}`} title="Disponível após a integração"><CategoryIcon name="delete" size={16} /></button></span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CategoryWorkspace() {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<CategoryType | 'ALL'>('ALL');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [level, setLevel] = useState<CategoryLevel>('all');
  const [origin, setOrigin] = useState<CategoryOrigin>('all');
  const [draftType, setDraftType] = useState<CategoryType | 'ALL'>('ALL');
  const [draftLevel, setDraftLevel] = useState<CategoryLevel>('all');
  const [draftOrigin, setDraftOrigin] = useState<CategoryOrigin>('all');
  const [filterMaxHeight, setFilterMaxHeight] = useState<number>();
  const filterRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filtersOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !filterRef.current?.contains(event.target)) setFiltersOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setFiltersOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [filtersOpen]);

  useLayoutEffect(() => {
    if (!filtersOpen || !popoverRef.current) return;
    const frame = popoverRef.current.closest('.workspace-frame');
    if (!frame) return;

    function fitInsideFrame() {
      if (!popoverRef.current || !frame) return;
      const bottom = Math.min(frame.getBoundingClientRect().bottom, window.innerHeight);
      const top = popoverRef.current.getBoundingClientRect().top;
      setFilterMaxHeight(Math.max(0, Math.floor(bottom - top - 12)));
    }

    fitInsideFrame();
    const observer = new ResizeObserver(fitInsideFrame);
    observer.observe(frame);
    window.addEventListener('resize', fitInsideFrame);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fitInsideFrame);
    };
  }, [filtersOpen]);

  const searchTerm = normalizeSearch(search.trim());
  const visible = categoryExamples.filter(item => {
    const parent = categoryExamples.find(candidate => candidate.id === item.parentId);
    return (selectedType === 'ALL' || item.type === selectedType)
      && (level === 'all' || (level === 'root' ? !item.parentId : Boolean(item.parentId)))
      && (origin === 'all' || (origin === 'default' ? item.isDefault : !item.isDefault))
      && (!searchTerm || normalizeSearch(item.label).includes(searchTerm) || (parent && normalizeSearch(parent.label).includes(searchTerm)));
  });
  const shownGroups = groups.filter(group => selectedType === 'ALL' || group.type === selectedType);

  return (
    <div className="category-workspace">
      <div className="section-toolbar category-toolbar"><div><span className="eyebrow">ORGANIZAÇÃO</span><h2>Suas categorias</h2><p>Prévia com categorias de exemplo</p></div><button className="primary-action" type="button" disabled title="Disponível após a integração"><CategoryIcon name="plus" size={17} />Nova categoria</button></div>

      <div className="category-search-row" ref={filterRef}>
        <label className="category-search"><CategoryIcon name="search" size={19} /><span className="sr-only">Buscar categoria</span><input name="categorySearch" type="search" autoComplete="off" placeholder="Buscar categoria…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <button className={`category-filter-button${filtersOpen || level !== 'all' || origin !== 'all' || selectedType !== 'ALL' ? ' active' : ''}`} type="button" onClick={() => { setDraftType(selectedType); setDraftLevel(level); setDraftOrigin(origin); setFiltersOpen(open => !open); }} aria-expanded={filtersOpen} aria-controls="category-filter-popover"><CategoryIcon name="filter" size={19} />Filtros</button>
        {filtersOpen && <div className="category-filter-popover" id="category-filter-popover" ref={popoverRef} style={{ maxHeight: filterMaxHeight }} role="group" aria-label="Filtros de categorias">
          <div className="category-filter-options">
          <fieldset><legend>Tipo de categoria</legend>{([{ type: 'ALL', label: 'Todos' }, ...groups.map(group => ({ type: group.type, label: group.label }))] as { type: CategoryType | 'ALL'; label: string }[]).map(({ type, label }) => <label key={type}><input type="radio" name="categoryType" value={type} checked={draftType === type} onChange={() => setDraftType(type)} /><span>{label}</span></label>)}</fieldset>
          <fieldset><legend>Organização</legend>{([['all', 'Todas'], ['root', 'Principais'], ['child', 'Subcategorias']] as const).map(([value, text]) => <label key={value}><input type="radio" name="categoryLevel" value={value} checked={draftLevel === value} onChange={() => setDraftLevel(value)} /><span>{text}</span></label>)}</fieldset>
          <fieldset><legend>Criada por</legend>{([['all', 'Todas'], ['default', 'Pelo aplicativo'], ['custom', 'Por você']] as const).map(([value, text]) => <label key={value}><input type="radio" name="categoryOrigin" value={value} checked={draftOrigin === value} onChange={() => setDraftOrigin(value)} /><span>{text}</span></label>)}</fieldset>
          </div>
          <div className="category-filter-actions"><button type="button" onClick={() => { setDraftType('ALL'); setDraftLevel('all'); setDraftOrigin('all'); setSelectedType('ALL'); setLevel('all'); setOrigin('all'); setFiltersOpen(false); }}>Limpar</button><button type="button" onClick={() => { setSelectedType(draftType); setLevel(draftLevel); setOrigin(draftOrigin); setFiltersOpen(false); }}>Aplicar filtros</button></div>
        </div>}
      </div>

      <div className="category-type-row"><div className="category-active-filters" aria-label="Filtros aplicados">
        {selectedType === 'ALL' && level === 'all' && origin === 'all' ? <span className="category-filter-empty">Todas as categorias</span> : <>
          {selectedType !== 'ALL' && <button type="button" className="category-filter-chip" onClick={() => setSelectedType('ALL')} aria-label={`Remover filtro ${groups.find(group => group.type === selectedType)?.label}`}>{groups.find(group => group.type === selectedType)?.label}<span aria-hidden="true">×</span></button>}
          {level !== 'all' && <button type="button" className="category-filter-chip" onClick={() => setLevel('all')} aria-label={`Remover filtro ${level === 'root' ? 'Principais' : 'Subcategorias'}`}>{level === 'root' ? 'Principais' : 'Subcategorias'}<span aria-hidden="true">×</span></button>}
          {origin !== 'all' && <button type="button" className="category-filter-chip" onClick={() => setOrigin('all')} aria-label={`Remover filtro ${origin === 'default' ? 'Pelo aplicativo' : 'Por você'}`}>{origin === 'default' ? 'Pelo aplicativo' : 'Por você'}<span aria-hidden="true">×</span></button>}
        </>}
        </div><span className="category-result-count" aria-live="polite">{visible.length} {visible.length === 1 ? 'categoria' : 'categorias'}</span></div>

      {visible.length ? <div className={`category-groups${selectedType !== 'ALL' ? ' single' : ''}`}>{shownGroups.filter(group => visible.some(item => item.type === group.type)).map(group => <CategoryGroup key={group.type} {...group} items={visible.filter(item => item.type === group.type)} />)}</div> : <div className="category-no-results"><CategoryIcon name="search" size={28} /><h3>Nenhuma categoria encontrada</h3><p>Ajuste a busca ou os filtros para ver outros resultados.</p></div>}
    </div>
  );
}
