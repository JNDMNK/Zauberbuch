import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Footprints, GraduationCap, Heart, Pencil, Plus, Search, Shield, Trash2, Users2 } from 'lucide-react';
import { WIKI_KINDS, type WikiEntryDto, type WikiKind } from '@zauberbuch/shared';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Alert, PageSpinner } from '../components/ui';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { WikiDetail } from '../components/wiki/WikiDetail';
import { WikiForm } from '../components/wiki/WikiForm';

const KIND_ICON: Record<WikiKind, typeof Users2> = { race: Users2, class: GraduationCap };
const KIND_ACCENT: Record<WikiKind, string> = { race: '!border-t-emerald-600 dark:!border-t-emerald-400', class: '!border-t-sky-600 dark:!border-t-sky-400' };

/**
 * Wiki (für alle angemeldeten Benutzer): Rubriken Völker und Klassen in Kartenansicht, Klick öffnet den Eintrag.
 * Admin und Moderator legen Einträge an, bearbeiten und löschen sie.
 */
export function WikiPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isEditor } = useAuth();
  const [params, setParams] = useSearchParams();
  const kind: WikiKind = params.get('tab') === 'class' ? 'class' : 'race';
  const [entries, setEntries] = useState<WikiEntryDto[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<WikiEntryDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<WikiEntryDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const openId = params.get('entry');

  const load = useCallback(() => {
    api
      .wiki()
      .then((r) => setEntries(r.entries))
      .catch(setError);
  }, []);
  useEffect(load, [load]);

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  const needle = q.trim().toLocaleLowerCase('de');
  const counts = useMemo(() => Object.fromEntries(WIKI_KINDS.map((k) => [k, (entries ?? []).filter((e) => e.kind === k).length])) as Record<WikiKind, number>, [entries]);
  const shown = useMemo(
    () => (entries ?? []).filter((e) => e.kind === kind && (!needle || `${e.name}\n${e.summary}\n${e.description}\n${JSON.stringify(e.data)}`.toLocaleLowerCase('de').includes(needle))),
    [entries, kind, needle],
  );
  const opened = entries?.find((e) => e.id === openId) ?? null;

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.deleteWiki(toDelete.id);
      setEntries((l) => l?.filter((e) => e.id !== toDelete.id) ?? null);
      setToDelete(null);
      toast.success(t('wiki.deleted'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const facts = (e: WikiEntryDto) =>
    e.kind === 'race'
      ? [
          { Icon: Shield, label: t('wiki.race.abilityIncreaseShort'), value: e.data.abilityIncrease },
          { Icon: Footprints, label: t('wiki.race.speed'), value: e.data.speed.split(';')[0] },
        ]
      : [
          { Icon: Heart, label: t('wiki.class.hitDie'), value: e.data.hitDie ? `1${e.data.hitDie.replace('d', 'W')}` : '' },
          { Icon: Shield, label: t('wiki.class.primaryAbility'), value: e.data.primaryAbility },
        ];

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!entries) return <PageSpinner />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">{t('wiki.title')}</h1>
        <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('wiki.hint')}</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-parchment-400/60 dark:border-night-700" aria-label={t('wiki.title')}>
        {WIKI_KINDS.map((k) => {
          const Icon = KIND_ICON[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => setParam({ tab: k === 'race' ? null : k, entry: null })}
              aria-pressed={kind === k}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 font-display text-sm font-semibold ${
                kind === k ? 'border-parchment-800 text-ink dark:border-parchment-300 dark:text-parchment-50' : 'border-transparent text-parchment-700 hover:text-ink dark:text-parchment-400 dark:hover:text-parchment-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(`wiki.kinds.${k}`)} ({counts[k]})
            </button>
          );
        })}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-700 dark:text-parchment-400" />
          <input type="search" className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('wiki.search')} aria-label={t('common.search')} />
        </div>
        {isEditor && (
          <button type="button" className="btn-primary shrink-0" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            {t(`wiki.new.${kind}`)}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="parchment px-6 py-12 text-center italic">{needle ? t('search.noResults') : t('wiki.empty')}</div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((e) => {
            const Icon = KIND_ICON[e.kind];
            const sub = e.kind === 'race' ? e.data.subraces.map((s) => s.name) : e.data.subclasses.map((s) => s.name);
            return (
              <li key={e.id}>
                <article className={`parchment relative flex h-full flex-col gap-2 border-t-4 p-4 transition hover:-translate-y-0.5 hover:shadow-cardhover ${KIND_ACCENT[e.kind]}`}>
                  <div className="flex items-start gap-2">
                    <Icon className="mt-1 h-5 w-5 shrink-0 text-parchment-700 dark:text-parchment-300" aria-hidden />
                    <h2 className="min-w-0 flex-1 break-words font-display text-xl font-bold leading-tight">
                      <button type="button" onClick={() => setParam({ entry: e.id })} className="text-left outline-none after:absolute after:inset-0 after:z-[5] after:content-[''] focus-visible:underline" aria-haspopup="dialog">
                        {e.name}
                      </button>
                    </h2>
                    {isEditor && (
                      <div className="relative z-10 flex shrink-0 gap-1">
                        <button type="button" className="btn-icon" onClick={() => setEditing(e)} title={t('common.edit')} aria-label={`${t('common.edit')}: ${e.name}`}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" className="btn-icon text-red-700 dark:text-red-400" onClick={() => setToDelete(e)} title={t('common.delete')} aria-label={`${t('common.delete')}: ${e.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {e.summary && <p className="line-clamp-3 text-sm italic">{e.summary}</p>}
                  <dl className="mt-auto space-y-1 pt-1 text-sm">
                    {facts(e)
                      .filter((f) => f.value)
                      .map(({ Icon: FIcon, label, value }) => (
                        <div key={label} className="flex items-start gap-1.5">
                          <FIcon className="mt-0.5 h-4 w-4 shrink-0 text-parchment-700 dark:text-parchment-400" aria-hidden />
                          <dt className="sheet-label !inline shrink-0">{label}:</dt>
                          <dd className="min-w-0">{value}</dd>
                        </div>
                      ))}
                  </dl>
                  {sub.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {sub.map((s) => (
                        <span key={s} className="badge bg-parchment-200 text-parchment-900 dark:bg-night-700 dark:text-parchment-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!opened} title={opened?.name ?? ''} onClose={() => setParam({ entry: null })} size="max-w-3xl">
        {opened && (
          <div className="space-y-3">
            {isEditor && (
              <div className="flex justify-end">
                <button type="button" className="btn-secondary" onClick={() => (setEditing(opened), setParam({ entry: null }))}>
                  <Pencil className="h-4 w-4" />
                  {t('common.edit')}
                </button>
              </div>
            )}
            <WikiDetail entry={opened} />
          </div>
        )}
      </Modal>
      <WikiForm
        open={editing !== null}
        kind={kind}
        entry={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          const r = editing && editing !== 'new' ? await api.updateWiki(editing.id, input) : await api.createWiki(input);
          setEntries((l) => [...(l ?? []).filter((x) => x.id !== r.entry.id), r.entry].sort((a, b) => a.name.localeCompare(b.name, 'de')));
          setEditing(null);
          toast.success(t('wiki.saved'));
        }}
      />
      <ConfirmDialog open={!!toDelete} title={t('wiki.deleteTitle')} message={t('wiki.deleteText', { name: toDelete?.name ?? '' })} busy={busy} danger onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  );
}
