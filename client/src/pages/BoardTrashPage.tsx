import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import { BOARD_RESTORE_DAYS, type DeletedBoardPostDto, type StoryDto } from '@zauberbuch/shared';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useToast } from '../context/ToastContext';
import { Alert, PageSpinner } from '../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Markdown } from '../components/Markdown';
import { CATEGORY_CLS, formatDateTime } from '../components/board/boardUtils';

/** Papierkorb der Infotafel (nur Admin): gelöschte Beiträge 90 Tage lang wiederherstellen */
export function BoardTrashPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [posts, setPosts] = useState<DeletedBoardPostDto[] | null>(null);
  const [stories, setStories] = useState<StoryDto[]>([]);
  const [storyId, setStoryId] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [toPurge, setToPurge] = useState<DeletedBoardPostDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .deletedPosts(storyId || undefined)
      .then((r) => setPosts(r.posts))
      .catch(setError);
  }, [storyId]);

  useEffect(load, [load]);
  useEffect(() => {
    api
      .stories(true)
      .then((r) => setStories(r.stories))
      .catch(() => undefined);
  }, []);

  const restore = async (p: DeletedBoardPostDto) => {
    try {
      await api.restorePost(p.id);
      setPosts((list) => list?.filter((x) => x.id !== p.id) ?? null);
      toast.success(t('board.restored'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  const purge = async () => {
    if (!toPurge) return;
    setBusy(true);
    try {
      await api.purgePost(toPurge.id);
      setPosts((list) => list?.filter((x) => x.id !== toPurge.id) ?? null);
      setToPurge(null);
      toast.success(t('board.purged'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/board" className="btn-ghost !px-2">
        <ArrowLeft className="h-4 w-4" />
        {t('board.backToBoard')}
      </Link>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{t('board.trash')}</h1>
          <p className="mt-1 text-sm text-parchment-700 dark:text-parchment-400">{t('board.trashHint', { days: BOARD_RESTORE_DAYS })}</p>
        </div>
        <select className="input !w-auto" value={storyId} onChange={(e) => setStoryId(e.target.value)} aria-label={t('board.stories')}>
          <option value="">{t('board.allStories')}</option>
          {stories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <Alert>{errorMessage(t, error)}</Alert>
      ) : !posts ? (
        <PageSpinner />
      ) : posts.length === 0 ? (
        <p className="parchment p-8 text-center text-parchment-700 dark:text-parchment-400">{t('board.trashEmpty')}</p>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <article key={p.id} className="parchment p-4 sm:p-5">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="badge bg-parchment-200 text-parchment-900 dark:bg-night-700 dark:text-parchment-200">{p.storyName}</span>
                    <span className={`badge ${CATEGORY_CLS[p.category]}`}>{t(`board.categories.${p.category}`)}</span>
                  </div>
                  {p.title && <h2 className="break-words font-display text-lg font-bold">{p.title}</h2>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="btn-secondary" onClick={() => restore(p)}>
                    <RotateCcw className="h-4 w-4" />
                    {t('board.restore')}
                  </button>
                  <button type="button" className="btn-icon text-red-700 dark:text-red-400" onClick={() => setToPurge(p)} title={t('board.purge')} aria-label={t('board.purge')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2 max-h-40 overflow-hidden break-words opacity-80">
                <Markdown>{p.body}</Markdown>
              </div>
              <p className="mt-3 text-sm italic text-parchment-700 dark:text-parchment-400">
                — {p.author?.username ?? t('board.deletedUser')} · {formatDateTime(p.createdAt, i18n.language)}
                {p.comments.length > 0 && <> · {t('board.commentCount', { count: p.comments.length })}</>}
              </p>
              <p className="mt-1 text-sm text-red-800 dark:text-red-300">
                {t('board.deletedInfo', {
                  name: p.deletedBy?.username ?? t('board.deletedUser'),
                  date: formatDateTime(p.deletedAt, i18n.language),
                  purge: new Date(p.purgeAt).toLocaleDateString(i18n.language),
                })}
              </p>
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog open={!!toPurge} title={t('board.purgeTitle')} message={t('board.purgeText')} busy={busy} onConfirm={purge} onCancel={() => setToPurge(null)} />
    </div>
  );
}
