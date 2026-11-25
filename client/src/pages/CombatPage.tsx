import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Swords } from 'lucide-react';
import type { EncounterSummaryDto, StoryDto } from '@zauberbuch/shared';
import { useLiveEvent } from '../hooks/useLiveEvents';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { refreshCombatActive } from '../hooks/useCombatActive';
import { Alert, PageSpinner, Spinner } from '../components/ui';
import { CombatTabs } from '../components/combat/CombatTabs';

/**
 * Übersicht der Kämpfe aus den eigenen Geschichten. Neue Kämpfe legen Dungeon Master einer Geschichte an.
 * Geschichten-Ansicht: nur Kämpfe der aktiven Geschichte; beim Aufruf über das Menü direkt in den laufenden Kampf.
 */
export function CombatPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [all, setAll] = useState<EncounterSummaryDto[] | null>(null);
  const [stories, setStories] = useState<StoryDto[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const activeStoryId = user?.activeStoryId ?? null;
  const fromNav = Boolean((location.state as { fromNav?: boolean } | null)?.fromNav);

  useEffect(() => {
    Promise.all([api.encounters(), api.stories()])
      .then(([e, s]) => {
        setAll(e.encounters);
        setStories(s.stories);
      })
      .catch(setError);
  }, []);
  useEffect(() => setShowAll(false), [activeStoryId]);
  // Neue/beendete Kämpfe der eigenen Geschichten live übernehmen
  useLiveEvent((e) => e.type === 'combat', () => api.encounters().then((e) => setAll(e.encounters), () => undefined));

  const activeStory = stories.find((s) => s.id === activeStoryId) ?? null;
  const storyMode = Boolean(activeStory) && !showAll;
  const encounters = all && storyMode ? all.filter((e) => e.storyId === activeStoryId) : all;

  // Geschichten-Ansicht + Klick im Menü: genau ein laufender Kampf -> direkt hinein
  useEffect(() => {
    if (!fromNav || !storyMode || !encounters) return;
    const running = encounters.filter((e) => !e.ended);
    if (running.length === 1) navigate(`/combat/${running[0].id}`, { replace: true });
  }, [fromNav, storyMode, encounters, navigate]);

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!encounters) return <PageSpinner />;

  const dmStories = stories.filter((s) => s.myRole === 'dm' && !s.archived);
  const isEditor = dmStories.length > 0;
  const running = encounters.filter((e) => !e.ended);
  const ended = encounters.filter((e) => e.ended);
  const list = (items: EncounterSummaryDto[]) => (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5">
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
      <h1 className="text-3xl font-bold">{t('combat.heading')}</h1>
      <CombatTabs />
      {activeStory && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {showAll ? t('storyView.showingAll') : t('storyView.filtered', { name: activeStory.name })}
          <button type="button" className="underline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? t('storyView.onlyStory') : t('storyView.showAll')}
          </button>
        </p>
      )}
      {isEditor && <NewEncounterForm stories={storyMode && activeStory?.myRole === 'dm' ? [activeStory] : dmStories} />}
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

function NewEncounterForm({ stories }: { stories: StoryDto[] }) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [storyId, setStoryId] = useState(stories[0]?.id ?? '');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!stories.some((s) => s.id === storyId)) setStoryId(stories[0]?.id ?? '');
  }, [stories, storyId]);

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
