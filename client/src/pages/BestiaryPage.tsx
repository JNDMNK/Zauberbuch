import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BookMarked, Eye, Pencil, Plus, Search, Shield, Swords, Trash2 } from 'lucide-react';
import type { BestiaryUserRef, StoryDto } from '@zauberbuch/shared';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCombatPlayerMode } from '../hooks/useCombatPlayerMode';
import { Alert, PageSpinner, Spinner } from '../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { CombatTabs } from '../components/combat/CombatTabs';
import { PlayerModeToggle } from '../components/combat/PlayerModeToggle';

/** Gemeinsame Form beider Datenbanken */
interface Entry {
  id: string;
  name: string;
  ac: number | null;
  hp: number | null;
  attack: string;
  description: string;
  createdBy: BestiaryUserRef | null;
  updatedBy: BestiaryUserRef | null;
  createdAt: string;
  updatedAt: string;
}
interface EntryInput {
  name: string;
  ac: number | null;
  hp: number | null;
  attack: string;
  description: string;
}

/** 'dm' = DM-Datenbank, sonst Geschichte (Spieler-Datenbank) */
type Source = { kind: 'dm' } | { kind: 'story'; storyId: string };

/**
 * Monster-Datenbank im Bereich Kampf.
 * DM/Admin: eigene DM-Datenbank (Vorlagen für Kämpfe) und – nur lesend – die Spieler-Datenbanken der Geschichten.
 * Spieler: Datenbank ihrer Geschichte(n), die alle Mitspieler gemeinsam befüllen.
 */
export function BestiaryPage() {
  const { t } = useTranslation();
  const { user, isEditor: editorRole } = useAuth();
  const [asPlayer] = useCombatPlayerMode();
  const isEditor = editorRole && !asPlayer;
  const [stories, setStories] = useState<StoryDto[] | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setStories(null);
    api
      .stories()
      .then((r) => {
        // Spielersicht: nur Geschichten, in denen man Mitspieler ist
        const list = isEditor ? r.stories : r.stories.filter((s) => s.members.some((m) => m.id === user?.id));
        setStories(list);
        setSource(isEditor ? { kind: 'dm' } : list[0] ? { kind: 'story', storyId: list[0].id } : null);
      })
      .catch(setError);
  }, [isEditor, user?.id]);

  const sourceValue = source ? (source.kind === 'dm' ? 'dm' : source.storyId) : '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-3xl font-bold">{t('combat.heading')}</h1>
        <PlayerModeToggle />
      </div>
      <CombatTabs />
      {error ? (
        <Alert>{errorMessage(t, error)}</Alert>
      ) : !stories ? (
        <PageSpinner />
      ) : !source ? (
        <Alert kind="info">{t('bestiary.noStory')}</Alert>
      ) : (
        <>
          {(isEditor || stories.length > 1) && (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="bestiary-source" className="text-sm font-semibold">
                {t('bestiary.database')}
              </label>
              <select
                id="bestiary-source"
                className="input !w-auto"
                value={sourceValue}
                onChange={(e) => setSource(e.target.value === 'dm' ? { kind: 'dm' } : { kind: 'story', storyId: e.target.value })}
              >
                {isEditor && <option value="dm">{t('bestiary.dmDatabase')}</option>}
                {stories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {isEditor ? t('bestiary.playerDatabaseOf', { name: s.name }) : s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <EntryList key={sourceValue} source={source} storyName={source.kind === 'story' ? stories.find((s) => s.id === source.storyId)?.name ?? '' : ''} />
        </>
      )}
    </div>
  );
}

function EntryList({ source, storyName }: { source: Source; storyName: string }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Entry | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const isDm = source.kind === 'dm';

  const load = useCallback(async () => {
    try {
      if (source.kind === 'dm') {
        const r = await api.monsterTemplates();
        setEntries(r.templates);
        setCanWrite(true);
      } else {
        const r = await api.bestiary(source.storyId);
        setEntries(r.entries);
        setCanWrite(r.canWrite);
      }
    } catch (err) {
      setError(err);
    }
  }, [source]);

  useEffect(() => {
    void load();
  }, [load]);

  const needle = q.trim().toLocaleLowerCase('de');
  const shown = useMemo(
    () => (entries ?? []).filter((e) => !needle || `${e.name}\n${e.attack}\n${e.description}`.toLocaleLowerCase('de').includes(needle)),
    [entries, needle],
  );

  const save = async (input: EntryInput) => {
    const id = editing && editing !== 'new' ? editing.id : null;
    if (source.kind === 'dm') {
      const data = { ...input, hp: input.hp ?? 0 };
      const r = id ? await api.updateMonsterTemplate(id, data) : await api.createMonsterTemplate(data);
      setEntries((list) => upsert(list, r.template));
    } else {
      const r = id ? await api.updateBestiaryEntry(id, input) : await api.createBestiaryEntry(source.storyId, input);
      setEntries((list) => upsert(list, r.entry));
    }
    setEditing(null);
    toast.success(t('bestiary.saved'));
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      if (isDm) await api.deleteMonsterTemplate(toDelete.id);
      else await api.deleteBestiaryEntry(toDelete.id);
      setEntries((list) => list?.filter((e) => e.id !== toDelete.id) ?? null);
      setToDelete(null);
      toast.success(t('bestiary.deleted'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!entries) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <Alert kind="info">
        {isDm ? t('bestiary.dmIntro') : canWrite ? t('bestiary.playerIntro', { name: storyName }) : t('bestiary.readOnlyIntro', { name: storyName })}
      </Alert>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-700 dark:text-parchment-400" />
          <input type="search" className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('bestiary.searchPlaceholder')} aria-label={t('common.search')} />
        </div>
        {canWrite && (
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            {t('bestiary.newEntry')}
          </button>
        )}
        {!canWrite && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-200">
            <Eye className="h-4 w-4" />
            {t('bestiary.readOnly')}
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="parchment p-8 text-center text-parchment-700 dark:text-parchment-400">{entries.length === 0 ? t('bestiary.empty') : t('bestiary.noMatch')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((e) => (
            <li key={e.id} className="parchment flex flex-col gap-2 p-4">
              <div className="flex items-start gap-2">
                <h3 className="min-w-0 flex-1 break-words font-display text-lg font-bold">{e.name}</h3>
                {canWrite && (
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className="btn-icon" onClick={() => setEditing(e)} title={t('common.edit')} aria-label={`${t('common.edit')}: ${e.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="btn-icon text-red-700 dark:text-red-400" onClick={() => setToDelete(e)} title={t('common.delete')} aria-label={`${t('common.delete')}: ${e.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-4 text-sm">
                <span className="inline-flex items-center gap-1" title={t('combat.ac')}>
                  <Shield className="h-4 w-4 text-parchment-600" />
                  <span className="sheet-label !inline">{t('combat.acShort')}</span> <strong>{e.ac ?? '?'}</strong>
                </span>
                <span title={t('combat.hp')}>
                  <span className="sheet-label !inline">{t('bestiary.hpShort')}</span> <strong>{e.hp ?? '?'}</strong>
                </span>
              </div>
              {e.attack && (
                <p className="flex items-start gap-1.5 text-sm">
                  <Swords className="mt-0.5 h-4 w-4 shrink-0 text-red-800 dark:text-red-400" aria-label={t('bestiary.attack')} />
                  <span className="whitespace-pre-wrap break-words">{e.attack}</span>
                </p>
              )}
              {e.description && <Description text={e.description} />}
              <p className="mt-auto pt-1 text-xs text-parchment-700 dark:text-parchment-400">
                {t('bestiary.createdBy', { name: e.createdBy?.username ?? t('board.deletedUser') })}
                {e.updatedBy && e.updatedAt !== e.createdAt && <> · {t('bestiary.updatedBy', { name: e.updatedBy.username, date: new Date(e.updatedAt).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' }) })}</>}
              </p>
            </li>
          ))}
        </ul>
      )}

      <EntryDialog open={editing !== null} entry={editing === 'new' ? null : editing} hpRequired={isDm} onClose={() => setEditing(null)} onSave={save} />
      <ConfirmDialog open={!!toDelete} title={t('bestiary.deleteTitle')} message={t('bestiary.deleteText', { name: toDelete?.name ?? '' })} busy={busy} onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  );
}

function upsert<T extends { id: string; name: string }>(list: T[] | null, item: T): T[] {
  const rest = (list ?? []).filter((x) => x.id !== item.id);
  return [...rest, item].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
}

function Description({ text }: { text: string }) {
  const { t } = useTranslation();
  const long = text.length > 220 || text.split('\n').length > 4;
  const [open, setOpen] = useState(!long);
  return (
    <div className="text-sm">
      <p className={`whitespace-pre-wrap break-words ${open ? '' : 'line-clamp-3'}`}>{text}</p>
      {long && (
        <button type="button" className="mt-0.5 text-xs font-semibold underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? t('board.showLess') : t('board.showMore')}
        </button>
      )}
    </div>
  );
}

function EntryDialog({ open, entry, hpRequired, onClose, onSave }: { open: boolean; entry: Entry | null; hpRequired: boolean; onClose: () => void; onSave: (input: EntryInput) => Promise<void> }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState('');
  const [ac, setAc] = useState('');
  const [hp, setHp] = useState('');
  const [attack, setAttack] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(entry?.name ?? '');
    setAc(entry?.ac === null || entry?.ac === undefined ? '' : String(entry.ac));
    setHp(entry?.hp === null || entry?.hp === undefined ? '' : String(entry.hp));
    setAttack(entry?.attack ?? '');
    setDescription(entry?.description ?? '');
  }, [open, entry]);
  const num = (v: string, len: number) => v.replace(/\D/g, '').slice(0, len);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (hpRequired && hp === '')) return;
    setBusy(true);
    try {
      await onSave({ name: name.trim(), ac: ac === '' ? null : Math.min(50, Number(ac)), hp: hp === '' ? null : Math.min(9999, Number(hp)), attack: attack.trim(), description: description.trim() });
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={entry ? t('bestiary.editEntry') : t('bestiary.newEntry')} onClose={onClose} size="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="b-name" className="label">
            {t('combat.monsterName')}
          </label>
          <input id="b-name" className="input" value={name} maxLength={80} required autoFocus onChange={(e) => setName(e.target.value)} placeholder={t('combat.monsterPlaceholder')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="b-ac" className="label">
              {t('combat.ac')}
            </label>
            <input id="b-ac" className="input text-center" inputMode="numeric" value={ac} onChange={(e) => setAc(num(e.target.value, 2))} placeholder={hpRequired ? '' : '?'} />
          </div>
          <div>
            <label htmlFor="b-hp" className="label">
              {t('combat.hp')}
            </label>
            <input id="b-hp" className="input text-center" inputMode="numeric" required={hpRequired} value={hp} onChange={(e) => setHp(num(e.target.value, 4))} placeholder={hpRequired ? '' : '?'} />
          </div>
        </div>
        {!hpRequired && <p className="-mt-2 text-xs text-parchment-700 dark:text-parchment-400">{t('bestiary.unknownHint')}</p>}
        <div>
          <label htmlFor="b-attack" className="label">
            {t('bestiary.attack')}
          </label>
          <textarea id="b-attack" className="input min-h-[2.5rem]" rows={2} value={attack} maxLength={1000} onChange={(e) => setAttack(e.target.value)} placeholder={t('bestiary.attackPlaceholder')} />
        </div>
        <div>
          <label htmlFor="b-desc" className="label">
            {t('bestiary.description')}
          </label>
          <textarea id="b-desc" className="input min-h-[5rem]" rows={5} value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !name.trim() || (hpRequired && hp === '')}>
            {busy ? <Spinner className="h-4 w-4" /> : <BookMarked className="h-4 w-4" />}
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

