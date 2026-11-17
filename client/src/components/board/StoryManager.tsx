import { useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, ArchiveRestore, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { isEditorRole, type Role, type StoryDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../ConfirmDialog';
import { Spinner } from '../ui';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nach jeder Änderung; created = neu angelegte Geschichte */
  onChanged: (created?: StoryDto) => void;
}

type BoardUser = { id: string; username: string; role: Role };

/** Geschichten anlegen, bearbeiten, Mitspieler zuordnen, archivieren (Admin/DM), löschen (Admin) */
export function StoryManager({ open, onClose, onChanged }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const titleId = useId();
  const [stories, setStories] = useState<StoryDto[] | null>(null);
  const [users, setUsers] = useState<BoardUser[]>([]);
  const [editing, setEditing] = useState<StoryDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<StoryDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([api.stories(true), api.boardUsers()])
      .then(([s, u]) => {
        setStories(s.stories);
        setUsers(u.users);
      })
      .catch((err) => toast.error(errorMessage(t, err)));

  useEffect(() => {
    if (!open) return;
    setEditing(null);
    void load();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const toggleArchive = async (s: StoryDto) => {
    try {
      await api.updateStory(s.id, { archived: !s.archived });
      toast.success(s.archived ? t('board.storyUnarchived') : t('board.storyArchived'));
      await load();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.deleteStory(toDelete.id);
      toast.success(t('board.storyDeleted'));
      setToDelete(null);
      await load();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="parchment relative my-auto w-full max-w-3xl">
        <div className="sticky top-0 z-10 flex items-center gap-2 rounded-t-xl border-b border-parchment-400/60 bg-parchment-50/95 px-5 py-3 dark:border-night-700 dark:bg-night-800/95">
          <h2 id={titleId} className="flex-1 font-display text-xl font-bold">
            {t('board.manageStories')}
          </h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {editing ? (
            <StoryForm
              story={editing === 'new' ? null : editing}
              users={users}
              onCancel={() => setEditing(null)}
              onSaved={async (s, created) => {
                setEditing(null);
                await load();
                onChanged(created ? s : undefined);
              }}
            />
          ) : (
            <>
              <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
                <Plus className="h-4 w-4" />
                {t('board.newStory')}
              </button>
              {!stories ? (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              ) : stories.length === 0 ? (
                <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('board.noStoriesYet')}</p>
              ) : (
                <ul className="divide-y divide-parchment-300/70 dark:divide-night-700">
                  {stories.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {s.name} {s.archived && <span className="badge ml-1 bg-parchment-200 text-parchment-900 dark:bg-night-700 dark:text-parchment-200">{t('board.archived')}</span>}
                        </p>
                        <p className="text-xs text-parchment-700 dark:text-parchment-400">
                          {t('board.postCount', { count: s.postCount })} · {s.members.length ? s.members.map((m) => m.username).join(', ') : t('board.noMembers')}
                        </p>
                      </div>
                      <button type="button" className="btn-icon" onClick={() => setEditing(s)} title={t('common.edit')} aria-label={`${t('common.edit')}: ${s.name}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" className="btn-icon" onClick={() => toggleArchive(s)} title={s.archived ? t('board.unarchive') : t('board.archive')} aria-label={`${s.archived ? t('board.unarchive') : t('board.archive')}: ${s.name}`}>
                        {s.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </button>
                      {isAdmin && (
                        <button type="button" className="btn-icon text-red-700 dark:text-red-400" onClick={() => setToDelete(s)} title={t('common.delete')} aria-label={`${t('common.delete')}: ${s.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!toDelete}
        title={t('board.deleteStoryTitle')}
        message={t('board.deleteStoryText', { name: toDelete?.name ?? '', count: toDelete?.postCount ?? 0 })}
        busy={busy}
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function StoryForm({ story, users, onCancel, onSaved }: { story: StoryDto | null; users: BoardUser[]; onCancel: () => void; onSaved: (s: StoryDto, created: boolean) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const [name, setName] = useState(story?.name ?? '');
  const [description, setDescription] = useState(story?.description ?? '');
  const [members, setMembers] = useState<Set<string>>(new Set(story?.members.map((m) => m.id) ?? []));
  const [busy, setBusy] = useState(false);

  const toggle = (uid: string) =>
    setMembers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const input = { name: name.trim(), description: description.trim(), memberIds: [...members] };
      const res = story ? await api.updateStory(story.id, input) : await api.createStory(input);
      toast.success(story ? t('board.storySaved') : t('board.storyCreated'));
      onSaved(res.story, !story);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const players = users.filter((u) => !isEditorRole(u.role));
  const editors = users.filter((u) => isEditorRole(u.role));

  return (
    <form onSubmit={submit} className="space-y-4">
      <h3 className="font-display text-lg font-bold">{story ? t('board.editStory') : t('board.newStory')}</h3>
      <div>
        <label htmlFor={`${id}-name`} className="label">
          {t('board.storyName')}
        </label>
        <input id={`${id}-name`} className="input" value={name} maxLength={100} required onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${id}-desc`} className="label">
          {t('board.storyDescription')}
        </label>
        <textarea id={`${id}-desc`} className="input min-h-[4rem]" value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <fieldset>
        <legend className="label">{t('board.members')}</legend>
        <p className="mb-2 text-xs text-parchment-700 dark:text-parchment-400">{t('board.membersHint')}</p>
        {players.length === 0 ? (
          <p className="text-sm">{t('board.noPlayers')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {players.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-parchment-800 dark:accent-parchment-300" checked={members.has(u.id)} onChange={() => toggle(u.id)} />
                {u.username}
              </label>
            ))}
          </div>
        )}
        {editors.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-parchment-700 dark:text-parchment-400">{t('board.editorsHint')}</p>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {editors.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-parchment-800 dark:accent-parchment-300" checked={members.has(u.id)} onChange={() => toggle(u.id)} />
                  {u.username} <span className="text-xs text-parchment-700 dark:text-parchment-400">({t(`role.${u.role}`)})</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
          {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {story ? t('common.save') : t('board.createStory')}
        </button>
      </div>
    </form>
  );
}
