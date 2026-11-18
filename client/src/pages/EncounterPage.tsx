import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDownAZ, ArrowDownWideNarrow, ArrowLeft, ChevronLeft, ChevronRight, Flag, Handshake, Pencil, Play, RotateCcw, Skull, Trash2, UserPlus } from 'lucide-react';
import {
  compareByInitiative,
  compareByName,
  type CharacterSummaryDto,
  type CombatantDto,
  type CombatantUpdate,
  type EncounterDto,
} from '@zauberbuch/shared';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useToast } from '../context/ToastContext';
import { refreshCombatActive } from '../hooks/useCombatActive';
import { Alert, PageSpinner, Spinner } from '../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { CombatantCard } from '../components/combat/CombatantCard';
import { PlayerModeToggle } from '../components/combat/PlayerModeToggle';
import { useCombatPlayerMode } from '../hooks/useCombatPlayerMode';
import { ApiError } from '../lib/api';

const POLL_MS = 3_000;
const SORT_KEY = 'zauberbuch.combat.sort';
type SortMode = 'initiative' | 'alpha';

function storedSort(): SortMode {
  try {
    return localStorage.getItem(SORT_KEY) === 'alpha' ? 'alpha' : 'initiative';
  } catch {
    return 'initiative';
  }
}

export function EncounterPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [enc, setEnc] = useState<EncounterDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [sort, setSort] = useState<SortMode>(storedSort);
  const [dialog, setDialog] = useState<'players' | 'monster' | 'ally' | 'rename' | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'encounter' } | { kind: 'combatant'; c: CombatantDto } | null>(null);
  const [busy, setBusy] = useState(false);
  const [asPlayer] = useCombatPlayerMode();

  const load = useCallback(
    (signal?: AbortSignal) =>
      api
        .encounter(id, signal)
        .then((r) => (setEnc(r.encounter), setError(null)))
        .catch((err) => (err as Error).name !== 'AbortError' && setError(err)),
    [id, asPlayer],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  // Live-Aktualisierung (LP aus Charakterbögen, Zugwechsel des DM)
  useEffect(() => {
    const tick = () => document.visibilityState === 'visible' && void load();
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  const changeSort = (m: SortMode) => {
    setSort(m);
    try {
      localStorage.setItem(SORT_KEY, m);
    } catch {
      /* egal */
    }
  };

  const sorted = useMemo(() => (enc ? [...enc.combatants].sort(sort === 'alpha' ? compareByName : compareByInitiative) : []), [enc, sort]);

  /** Aktion ausführen und die zurückgelieferte Ansicht übernehmen */
  const act = async (fn: () => Promise<{ encounter: EncounterDto }>) => {
    try {
      const r = await fn();
      setEnc(r.encounter);
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  if (error) {
    // Spielermodus: Kampf einer Geschichte, in der der Admin kein Mitspieler ist
    if (asPlayer && error instanceof ApiError && error.status === 404) {
      return (
        <div className="space-y-4">
          <Link to="/combat" className="btn-ghost !px-2">
            <ArrowLeft className="h-4 w-4" />
            {t('combat.backToList')}
          </Link>
          <Alert kind="info">{t('combat.playerModeNotMember')}</Alert>
          <PlayerModeToggle />
        </div>
      );
    }
    return <Alert>{errorMessage(t, error)}</Alert>;
  }
  if (!enc) return <PageSpinner />;

  const manage = enc.canManage;
  const current = enc.combatants.find((c) => c.id === enc.turnCombatantId) ?? null;
  const missingInitiative = enc.combatants.filter((c) => c.initiative === null).length;

  const removeConfirmed = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'encounter') {
        await api.deleteEncounter(enc.id);
        refreshCombatActive();
        navigate('/combat');
        return;
      }
      setEnc((await api.removeCombatant(confirm.c.id)).encounter);
      setConfirm(null);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/combat" className="btn-ghost mr-auto !px-2">
          <ArrowLeft className="h-4 w-4" />
          {t('combat.backToList')}
        </Link>
        <PlayerModeToggle />
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <h1 className="flex items-center gap-2 break-words text-3xl font-bold">
            {enc.name}
            {manage && (
              <button type="button" className="btn-icon" onClick={() => setDialog('rename')} title={t('combat.rename')} aria-label={t('combat.rename')}>
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </h1>
          <p className="text-parchment-700 dark:text-parchment-400">
            {enc.storyName}
            {enc.ended && <span className="badge ml-2 bg-parchment-200 text-parchment-900 dark:bg-night-700 dark:text-parchment-200">{t('combat.endedBadge')}</span>}
          </p>
        </div>
        <div className="parchment flex items-center gap-3 px-4 py-2">
          <div className="text-center">
            <p className="sheet-label">{t('combat.round')}</p>
            <p className="font-display text-2xl font-bold tabular-nums">{enc.round}</p>
          </div>
          <div className="min-w-[8rem] border-l border-parchment-300 pl-3 dark:border-night-700">
            <p className="sheet-label">{t('combat.currentTurn')}</p>
            <p className="font-display font-bold">{current?.name ?? '—'}</p>
          </div>
        </div>
      </div>

      {manage && (
        <div className="flex flex-wrap items-center gap-2">
          {current ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => act(() => api.encounterTurn(enc.id, -1))} disabled={enc.combatants.length === 0}>
                <ChevronLeft className="h-4 w-4" />
                {t('combat.prevTurn')}
              </button>
              <button type="button" className="btn-primary" onClick={() => act(() => api.encounterTurn(enc.id, 1))} disabled={enc.combatants.length === 0}>
                {t('combat.nextTurn')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button type="button" className="btn-primary" onClick={() => act(() => api.encounterTurn(enc.id, 1))} disabled={enc.combatants.length === 0}>
              <Play className="h-4 w-4" />
              {t('combat.startTurns')}
            </button>
          )}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => act(() => api.updateEncounter(enc.id, { round: 1, turnCombatantId: null }))}
            title={t('combat.resetTurns')}
          >
            <RotateCcw className="h-4 w-4" />
            {t('combat.resetTurns')}
          </button>
          <span className="mx-1 hidden h-6 border-l border-parchment-400 sm:block dark:border-night-700" />
          <button type="button" className="btn-secondary" onClick={() => setDialog('players')}>
            <UserPlus className="h-4 w-4" />
            {t('combat.addPlayers')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setDialog('monster')}>
            <Skull className="h-4 w-4" />
            {t('combat.addMonster')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setDialog('ally')}>
            <Handshake className="h-4 w-4" />
            {t('combat.addAlly')}
          </button>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={async () => {
                await act(() => api.updateEncounter(enc.id, { ended: !enc.ended }));
                refreshCombatActive();
              }}
            >
              <Flag className="h-4 w-4" />
              {enc.ended ? t('combat.resume') : t('combat.end')}
            </button>
            <button type="button" className="btn-icon text-red-700 dark:text-red-400" onClick={() => setConfirm({ kind: 'encounter' })} title={t('combat.delete')} aria-label={t('combat.delete')}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={t('combat.sort')} className="flex overflow-hidden rounded-full border border-parchment-500/60 dark:border-night-700">
          {(
            [
              ['initiative', ArrowDownWideNarrow, t('combat.sortInitiative')],
              ['alpha', ArrowDownAZ, t('combat.sortAlpha')],
            ] as const
          ).map(([m, Icon, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={sort === m}
              onClick={() => changeSort(m)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition ${
                sort === m ? 'bg-parchment-800 text-parchment-50 dark:bg-parchment-300 dark:text-ink' : 'hover:bg-parchment-200 dark:hover:bg-night-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        {manage && missingInitiative > 0 && <span className="text-sm text-amber-800 dark:text-amber-300">{t('combat.missingInitiative', { count: missingInitiative })}</span>}
        <span className="ml-auto text-xs text-parchment-700 dark:text-parchment-400">{t('combat.liveHint')}</span>
      </div>

      {sorted.length === 0 ? (
        <p className="parchment p-8 text-center text-parchment-700 dark:text-parchment-400">{manage ? t('combat.emptyEditor') : t('combat.emptyUser')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 pt-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {sorted.map((c) => (
            <CombatantCard
              key={c.id}
              c={c}
              active={c.id === enc.turnCombatantId}
              manage={manage}
              onUpdate={(data: CombatantUpdate) => act(() => api.updateCombatant(c.id, data))}
              onHp={(delta) => act(() => api.combatantHp(c.id, delta))}
              onRemove={() => setConfirm({ kind: 'combatant', c })}
            />
          ))}
        </div>
      )}

      {manage && (
        <>
          <AddPlayersDialog open={dialog === 'players'} enc={enc} onClose={() => setDialog(null)} onDone={(e) => (setEnc(e), setDialog(null))} />
          <AddMonsterDialog open={dialog === 'monster'} encId={enc.id} onClose={() => setDialog(null)} onDone={(e) => (setEnc(e), setDialog(null))} />
          <AddMonsterDialog allied open={dialog === 'ally'} encId={enc.id} onClose={() => setDialog(null)} onDone={(e) => (setEnc(e), setDialog(null))} />
          <RenameDialog open={dialog === 'rename'} enc={enc} onClose={() => setDialog(null)} onDone={(e) => (setEnc(e), setDialog(null))} />
        </>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === 'encounter' ? t('combat.deleteTitle') : t('combat.removeTitle')}
        message={confirm?.kind === 'encounter' ? t('combat.deleteText') : t('combat.removeText', { name: confirm?.kind === 'combatant' ? confirm.c.name : '' })}
        busy={busy}
        onConfirm={removeConfirmed}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function AddPlayersDialog({ open, enc, onClose, onDone }: { open: boolean; enc: EncounterDto; onClose: () => void; onDone: (e: EncounterDto) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [chars, setChars] = useState<CharacterSummaryDto[] | null>(null);
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    Promise.all([api.allCharacters(), api.stories(true)])
      .then(([c, s]) => {
        setChars(c.characters);
        setMembers(new Set(s.stories.find((x) => x.id === enc.storyId)?.members.map((m) => m.id) ?? []));
      })
      .catch((err) => toast.error(errorMessage(t, err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const present = new Set(enc.combatants.map((c) => c.characterId).filter(Boolean));
  // Charaktere der Mitspieler dieser Geschichte zuerst
  const sorted = [...(chars ?? [])].sort(
    (a, b) => Number(members.has(b.owner?.id ?? '')) - Number(members.has(a.owner?.id ?? '')) || (a.owner?.username ?? '').localeCompare(b.owner?.username ?? '') || a.name.localeCompare(b.name),
  );

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.addCombatCharacters(enc.id, [...selected]);
      onDone(r.encounter);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={t('combat.addPlayers')} onClose={onClose}>
      {!chars ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : chars.length === 0 ? (
        <p>{t('combat.noCharacters')}</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('combat.addPlayersHint')}</p>
          <ul className="max-h-[50vh] divide-y divide-parchment-300/70 overflow-y-auto dark:divide-night-700">
            {sorted.map((c) => {
              const already = present.has(c.id);
              return (
                <li key={c.id}>
                  <label className={`flex items-center gap-3 py-2 ${already ? 'opacity-50' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-parchment-800 dark:accent-parchment-300"
                      disabled={already}
                      checked={already || selected.has(c.id)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{c.name || t('characters.unnamed')}</span>
                      <span className="block text-xs text-parchment-700 dark:text-parchment-400">
                        {[c.classLevel, c.race].filter(Boolean).join(' · ')} {c.owner && `· ${c.owner.username}`}
                      </span>
                    </span>
                    {members.has(c.owner?.id ?? '') && <span className="badge bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{t('combat.member')}</span>}
                    {already && <span className="text-xs">{t('combat.alreadyAdded')}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn-primary" onClick={submit} disabled={busy || selected.size === 0}>
              {busy ? <Spinner className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {t('combat.addSelected', { count: selected.size })}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AddMonsterDialog({ open, encId, allied = false, onClose, onDone }: { open: boolean; encId: string; allied?: boolean; onClose: () => void; onDone: (e: EncounterDto) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState('');
  const [count, setCount] = useState('1');
  const [ac, setAc] = useState('');
  const [hp, setHp] = useState('');
  const [ini, setIni] = useState('');
  const [hide, setHide] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setName('');
      setCount('1');
      setAc('');
      setHp('');
      setIni('');
      // Verbündete sind standardmäßig offen sichtbar, Monster verdeckt
      setHide(!allied);
    }
  }, [open, allied]);
  const num = (v: string, allowMinus = false) => v.replace(allowMinus ? /[^\d-]/g : /\D/g, '').slice(0, 4);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || hp === '') return;
    setBusy(true);
    try {
      const r = await api.addMonster(encId, {
        name: name.trim(),
        count: Math.max(1, Math.min(20, Number(count) || 1)),
        ac: ac === '' ? null : Math.min(50, Number(ac)),
        hpMax: Math.min(9999, Number(hp)),
        initiative: ini === '' || ini === '-' ? null : Math.max(-20, Math.min(99, Number(ini))),
        hideStats: hide,
        allied,
      });
      onDone(r.encounter);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={allied ? t('combat.addAlly') : t('combat.addMonster')} onClose={onClose} size="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="m-name" className="label">
            {t('combat.monsterName')}
          </label>
          <input id="m-name" className="input" value={name} maxLength={80} required autoFocus onChange={(e) => setName(e.target.value)} placeholder={allied ? t('combat.allyPlaceholder') : t('combat.monsterPlaceholder')} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="m-count" className="label">
              {t('combat.count')}
            </label>
            <input id="m-count" className="input text-center" inputMode="numeric" value={count} onChange={(e) => setCount(num(e.target.value).slice(0, 2))} />
          </div>
          <div>
            <label htmlFor="m-ac" className="label">
              {t('combat.acShort')}
            </label>
            <input id="m-ac" className="input text-center" inputMode="numeric" value={ac} onChange={(e) => setAc(num(e.target.value).slice(0, 2))} />
          </div>
          <div>
            <label htmlFor="m-hp" className="label">
              {t('combat.hpMax')}
            </label>
            <input id="m-hp" className="input text-center" inputMode="numeric" required value={hp} onChange={(e) => setHp(num(e.target.value))} />
          </div>
          <div>
            <label htmlFor="m-ini" className="label">
              {t('combat.initiative')}
            </label>
            <input id="m-ini" className="input text-center" inputMode="numeric" value={ini} onChange={(e) => setIni(num(e.target.value, true).slice(0, 3))} />
          </div>
        </div>
        {Number(count) > 1 && <p className="text-xs text-parchment-700 dark:text-parchment-400">{t('combat.countHint', { name: name || (allied ? t('combat.allyPlaceholderShort') : 'Goblin') })}</p>}
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-parchment-800 dark:accent-parchment-300" checked={hide} onChange={(e) => setHide(e.target.checked)} />
          <span>
            {t('combat.hideStatsLabel')}
            <span className="block text-xs text-parchment-700 dark:text-parchment-400">{t('combat.hideStatsHint')}</span>
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !name.trim() || hp === ''}>
            {busy ? <Spinner className="h-4 w-4" /> : allied ? <Handshake className="h-4 w-4" /> : <Skull className="h-4 w-4" />}
            {t('combat.addMonsterButton')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RenameDialog({ open, enc, onClose, onDone }: { open: boolean; enc: EncounterDto; onClose: () => void; onDone: (e: EncounterDto) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState(enc.name);
  useEffect(() => {
    if (open) setName(enc.name);
  }, [open, enc.name]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      onDone((await api.updateEncounter(enc.id, { name: name.trim() })).encounter);
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };
  return (
    <Modal open={open} title={t('combat.rename')} onClose={onClose} size="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <input className="input" value={name} maxLength={100} autoFocus onChange={(e) => setName(e.target.value)} aria-label={t('combat.name')} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={!name.trim()}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
