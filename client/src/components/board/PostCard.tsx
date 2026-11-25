import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Pencil, Pin, PinOff, Send, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { MAX_COMMENT_LENGTH, type BoardCommentDto, type BoardPostDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../ConfirmDialog';
import { Markdown } from '../Markdown';
import { Spinner } from '../ui';
import { PostForm } from './PostForm';
import { CATEGORY_CLS, formatDateTime } from './boardUtils';

const COLLAPSED_PX = 260;
const VISIBLE_COMMENTS = 3;

interface Props {
  post: BoardPostDto;
  readOnly: boolean;
  /** Dungeon Master der Geschichte: anheften und lösen */
  canPin: boolean;
  onChange: (post: BoardPostDto) => void;
  onRemove: (id: string) => void;
}

export function PostCard({ post, readOnly, canPin, onChange, onRemove }: Props) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const deletedName = t('board.deletedUser');

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el) setOverflowing(el.scrollHeight > COLLAPSED_PX + 40);
  }, [post.body, editing]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const togglePin = () =>
    run(async () => {
      const res = await api.pinPost(post.id, !post.pinned);
      onChange(res.post);
    });

  /** Gleicher Knopf erneut = Reaktion zurücknehmen */
  const react = (value: 1 | -1) =>
    run(async () => {
      const res = await api.reactPost(post.id, post.myReaction === value ? 0 : value);
      onChange(res.post);
    });

  const remove = () =>
    run(async () => {
      await api.deletePost(post.id);
      setConfirmDelete(false);
      onRemove(post.id);
      toast.success(t('board.postDeleted'));
    });

  const setComments = (comments: BoardCommentDto[]) => onChange({ ...post, comments });
  const hiddenComments = showAllComments ? 0 : Math.max(0, post.comments.length - VISIBLE_COMMENTS);
  const visibleComments = post.comments.slice(hiddenComments);

  return (
    <article className={`parchment p-4 sm:p-5 ${post.pinned ? 'ring-2 ring-parchment-600/60 dark:ring-parchment-400/50' : ''}`} aria-labelledby={`post-${post.id}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {post.pinned && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-parchment-800 dark:text-parchment-300">
                <Pin className="h-3.5 w-3.5" fill="currentColor" />
                {t('board.pinned')}
              </span>
            )}
            <span className={`badge ${CATEGORY_CLS[post.category]}`}>{t(`board.categories.${post.category}`)}</span>
          </div>
          {post.title && (
            <h3 id={`post-${post.id}`} className="break-words font-display text-lg font-bold">
              {post.title}
            </h3>
          )}
        </div>
        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            {canPin && (
              <button type="button" className="btn-icon" onClick={togglePin} disabled={busy} title={post.pinned ? t('board.unpin') : t('board.pin')} aria-label={post.pinned ? t('board.unpin') : t('board.pin')}>
                {post.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
            )}
            {post.canEdit && !readOnly && (
              <button type="button" className="btn-icon" onClick={() => setEditing(true)} title={t('common.edit')} aria-label={t('common.edit')}>
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {post.canEdit && (
              <button type="button" className="btn-icon text-red-700 dark:text-red-400" onClick={() => setConfirmDelete(true)} title={t('common.delete')} aria-label={t('common.delete')}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-3">
          <PostForm
            initial={post}
            submitLabel={t('common.save')}
            onCancel={() => setEditing(false)}
            onSubmit={async (input) => {
              try {
                const res = await api.updatePost(post.id, input);
                onChange(res.post);
                setEditing(false);
                toast.success(t('board.postSaved'));
              } catch (err) {
                toast.error(errorMessage(t, err));
              }
            }}
          />
        </div>
      ) : (
        <>
          <div
            ref={bodyRef}
            className={`relative mt-2 break-words ${!expanded && overflowing ? 'overflow-hidden' : ''}`}
            style={!expanded && overflowing ? { maxHeight: COLLAPSED_PX } : undefined}
          >
            <Markdown>{post.body}</Markdown>
            {!expanded && overflowing && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-parchment-50 dark:from-night-800" />}
          </div>
          {overflowing && (
            <button type="button" className="mt-1 text-sm font-semibold text-parchment-800 underline dark:text-parchment-300" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
              {expanded ? t('board.showLess') : t('board.showMore')}
            </button>
          )}
        </>
      )}

      <p className="mt-3 text-sm italic text-parchment-700 dark:text-parchment-400">
        — <span className="font-semibold not-italic">{post.author?.username ?? deletedName}</span> · <time dateTime={post.createdAt}>{formatDateTime(post.createdAt, i18n.language)}</time>
        {post.editedAt && (
          <>
            {' · '}
            {t('board.editedAt', { date: formatDateTime(post.editedAt, i18n.language) })}
            {post.editedBy && post.editedBy.id !== post.author?.id && <> {t('board.editedBy', { name: post.editedBy.username })}</>}
          </>
        )}
      </p>

      <div className="mt-2 flex items-center gap-2" role="group" aria-label={t('board.reactions')}>
        {([1, -1] as const).map((v) => {
          const names = v === 1 ? post.likedBy : post.dislikedBy;
          const mine = post.myReaction === v;
          const Icon = v === 1 ? ThumbsUp : ThumbsDown;
          const label = t(v === 1 ? 'board.like' : 'board.dislike');
          return (
            <button
              key={v}
              type="button"
              disabled={readOnly || busy}
              onClick={() => react(v)}
              aria-pressed={mine}
              aria-label={`${label} (${names.length})`}
              title={names.length ? `${label}: ${names.join(', ')}` : label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm tabular-nums transition disabled:cursor-default disabled:opacity-70 ${
                mine
                  ? v === 1
                    ? 'border-emerald-700 bg-emerald-100 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-200'
                    : 'border-red-700 bg-red-100 text-red-900 dark:border-red-500 dark:bg-red-950 dark:text-red-200'
                  : 'border-parchment-400 hover:border-parchment-700 dark:border-night-700 dark:hover:border-parchment-400'
              }`}
            >
              <Icon className="h-4 w-4" />
              {names.length}
            </button>
          );
        })}
      </div>

      <section className="mt-3 border-t border-parchment-300/70 pt-3 dark:border-night-700" aria-label={t('board.comments')}>
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-parchment-800 dark:text-parchment-300">
          <MessageSquare className="h-4 w-4" />
          {t('board.commentCount', { count: post.comments.length })}
        </h4>
        {hiddenComments > 0 && (
          <button type="button" className="mt-1 text-sm underline" onClick={() => setShowAllComments(true)}>
            {t('board.showAllComments', { count: post.comments.length })}
          </button>
        )}
        <ul className="mt-2 space-y-2">
          {visibleComments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              readOnly={readOnly}
              onChange={(nc) => setComments(post.comments.map((x) => (x.id === nc.id ? nc : x)))}
              onRemove={(id) => setComments(post.comments.filter((x) => x.id !== id))}
            />
          ))}
        </ul>
        {!readOnly && <CommentForm postId={post.id} onCreated={(c) => setComments([...post.comments, c])} />}
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title={t('board.deletePostTitle')}
        message={t('board.deletePostText')}
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </article>
  );
}

function CommentItem({ comment, readOnly, onChange, onRemove }: { comment: BoardCommentDto; readOnly: boolean; onChange: (c: BoardCommentDto) => void; onRemove: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.body);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await api.updateComment(comment.id, text);
      onChange(res.comment);
      setEditing(false);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteComment(comment.id);
      onRemove(comment.id);
    } catch (err) {
      toast.error(errorMessage(t, err));
      setBusy(false);
    }
  };

  return (
    <li className="rounded-lg bg-parchment-100/70 px-3 py-2 text-sm dark:bg-night-900/60">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-xs text-parchment-700 dark:text-parchment-400">
          <span className="font-semibold text-ink dark:text-parchment-100">{comment.author?.username ?? t('board.deletedUser')}</span> · {formatDateTime(comment.createdAt, i18n.language)}
          {comment.editedAt && <> · {t('board.edited')}</>}
        </p>
        {comment.canEdit && !editing && (
          <div className="-my-1 flex shrink-0 gap-0.5">
            {!readOnly && (
              <button type="button" className="btn-icon h-7 w-7" onClick={() => (setText(comment.body), setEditing(true))} title={t('common.edit')} aria-label={t('common.edit')}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" className="btn-icon h-7 w-7 text-red-700 dark:text-red-400" onClick={() => setConfirm(true)} title={t('common.delete')} aria-label={t('common.delete')}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} className="mt-1 space-y-2">
          <textarea className="input min-h-[4rem]" value={text} maxLength={MAX_COMMENT_LENGTH} onChange={(e) => setText(e.target.value)} aria-label={t('board.comment')} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary !py-1 text-sm" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary !py-1 text-sm" disabled={busy || !text.trim()}>
              {t('common.save')}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-0.5 whitespace-pre-wrap break-words">{comment.body}</p>
      )}
      <ConfirmDialog open={confirm} title={t('board.deleteCommentTitle')} message={t('board.deleteCommentText')} busy={busy} onConfirm={remove} onCancel={() => setConfirm(false)} />
    </li>
  );
}

function CommentForm({ postId, onCreated }: { postId: string; onCreated: (c: BoardCommentDto) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await api.createComment(postId, text);
      onCreated(res.comment);
      setText('');
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-2 flex items-end gap-2">
      <textarea
        className="input min-h-[2.5rem] flex-1 resize-y py-1.5 text-sm"
        rows={1}
        value={text}
        maxLength={MAX_COMMENT_LENGTH}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit(e);
        }}
        placeholder={t('board.commentPlaceholder')}
        aria-label={t('board.comment')}
      />
      <button type="submit" className="btn-secondary !px-3" disabled={busy || !text.trim()} title={t('board.sendComment')} aria-label={t('board.sendComment')}>
        {busy ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
      </button>
    </form>
  );
}
