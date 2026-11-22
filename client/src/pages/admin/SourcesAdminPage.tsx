import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BookMarked, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import type { SourceDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { reloadSources, useSources } from '../../hooks/useSources';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageSpinner, Spinner } from '../../components/ui';

/** Verwaltung → Quellen (Admin und Moderator): Bücher, die app-weit als Quelle auswählbar sind */
export function SourcesAdminPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { sources, loaded } = useSources();
  const [editing, setEditing] = useState<SourceDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<SourceDto | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void reloadSources(); // aktuelle Verwendungszahlen
  }, []);

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.deleteSource(toDelete.id);
      await reloadSources();
      setToDelete(null);
      toast.success(t('sources.deleted'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <PageSpinner />;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">{t('sources.title')}</h2>
          <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('sources.hint')}</p>
        </div>
        <button type="button" className="btn-primary shrink-0" onClick={() => setEditing('new')} disabled={editing === 'new'}>
          <Plus className="h-4 w-4" />
          {t('sources.new')}
        </button>
      </div>
      <ul className="space-y-2">
        {editing === 'new' && (
          <li className="parchment p-3">
            <SourceForm onCancel={() => setEditing(null)} onSaved={() => setEditing(null)} />
          </li>
        )}
        {sources.length === 0 && editing !== 'new' && <li className="parchment px-6 py-10 text-center italic">{t('sources.empty')}</li>}
        {sources.map((s) =>
          editing !== 'new' && editing?.id === s.id ? (
            <li key={s.id} className="parchment p-3">
              <SourceForm source={s} onCancel={() => setEditing(null)} onSaved={() => setEditing(null)} />
            </li>
          ) : (
            <li key={s.id} className="parchment flex flex-wrap items-center gap-3 px-4 py-3">
              <BookMarked className="h-5 w-5 shrink-0 text-parchment-700 dark:text-parchment-300" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold leading-tight">
                  {s.name}
                  {s.abbreviation && <span className="badge ml-2 bg-parchment-200 align-middle text-parchment-900 dark:bg-night-700 dark:text-parchment-200">{s.abbreviation}</span>}
                </p>
                <p className="text-xs text-parchment-700 dark:text-parchment-400">{t('sources.usage', { wiki: s.usage.wiki, catalog: s.usage.catalog, spells: s.usage.spells, monsters: s.usage.monsters, magicItems: s.usage.magicItems })}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" className="btn-icon" onClick={() => setEditing(s)} title={t('common.edit')} aria-label={`${t('common.edit')}: ${s.name}`}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" className="btn-icon text-red-700 dark:text-red-400" onClick={() => setToDelete(s)} title={t('common.delete')} aria-label={`${t('common.delete')}: ${s.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      <ConfirmDialog open={!!toDelete} title={t('sources.deleteTitle')} message={t('sources.deleteText', { name: toDelete?.name ?? '' })} busy={busy} danger onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  );
}

function SourceForm({ source, onCancel, onSaved }: { source?: SourceDto; onCancel: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState(source?.name ?? '');
  const [abbreviation, setAbbreviation] = useState(source?.abbreviation ?? '');
  const [busy, setBusy] = useState(false);
  const id = source?.id ?? 'new';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const input = { name: name.trim(), abbreviation: abbreviation.trim() };
      if (source) await api.updateSource(source.id, input);
      else await api.createSource(input);
      await reloadSources();
      toast.success(t('sources.saved'));
      onSaved();
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[14rem] flex-1">
        <label htmlFor={`src-name-${id}`} className="label">
          {t('sources.name')}
        </label>
        <input id={`src-name-${id}`} className="input" value={name} maxLength={100} required autoFocus onChange={(e) => setName(e.target.value)} placeholder={t('sources.namePlaceholder')} />
      </div>
      <div className="w-32">
        <label htmlFor={`src-abbr-${id}`} className="label">
          {t('sources.abbreviation')}
        </label>
        <input id={`src-abbr-${id}`} className="input" value={abbreviation} maxLength={12} onChange={(e) => setAbbreviation(e.target.value)} placeholder="SHB" />
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          <X className="h-4 w-4" />
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
          {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {t('common.save')}
        </button>
      </div>
      {source && source.usage.spells + source.usage.monsters > 0 && <p className="w-full text-xs text-parchment-700 dark:text-parchment-400">{t('sources.renameHint')}</p>}
    </form>
  );
}
