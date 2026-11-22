import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Copy, Plus, ScrollText, Search, Trash2, Users, Wand2 } from 'lucide-react';
import { CharacterWizard } from '../components/wizard/CharacterWizard';
import type { CharacterSummaryDto } from '@zauberbuch/shared';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Alert, PageSpinner, Spinner } from '../components/ui';

export function CharacterCard({ c, to, actions }: { c: CharacterSummaryDto; to: string; actions?: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  return (
    <article className="parchment relative flex items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-cardhover">
      <ScrollText className="mt-1 h-8 w-8 shrink-0 text-parchment-700 dark:text-parchment-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-display text-lg font-bold">
          <Link to={to} className="after:absolute after:inset-0 after:content-['']">
            {c.name || t('characters.unnamed')}
          </Link>
        </h2>
        <p className="truncate text-sm">{[c.classLevel, c.race].filter(Boolean).join(' · ') || t('characters.level', { level: c.level })}</p>
        {c.story && (
          <p className="mt-1">
            <span className="badge bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200">{c.story.name}</span>
          </p>
        )}
        <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">
          {c.owner && <span className="font-semibold">{c.owner.username} · </span>}
          {t('characters.updated', { date: new Date(c.updatedAt).toLocaleDateString(i18n.language) })}
        </p>
      </div>
      {actions && <div className="relative z-10 flex gap-1">{actions}</div>}
    </article>
  );
}

export function CharactersPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState<CharacterSummaryDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<CharacterSummaryDto | null>(null);
  const { isEditor, user } = useAuth();
  const location = useLocation();
  const allOwn = list;
  const [allShared, setShared] = useState<CharacterSummaryDto[]>([]);
  /** Fremde Bögen: Moderator/Admin alle, Dungeon Master die ihrer Geschichten */
  const [allOthers, setOthers] = useState<CharacterSummaryDto[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const activeStoryId = user?.activeStoryId ?? null;
  const fromNav = Boolean((location.state as { fromNav?: boolean } | null)?.fromNav);

  useEffect(() => {
    Promise.all([api.characters(), api.allCharacters()])
      .then(([mine, others]) => {
        setList(mine.characters);
        setShared(mine.shared);
        setOthers(others.characters.filter((c) => c.owner?.id !== user?.id));
      })
      .catch(setError);
  }, [user?.id]);
  useEffect(() => setShowAll(false), [activeStoryId]);

  // Geschichten-Ansicht: nur Bögen der aktiven Geschichte
  const storyMode = Boolean(activeStoryId) && !showAll;
  const inStory = (c: CharacterSummaryDto) => !storyMode || c.story?.id === activeStoryId;
  const shared = allShared.filter(inStory);
  const others = (allOthers ?? []).filter(inStory);
  const storyName = [...(allOwn ?? []), ...allShared, ...(allOthers ?? [])].find((c) => c.story?.id === activeStoryId)?.story?.name;

  // Über das Menü aufgerufen, nur ein eigener Bogen in der Geschichte und keine weiteren sichtbar -> direkt hinein
  useEffect(() => {
    if (!fromNav || !storyMode || !allOwn || allOthers === null) return;
    const own = allOwn.filter((c) => c.story?.id === activeStoryId);
    const sharedHere = allShared.filter((c) => c.story?.id === activeStoryId);
    const othersHere = allOthers.filter((c) => c.story?.id === activeStoryId);
    if (own.length === 1 && sharedHere.length === 0 && othersHere.length === 0) navigate(`/characters/${own[0].id}`, { replace: true });
  }, [fromNav, storyMode, allOwn, allShared, allOthers, activeStoryId, navigate]);

  const [wizard, setWizard] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      const { character } = await api.createCharacter();
      navigate(`/characters/${character.id}`);
    } catch (err) {
      toast.error(errorMessage(t, err));
      setBusy(false);
    }
  };

  const duplicate = async (c: CharacterSummaryDto) => {
    try {
      const { character } = await api.duplicateCharacter(c.id);
      setList((l) => [character, ...(l ?? [])]);
      toast.success(t('characters.duplicated'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    try {
      await api.deleteCharacter(toDelete.id);
      setList((l) => l?.filter((x) => x.id !== toDelete.id) ?? null);
      toast.success(t('characters.deleted'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setToDelete(null);
    }
  };

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!list) return <PageSpinner />;
  const ownShown = list.filter(inStory);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <ScrollText className="h-7 w-7 text-parchment-600" />
          {isEditor || others.length > 0 ? t('characters.titleAll') : t('characters.title')}
        </h1>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => setWizard(true)}>
            <Wand2 className="h-4 w-4" />
            {t('wizard.open')}
          </button>
          <button type="button" className="btn-secondary" onClick={create} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {t('wizard.empty')}
          </button>
        </div>
      </div>
      <CharacterWizard open={wizard} onClose={() => setWizard(false)} onCreated={(id) => navigate(`/characters/${id}`)} />
      {activeStoryId && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          {showAll || !storyName ? t('storyView.showingAll') : t('storyView.filteredCharacters', { name: storyName })}
          <button type="button" className="underline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? t('storyView.onlyStory') : t('storyView.showAll')}
          </button>
        </p>
      )}
      {(isEditor || others.length > 0) && <h2 className="mb-3 text-xl font-bold">{t('characters.mine')}</h2>}
      {ownShown.length === 0 ? (
        <div className="parchment px-6 py-16 text-center">
          <p className="font-display text-xl font-bold">{t('characters.empty')}</p>
          <p className="mt-2 text-parchment-700 dark:text-parchment-400">{t('characters.emptyHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ownShown.map((c) => (
            <CharacterCard
              key={c.id}
              c={c}
              to={`/characters/${c.id}`}
              actions={
                <>
                  <button type="button" className="btn-icon" onClick={() => duplicate(c)} title={t('characters.duplicate')} aria-label={`${t('characters.duplicate')}: ${c.name}`}>
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="btn-icon text-red-700 dark:text-red-400"
                    onClick={() => setToDelete(c)}
                    title={t('characters.delete')}
                    aria-label={`${t('characters.delete')}: ${c.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}
      {shared.length > 0 && (
        <section className="mt-10" aria-labelledby="shared-characters">
          <h2 id="shared-characters" className="text-xl font-bold">
            {t('characters.shared')}
          </h2>
          <p className="mb-3 text-sm text-parchment-700 dark:text-parchment-400">{t('characters.sharedHint')}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shared.map((c) => (
              <CharacterCard key={c.id} c={c} to={`/characters/${c.id}`} />
            ))}
          </div>
        </section>
      )}
      {(isEditor || others.length > 0) && <OtherCharacters list={allOthers === null ? null : others} />}
      <ConfirmDialog
        open={!!toDelete}
        title={t('characters.delete')}
        message={toDelete ? t('characters.deleteConfirm', { name: toDelete.name || t('characters.unnamed') }) : ''}
        confirmLabel={t('characters.delete')}
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

/** Charakterbögen der anderen Benutzer (nur lesen) – nur für Dungeon Master und Admin */
function OtherCharacters({ list }: { list: CharacterSummaryDto[] | null }) {
  const { t } = useTranslation();
  const error: unknown = null;
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('de');
    return (list ?? [])
      .filter((c) => !q || [c.name, c.classLevel, c.race, c.owner?.username].some((v) => v?.toLocaleLowerCase('de').includes(q)))
      .sort((a, b) => (a.owner?.username ?? '').localeCompare(b.owner?.username ?? '', 'de') || a.name.localeCompare(b.name, 'de'));
  }, [list, query]);

  return (
    <section className="mt-10" aria-labelledby="other-characters">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="other-characters" className="flex items-center gap-2 text-xl font-bold">
            <Users className="h-5 w-5 text-parchment-600" />
            {t('characters.others')}
          </h2>
          <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('characters.othersHint')}</p>
        </div>
        {list && list.length > 0 && (
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-600" />
            <input
              type="search"
              className="input !pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('characters.othersSearch')}
              aria-label={t('characters.othersSearch')}
            />
          </div>
        )}
      </div>
      {error ? (
        <Alert>{errorMessage(t, error)}</Alert>
      ) : !list ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <div className="parchment px-6 py-8 text-center italic">{list.length === 0 ? t('characters.othersEmpty') : t('search.noResults')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <CharacterCard key={c.id} c={c} to={`/characters/${c.id}`} />
          ))}
        </div>
      )}
    </section>
  );
}
