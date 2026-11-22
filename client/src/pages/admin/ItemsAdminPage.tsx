import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SourceSelect } from '../../components/sources/SourceFields';
import { Pencil, Plus, Save, Search, Trash2 } from 'lucide-react';
import type { ItemCharacterRef, ItemStoryDto, MagicItemDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { Alert, PageSpinner, Spinner } from '../../components/ui';
import { ItemCard } from '../../components/ItemCard';
import { MarkdownEditor } from '../../components/MarkdownEditor';

/**
 * Verwaltung → Magische Gegenstände (Admin, Moderator, alle Dungeon Master): eine Datenbank für alle Geschichten,
 * Besitzer werden je Geschichte vergeben (Charakterbögen der gewählten Geschichte, auch mehrere).
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
  const [onlyStory, setOnlyStory] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Geschichte, in der Besitzer vergeben werden (die Datenbank selbst gilt für alle Geschichten)
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

  const refreshCounts = () => {
    api
      .itemStories()
      .then((r) => setStories(r.stories))
      .catch(() => undefined);
  };

  const load = useCallback(() => {
    if (!stories) return;
    api
      .items(storyId && stories.some((s) => s.id === storyId) ? storyId : null)
      .then((r) => {
        setItems(r.items);
        setCharacters(r.characters);
      })
      .catch(setError);
  }, [storyId, stories]);
  useEffect(load, [load]);

  const needle = q.trim().toLocaleLowerCase('de');
  const shown = useMemo(
    () =>
      (items ?? []).filter(
        (i) =>
          (!onlyStory || !storyId || i.holders.some((h) => h.storyId === storyId)) &&
          (!needle || `${i.name}\n${i.description}\n${i.value}\n${i.holders.map((h) => `${h.name} ${h.owner}`).join(' ')}`.toLocaleLowerCase('de').includes(needle)),
      ),
    [items, needle, onlyStory, storyId],
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">{t('items.title')}</h2>
          <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('items.hint')}</p>
        </div>
        <button type="button" className="btn-primary shrink-0 whitespace-nowrap" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" />
          {t('items.new')}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {stories.length > 0 && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            {t('items.holderStory')}
            <select className="input !w-auto font-normal" value={storyId} onChange={(e) => setParams(e.target.value ? { story: e.target.value } : {})}>
              <option value="">{t('items.noHolderStory')}</option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.itemCount})
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-600" />
          <input type="search" className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('items.search')} aria-label={t('common.search')} />
        </div>
        {storyId && (
          <label className="chip-check">
            <input type="checkbox" checked={onlyStory} onChange={(e) => setOnlyStory(e.target.checked)} />
            {t('items.onlyThisStory')}
          </label>
        )}
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
                footer={
                  storyId ? (
                    <HolderAssign
                      item={i}
                      storyId={storyId}
                      storyName={stories.find((s) => s.id === storyId)?.name ?? ''}
                      characters={characters}
                      onSaved={(item) => (setItems((l) => l?.map((x) => (x.id === item.id ? item : x)) ?? null), refreshCounts())}
                    />
                  ) : (
                    <p className="text-sm italic text-parchment-700 dark:text-parchment-400">{t('items.chooseStoryForHolders')}</p>
                  )
                }
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
        storyId={storyId}
        storyName={stories.find((s) => s.id === storyId)?.name ?? ''}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          const data = { ...input, storyId: storyId || null, holderIds: storyId ? input.holderIds : [] };
          const r = editing && editing !== 'new' ? await api.updateItem(editing.id, data) : await api.createItem(data);
          setItems((l) => [...(l ?? []).filter((x) => x.id !== r.item.id), r.item].sort((a, b) => a.name.localeCompare(b.name, 'de')));
          refreshCounts();
          setEditing(null);
          toast.success(t('items.saved'));
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        title={t('items.deleteTitle')}
        message={t('items.deleteText', { name: toDelete?.name ?? '' })}
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

/** Besitzer direkt in der Detailansicht zuordnen (ohne den Bearbeiten-Dialog); jede Änderung wird sofort gespeichert */
function HolderAssign({
  item,
  storyId,
  storyName,
  characters,
  onSaved,
}: {
  item: MagicItemDto;
  storyId: string;
  storyName: string;
  characters: ItemCharacterRef[];
  onSaved: (item: MagicItemDto) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  // sofort anzeigen, bis die Antwort des Servers da ist
  const [pending, setPending] = useState<Set<string> | null>(null);
  const holders = pending ?? new Set(item.holders.filter((h) => h.storyId === storyId).map((h) => h.id));

  const toggle = async (id: string, on: boolean) => {
    const next = new Set(holders);
    if (on) next.add(id);
    else next.delete(id);
    setBusy(id);
    setPending(next);
    try {
      const r = await api.setItemHolders(item.id, storyId, [...next]);
      onSaved(r.item);
      toast.success(t('items.holdersSaved'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(null);
      setPending(null);
    }
  };

  return (
    <fieldset className="rounded-lg border border-parchment-400/60 p-3 dark:border-night-700">
      <legend className="label px-1">{t('items.holdersIn', { name: storyName })}</legend>
      {characters.length === 0 ? (
        <p className="text-sm italic">{t('items.noCharacters')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {characters.map((c) => (
            <label key={c.id} className="chip-check">
              <input
                type="checkbox"
                checked={holders.has(c.id)}
                disabled={busy !== null}
                onChange={(e) => toggle(c.id, e.target.checked)}
              />
              <span>
                <span className="font-semibold">{c.name}</span> <span className="text-xs opacity-70">({c.owner})</span>
              </span>
              {busy === c.id && <Spinner className="h-3.5 w-3.5" />}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function ItemDialog({
  open,
  item,
  characters,
  storyId,
  storyName,
  onClose,
  onSave,
}: {
  open: boolean;
  item: MagicItemDto | null;
  characters: ItemCharacterRef[];
  storyId: string;
  storyName: string;
  onClose: () => void;
  onSave: (input: { name: string; description: string; weight: number; value: string; attunement: boolean; sourceId: string | null; holderIds: string[] }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('');
  const [value, setValue] = useState('');
  const [attunement, setAttunement] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [holders, setHolders] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? '');
    setDescription(item?.description ?? '');
    setWeight(item?.weight ? String(item.weight).replace('.', ',') : '');
    setValue(item?.value ?? '');
    setAttunement(item?.attunement ?? false);
    setSourceId(item?.sourceId ?? null);
    setHolders(new Set(item?.holders.filter((h) => h.storyId === storyId).map((h) => h.id) ?? []));
  }, [open, item, storyId]);

  // Gewicht in lb, Komma oder Punkt; leer = 0
  const parsedWeight = weight.trim() === '' ? 0 : Number(weight.trim().replace(',', '.'));
  const weightInvalid = !Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 9999;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || weightInvalid) return;
    setBusy(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), weight: parsedWeight ?? 0, value: value.trim(), attunement, sourceId, holderIds: [...holders] });
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
        <div className="flex flex-wrap gap-4">
          <div className="max-w-[12rem]">
            <label htmlFor="item-weight" className="label">
              {t('items.weight')}
            </label>
            <div className="relative">
              <input
                id="item-weight"
                className={`input !pr-10 text-right ${weightInvalid ? 'input-error' : ''}`}
                inputMode="decimal"
                value={weight}
                maxLength={8}
                onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="0"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-parchment-700 dark:text-parchment-400">lb</span>
            </div>
          </div>
          <div className="max-w-[14rem]">
            <label htmlFor="item-value" className="label">
              {t('items.value')}
            </label>
            <input id="item-value" className="input" value={value} maxLength={40} onChange={(e) => setValue(e.target.value)} placeholder={t('items.valuePlaceholder')} />
          </div>
        </div>
        <div>
          <label className="chip-check font-semibold">
            <input id="item-attunement" type="checkbox" checked={attunement} onChange={(e) => setAttunement(e.target.checked)} />
            {t('items.requiresAttunement')}
          </label>
          <p className="mt-0.5 text-xs text-parchment-700 dark:text-parchment-400">{t('items.attunementHint')}</p>
        </div>
        <div className="sm:max-w-sm">
          <SourceSelect id="item-source" value={sourceId} onChange={setSourceId} />
        </div>
        <div>
          <label htmlFor="item-desc" className="label">
            {t('bestiary.description')}
          </label>
          <MarkdownEditor id="item-desc" value={description} onChange={(v) => setDescription(v.slice(0, 5000))} rows={8} />
        </div>
        {!storyId ? (
          <p className="text-sm italic text-parchment-700 dark:text-parchment-400">{t('items.chooseStoryForHolders')}</p>
        ) : (
          <fieldset>
            <legend className="label">{t('items.holdersIn', { name: storyName })}</legend>
            <p className="mb-2 text-xs text-parchment-700 dark:text-parchment-400">{t('items.holdersHint')}</p>
            {characters.length === 0 ? (
              <p className="text-sm italic">{t('items.noCharacters')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {characters.map((c) => (
                  <label key={c.id} className="chip-check">
                    <input
                      type="checkbox"
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
                      <span className="font-semibold">{c.name}</span> <span className="text-xs opacity-70">({c.owner})</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !name.trim() || weightInvalid}>
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
