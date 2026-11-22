import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDownAZ, ArrowUpAZ, BookHeart, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import type { SortField, SpellDto } from '@zauberbuch/shared';
import { api } from '../lib/api';
import { countActiveFilters, filtersToParams, parseFilters, type SpellFilters } from '../lib/filters';
import { errorMessage } from '../lib/errors';
import { asLocale } from '../lib/spellText';
import { useDebounce } from '../hooks/useDebounce';
import { useSpellSearch } from '../hooks/useSpellSearch';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useAuth } from '../context/AuthContext';
import { FilterPanel } from '../components/FilterPanel';
import { SpellCard } from '../components/SpellCard';
import { Alert, Spinner } from '../components/ui';
import { useActiveStory } from '../hooks/useActiveStory';
import { StorySourceBanner } from '../components/StorySourceBanner';

function SkeletonCard() {
  return (
    <div className="parchment h-56 animate-pulse p-4" aria-hidden>
      <div className="h-5 w-2/3 rounded bg-parchment-300/70 dark:bg-night-700" />
      <div className="mt-2 h-4 w-1/2 rounded bg-parchment-200 dark:bg-night-700/70" />
      <div className="mt-6 space-y-2">
        <div className="h-3 w-3/4 rounded bg-parchment-200 dark:bg-night-700/70" />
        <div className="h-3 w-2/3 rounded bg-parchment-200 dark:bg-night-700/70" />
        <div className="h-3 w-1/2 rounded bg-parchment-200 dark:bg-night-700/70" />
      </div>
    </div>
  );
}

interface SpellsPageProps {
  /** Eigenes Zauberbuch („Mein Zauberbuch“) */
  favoritesPage?: boolean;
  /** Zauberbuch eines anderen Benutzers (Admin/Dungeon Master) */
  owner?: { id: string; username: string };
  /** Zusätzliche Elemente über der Überschrift (z. B. Zurück-Link) */
  header?: React.ReactNode;
}

export function SpellsPage({ favoritesPage = false, owner, header }: SpellsPageProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [sources, setSources] = useState<string[]>([]);
  const [mobileFilters, setMobileFilters] = useState(false);

  // Suchfeld: lokal, debounced in die URL übernehmen
  const [query, setQuery] = useState(filters.q);
  const debouncedQuery = useDebounce(query, 300);
  const lastPushedQuery = useRef(filters.q);

  const update = useCallback((next: SpellFilters, replace = false) => setSearchParams(filtersToParams(next), { replace, preventScrollReset: true }), [setSearchParams]);

  useEffect(() => {
    // Externe Änderung (Zurück-Button, Link) -> Eingabefeld synchronisieren
    if (filters.q !== lastPushedQuery.current) {
      lastPushedQuery.current = filters.q;
      setQuery(filters.q);
    }
  }, [filters.q]);

  useEffect(() => {
    if (debouncedQuery.trim() !== filters.q.trim()) {
      lastPushedQuery.current = debouncedQuery.trim();
      update({ ...filters, q: debouncedQuery }, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  useEffect(() => {
    api
      .sources()
      .then((r) => setSources(r.sources))
      .catch(() => setSources([]));
  }, []);

  const lang = asLocale(i18n.language);
  // Geschichten-Ansicht: nur Zauber aus den Quellen der aktiven Geschichte (nicht beim Zauberbuch eines anderen)
  const activeStory = useActiveStory();
  const storyId = !owner && activeStory.restricted ? activeStory.story?.id : undefined;
  const search = useSpellSearch(filters, { lang, favoritesOnly: favoritesPage, ownerId: owner?.id, storyId, enabled: !(filters.favorites && !user) && !activeStory.loading });
  const sentinelRef = useInfiniteScroll(search.loadMore, search.hasMore && !search.loading && !search.error, search.items.length);

  const onFavoriteChange = useCallback(
    (spell: SpellDto, isFav: boolean) => {
      if (!isFav && !owner && (favoritesPage || filters.favorites)) search.removeItem(spell.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [favoritesPage, owner, filters.favorites, search.removeItem],
  );

  // Innerhalb der Verwaltung (Zauberbuch eines Benutzers) gibt es bereits eine h1
  const Heading = owner ? 'h2' : 'h1';
  const activeCount = countActiveFilters(filters, { ignoreFavorites: favoritesPage });
  const firstLoad = search.loading && search.items.length === 0;

  const panel = <FilterPanel filters={filters} onChange={(f) => update(f)} sources={sources} showFavoritesToggle={Boolean(user) && !owner} favoritesPage={favoritesPage || Boolean(owner)} />;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-1">
        {header}
        <Heading className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          {favoritesPage || owner ? <BookHeart className="h-7 w-7 text-red-700 dark:text-red-400" /> : <Sparkles className="h-7 w-7 text-parchment-600" />}
          {owner ? t('admin.spellbookOf', { name: owner.username }) : favoritesPage ? t('nav.favorites') : t('nav.spells')}
        </Heading>
        {!owner && <StorySourceBanner what={t('storySources.spells')} />}
      </div>

      <div className="flex gap-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="parchment sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4">{panel}</div>
        </aside>

        <section className="min-w-0 flex-1" aria-label={t('common.search')}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-parchment-600" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={filters.nameOnly ? t('search.placeholderName') : t('search.placeholder')}
                  aria-label={filters.nameOnly ? t('search.placeholderName') : t('search.placeholder')}
                  className="input h-12 !pl-10 !pr-10 text-lg"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-parchment-600 hover:bg-parchment-200 dark:hover:bg-night-700"
                    aria-label={t('common.close')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <label className="chip-check mt-2">
                <input type="checkbox" checked={filters.nameOnly} onChange={(e) => update({ ...filters, q: query, nameOnly: e.target.checked }, true)} />
                {t('search.nameOnly')}
              </label>
            </div>
            {/* gleiche Höhe wie das Suchfeld, oben bündig */}
            <div className="flex h-12 items-stretch gap-2">
              <button type="button" className="btn-secondary lg:hidden" onClick={() => setMobileFilters(true)}>
                <SlidersHorizontal className="h-4 w-4" />
                {t('filter.title')}
                {activeCount > 0 && <span className="rounded-full bg-parchment-800 px-1.5 text-xs text-parchment-50 dark:bg-parchment-300 dark:text-ink">{activeCount}</span>}
              </button>
              <label className="sr-only" htmlFor="sort">
                {t('filter.sort')}
              </label>
              <select id="sort" className="input !h-full !w-auto" value={filters.sort} onChange={(e) => update({ ...filters, sort: e.target.value as SortField })}>
                <option value="name">{t('filter.sortName')}</option>
                <option value="level">{t('filter.sortLevel')}</option>
                <option value="school">{t('filter.sortSchool')}</option>
              </select>
              <button
                type="button"
                className="btn-secondary !px-3"
                onClick={() => update({ ...filters, order: filters.order === 'asc' ? 'desc' : 'asc' })}
                title={filters.order === 'asc' ? t('filter.asc') : t('filter.desc')}
                aria-label={filters.order === 'asc' ? t('filter.asc') : t('filter.desc')}
              >
                {filters.order === 'asc' ? <ArrowDownAZ className="h-5 w-5" /> : <ArrowUpAZ className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between text-sm text-parchment-800 dark:text-parchment-300">
            <span aria-live="polite">{!firstLoad && t('search.results', { count: search.total })}</span>
            {search.loading && !firstLoad && <Spinner className="h-4 w-4" />}
          </div>

          {search.error && search.items.length === 0 ? (
            <Alert>
              {errorMessage(t, search.error)}{' '}
              <button type="button" className="underline" onClick={search.retry}>
                {t('common.retry')}
              </button>
            </Alert>
          ) : firstLoad ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : search.items.length === 0 ? (
            <div className="parchment px-6 py-16 text-center">
              <p className="font-display text-xl font-bold">
                {owner && !filters.q && activeCount === 0 ? t('search.emptySpellbook') : favoritesPage && !filters.q && activeCount === 0 ? t('search.noFavorites') : t('search.noResults')}
              </p>
              <p className="mt-2 text-parchment-700 dark:text-parchment-400">
                {owner && !filters.q && activeCount === 0 ? '' : favoritesPage && !filters.q && activeCount === 0 ? t('search.noFavoritesHint') : t('search.noResultsHint')}
              </p>
            </div>
          ) : (
            <>
              <div className={`grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 ${search.loading && search.page <= 1 ? 'opacity-60' : ''}`}>
                {search.items.map((spell) => (
                  <SpellCard key={spell.id} spell={spell} onFavoriteChange={onFavoriteChange} />
                ))}
              </div>
              <div ref={sentinelRef} className="flex h-20 items-center justify-center">
                {search.error ? (
                  <button type="button" className="btn-secondary" onClick={search.retry}>
                    {t('common.retry')}
                  </button>
                ) : search.hasMore ? (
                  <button type="button" className="btn-ghost" onClick={search.loadMore} disabled={search.loading}>
                    {search.loading ? <Spinner /> : t('search.loadMore')}
                  </button>
                ) : (
                  search.total > search.pageSize && <p className="text-sm italic text-parchment-700 dark:text-parchment-500">{t('search.end')}</p>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {mobileFilters && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label={t('filter.title')}>
          <div className="flex-1 bg-black/50" onClick={() => setMobileFilters(false)} />
          <div className="parchment !rounded-none h-full w-[min(22rem,90vw)] overflow-y-auto p-4">
            <div className="mb-2 flex justify-end">
              <button type="button" className="btn-icon" onClick={() => setMobileFilters(false)} aria-label={t('common.close')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {panel}
            <button type="button" className="btn-primary mt-6 w-full" onClick={() => setMobileFilters(false)}>
              {t('search.results', { count: search.total })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
