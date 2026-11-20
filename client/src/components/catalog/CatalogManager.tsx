import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { CATALOG_CATEGORIES, type CatalogCategory, type CatalogItemDto, type CatalogItemInput } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../ConfirmDialog';
import { Alert, PageSpinner } from '../ui';
import { CATEGORY_ICON, CatalogCard } from './CatalogCard';
import { CatalogItemDialog } from './CatalogItemDialog';

/**
 * Verwaltung der Gegenstands-Datenbank: Unterreiter Rüstung / Waffen / Gegenstände in Kartenansicht.
 * Ohne storyId die Standard-Datenbank; mit storyId die Liste der Geschichte (erbt den Standard, Einträge lassen sich
 * anpassen, ausblenden, zurücksetzen und eigene hinzufügen).
 */
export function CatalogManager({ storyId, readOnly = false }: { storyId?: string; readOnly?: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState<CatalogItemDto[] | null>(null);
  const [category, setCategory] = useState<CatalogCategory>('weapon');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<CatalogItemDto | 'new' | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'revert'; item: CatalogItemDto } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    (storyId ? api.storyCatalog(storyId) : api.catalog())
      .then((r) => setItems(r.items))
      .catch(setError);
  }, [storyId]);
  useEffect(load, [load]);

  const needle = q.trim().toLocaleLowerCase('de');
  const counts = useMemo(() => Object.fromEntries(CATALOG_CATEGORIES.map((c) => [c, (items ?? []).filter((i) => i.category === c && !i.hidden).length])), [items]);
  const shown = useMemo(
    () => (items ?? []).filter((i) => i.category === category && (!needle || `${i.name}\n${i.description}`.toLocaleLowerCase('de').includes(needle))),
    [items, category, needle],
  );

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      load();
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  const save = async (input: CatalogItemInput) => {
    const target = editing === 'new' ? null : editing;
    if (!target) await (storyId ? api.createStoryCatalogItem(storyId, input) : api.createStandardItem(input));
    else if (storyId && target.origin === 'standard') await api.overrideCatalogItem(storyId, target.id, input);
    else await api.updateCatalogItem(target.id, input);
    setEditing(null);
    toast.success(t('catalog.saved'));
    load();
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'delete') await api.deleteCatalogItem(confirm.item.id);
      else if (storyId) await api.revertCatalogItem(storyId, confirm.item.baseId ?? confirm.item.id);
      toast.success(confirm.kind === 'delete' ? t('catalog.deleted') : t('catalog.reverted'));
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!items) return <PageSpinner />;

  const badge = (i: CatalogItemDto) => {
    if (!storyId) return null;
    const cls = {
      standard: 'bg-parchment-200 text-parchment-900 dark:bg-night-700 dark:text-parchment-200',
      override: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
      story: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
    }[i.origin];
    return <span className={`badge mt-0.5 ${cls}`}>{i.hidden ? t('catalog.origin.hidden') : t(`catalog.origin.${i.origin}`)}</span>;
  };

  const actions = (i: CatalogItemDto) => {
    if (readOnly) return null;
    const btn = 'btn-icon';
    if (storyId && i.hidden) {
      return (
        <button type="button" className={btn} onClick={() => act(() => api.revertCatalogItem(storyId, i.id), t('catalog.shown'))} title={t('catalog.show')} aria-label={`${t('catalog.show')}: ${i.name}`}>
          <Eye className="h-4 w-4" />
        </button>
      );
    }
    return (
      <>
        <button type="button" className={btn} onClick={() => setEditing(i)} title={t('common.edit')} aria-label={`${t('common.edit')}: ${i.name}`}>
          <Pencil className="h-4 w-4" />
        </button>
        {storyId && i.origin === 'standard' && (
          <button type="button" className={btn} onClick={() => act(() => api.hideCatalogItem(storyId, i.id), t('catalog.hiddenDone'))} title={t('catalog.hide')} aria-label={`${t('catalog.hide')}: ${i.name}`}>
            <EyeOff className="h-4 w-4" />
          </button>
        )}
        {storyId && i.origin === 'override' && (
          <button type="button" className={btn} onClick={() => setConfirm({ kind: 'revert', item: i })} title={t('catalog.revert')} aria-label={`${t('catalog.revert')}: ${i.name}`}>
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        {(!storyId || i.origin === 'story') && (
          <button type="button" className={`${btn} text-red-700 dark:text-red-400`} onClick={() => setConfirm({ kind: 'delete', item: i })} title={t('common.delete')} aria-label={`${t('common.delete')}: ${i.name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </>
    );
  };

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto border-b border-parchment-400/60 dark:border-night-700" aria-label={t('catalog.title')}>
        {CATALOG_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICON[c];
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 font-display text-sm font-semibold ${
                category === c ? 'border-parchment-800 text-ink dark:border-parchment-300 dark:text-parchment-50' : 'border-transparent text-parchment-700 hover:text-ink dark:text-parchment-400 dark:hover:text-parchment-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(`catalog.categories.${c}`)} ({counts[c]})
            </button>
          );
        })}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-600" />
          <input type="search" className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('catalog.search')} aria-label={t('common.search')} />
        </div>
        {!readOnly && (
          <button type="button" className="btn-primary shrink-0" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            {t(`catalog.new.${category}`)}
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <div className="parchment px-6 py-10 text-center italic">{needle ? t('search.noResults') : t('catalog.empty')}</div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((i) => (
            <li key={i.id}>
              <CatalogCard item={i} badge={badge(i)} actions={actions(i)} dimmed={i.hidden} />
            </li>
          ))}
        </ul>
      )}
      <CatalogItemDialog open={editing !== null} category={editing && editing !== 'new' ? editing.category : category} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={save} />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === 'delete' ? t('catalog.deleteTitle') : t('catalog.revertTitle')}
        message={confirm?.kind === 'delete' ? (storyId ? t('catalog.deleteStoryText', { name: confirm.item.name }) : t('catalog.deleteText', { name: confirm?.item.name ?? '' })) : t('catalog.revertText', { name: confirm?.item.name ?? '' })}
        busy={busy}
        danger={confirm?.kind === 'delete'}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
