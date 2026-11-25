import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, NotebookPen, Pencil, Pin, PinOff, Plus, Save, Search, Trash2 } from 'lucide-react';
import { NOTE_CATEGORIES, type CharacterNoteDto, type CharacterNoteInput, type NoteCategory } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { Alert, PageSpinner, Spinner } from '../ui';
import { Modal } from '../Modal';
import { Markdown } from '../Markdown';
import { MarkdownEditor } from '../MarkdownEditor';
import { ConfirmDialog } from '../ConfirmDialog';

const CATEGORY_COLOR: Record<NoteCategory, string> = {
  general: 'bg-parchment-200 text-parchment-900 dark:bg-night-700 dark:text-parchment-200',
  quest: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  npc: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  place: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  lore: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  loot: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200',
  todo: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
};
const empty = (): Required<CharacterNoteInput> => ({ title: '', body: '', category: 'general', pinned: false, sharedWithDm: false });

/**
 * Persönliche Notizen zum Charakter (ähnlich der Infotafel): Titel, Kategorie, formatierter Text, anpinnen.
 * Besitzer und Mitbearbeiter sehen und bearbeiten alle; mit „für den DM sichtbar“ liest auch der DM der Geschichte mit.
 */
export function NotesTab({ characterId }: { characterId: string }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [notes, setNotes] = useState<CharacterNoteDto[] | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<NoteCategory | ''>('');
  const [editing, setEditing] = useState<CharacterNoteDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<CharacterNoteDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .characterNotes(characterId)
      .then((r) => {
        setNotes(r.notes);
        setCanWrite(r.canWrite);
      })
      .catch(setError);
  }, [characterId]);
  useEffect(load, [load]);

  const sort = (list: CharacterNoteDto[]) => [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const needle = q.trim().toLocaleLowerCase('de');
  const shown = useMemo(
    () => (notes ?? []).filter((n) => (!category || n.category === category) && (!needle || `${n.title}\n${n.body}`.toLocaleLowerCase('de').includes(needle))),
    [notes, category, needle],
  );

  const save = async (id: string | null, input: Required<CharacterNoteInput>) => {
    const r = id ? await api.updateCharacterNote(characterId, id, input) : await api.createCharacterNote(characterId, input);
    setNotes((l) => sort([...(l ?? []).filter((n) => n.id !== r.note.id), r.note]));
    toast.success(t('notes.saved'));
  };
  const togglePin = async (n: CharacterNoteDto) => {
    try {
      await save(n.id, { title: n.title, body: n.body, category: n.category, pinned: !n.pinned, sharedWithDm: n.sharedWithDm });
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };
  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.deleteCharacterNote(characterId, toDelete.id);
      setNotes((l) => l?.filter((n) => n.id !== toDelete.id) ?? null);
      setToDelete(null);
      toast.success(t('notes.deleted'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!notes) return <PageSpinner />;
  const date = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <NotebookPen className="h-5 w-5" />
            {t('notes.title')}
          </h2>
          <p className="text-sm text-parchment-700 dark:text-parchment-400">{canWrite ? t('notes.hint') : t('notes.hintDm')}</p>
        </div>
        {canWrite && (
          <button type="button" className="btn-primary shrink-0" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            {t('notes.new')}
          </button>
        )}
      </div>

      {notes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-700 dark:text-parchment-400" />
            <input type="search" className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('notes.search')} aria-label={t('notes.search')} />
          </div>
          <select className="input !w-auto" value={category} onChange={(e) => setCategory(e.target.value as NoteCategory | '')} aria-label={t('notes.category')}>
            <option value="">
              {t('notes.category')}: {t('common.any')}
            </option>
            {NOTE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`notes.categories.${c}`)}
              </option>
            ))}
          </select>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="parchment px-6 py-12 text-center italic">{notes.length === 0 ? (canWrite ? t('notes.empty') : t('notes.emptyDm')) : t('notes.noHits')}</div>
      ) : (
        <ul className="space-y-3">
          {shown.map((n) => (
            <li key={n.id}>
              <article className={`parchment space-y-2 p-4 ${n.pinned ? 'ring-2 ring-amber-400/70 dark:ring-amber-700/70' : ''}`}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="flex flex-wrap items-center gap-2 break-words font-display text-lg font-bold">
                      {n.pinned && <Pin className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-label={t('notes.pinned')} />}
                      {n.title || t('notes.untitled')}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-parchment-700 dark:text-parchment-400">
                      <span className={`badge ${CATEGORY_COLOR[n.category]}`}>{t(`notes.categories.${n.category}`)}</span>
                      {n.sharedWithDm ? (
                        <span className="badge bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200">
                          <Eye className="mr-1 h-3 w-3" />
                          {t('notes.shared')}
                        </span>
                      ) : (
                        canWrite && (
                          <span className="badge bg-parchment-200 text-parchment-900 dark:bg-night-700 dark:text-parchment-200">
                            <EyeOff className="mr-1 h-3 w-3" />
                            {t('notes.private')}
                          </span>
                        )
                      )}
                      <span>{t('notes.updated', { date: date(n.updatedAt), author: n.authorName || '—' })}</span>
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => togglePin(n)}
                        title={n.pinned ? t('notes.unpin') : t('notes.pin')}
                        aria-label={`${n.pinned ? t('notes.unpin') : t('notes.pin')}: ${n.title}`}
                      >
                        {n.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </button>
                      <button type="button" className="btn-icon" onClick={() => setEditing(n)} title={t('common.edit')} aria-label={`${t('common.edit')}: ${n.title}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="btn-icon text-red-700 dark:text-red-400"
                        onClick={() => setToDelete(n)}
                        title={t('common.delete')}
                        aria-label={`${t('common.delete')}: ${n.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                {n.body.trim() && (
                  <Markdown links className="break-words">
                    {n.body}
                  </Markdown>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <NoteForm note={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={async (input) => (await save(editing === 'new' ? null : editing.id, input), setEditing(null))} />
      )}
      <ConfirmDialog
        open={!!toDelete}
        title={t('notes.deleteTitle')}
        message={t('notes.deleteText', { title: toDelete?.title || t('notes.untitled') })}
        busy={busy}
        danger
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function NoteForm({ note, onClose, onSave }: { note: CharacterNoteDto | null; onClose: () => void; onSave: (input: Required<CharacterNoteInput>) => Promise<void> }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState<Required<CharacterNoteInput>>(() =>
    note ? { title: note.title, body: note.body, category: note.category, pinned: note.pinned, sharedWithDm: note.sharedWithDm } : empty(),
  );
  const [busy, setBusy] = useState(false);
  const valid = form.title.trim() || form.body.trim();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await onSave({ ...form, title: form.title.trim() });
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open title={note ? t('notes.edit') : t('notes.new')} onClose={onClose} size="max-w-3xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_14rem]">
          <div>
            <label htmlFor="note-title" className="label">
              {t('notes.titleField')}
            </label>
            <input id="note-title" className="input" value={form.title} maxLength={150} autoFocus onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="note-cat" className="label">
              {t('notes.category')}
            </label>
            <select id="note-cat" className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as NoteCategory }))}>
              {NOTE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`notes.categories.${c}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="note-body" className="label">
            {t('notes.body')}
          </label>
          <MarkdownEditor id="note-body" value={form.body} onChange={(v) => setForm((f) => ({ ...f, body: v.slice(0, 20000) }))} rows={10} />
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="chip-check">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))} />
            {t('notes.pin')}
          </label>
          <label className="chip-check">
            <input type="checkbox" checked={form.sharedWithDm} onChange={(e) => setForm((f) => ({ ...f, sharedWithDm: e.target.checked }))} />
            {t('notes.shareWithDm')}
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !valid}>
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
