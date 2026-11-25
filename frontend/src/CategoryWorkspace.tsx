import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { apiBaseUrl, authTokenKey } from './api.ts';
import './categoryStyles.css';

type CategoryType = 'INCOME' | 'EXPENSE' | 'INVESTMENT';
type CategoryLevel = 'all' | 'root' | 'child';
type CategoryOrigin = 'all' | 'default' | 'custom';
type Category = {
  id: number;
  label: string;
  type: CategoryType;
  parentId: number | null;
  userId: string;
  isDefault: boolean;
};
type CategoryLoadState = 'loading' | 'loaded' | 'error';

const groups: { type: CategoryType; label: string; icon: 'income' | 'expense' | 'investment' }[] = [
  { type: 'INCOME', label: 'Receitas', icon: 'income' },
  { type: 'EXPENSE', label: 'Despesas', icon: 'expense' },
  { type: 'INVESTMENT', label: 'Investimentos', icon: 'investment' },
];


function isCategory(value: unknown): value is Category {
  if (typeof value !== 'object' || value === null) return false;
  const category = value as Record<string, unknown>;
  return Number.isInteger(category.id)
    && typeof category.label === 'string'
    && (category.type === 'INCOME' || category.type === 'EXPENSE' || category.type === 'INVESTMENT')
    && (category.parentId === null || Number.isInteger(category.parentId))
    && typeof category.userId === 'string'
    && typeof category.isDefault === 'boolean';
}

function getApiError(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return fallback;
}

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function sortCategoriesByHierarchy(categories: Category[]): Category[] {
  const roots = categories.filter(category => category.parentId === null);
  const ordered: Category[] = [];

  for (const root of roots) {
    ordered.push(root);
    ordered.push(...categories.filter(category => category.parentId === root.id));
  }

  const includedIds = new Set(ordered.map(category => category.id));
  ordered.push(...categories.filter(category => !includedIds.has(category.id)));
  return ordered;
}

function CategoryIcon({ name, size = 18 }: { name: 'search' | 'filter' | 'tag' | 'income' | 'expense' | 'investment' | 'plus' | 'edit' | 'delete' | 'close'; size?: number }) {
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
    close: <path d="M6 6l12 12M18 6 6 18" />,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function CategoryGroup({ type, label, icon, items, categories, onEdit, onDelete }: { type: CategoryType; label: string; icon: 'income' | 'expense' | 'investment'; items: Category[]; categories: Category[]; onEdit: (category: Category) => void; onDelete: (category: Category) => void }) {
  return (
    <section className="category-group" aria-labelledby={`category-group-${type}`}>
      <header className="category-group-header">
        <div><CategoryIcon name={icon} size={21} /><h3 id={`category-group-${type}`}>{label}</h3></div>
        <span>{items.length} {items.length === 1 ? 'categoria' : 'categorias'}</span>
      </header>
      <div className="category-group-list" tabIndex={0} aria-label={`Lista de ${label.toLocaleLowerCase('pt-BR')}`}>
        {items.map(item => {
          const parent = categories.find(candidate => candidate.id === item.parentId);
          return (
            <div className={`category-list-row${parent ? ' child' : ''}`} key={item.id}>
              <span className="category-row-icon"><CategoryIcon name="tag" size={16} /></span>
              <span className="category-row-copy"><strong>{item.label}</strong></span>
              {item.isDefault && <span className="category-default-badge">Padrão</span>}
              {!item.isDefault && <span className="category-row-actions"><button type="button" onClick={() => onEdit(item)} aria-label={`Editar ${item.label}`} title={`Editar ${item.label}`}><CategoryIcon name="edit" size={16} /></button><button className="category-delete-button" type="button" onClick={() => onDelete(item)} aria-label={`Excluir ${item.label}`} title={`Excluir ${item.label}`}><CategoryIcon name="delete" size={16} /></button></span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CategoryWorkspace() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadState, setLoadState] = useState<CategoryLoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleteState, setDeleteState] = useState<'loading' | 'ready' | 'blocked' | 'deleting' | 'error'>('loading');
  const [deleteMessage, setDeleteMessage] = useState('');
  const [createLabel, setCreateLabel] = useState('');
  const [createType, setCreateType] = useState<CategoryType>('EXPENSE');
  const [createParentId, setCreateParentId] = useState('');
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
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
  const createDialogRef = useRef<HTMLElement>(null);
  const createLabelRef = useRef<HTMLInputElement>(null);
  const parentPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      setLoadState('loading');
      setLoadError('');
      const token = sessionStorage.getItem(authTokenKey);
      if (!token) {
        setLoadState('error');
        setLoadError('Sua sessão não foi encontrada. Entre novamente para carregar suas categorias.');
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/categories`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const payload: unknown = await response.json();

        if (!response.ok) {
          throw new Error(getApiError(payload, 'Não foi possível carregar suas categorias.'));
        }
        if (typeof payload !== 'object' || payload === null || !('categories' in payload)
          || !Array.isArray(payload.categories) || !payload.categories.every(isCategory)) {
          throw new Error('O servidor retornou uma lista de categorias inválida.');
        }

        setCategories(sortCategoriesByHierarchy(payload.categories));
        setLoadState('loaded');
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadState('error');
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar suas categorias.');
      }
    }

    void loadCategories();
    return () => controller.abort();
  }, [reloadVersion]);

  useEffect(() => {
    if (!createDialogOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    createLabelRef.current?.focus();

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (parentPickerOpen) setParentPickerOpen(false);
        else setCreateDialogOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !createDialogRef.current) return;

      const focusable = Array.from(createDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      previousFocus?.focus();
    };
  }, [createDialogOpen, parentPickerOpen]);

  useEffect(() => {
    if (!parentPickerOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !parentPickerRef.current?.contains(event.target)) {
        setParentPickerOpen(false);
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [parentPickerOpen]);

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
  const visible = categories.filter(item => {
    const parent = categories.find(candidate => candidate.id === item.parentId);
    return (selectedType === 'ALL' || item.type === selectedType)
      && (level === 'all' || (level === 'root' ? !item.parentId : Boolean(item.parentId)))
      && (origin === 'all' || (origin === 'default' ? item.isDefault : !item.isDefault))
      && (!searchTerm || normalizeSearch(item.label).includes(searchTerm) || (parent && normalizeSearch(parent.label).includes(searchTerm)));
  });
  const shownGroups = groups.filter(group => selectedType === 'ALL' || group.type === selectedType);
  const availableParents = categories.filter(category => category.id !== editingCategory?.id && category.type === createType && category.parentId === null);
  const editingCategoryHasChildren = editingCategory
    ? categories.some(category => category.parentId === editingCategory.id)
    : false;

  function openCreateDialog() {
    setEditingCategory(null);
    setCreateLabel('');
    setCreateType('EXPENSE');
    setCreateParentId('');
    setParentPickerOpen(false);
    setCreateError('');
    setCreateDialogOpen(true);
  }

  function openEditDialog(category: Category) {
    setEditingCategory(category);
    setCreateLabel(category.label);
    setCreateType(category.type);
    setCreateParentId(category.parentId === null ? '' : String(category.parentId));
    setParentPickerOpen(false);
    setCreateError('');
    setCreateDialogOpen(true);
  }

  async function openDeleteDialog(category: Category) {
    setDeletingCategory(category);
    setDeleteState('loading');
    setDeleteMessage('');
    const token = sessionStorage.getItem(authTokenKey);
    if (!token) {
      setDeleteState('error');
      setDeleteMessage('Sua sessão não foi encontrada. Entre novamente.');
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/categories/${category.id}/deletion-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(getApiError(payload, 'Não foi possível verificar a categoria.'));
      if (typeof payload !== 'object' || payload === null || !('canDelete' in payload) || typeof payload.canDelete !== 'boolean'
        || !('blockers' in payload) || typeof payload.blockers !== 'object' || payload.blockers === null) {
        throw new Error('O servidor retornou uma resposta inválida.');
      }
      const blockers = payload.blockers as Record<string, unknown>;
      if (payload.canDelete) {
        setDeleteState('ready');
      } else {
        const reasons: string[] = [];
        if (blockers.children) reasons.push('possui subcategorias');
        if (blockers.transactions) reasons.push('é usada por transações');
        if (blockers.investments) reasons.push('é usada por investimentos');
        setDeleteMessage(`Esta categoria não pode ser excluída porque ${reasons.join(', ') || 'é protegida'}.`);
        setDeleteState('blocked');
      }
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : 'Não foi possível verificar a categoria.');
      setDeleteState('error');
    }
  }

  async function confirmDeleteCategory() {
    if (!deletingCategory || deleteState !== 'ready') return;
    const token = sessionStorage.getItem(authTokenKey);
    if (!token) {
      setDeleteMessage('Sua sessão não foi encontrada. Entre novamente.');
      setDeleteState('error');
      return;
    }
    setDeleteState('deleting');
    try {
      const response = await fetch(`${apiBaseUrl}/api/categories/${deletingCategory.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 409) {
          setDeleteMessage('Esta categoria passou a ter vínculos e não pode ser excluída agora.');
          setDeleteState('blocked');
          return;
        }
        const payload: unknown = await response.json();
        throw new Error(getApiError(payload, 'Não foi possível excluir a categoria.'));
      }
      setCategories(current => current.filter(category => category.id !== deletingCategory.id));
      setDeletingCategory(null);
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : 'Não foi possível excluir a categoria.');
      setDeleteState('error');
    }
  }

  async function submitCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createLabel.trim()) {
      setCreateError('Informe o nome da categoria.');
      createLabelRef.current?.focus();
      return;
    }

    const token = sessionStorage.getItem(authTokenKey);
    if (!token) {
      setCreateError('Sua sessão não foi encontrada. Entre novamente para criar categorias.');
      return;
    }

    setIsCreating(true);
    setCreateError('');
    try {
      const isEditing = editingCategory !== null;
      const response = await fetch(
        isEditing ? `${apiBaseUrl}/api/categories/${editingCategory.id}` : `${apiBaseUrl}/api/categories`,
        {
        method: isEditing ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          label: createLabel.trim(),
          type: createType,
          parentId: createParentId ? Number(createParentId) : null,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getApiError(payload, isEditing ? 'Não foi possível atualizar a categoria.' : 'Não foi possível criar a categoria.'));
      }
      if (typeof payload !== 'object' || payload === null || !('category' in payload) || !isCategory(payload.category)) {
        throw new Error('O servidor retornou uma categoria inválida.');
      }

      if (isEditing) {
        if (!('categories' in payload) || !Array.isArray(payload.categories) || !payload.categories.every(isCategory)) {
          throw new Error('O servidor retornou uma lista de categorias inválida.');
        }
        setCategories(sortCategoriesByHierarchy(payload.categories));
      } else {
        const createdCategory = payload.category;
        setCategories(current => sortCategoriesByHierarchy([
          ...current.filter(category => category.id !== createdCategory.id),
          createdCategory,
        ]));
      }
      setParentPickerOpen(false);
      setCreateDialogOpen(false);
      setEditingCategory(null);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : (editingCategory ? 'Não foi possível atualizar a categoria.' : 'Não foi possível criar a categoria.'));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="category-workspace">
      <div className="category-search-row" ref={filterRef}>
        <label className="category-search"><CategoryIcon name="search" size={19} /><span className="sr-only">Buscar categoria</span><input name="categorySearch" type="search" autoComplete="off" placeholder="Buscar categoria…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="category-filter-control">
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
        <button className="primary-action category-create-button" type="button" onClick={openCreateDialog}><CategoryIcon name="plus" size={17} />Nova categoria</button>
      </div>

      <div className="category-type-row"><div className="category-active-filters" aria-label="Filtros aplicados">
        {selectedType === 'ALL' && level === 'all' && origin === 'all' ? <span className="category-filter-empty">Todas as categorias</span> : <>
          {selectedType !== 'ALL' && <button type="button" className="category-filter-chip" onClick={() => setSelectedType('ALL')} aria-label={`Remover filtro ${groups.find(group => group.type === selectedType)?.label}`}>{groups.find(group => group.type === selectedType)?.label}<span aria-hidden="true">×</span></button>}
          {level !== 'all' && <button type="button" className="category-filter-chip" onClick={() => setLevel('all')} aria-label={`Remover filtro ${level === 'root' ? 'Principais' : 'Subcategorias'}`}>{level === 'root' ? 'Principais' : 'Subcategorias'}<span aria-hidden="true">×</span></button>}
          {origin !== 'all' && <button type="button" className="category-filter-chip" onClick={() => setOrigin('all')} aria-label={`Remover filtro ${origin === 'default' ? 'Pelo aplicativo' : 'Por você'}`}>{origin === 'default' ? 'Pelo aplicativo' : 'Por você'}<span aria-hidden="true">×</span></button>}
        </>}
        </div><span className="category-result-count" aria-live="polite">{visible.length} {visible.length === 1 ? 'categoria' : 'categorias'}</span></div>

      {loadState === 'loading' ? <div className="category-no-results category-load-state" role="status"><span className="category-spinner" /><h3>Carregando suas categorias</h3><p>Buscando os dados da sua conta.</p></div>
        : loadState === 'error' ? <div className="category-no-results category-load-state" role="alert"><CategoryIcon name="tag" size={28} /><h3>Não foi possível carregar as categorias</h3><p>{loadError}</p><button type="button" onClick={() => setReloadVersion(version => version + 1)}>Tentar novamente</button></div>
          : categories.length === 0 ? <div className="category-no-results"><CategoryIcon name="tag" size={28} /><h3>Nenhuma categoria cadastrada</h3><p>Não há categorias disponíveis para esta conta.</p></div>
            : visible.length ? <div className={`category-groups${selectedType !== 'ALL' ? ' single' : ''}`}>{shownGroups.filter(group => visible.some(item => item.type === group.type)).map(group => <CategoryGroup key={group.type} {...group} items={visible.filter(item => item.type === group.type)} categories={categories} onEdit={openEditDialog} onDelete={openDeleteDialog} />)}</div>
              : <div className="category-no-results"><CategoryIcon name="search" size={28} /><h3>Nenhuma categoria encontrada</h3><p>Ajuste a busca ou os filtros para ver outros resultados.</p></div>}

      {createDialogOpen && <div className="category-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setCreateDialogOpen(false); }}>
        <section className="category-create-dialog" ref={createDialogRef} role="dialog" aria-modal="true" aria-labelledby="category-dialog-title" aria-describedby="category-dialog-description">
          <header className="category-dialog-header"><div><span className="eyebrow">{editingCategory ? 'EDITAR PERSONALIZAÇÃO' : 'NOVA PERSONALIZAÇÃO'}</span><h2 id="category-dialog-title">{editingCategory ? 'Editar categoria' : 'Criar categoria'}</h2><p id="category-dialog-description">{editingCategory ? 'Atualize os dados da sua categoria.' : 'Organize seus lançamentos com uma categoria própria.'}</p></div><button type="button" onClick={() => { setCreateDialogOpen(false); setEditingCategory(null); }} aria-label="Fechar formulário"><CategoryIcon name="close" size={18} /></button></header>
          <form className="category-create-form" onSubmit={submitCreateCategory} noValidate>
            <div className="category-form-field"><label htmlFor="new-category-label">Nome da categoria</label><input ref={createLabelRef} id="new-category-label" name="label" value={createLabel} onChange={event => { setCreateLabel(event.target.value); setCreateError(''); }} placeholder="Ex.: Viagem" maxLength={80} required /></div>
            <fieldset className="category-form-field category-kind-field"><legend>Tipo</legend><div className="category-kind-options">{groups.map(group => <label key={group.type} className={createType === group.type ? 'selected' : ''}><input type="radio" name="type" value={group.type} checked={createType === group.type} disabled={editingCategory !== null && editingCategory.parentId !== null} onChange={() => { setCreateType(group.type); setCreateParentId(''); }} /><span>{group.label}</span></label>)}</div>{editingCategory !== null && editingCategory.parentId !== null && <small>O tipo de uma subcategoria segue o da categoria principal.</small>}</fieldset>
            <div className="category-form-field category-parent-field" ref={parentPickerRef}>
              <label id="new-category-parent-label">Categoria principal <span>(opcional)</span></label>
              <button
                aria-controls="new-category-parent-options"
                aria-expanded={parentPickerOpen}
                aria-labelledby="new-category-parent-label new-category-parent-value"
                className={'category-parent-trigger' + (parentPickerOpen ? ' open' : '')}
                disabled={editingCategoryHasChildren}
                id="new-category-parent"
                onClick={() => setParentPickerOpen(open => !open)}
                type="button"
              >
                <span id="new-category-parent-value">{availableParents.find(parent => String(parent.id) === createParentId)?.label ?? 'Criar como categoria principal'}</span>
                <span className="category-parent-chevron" aria-hidden="true">⌄</span>
              </button>
              {editingCategoryHasChildren && <small>Uma categoria com subcategorias não pode ser movida para dentro de outra.</small>}
              {parentPickerOpen && <div className="category-parent-options" id="new-category-parent-options" role="group" aria-labelledby="new-category-parent-label">
                <button className={!createParentId ? 'selected' : ''} type="button" aria-pressed={!createParentId} onClick={() => { setCreateParentId(''); setParentPickerOpen(false); }}>Criar como categoria principal<span aria-hidden="true">{!createParentId ? '✓' : ''}</span></button>
                {availableParents.map(parent => <button className={createParentId === String(parent.id) ? 'selected' : ''} key={parent.id} type="button" aria-pressed={createParentId === String(parent.id)} onClick={() => { setCreateParentId(String(parent.id)); setParentPickerOpen(false); }}>{parent.label}<span aria-hidden="true">{createParentId === String(parent.id) ? '✓' : ''}</span></button>)}
              </div>}
              <small>Escolha uma categoria principal para criar uma subcategoria.</small>
            </div>
            {createError && <p className="category-create-error" role="alert">{createError}</p>}
            <footer className="category-dialog-actions"><button className="category-save-button" type="submit" disabled={isCreating}>{isCreating ? 'Salvando…' : editingCategory ? 'Salvar alterações' : 'Criar categoria'}</button></footer>
          </form>
        </section>
      </div>}
      {deletingCategory && <div className="category-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && deleteState !== 'deleting') setDeletingCategory(null); }}>
        <section className="category-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="category-delete-title" aria-describedby="category-delete-description">
          <span className="category-delete-icon"><CategoryIcon name="delete" size={23} /></span>
          <h2 id="category-delete-title">Excluir categoria?</h2>
          <p id="category-delete-description">Deseja realmente excluir <strong>{deletingCategory.label}</strong>? Esta ação não pode ser desfeita.</p>
          {deleteState === 'loading' && <p role="status">Verificando vínculos da categoria…</p>}
          {(deleteState === 'blocked' || deleteState === 'error') && <p className="category-delete-warning" role="alert">{deleteMessage}</p>}
          <div className="category-dialog-actions">
            <button type="button" onClick={() => setDeletingCategory(null)} disabled={deleteState === 'deleting'}>Cancelar</button>
            {deleteState === 'ready' && <button className="category-delete-confirm" type="button" onClick={() => void confirmDeleteCategory()}>Excluir categoria</button>}
            {deleteState === 'deleting' && <button className="category-delete-confirm" type="button" disabled>Excluindo…</button>}
          </div>
        </section>
      </div>}
    </div>
  );
}
