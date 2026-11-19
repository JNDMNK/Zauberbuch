import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Save, Search, Trash2 } from 'lucide-react';
import type { ItemCharacterRef, ItemStoryDto, MagicItemDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { Alert, PageSpinner, Spinner } from '../../components/ui';
import { ItemCard } from '../../components/ItemCard';

/**
 * Verwaltung → Magische Gegenstände (Admin, Moderator, Dungeon Master der Geschichte):
 * Gegenstände je Geschichte anlegen und Charakterbögen (auch mehreren) zuweisen.
 */
export function ItemsAdminPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [stories, setStories] = useState<ItemStoryDto[] | null>(null);
  const [items, setItems] = useState<MagicItemDto[] | null>(null);
  const [characters, setCharacters] = useState<ItemCharacterRef[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<MagicItemDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<MagicItemDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const storyId = params.get('story') ?? '';

  useEffect(() => {
    api
      .itemStories()
      .then((r) => {
        setStories(r.stories);
        if (!storyId && r.stories[0]) setParams({ story: r.stories[0].id }, { replace: true });
      })
      .catch(setError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(() => {
    if (!storyId) return;
    setItems(null);
    api
      .storyItems(storyId)
      .then((r) => {
        setItems(r.items);
        setCharacters(r.characters);
      })
      .catch(setError);
  }, [storyId]);
  useEffect(load, [load]);

  const needle = q.trim().toLocaleLowerCase('de');
  const shown = useMemo(
    () => (items ?? []).filter((i) => !needle || `${i.name}\n${i.description}\n${i.holders.map((h) => `${h.name} ${h.owner}`).join(' ')}`.toLocaleLowerCase('de').includes(needle)),
    [items, needle],
  );

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.deleteItem(toDelete.id);
      setItems((l) => l?.filter((i) => i.id !== toDelete.id) ?? null);
      setToDelete(null);
      toast.success(t('items.deleted'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!stories) return <PageSpinner />;
  if (stories.length === 0) return <Alert kind="info">{t('items.noStories')}</Alert>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">{t('items.title')}</h2>
          <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('items.hint')}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setEditing('new')} disabled={!storyId}>
          <Plus className="h-4 w-4" />
          {t('items.new')}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input !w-auto" value={storyId} onChange={(e) => setParams({ story: e.target.value })} aria-label={t('combat.story')}>
          {stories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.itemCount})
            </option>
          ))}
        </select>
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-600" />
          <input type="search" className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('items.search')} aria-label={t('common.search')} />
        </div>
      </div>
      {!items ? (
        <PageSpinner />
      ) : shown.length === 0 ? (
        <div className="parchment px-6 py-12 text-center italic">{items.length === 0 ? t('items.empty') : t('search.noResults')}</div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((i) => (
            <li key={i.id}>
              <ItemCard
                item={i}
                actions={
                  <>
                    <button type="button" className="btn-icon" onClick={() => setEditing(i)} title={t('common.edit')} aria-label={`${t('common.edit')}: ${i.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="btn-icon text-red-700 dark:text-red-400" onClick={() => setToDelete(i)} title={t('common.delete')} aria-label={`${t('common.delete')}: ${i.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <ItemDialog
        open={editing !== null}
        item={editing === 'new' ? null : editing}
        characters={characters}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          const r = editing && editing !== 'new' ? await api.updateItem(editing.id, input) : await api.createItem(storyId, input);
          setItems((l) => [...(l ?? []).filter((x) => x.id !== r.item.id), r.item].sort((a, b) => a.name.localeCompare(b.name, 'de')));
          setStories((l) => l?.map((s) => (s.id === storyId && editing === 'new' ? { ...s, itemCount: s.itemCount + 1 } : s)) ?? null);
          setEditing(null);
          toast.success(t('items.saved'));
        }}
      />
      <ConfirmDialog open={!!toDelete} title={t('items.deleteTitle')} message={t('items.deleteText', { name: toDelete?.name ?? '' })} busy={busy} onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  );
}

function ItemDialog({
  open,
  item,
  characters,
  onClose,
  onSave,
}: {
  open: boolean;
  item: MagicItemDto | null;
  characters: ItemCharacterRef[];
  onClose: () => void;
  onSave: (input: { name: string; description: string; holderIds: string[] }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [holders, setHolders] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? '');
    setDescription(item?.description ?? '');
    setHolders(new Set(item?.holders.map((h) => h.id) ?? []));
  }, [open, item]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), holderIds: [...holders] });
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={item ? t('items.edit') : t('items.new')} onClose={onClose} size="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="item-name" className="label">
            {t('combat.monsterName')}
          </label>
          <input id="item-name" className="input" value={name} maxLength={100} required autoFocus onChange={(e) => setName(e.target.value)} placeholder={t('items.namePlaceholder')} />
        </div>
        <div>
          <label htmlFor="item-desc" className="label">
            {t('bestiary.description')}
          </label>
          <textarea id="item-desc" className="input min-h-[7rem]" rows={6} value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <fieldset>
          <legend className="label">{t('items.holders')}</legend>
          <p className="mb-2 text-xs text-parchment-700 dark:text-parchment-400">{t('items.holdersHint')}</p>
          {characters.length === 0 ? (
            <p className="text-sm italic">{t('items.noCharacters')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {characters.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-parchment-800 dark:accent-parchment-300"
                    checked={holders.has(c.id)}
                    onChange={(e) =>
                      setHolders((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(c.id);
                        else next.delete(c.id);
                        return next;
                      })
                    }
                  />
                  <span>
                    <span className="font-semibold">{c.name}</span> <span className="text-xs text-parchment-700 dark:text-parchment-400">({c.owner})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
