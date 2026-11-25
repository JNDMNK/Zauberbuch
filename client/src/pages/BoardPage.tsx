import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Archive, MessagesSquare, NotebookPen, Plus, Search, Settings2, Trash, Users, X } from 'lucide-react';
import { BOARD_CATEGORIES, type BoardCategory, type BoardPostDto, type StoryDto } from '@zauberbuch/shared';
import { useLiveEvent } from '../hooks/useLiveEvents';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '../hooks/useDebounce';
import { refreshBoardUnread } from '../hooks/useBoardUnread';
import { Alert, PageSpinner, Spinner } from '../components/ui';
import { PostCard } from '../components/board/PostCard';
import { PostForm } from '../components/board/PostForm';
import { DmNotesPanel } from '../components/board/DmNotesPanel';

/** Sicherheitsnetz; neue Beiträge kommen normalerweise sofort per Live-Ereignis */
const REFRESH_MS = 120_000;
const LAST_STORY_KEY = 'zauberbuch.board.story';

function rememberStory(id: string) {
  try {
    localStorage.setItem(LAST_STORY_KEY, id);
  } catch {
    /* ohne Speicher geht es auch */
  }
}
function lastStory(): string | null {
  try {
    return localStorage.getItem(LAST_STORY_KEY);
  } catch {
    return null;
  }
}

export function BoardPage() {
  const { t } = useTranslation();
  const { storyId } = useParams();
  const navigate = useNavigate();
  const { isEditor, isAdmin, user } = useAuth();
  const [stories, setStories] = useState<StoryDto[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const loadStories = useCallback(
    () =>
      api
        .stories(showArchived)
        .then((r) => setStories(r.stories))
        .catch(setError),
    [showArchived],
  );

  useEffect(() => {
    void loadStories();
  }, [loadStories]);

  // Ohne Auswahl: Geschichten-Ansicht (aktive Geschichte), sonst zuletzt geöffnete oder erste Geschichte
  useEffect(() => {
    if (!stories || stories.length === 0) return;
    if (storyId && stories.some((s) => s.id === storyId)) return;
    const last = lastStory();
    const target = stories.find((s) => s.id === user?.activeStoryId) ?? stories.find((s) => s.id === last) ?? stories[0];
    navigate(`/board/${target.id}`, { replace: true });
  }, [stories, storyId, navigate, user?.activeStoryId]);

  const story = stories?.find((s) => s.id === storyId) ?? null;

  useEffect(() => {
    if (story) rememberStory(story.id);
  }, [story]);

  const clearUnread = useCallback((id: string) => setStories((list) => list?.map((s) => (s.id === id ? { ...s, unread: 0 } : s)) ?? null), []);

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!stories) return <PageSpinner />;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-3xl font-bold">{t('board.heading')}</h1>
        {isAdmin && (
          <Link to="/board/trash" className="btn-ghost">
            <Trash className="h-4 w-4" />
            {t('board.trash')}
          </Link>
        )}
        {isEditor && (
          <Link to="/admin/stories" className="btn-secondary">
            <Settings2 className="h-4 w-4" />
            {t('board.manageStories')}
          </Link>
        )}
      </div>

      {stories.length === 0 ? (
        <div className="parchment p-8 text-center">
          <p className="text-lg">{isEditor ? t('board.noStoriesEditor') : t('board.noStoriesUser')}</p>
          {isEditor && (
            <Link to="/admin/stories" className="btn-primary mt-4">
              <Plus className="h-4 w-4" />
              {t('board.newStory')}
            </Link>
          )}
          {showArchived || (
            <button type="button" className="mt-4 block w-full text-sm underline" onClick={() => setShowArchived(true)}>
              {t('board.showArchived')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label={t('board.stories')} className="flex flex-wrap gap-2">
              {stories.map((s) => (
                <Link
                  key={s.id}
                  to={`/board/${s.id}`}
                  aria-current={s.id === storyId ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-display text-sm font-semibold transition ${
                    s.id === storyId
                      ? 'border-parchment-800 bg-parchment-800 text-parchment-50 dark:border-parchment-300 dark:bg-parchment-300 dark:text-ink'
                      : 'border-parchment-500/70 hover:bg-parchment-200/80 dark:border-night-700 dark:hover:bg-night-700'
                  }`}
                >
                  {s.archived && <Archive className="h-3.5 w-3.5" aria-label={t('board.archived')} />}
                  {s.name}
                  {s.unread > 0 && s.id !== storyId && (
                    <span className="rounded-full bg-red-700 px-1.5 text-xs font-bold text-white" aria-label={t('board.unreadCount', { count: s.unread })}>
                      {s.unread}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
            <label className="chip-check ml-auto">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              {t('board.showArchived')}
            </label>
          </div>
          {story && <StoryBoard key={story.id} story={story} onRead={clearUnread} />}
        </>
      )}
    </div>
  );
}

function StoryBoard({ story, onRead }: { story: StoryDto; onRead: (id: string) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [posts, setPosts] = useState<BoardPostDto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q.trim(), 350);
  const [category, setCategory] = useState<BoardCategory | null>(null);
  const [writing, setWriting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const readOnly = story.archived;
  const isDm = story.myRole === 'dm';
  const [params_, setParams] = useSearchParams();
  const tab = isDm && params_.get('tab') === 'dm' ? 'dm' : 'posts';
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  const params = useCallback(
    (page: number) => {
      const p = new URLSearchParams({ page: String(page) });
      if (debouncedQ) p.set('q', debouncedQ);
      if (category) p.set('category', category);
      return p;
    },
    [debouncedQ, category],
  );

  /** Lädt die Seiten 1..n neu (für Filterwechsel und automatische Aktualisierung) */
  const reload = useCallback(
    async (n: number, signal?: AbortSignal) => {
      const results = await Promise.all(Array.from({ length: n }, (_, i) => api.boardPosts(story.id, params(i + 1), signal)));
      const seen = new Set<string>();
      const merged = results.flatMap((r) => r.posts).filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
      setPosts(merged);
      setTotal(results[0]?.total ?? 0);
      if (document.visibilityState === 'visible') {
        await api.markStoryRead(story.id).catch(() => undefined);
        onRead(story.id);
        refreshBoardUnread();
      }
    },
    [story.id, params, onRead],
  );

  // Filter geändert -> von vorn
  useEffect(() => {
    const ctrl = new AbortController();
    setPages(1);
    setPosts(null);
    reload(1, ctrl.signal).catch((err) => (err as Error).name !== 'AbortError' && setError(err));
    return () => ctrl.abort();
  }, [reload]);

  // Automatische Aktualisierung, solange der Tab sichtbar ist
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') reload(pagesRef.current).catch(() => undefined);
    };
    const id = window.setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [reload]);

  useLiveEvent((e) => e.type === 'board' && e.storyId === story.id, () => document.visibilityState === 'visible' && reload(pagesRef.current).catch(() => undefined));

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = pages + 1;
      const res = await api.boardPosts(story.id, params(next));
      setPosts((list) => {
        const ids = new Set(list?.map((p) => p.id));
        return [...(list ?? []), ...res.posts.filter((p) => !ids.has(p.id))];
      });
      setTotal(res.total);
      setPages(next);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = Boolean(debouncedQ || category);

  return (
    <div className="space-y-4">
      <section className="parchment p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-bold">{story.name}</h2>
            {story.description && <p className="mt-1 whitespace-pre-wrap">{story.description}</p>}
          </div>
          {story.archived && <span className="badge bg-parchment-200 text-parchment-900 dark:bg-night-700 dark:text-parchment-200">{t('board.archived')}</span>}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-parchment-700 dark:text-parchment-400">
          <Users className="h-4 w-4" />
          {story.members.length ? story.members.map((m) => (m.role === 'dm' ? `${m.username} (${t('storyRole.dmShort')})` : m.username)).join(', ') : t('board.noMembers')}
        </p>
        {story.archived && (
          <div className="mt-3">
            <Alert kind="info">{t('board.archivedHint')}</Alert>
          </div>
        )}
      </section>

      {isDm && (
        <nav className="flex gap-1 overflow-x-auto border-b border-parchment-400/60 dark:border-night-700" aria-label={t('board.heading')}>
          {(
            [
              ['posts', MessagesSquare, t('dmNotes.tabPosts')],
              ['dm', NotebookPen, t('dmNotes.tab')],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setParams(key === 'dm' ? { tab: 'dm' } : {}, { replace: true })}
              aria-pressed={tab === key}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 font-display text-sm font-semibold ${
                tab === key
                  ? 'border-parchment-800 text-ink dark:border-parchment-300 dark:text-parchment-50'
                  : 'border-transparent text-parchment-700 hover:text-ink dark:text-parchment-400 dark:hover:text-parchment-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      )}

      {tab === 'dm' ? (
        <DmNotesPanel storyId={story.id} readOnly={readOnly} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[14rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-700 dark:text-parchment-400" />
              <input type="search" className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('board.searchPlaceholder')} aria-label={t('common.search')} />
            </div>
            {!readOnly && !writing && (
              <button type="button" className="btn-primary" onClick={() => setWriting(true)}>
                <Plus className="h-4 w-4" />
                {t('board.newPost')}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('board.category')}>
            <CategoryChip active={category === null} onClick={() => setCategory(null)} label={t('common.any')} />
            {BOARD_CATEGORIES.map((c) => (
              <CategoryChip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)} label={t(`board.categories.${c}`)} />
            ))}
          </div>

          {writing && (
            <section className="parchment p-5">
              <h3 className="mb-3 font-display text-lg font-bold">{t('board.newPost')}</h3>
              <PostForm
                submitLabel={t('board.publish')}
                onCancel={() => setWriting(false)}
                onSubmit={async (input) => {
                  try {
                    await api.createPost(story.id, input);
                    setWriting(false);
                    toast.success(t('board.postCreated'));
                    await reload(pagesRef.current);
                  } catch (err) {
                    toast.error(errorMessage(t, err));
                  }
                }}
              />
            </section>
          )}

          {error ? (
            <Alert>{errorMessage(t, error)}</Alert>
          ) : !posts ? (
            <PageSpinner />
          ) : posts.length === 0 ? (
            <p className="parchment p-8 text-center text-parchment-700 dark:text-parchment-400">{filtered ? t('board.noResults') : t('board.empty')}</p>
          ) : (
            <>
              {filtered && (
                <p className="flex items-center gap-2 text-sm">
                  {t('board.resultCount', { count: total })}
                  <button type="button" className="inline-flex items-center gap-1 underline" onClick={() => (setQ(''), setCategory(null))}>
                    <X className="h-3.5 w-3.5" />
                    {t('board.resetFilter')}
                  </button>
                </p>
              )}
              <div className="space-y-4">
                {posts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    readOnly={readOnly}
                    canPin={story.myRole === 'dm'}
                    onChange={(np) => setPosts((list) => list?.map((x) => (x.id === np.id ? np : x)) ?? null)}
                    onRemove={(id) => {
                      setPosts((list) => list?.filter((x) => x.id !== id) ?? null);
                      setTotal((n) => n - 1);
                    }}
                  />
                ))}
              </div>
              {posts.length < total && (
                <div className="flex justify-center">
                  <button type="button" className="btn-secondary" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore && <Spinner className="h-4 w-4" />}
                    {t('board.loadMore', { count: total - posts.length })}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function CategoryChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm transition ${
        active
          ? 'border-parchment-800 bg-parchment-800 text-parchment-50 dark:border-parchment-300 dark:bg-parchment-300 dark:text-ink'
          : 'border-parchment-400/70 hover:bg-parchment-200/80 dark:border-night-700 dark:hover:bg-night-700'
      }`}
    >
      {label}
    </button>
  );
}
