import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ChevronDown, ChevronsDownUp, ChevronsUpDown, EyeOff, Pencil, Plus, Save, Search, Trash2 } from 'lucide-react';
import { MAX_DM_NOTE_BODY, type DmNoteDto, type DmNoteInput } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../ConfirmDialog';
import { Markdown } from '../Markdown';
import { MarkdownEditor } from '../MarkdownEditor';
import { Alert, PageSpinner, Spinner } from '../ui';

const COLLAPSED_KEY = (storyId: string) => `zauberbuch.dmnotes.collapsed.${storyId}`;

function loadCollapsed(storyId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY(storyId)) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function saveCollapsed(storyId: string, ids: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY(storyId), JSON.stringify([...ids]));
  } catch {
    /* ohne Speicher geht es auch */
  }
}

/**
 * Infotafel → Reiter „DM-Notizen“: Abschnitte (z. B. „Dorf A“) mit formatiertem Text, die nur die Dungeon Master der
 * Geschichte sehen. Abschnitte lassen sich auf-/zuklappen, verschieben, bearbeiten und löschen.
 */
export function DmNotesPanel({ storyId, readOnly }: { storyId: string; readOnly: boolean }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [notes, setNotes] = useState<DmNoteDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<DmNoteDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed(storyId));

  const load = useCallback(() => {
    api
      .dmNotes(storyId)
      .then((r) => setNotes(r.notes))
      .catch(setError);
  }, [storyId]);
  useEffect(load, [load]);

  const setCollapsedAndSave = (next: Set<string>) => {
    setCollapsed(next);
    saveCollapsed(storyId, next);
  };
  const toggle = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsedAndSave(next);
  };

  const needle = q.trim().toLocaleLowerCase('de');
  const shown = useMemo(() => (notes ?? []).filter((n) => !needle || `${n.title}\n${n.body}`.toLocaleLowerCase('de').includes(needle)), [notes, needle]);
  const allCollapsed = shown.length > 0 && shown.every((n) => collapsed.has(n.id));

  const move = async (index: number, dir: -1 | 1) => {
    if (!notes) return;
    const next = [...notes];
    const [n] = next.splice(index, 1);
    next.splice(index + dir, 0, n);
    setNotes(next); // sofort anzeigen
    try {
      setNotes((await api.orderDmNotes(storyId, next.map((x) => x.id))).notes);
    } catch (err) {
      toast.error(errorMessage(t, err));
      load();
    }
  };

  const save = async (id: string | 'new', input: DmNoteInput) => {
    if (id === 'new') {
      const r = await api.createDmNote(storyId, input);
      setNotes((l) => [...(l ?? []), r.note]);
    } else {
      const r = await api.updateDmNote(id, input);
      setNotes((l) => l?.map((n) => (n.id === id ? r.note : n)) ?? null);
    }
    setEditing(null);
    toast.success(t('dmNotes.saved'));
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.deleteDmNote(toDelete.id);
      setNotes((l) => l?.filter((n) => n.id !== toDelete.id) ?? null);
      setToDelete(null);
      toast.success(t('dmNotes.deleted'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!notes) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-parchment-700 dark:text-parchment-400">
        <EyeOff className="h-4 w-4 shrink-0" />
        {t('dmNotes.hint')}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-700 dark:text-parchment-400" />
          <input type="search" className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('dmNotes.search')} aria-label={t('common.search')} />
        </div>
        {shown.length > 0 && (
          <button type="button" className="btn-ghost" onClick={() => setCollapsedAndSave(allCollapsed ? new Set() : new Set([...collapsed, ...shown.map((n) => n.id)]))}>
            {allCollapsed ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
            {allCollapsed ? t('dmNotes.expandAll') : t('dmNotes.collapseAll')}
          </button>
        )}
        {!readOnly && (
          <button type="button" className="btn-primary" onClick={() => setEditing('new')} disabled={editing === 'new'}>
            <Plus className="h-4 w-4" />
            {t('dmNotes.new')}
          </button>
        )}
      </div>

      {editing === 'new' && (
        <section className="parchment p-4">
          <NoteForm onCancel={() => setEditing(null)} onSave={(input) => save('new', input)} />
        </section>
      )}

      {notes.length === 0 && editing !== 'new' ? (
        <div className="parchment px-6 py-10 text-center italic">{t('dmNotes.empty')}</div>
      ) : shown.length === 0 && needle ? (
        <div className="parchment px-6 py-10 text-center italic">{t('search.noResults')}</div>
      ) : (
        <ol className="space-y-3">
          {shown.map((n) => {
            const index = notes.findIndex((x) => x.id === n.id);
            const open = !collapsed.has(n.id);
            return (
              <li key={n.id} className="parchment overflow-hidden">
                {editing === n.id ? (
                  <div className="p-4">
                    <NoteForm note={n} onCancel={() => setEditing(null)} onSave={(input) => save(n.id, input)} />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1 px-3 py-2">
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left" onClick={() => toggle(n.id)} aria-expanded={open}>
                        <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden />
                        <span className="min-w-0 break-words font-display text-lg font-bold">{n.title}</span>
                      </button>
                      {!readOnly && (
                        <div className="flex shrink-0 items-center">
                          <button type="button" className="btn-icon h-8 w-8" onClick={() => move(index, -1)} disabled={index === 0 || !!needle} title={t('dmNotes.up')} aria-label={`${t('dmNotes.up')}: ${n.title}`}>
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button type="button" className="btn-icon h-8 w-8" onClick={() => move(index, 1)} disabled={index === notes.length - 1 || !!needle} title={t('dmNotes.down')} aria-label={`${t('dmNotes.down')}: ${n.title}`}>
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button type="button" className="btn-icon h-8 w-8" onClick={() => setEditing(n.id)} title={t('common.edit')} aria-label={`${t('common.edit')}: ${n.title}`}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" className="btn-icon h-8 w-8 text-red-700 dark:text-red-400" onClick={() => setToDelete(n)} title={t('common.delete')} aria-label={`${t('common.delete')}: ${n.title}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {open && (
                      <div className="border-t border-parchment-300/70 px-5 pb-4 pt-3 dark:border-night-700">
                        {n.body.trim() ? <Markdown className="break-words">{n.body}</Markdown> : <p className="italic text-parchment-700 dark:text-parchment-400">{t('dmNotes.noText')}</p>}
                        <p className="mt-3 text-xs text-parchment-700 dark:text-parchment-400">
                          {t('dmNotes.updated', { date: new Date(n.updatedAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }), user: n.updatedBy ?? '—' })}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <ConfirmDialog open={!!toDelete} title={t('dmNotes.deleteTitle')} message={t('dmNotes.deleteText', { name: toDelete?.title ?? '' })} busy={busy} danger onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  );
}

function NoteForm({ note, onSave, onCancel }: { note?: DmNoteDto; onSave: (input: DmNoteInput) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [busy, setBusy] = useState(false);
  const id = note?.id ?? 'new';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSave({ title: title.trim(), body });
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor={`dmn-title-${id}`} className="label">
          {t('dmNotes.title')}
        </label>
        <input id={`dmn-title-${id}`} className="input" value={title} maxLength={120} required autoFocus onChange={(e) => setTitle(e.target.value)} placeholder={t('dmNotes.titlePlaceholder')} />
      </div>
      <div>
        <label htmlFor={`dmn-body-${id}`} className="label">
          {t('dmNotes.body')}
        </label>
        <MarkdownEditor id={`dmn-body-${id}`} value={body} onChange={(v) => setBody(v.slice(0, MAX_DM_NOTE_BODY))} rows={10} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn-primary" disabled={busy || !title.trim()}>
          {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {t('common.save')}
        </button>
      </div>
    </form>
  );
}
