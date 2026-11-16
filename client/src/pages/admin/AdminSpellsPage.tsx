import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Copy, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { SpellDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { parseFilters } from '../../lib/filters';
import { errorMessage } from '../../lib/errors';
import { asLocale, resolveText } from '../../lib/spellText';
import { SCHOOL_COLORS } from '../../lib/schools';
import { useDebounce } from '../../hooks/useDebounce';
import { useSpellSearch } from '../../hooks/useSpellSearch';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Alert, PageSpinner, Spinner } from '../../components/ui';

export function AdminSpellsPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const lang = asLocale(i18n.language);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const filters = useMemo(() => ({ ...parseFilters(new URLSearchParams()), q: debounced }), [debounced]);
  const search = useSpellSearch(filters, { lang });
  const sentinelRef = useInfiniteScroll(search.loadMore, search.hasMore && !search.loading && !search.error, search.items.length);
  const [toDelete, setToDelete] = useState<SpellDto | null>(null);
  const [busy, setBusy] = useState(false);

  const duplicate = async (spell: SpellDto) => {
    try {
      const { spell: copy } = await api.duplicateSpell(spell.id);
      toast.success(t('admin.spellDuplicated'));
      navigate(`/admin/spells/${copy.slug}/edit`);
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.deleteSpell(toDelete.id);
      search.removeItem(toDelete.id);
      toast.success(t('admin.spellDeleted'));
      setToDelete(null);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-600" />
          <input type="search" className="input !pl-9" placeholder={t('admin.filterSpells')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('admin.filterSpells')} />
        </div>
        <span className="text-sm text-parchment-700 dark:text-parchment-400">{t('admin.count', { count: search.total })}</span>
        <Link to="/admin/spells/new" className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('admin.newSpell')}
        </Link>
      </div>

      {search.error && search.items.length === 0 ? (
        <Alert>{errorMessage(t, search.error)}</Alert>
      ) : search.loading && search.items.length === 0 ? (
        <PageSpinner />
      ) : (
        <div className="parchment overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>{t('admin.name')}</th>
                <th>{t('filter.level')}</th>
                <th className="hidden sm:table-cell">{t('filter.school')}</th>
                <th className="hidden md:table-cell">{t('spell.source')}</th>
                <th className="text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {search.items.map((spell) => {
                const { t: text, isFallback, locale } = resolveText(spell, lang);
                return (
                  <tr key={spell.id}>
                    <td>
                      <Link to={`/spells/${spell.slug}`} className="font-semibold hover:underline">
                        {text.name}
                      </Link>
                      {isFallback && <span className="ml-2 text-xs text-parchment-600">({locale.toUpperCase()})</span>}
                      <div className="font-mono text-xs text-parchment-600">{spell.slug}</div>
                    </td>
                    <td>{spell.level === 0 ? t('spell.cantrip') : spell.level}</td>
                    <td className="hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SCHOOL_COLORS[spell.school] }} />
                        {t(`school.${spell.school}`)}
                      </span>
                    </td>
                    <td className="hidden md:table-cell">
                      {spell.source}
                      {spell.isHomebrew && <span className="badge ml-2 bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200">{t('spell.homebrew')}</span>}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link to={`/admin/spells/${spell.slug}/edit`} className="btn-icon" title={t('common.edit')} aria-label={t('common.edit')}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button type="button" className="btn-icon" onClick={() => duplicate(spell)} title={t('common.duplicate')} aria-label={t('common.duplicate')}>
                          <Copy className="h-4 w-4" />
                        </button>
                        <button type="button" className="btn-icon text-red-700 dark:text-red-400" onClick={() => setToDelete(spell)} title={t('common.delete')} aria-label={t('common.delete')}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div ref={sentinelRef} className="flex h-12 items-center justify-center">
            {search.loading && <Spinner />}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t('common.delete')}
        message={toDelete ? t('admin.deleteSpellConfirm', { name: resolveText(toDelete, lang).t.name }) : ''}
        confirmLabel={t('common.delete')}
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
