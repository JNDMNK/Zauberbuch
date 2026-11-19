import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BookMarked, Eye, Heart, Pencil, Plus, Search, Shield, Skull, Swords, Trash2 } from 'lucide-react';
import { hpRangeSchema, monsterStatsSchema, type BestiaryUserRef, type DamageType, type MonsterStats, type StoryDto } from '@zauberbuch/shared';
import { DamageInput, checkDamage, type DamageState } from '../components/DamageInput';
import { DamageValue } from '../components/DamageValue';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Alert, PageSpinner, Spinner } from '../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { CombatTabs } from '../components/combat/CombatTabs';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { StatBlock, useMonsterSubtitle } from '../components/bestiary/StatBlock';
import { StatBlockForm } from '../components/bestiary/StatBlockForm';

/** Gemeinsame Form beider Datenbanken */
interface Entry {
  id: string;
  name: string;
  ac: number | null;
  /** DM: Zahl; Spieler: Zahl oder Bereich als Text („10-15“) */
  hp: number | string | null;
  attack: string;
  description: string;
  damageDice: string | null;
  damageType: DamageType | null;
  stats: MonsterStats;
  createdBy: BestiaryUserRef | null;
  updatedBy: BestiaryUserRef | null;
  createdAt: string;
  updatedAt: string;
}
interface EntryInput {
  name: string;
  ac: number | null;
  /** Rohtext aus dem Formular (DM: Zahl, Spieler: Zahl oder Bereich) */
  hp: string;
  attack: string;
  description: string;
  damageDice: string | null;
  damageType: DamageType | null;
  stats: MonsterStats;
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
  const { user } = useAuth();
  const [stories, setStories] = useState<StoryDto[] | null>(null);
  // DM-Datenbank: wer in mindestens einer Geschichte Dungeon Master ist (Admin immer)
  const isEditor = Boolean(stories?.some((s) => s.myRole === 'dm')) || user?.role === 'admin';
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setStories(null);
    api
      .stories()
      .then((r) => {
        // Geschichten mit Rolle (Spieler: bearbeiten, Dungeon Master: nur lesen)
        const list = r.stories.filter((s) => s.myRole);
        const dm = list.some((s) => s.myRole === 'dm') || user?.role === 'admin';
        setStories(list);
        // Geschichten-Ansicht: deren Spieler-Datenbank vorauswählen (als Spieler), sonst DM-Datenbank bzw. erste Geschichte
        const active = list.find((s) => s.id === user?.activeStoryId);
        if (active && active.myRole === 'player') setSource({ kind: 'story', storyId: active.id });
        else setSource(dm ? { kind: 'dm' } : list[0] ? { kind: 'story', storyId: list[0].id } : null);
      })
      .catch(setError);
  }, [user?.id, user?.activeStoryId, user?.role]);

  const sourceValue = source ? (source.kind === 'dm' ? 'dm' : source.storyId) : '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-3xl font-bold">{t('combat.heading')}</h1>
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
                    {s.myRole === 'dm' ? t('bestiary.playerDatabaseOf', { name: s.name }) : s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <EntryList key={sourceValue} source={source} storyName={source.kind === 'story' ? (stories.find((s) => s.id === source.storyId)?.name ?? '') : ''} />
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
  const [viewing, setViewing] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const subtitle = useMonsterSubtitle();
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
    () => (entries ?? []).filter((e) => !needle || `${e.name}\n${e.attack}\n${e.description}\n${e.stats.type}\n${e.stats.tags}\n${e.stats.habitat}`.toLocaleLowerCase('de').includes(needle)),
    [entries, needle],
  );

  const save = async (input: EntryInput) => {
    const id = editing && editing !== 'new' ? editing.id : null;
    if (source.kind === 'dm') {
      const data = { ...input, hp: Math.min(9999, Number(input.hp) || 0) };
      const r = id ? await api.updateMonsterTemplate(id, data) : await api.createMonsterTemplate(data);
      setEntries((list) => upsert(list, r.template));
      setViewing((v) => (v?.id === r.template.id ? r.template : v));
    } else {
      const data = { ...input, hp: input.hp.trim() || null };
      const r = id ? await api.updateBestiaryEntry(id, data) : await api.createBestiaryEntry(source.storyId, data);
      setEntries((list) => upsert(list, r.entry));
      setViewing((v) => (v?.id === r.entry.id ? r.entry : v));
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
      <Alert kind="info">{isDm ? t('bestiary.dmIntro') : canWrite ? t('bestiary.playerIntro', { name: storyName }) : t('bestiary.readOnlyIntro', { name: storyName })}</Alert>
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
          {shown.map((e) => {
            const sub = subtitle(e.stats);
            const actions = canWrite && (
              <>
                <button type="button" className="btn-icon" onClick={() => (setViewing(null), setEditing(e))} title={t('common.edit')} aria-label={`${t('common.edit')}: ${e.name}`}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="btn-icon text-red-700 dark:text-red-400"
                  onClick={() => (setViewing(null), setToDelete(e))}
                  title={t('common.delete')}
                  aria-label={`${t('common.delete')}: ${e.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            );
            return (
              <li key={e.id} className="parchment relative flex flex-col gap-2 p-4 transition hover:-translate-y-0.5 hover:shadow-cardhover">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-display text-lg font-bold leading-tight">
                      <button
                        type="button"
                        onClick={() => setViewing(e)}
                        className="text-left outline-none after:absolute after:inset-0 after:z-[5] after:content-[''] focus-visible:underline"
                        aria-haspopup="dialog"
                      >
                        {e.name}
                      </button>
                    </h3>
                    {sub && <p className="text-sm italic text-parchment-700 dark:text-parchment-400">{sub}</p>}
                  </div>
                  {actions && <div className="relative z-10 flex shrink-0 gap-1">{actions}</div>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1" title={t('combat.ac')}>
                    <Shield className="h-4 w-4 text-parchment-600" />
                    <span className="sheet-label !inline">{t('combat.acShort')}</span> <strong>{e.ac ?? '?'}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1" title={t('combat.hp')}>
                    <Heart className="h-4 w-4 text-red-700 dark:text-red-400" />
                    <span className="sheet-label !inline">{t('bestiary.hpShort')}</span> <strong>{e.hp ?? '?'}</strong>
                  </span>
                  {e.stats.cr && (
                    <span className="inline-flex items-center gap-1" title={t('bestiary.stats.cr')}>
                      <Skull className="h-4 w-4 text-parchment-600" />
                      <span className="sheet-label !inline">{t('bestiary.stats.crShort')}</span> <strong>{e.stats.cr}</strong>
                    </span>
                  )}
                </div>
                {(e.attack || (e.damageDice && e.damageType)) && (
                  <div className="space-y-1 text-sm">
                    {e.attack && (
                      <p className="flex items-start gap-1.5">
                        <Swords className="mt-0.5 h-4 w-4 shrink-0 text-parchment-700 dark:text-parchment-400" aria-label={t('bestiary.attack')} />
                        <span className="line-clamp-2 whitespace-pre-wrap break-words">{e.attack}</span>
                      </p>
                    )}
                    {e.damageDice && e.damageType && <DamageValue damage={{ dice: e.damageDice, type: e.damageType }} />}
                  </div>
                )}
                {(e.stats.traits.length > 0 || e.stats.actions.length > 0) && (
                  <p className="line-clamp-2 text-sm">
                    {[...e.stats.traits, ...e.stats.actions]
                      .map((f) => f.name)
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                <p className="mt-auto pt-1 text-xs text-parchment-700 dark:text-parchment-400">
                  {t('bestiary.createdBy', { name: e.createdBy?.username ?? t('board.deletedUser') })}
                  {e.updatedBy && e.updatedAt !== e.createdAt && (
                    <> · {t('bestiary.updatedBy', { name: e.updatedBy.username, date: new Date(e.updatedAt).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' }) })}</>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!viewing} title={viewing?.name ?? ''} onClose={() => setViewing(null)} size="max-w-5xl">
        {viewing && (
          <div className="space-y-3">
            {canWrite && (
              <div className="flex justify-end gap-1">
                <button type="button" className="btn-secondary" onClick={() => (setEditing(viewing), setViewing(null))}>
                  <Pencil className="h-4 w-4" />
                  {t('common.edit')}
                </button>
              </div>
            )}
            <StatBlock entry={viewing} />
          </div>
        )}
      </Modal>
      <EntryDialog open={editing !== null} entry={editing === 'new' ? null : editing} hpRequired={isDm} onClose={() => setEditing(null)} onSave={save} />
      <ConfirmDialog
        open={!!toDelete}
        title={t('bestiary.deleteTitle')}
        message={t('bestiary.deleteText', { name: toDelete?.name ?? '' })}
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function upsert<T extends { id: string; name: string }>(list: T[] | null, item: T): T[] {
  const rest = (list ?? []).filter((x) => x.id !== item.id);
  return [...rest, item].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
}

function EntryDialog({ open, entry, hpRequired, onClose, onSave }: { open: boolean; entry: Entry | null; hpRequired: boolean; onClose: () => void; onSave: (input: EntryInput) => Promise<void> }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState('');
  const [ac, setAc] = useState('');
  const [hp, setHp] = useState('');
  const [attack, setAttack] = useState('');
  const [description, setDescription] = useState('');
  const [damage, setDamage] = useState<DamageState>({ dice: '', type: '' });
  const [stats, setStats] = useState<MonsterStats>(() => monsterStatsSchema.parse({}));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setDamage({ dice: entry?.damageDice ?? '', type: entry?.damageType ?? '' });
    setName(entry?.name ?? '');
    setAc(entry?.ac === null || entry?.ac === undefined ? '' : String(entry.ac));
    setHp(entry?.hp === null || entry?.hp === undefined ? '' : String(entry.hp));
    setAttack(entry?.attack ?? '');
    setDescription(entry?.description ?? '');
    setStats(entry?.stats ?? monsterStatsSchema.parse({}));
  }, [open, entry]);
  const num = (v: string, len: number) => v.replace(/\D/g, '').slice(0, len);

  const dmg = checkDamage(damage);
  const hpCheck = hpRequired ? null : hpRangeSchema.safeParse(hp);
  const hpInvalid = hpCheck !== null && !hpCheck.success;
  const invalid = !name.trim() || (hpRequired && hp === '') || hpInvalid || dmg.error !== null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        ac: ac === '' ? null : Math.min(50, Number(ac)),
        hp,
        attack: attack.trim(),
        description: description.trim(),
        damageDice: dmg.value?.dice ?? null,
        damageType: dmg.value?.type ?? null,
        stats,
      });
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={entry ? t('bestiary.editEntry') : t('bestiary.newEntry')} onClose={onClose} size="max-w-4xl">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="b-name" className="label">
            {t('combat.monsterName')}
          </label>
          <input id="b-name" className="input" value={name} maxLength={80} required autoFocus onChange={(e) => setName(e.target.value)} placeholder={t('combat.monsterPlaceholder')} />
        </div>
        <StatBlockForm
          value={stats}
          onChange={setStats}
          top={
            <>
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
                  {hpRequired ? (
                    <input id="b-hp" className="input text-center" inputMode="numeric" required value={hp} onChange={(e) => setHp(num(e.target.value, 4))} />
                  ) : (
                    <input
                      id="b-hp"
                      className={`input text-center ${hpInvalid ? 'input-error' : ''}`}
                      value={hp}
                      maxLength={20}
                      onChange={(e) => setHp(e.target.value.replace(/[^\d\s\-–]/g, ''))}
                      placeholder={t('bestiary.hpRangePlaceholder')}
                    />
                  )}
                </div>
              </div>
              {!hpRequired && (
                <p className={`-mt-2 text-xs ${hpInvalid ? 'text-red-700 dark:text-red-400' : 'text-parchment-700 dark:text-parchment-400'}`}>
                  {hpInvalid ? t('errors.hp_range_invalid') : t('bestiary.hpRangeHint')}
                </p>
              )}
            </>
          }
        />
        <fieldset className="rounded-lg border border-parchment-400/60 p-3 dark:border-night-700">
          <legend className="px-1 font-display text-sm font-bold uppercase tracking-wide text-parchment-800 dark:text-parchment-300">{t('bestiary.combatAttack')}</legend>
          <p className="mb-2 text-xs text-parchment-700 dark:text-parchment-400">{t('bestiary.combatAttackHint')}</p>
          <div className="space-y-3">
            <div>
              <label htmlFor="b-attack" className="label">
                {t('bestiary.attack')}
              </label>
              <textarea
                id="b-attack"
                className="input min-h-[2.5rem]"
                rows={2}
                value={attack}
                maxLength={1000}
                onChange={(e) => setAttack(e.target.value)}
                placeholder={t('bestiary.attackPlaceholder')}
              />
            </div>
            <DamageInput value={damage} onChange={setDamage} />
          </div>
        </fieldset>
        <div>
          <label htmlFor="b-desc" className="label">
            {t('bestiary.description')}
          </label>
          <MarkdownEditor id="b-desc" value={description} onChange={(v) => setDescription(v.slice(0, 5000))} rows={5} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || invalid}>
            {busy ? <Spinner className="h-4 w-4" /> : <BookMarked className="h-4 w-4" />}
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
