import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Swords } from 'lucide-react';
import type { EncounterSummaryDto, StoryDto } from '@zauberbuch/shared';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { refreshCombatActive } from '../hooks/useCombatActive';
import { Alert, PageSpinner, Spinner } from '../components/ui';
import { PlayerModeToggle } from '../components/combat/PlayerModeToggle';
import { useCombatPlayerMode } from '../hooks/useCombatPlayerMode';

/** Übersicht der Kämpfe aus den eigenen Geschichten; DM/Admin legen neue an */
export function CombatPage() {
  const { t, i18n } = useTranslation();
  const { isEditor: editorRole } = useAuth();
  const [asPlayer] = useCombatPlayerMode();
  const isEditor = editorRole && !asPlayer;
  const [encounters, setEncounters] = useState<EncounterSummaryDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setEncounters(null);
    api
      .encounters()
      .then((r) => setEncounters(r.encounters))
      .catch(setError);
  }, [asPlayer]);

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!encounters) return <PageSpinner />;

  const running = encounters.filter((e) => !e.ended);
  const ended = encounters.filter((e) => e.ended);
  const list = (items: EncounterSummaryDto[]) => (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((e) => (
        <li key={e.id}>
          <Link to={`/combat/${e.id}`} className="parchment block p-4 transition hover:shadow-cardhover">
            <div className="flex items-start gap-3">
              <Swords className={`mt-1 h-5 w-5 shrink-0 ${e.ended ? 'text-parchment-500' : 'text-red-700 dark:text-red-400'}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-bold">{e.name}</p>
                <p className="text-sm text-parchment-700 dark:text-parchment-400">{e.storyName}</p>
                <p className="mt-1 text-sm">
                  {t('combat.roundN', { round: e.round })} · {t('combat.combatantCount', { count: e.combatantCount })} · {new Date(e.updatedAt).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-3xl font-bold">{t('combat.heading')}</h1>
        <PlayerModeToggle />
      </div>
      {asPlayer && <Alert kind="info">{t('combat.playerModeActive')}</Alert>}
      {isEditor && <NewEncounterForm />}
      <section>
        <h2 className="mb-3 text-xl font-bold">{t('combat.running', { count: running.length })}</h2>
        {running.length ? list(running) : <p className="text-parchment-700 dark:text-parchment-400">{isEditor ? t('combat.noneRunningEditor') : t('combat.noneRunningUser')}</p>}
      </section>
      {ended.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">{t('combat.ended')}</h2>
          {list(ended)}
        </section>
      )}
    </div>
  );
}

function NewEncounterForm() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [stories, setStories] = useState<StoryDto[] | null>(null);
  const [storyId, setStoryId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .stories()
      .then((r) => {
        setStories(r.stories);
        if (r.stories[0]) setStoryId(r.stories[0].id);
      })
      .catch(() => setStories([]));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!storyId || !name.trim()) return;
    setBusy(true);
    try {
      const res = await api.createEncounter(storyId, name.trim());
      refreshCombatActive();
      navigate(`/combat/${res.encounter.id}`);
    } catch (err) {
      toast.error(errorMessage(t, err));
      setBusy(false);
    }
  };

  if (stories && stories.length === 0) {
    return (
      <Alert kind="info">
        {t('combat.needStory')}{' '}
        <Link to="/board" className="underline">
          {t('nav.board')}
        </Link>
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="parchment flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-[12rem] flex-1">
        <label htmlFor="enc-story" className="label">
          {t('combat.story')}
        </label>
        <select id="enc-story" className="input" value={storyId} onChange={(e) => setStoryId(e.target.value)} disabled={!stories}>
          {stories?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[12rem] flex-[2]">
        <label htmlFor="enc-name" className="label">
          {t('combat.name')}
        </label>
        <input id="enc-name" className="input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder={t('combat.namePlaceholder')} />
      </div>
      <button type="submit" className="btn-primary" disabled={busy || !storyId || !name.trim()}>
        {busy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {t('combat.start')}
      </button>
    </form>
  );
}
