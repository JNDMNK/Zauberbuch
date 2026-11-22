import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Archive, ArchiveRestore, BookOpen, Coins, Gem, MessagesSquare, Pencil, Plus, RotateCcw, Save, Search, Swords, Trash2, X } from 'lucide-react';
import { DEFAULT_LANGUAGES, DEFAULT_LIFESTYLES, DEFAULT_TOOLS, type Lifestyle, type Role, type StoryDto, type StoryRole } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CatalogManager } from '../../components/catalog/CatalogManager';
import { Alert, PageSpinner, Spinner } from '../../components/ui';

type StoryUser = { id: string; username: string; role: Role };

/**
 * Verwaltung → Geschichten (Admin und Moderatoren): Geschichten anlegen, bearbeiten, archivieren und Mitglieder mit
 * ihrer Rolle (Spieler / Dungeon Master) eintragen. Diese Rollen bestimmen die Ansicht in Infotafel und Kampf.
 */
export function StoriesAdminPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [stories, setStories] = useState<StoryDto[] | null>(null);
  const [users, setUsers] = useState<StoryUser[]>([]);
  const [editing, setEditing] = useState<StoryDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<StoryDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    () =>
      Promise.all([api.manageStories(), api.storyUsers()])
        .then(([s, u]) => {
          setStories(s.stories);
          setUsers(u.users);
        })
        .catch(setError),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const toggleArchive = async (s: StoryDto) => {
    try {
      await api.updateStory(s.id, { archived: !s.archived });
      toast.success(s.archived ? t('board.storyUnarchived') : t('board.storyArchived'));
      await load();
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
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!stories) return <PageSpinner />;

  if (editing) {
    return (
      <StoryForm
        story={editing === 'new' ? null : editing}
        users={users}
        onCancel={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">{t('stories.title')}</h2>
          <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('stories.hint')}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" />
          {t('board.newStory')}
        </button>
      </div>
      {stories.length === 0 ? (
        <div className="parchment px-6 py-12 text-center italic">{t('board.noStoriesYet')}</div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {stories.map((s) => {
            const dms = s.members.filter((m) => m.role === 'dm');
            const players = s.members.filter((m) => m.role !== 'dm');
            return (
              <li key={s.id} className="parchment flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-start gap-2">
                  <BookOpen className="mt-1 h-5 w-5 shrink-0 text-parchment-700 dark:text-parchment-400" />
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-display text-lg font-bold">
                      {s.name} {s.archived && <span className="badge ml-1 bg-parchment-200 text-parchment-900 dark:bg-night-700 dark:text-parchment-200">{t('board.archived')}</span>}
                    </h3>
                    {s.description && <p className="line-clamp-2 text-sm">{s.description}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className="btn-icon" onClick={() => setEditing(s)} title={t('stories.edit')} aria-label={`${t('stories.edit')}: ${s.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => toggleArchive(s)}
                      title={s.archived ? t('board.unarchive') : t('board.archive')}
                      aria-label={`${s.archived ? t('board.unarchive') : t('board.archive')}: ${s.name}`}
                    >
                      {s.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn-icon text-red-700 dark:text-red-400"
                        onClick={() => setToDelete(s)}
                        title={t('common.delete')}
                        aria-label={`${t('common.delete')}: ${s.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm">
                  <span className="font-semibold">{t('storyRole.dmPlural')}:</span> {dms.length ? dms.map((m) => m.username).join(', ') : '—'}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">{t('storyRole.playerPlural')}:</span> {players.length ? players.map((m) => m.username).join(', ') : '—'}
                </p>
                <div className="mt-auto flex flex-wrap gap-3 border-t border-parchment-300/70 pt-2 text-sm dark:border-night-700">
                  <Link to={`/board/${s.id}`} className="inline-flex items-center gap-1 underline">
                    <MessagesSquare className="h-4 w-4" />
                    {t('nav.board')} ({t('board.postCount', { count: s.postCount })})
                  </Link>
                  <Link to="/combat" className="inline-flex items-center gap-1 underline">
                    <Swords className="h-4 w-4" />
                    {t('nav.combat')}
                  </Link>
                  <Link to={`/admin/items?story=${s.id}`} className="inline-flex items-center gap-1 underline">
                    <Gem className="h-4 w-4" />
                    {t('admin.items')}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={!!toDelete}
        title={t('board.deleteStoryTitle')}
        message={t('stories.deleteText', {
          name: toDelete?.name ?? '',
          count: toDelete?.postCount ?? 0,
        })}
        busy={busy}
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function StoryForm({ story, users, onCancel, onSaved }: { story: StoryDto | null; users: StoryUser[]; onCancel: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState(story?.name ?? '');
  const [description, setDescription] = useState(story?.description ?? '');
  const [members, setMembers] = useState<Map<string, StoryRole>>(new Map(story?.members.map((m) => [m.id, m.role]) ?? []));
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [lifestyles, setLifestyles] = useState<Lifestyle[]>(story?.lifestyles ?? DEFAULT_LIFESTYLES);
  // Neue Geschichte: Sprachen aus dem Wiki (werden geladen); bestehende: Liste der Geschichte
  const [languages, setLanguages] = useState<string[] | null>(story?.languages ?? null);
  const [wikiLanguages, setWikiLanguages] = useState<string[]>([]);
  // Götter: neue Geschichte = alle aus dem Wiki; gruppiert nach Pantheon
  const [gods, setGods] = useState<string[] | null>(story?.gods ?? null);
  const [godGroups, setGodGroups] = useState<{ label: string; names: string[] }[]>([]);
  useEffect(() => {
    const byName = (a: string, b: string) => a.localeCompare(b, 'de');
    api
      .wiki()
      .then((r) => {
        const names = r.entries
          .filter((e) => e.kind === 'language')
          .map((e) => e.name)
          .sort(byName);
        setWikiLanguages(names);
        setLanguages((l) => l ?? (names.length ? names : DEFAULT_LANGUAGES));
        const groups = new Map<string, string[]>();
        for (const e of r.entries) {
          if (e.kind !== 'god') continue;
          const key = e.data.pantheon || t('wiki.god.noPantheon');
          groups.set(key, [...(groups.get(key) ?? []), e.name]);
        }
        const list = [...groups.entries()].sort(([a], [b]) => byName(a, b)).map(([label, n]) => ({ label, names: n.sort(byName) }));
        setGodGroups(list);
        setGods((g) => g ?? list.flatMap((x) => x.names));
      })
      .catch(() => {
        setLanguages((l) => l ?? DEFAULT_LANGUAGES);
        setGods((g) => g ?? []);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [tools, setTools] = useState<string[]>(story?.tools ?? DEFAULT_TOOLS);
  const [initial] = useState(() => new Set(story?.members.map((m) => m.id) ?? []));

  const setRole = (uid: string, role: StoryRole | '') =>
    setMembers((prev) => {
      const next = new Map(prev);
      if (role) next.set(uid, role);
      else next.delete(uid);
      return next;
    });

  const needle = filter.trim().toLocaleLowerCase('de');
  const shown = useMemo(
    () =>
      [...users]
        .filter((u) => !needle || u.username.toLocaleLowerCase('de').includes(needle) || members.has(u.id))
        // beim Öffnen eingetragene zuerst (feste Reihenfolge, damit Zeilen beim Klicken nicht springen)
        .sort((a, b) => Number(initial.has(b.id)) - Number(initial.has(a.id)) || a.username.localeCompare(b.username)),
    [users, needle, members, initial],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const input = {
        name: name.trim(),
        description: description.trim(),
        members: [...members.entries()].map(([userId, role]) => ({
          userId,
          role,
        })),
        lifestyles: lifestyles.map((l) => ({
          name: l.name.trim(),
          cost: l.cost.trim(),
        })),
        languages: languages ?? undefined,
        gods: gods ?? undefined,
        tools,
      };
      if (story) await api.updateStory(story.id, input);
      else await api.createStory(input);
      toast.success(story ? t('board.storySaved') : t('board.storyCreated'));
      onSaved();
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const count = (role: StoryRole) => [...members.values()].filter((r) => r === role).length;

  return (
    <>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-xl font-bold">{story ? t('stories.edit') : t('board.newStory')}</h2>
          <button type="button" className="btn-icon" onClick={onCancel} aria-label={t('common.close')} title={t('common.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <section className="parchment space-y-4 p-5">
          <div>
            <label htmlFor="story-name" className="label">
              {t('board.storyName')}
            </label>
            <input id="story-name" className="input" value={name} maxLength={100} required autoFocus onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="story-desc" className="label">
              {t('board.storyDescription')}
            </label>
            <textarea id="story-desc" className="input min-h-[4rem]" value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </section>

        <section className="parchment space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex-1 font-display text-lg font-bold">{t('stories.members')}</h3>
            <span className="text-sm text-parchment-700 dark:text-parchment-400">
              {t('storyRole.dmPlural')}: {count('dm')} · {t('storyRole.playerPlural')}: {count('player')}
            </span>
          </div>
          <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('stories.membersHint')}</p>
          {users.length > 8 && (
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-600" />
              <input type="search" className="input !py-1.5 !pl-9" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('auth.username')} aria-label={t('auth.username')} />
            </div>
          )}
          <ul className="divide-y divide-parchment-300/70 dark:divide-night-700">
            {shown.map((u) => {
              const role = members.get(u.id) ?? '';
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{u.username}</span> <span className="text-xs text-parchment-700 dark:text-parchment-400">({t(`role.${u.role}`)})</span>
                  </span>
                  <div
                    role="radiogroup"
                    aria-label={`${t('stories.roleFor')} ${u.username}`}
                    className="flex overflow-hidden rounded-full border border-parchment-500/60 text-sm dark:border-night-700"
                  >
                    {(['', 'player', 'dm'] as const).map((r) => (
                      <button
                        key={r || 'none'}
                        type="button"
                        role="radio"
                        aria-checked={role === r}
                        onClick={() => setRole(u.id, r)}
                        className={`px-3 py-1 transition ${
                          role === r
                            ? r === 'dm'
                              ? 'bg-red-800 text-white dark:bg-red-700'
                              : r === 'player'
                                ? 'bg-emerald-700 text-white dark:bg-emerald-600'
                                : 'bg-parchment-300 text-ink dark:bg-night-700 dark:text-parchment-100'
                            : 'hover:bg-parchment-200 dark:hover:bg-night-700'
                        }`}
                      >
                        {r ? t(`storyRole.${r}`) : t('stories.notMember')}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <LifestyleEditor value={lifestyles} onChange={setLifestyles} />
        {languages && (
          <WikiPickEditor
            title={t('stories.languages')}
            hint={t('stories.languagesHint')}
            value={languages}
            groups={[{ label: t('stories.languagesFromWiki'), names: wikiLanguages }]}
            onChange={setLanguages}
            customLabel={t('stories.languagesCustom')}
            noCustomLabel={t('stories.languagesNoCustom')}
            placeholder={t('stories.languagePlaceholder')}
          />
        )}
        {gods && (
          <WikiPickEditor
            title={t('stories.gods')}
            hint={t('stories.godsHint')}
            value={gods}
            groups={godGroups}
            onChange={setGods}
            allowEmpty
            customLabel={t('stories.godsCustom')}
            noCustomLabel={t('stories.godsNoCustom')}
            placeholder={t('stories.godPlaceholder')}
          />
        )}
        <OptionListEditor title={t('stories.tools')} hint={t('stories.toolsHint')} value={tools} defaults={DEFAULT_TOOLS} onChange={setTools} placeholder={t('stories.toolPlaceholder')} />

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !name.trim() || lifestyleError(lifestyles) !== null}>
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {story ? t('common.save') : t('board.createStory')}
          </button>
        </div>
      </form>
      <details className="parchment group mt-5 p-5">
        <summary className="flex cursor-pointer list-none items-center gap-2">
          <h3 className="flex-1 font-display text-lg font-bold">{t('catalog.storyTitle')}</h3>
          <span className="text-sm text-parchment-700 group-open:hidden dark:text-parchment-400">{t('stories.expand')}</span>
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-parchment-700 dark:text-parchment-400">{story ? t('catalog.storyHint') : t('catalog.storyAfterCreate')}</p>
          {story && <CatalogManager storyId={story.id} />}
        </div>
      </details>
    </>
  );
}

/** Prüfung wie auf dem Server: mindestens ein Eintrag, Namen vorhanden und eindeutig */
function lifestyleError(list: Lifestyle[]): string | null {
  if (list.length === 0) return 'empty';
  if (list.some((l) => !l.name.trim())) return 'name';
  const names = list.map((l) => l.name.trim().toLocaleLowerCase('de'));
  return new Set(names).size === names.length ? null : 'duplicate';
}

/** Tabelle „Lebensstil & tägliche Kosten“ einer Geschichte */
function LifestyleEditor({ value, onChange }: { value: Lifestyle[]; onChange: (v: Lifestyle[]) => void }) {
  const { t } = useTranslation();
  const error = lifestyleError(value);
  const update = (i: number, patch: Partial<Lifestyle>) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <section className="parchment space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex flex-1 items-center gap-2 font-display text-lg font-bold">
          <Coins className="h-5 w-5" />
          {t('stories.lifestyles')}
        </h3>
        <button type="button" className="btn-ghost !py-1 text-sm" onClick={() => onChange(DEFAULT_LIFESTYLES)}>
          <RotateCcw className="h-4 w-4" />
          {t('stories.lifestylesReset')}
        </button>
      </div>
      <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('stories.lifestylesHint')}</p>
      <div className="max-w-xl space-y-2 text-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_9rem_2.5rem] gap-2">
          <span className="sheet-label">{t('sheet.lifestyleName')}</span>
          <span className="sheet-label">{t('sheet.dailyCost')}</span>
          <span />
        </div>
        {value.map((l, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_9rem_2.5rem] items-center gap-2">
            <input className="input !py-1" value={l.name} maxLength={50} onChange={(e) => update(i, { name: e.target.value })} aria-label={`${t('sheet.lifestyleName')} ${i + 1}`} />
            <input className="input !py-1" value={l.cost} maxLength={30} onChange={(e) => update(i, { cost: e.target.value })} placeholder="1 GM" aria-label={`${t('sheet.dailyCost')} ${i + 1}`} />
            <button
              type="button"
              className="btn-icon text-red-700 dark:text-red-400"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              disabled={value.length <= 1}
              title={t('common.delete')}
              aria-label={`${t('common.delete')}: ${l.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {error && error !== 'empty' && <p className="text-xs text-red-700 dark:text-red-400">{t(`stories.lifestyleError.${error}`)}</p>}
      {value.length < 20 && (
        <button type="button" className="btn-ghost !px-2 !py-1 text-sm" onClick={() => onChange([...value, { name: '', cost: '' }])}>
          <Plus className="h-4 w-4" />
          {t('stories.lifestyleAdd')}
        </button>
      )}
    </section>
  );
}

/** Einklappbarer Editor für eine Auswahlliste (Sprachen, Werkzeuge & andere) */
/**
 * Auswahl aus dem Wiki für eine Geschichte (Sprachen, Götter): Wiki-Einträge – optional in Gruppen – an-/abwählen,
 * eigene Einträge ergänzen. „Alle aus dem Wiki“ wählt alle Wiki-Einträge an (eigene bleiben).
 */
function WikiPickEditor({
  title,
  hint,
  value,
  groups,
  onChange,
  allowEmpty = false,
  customLabel,
  noCustomLabel,
  placeholder,
}: {
  title: string;
  hint: string;
  value: string[];
  groups: { label: string; names: string[] }[];
  onChange: (v: string[]) => void;
  /** darf ganz leer sein (z. B. Welt ohne Götter) */
  allowEmpty?: boolean;
  customLabel: string;
  noCustomLabel: string;
  placeholder: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const lower = (s: string) => s.toLocaleLowerCase('de');
  const has = (name: string) => value.some((v) => lower(v) === lower(name.trim()));
  const allWiki = groups.flatMap((g) => g.names);
  const wikiSet = new Set(allWiki.map(lower));
  const custom = value.filter((v) => !wikiSet.has(lower(v)));
  const canRemove = (n = 1) => allowEmpty || value.length > n;
  const toggle = (name: string, on: boolean) => {
    if (on) onChange([...value, name]);
    else if (canRemove()) onChange(value.filter((v) => lower(v) !== lower(name)));
  };
  const setGroup = (names: string[], on: boolean) => {
    const set = new Set(names.map(lower));
    const rest = value.filter((v) => !set.has(lower(v)));
    if (on) onChange([...rest, ...names]);
    else if (allowEmpty || rest.length > 0) onChange(rest);
  };
  const add = () => {
    const name = draft.trim();
    if (!name || has(name) || value.length >= 300) return;
    onChange([...value, name]);
    setDraft('');
  };
  return (
    <details className="parchment group p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <h3 className="flex-1 font-display text-lg font-bold">
          {title} <span className="text-sm font-normal text-parchment-700 dark:text-parchment-400">({value.length})</span>
        </h3>
        <span className="text-sm text-parchment-700 group-open:hidden dark:text-parchment-400">{t('stories.expand')}</span>
      </summary>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-start gap-2">
          <p className="flex-1 text-sm text-parchment-700 dark:text-parchment-400">{hint}</p>
          <button type="button" className="btn-ghost !py-1 text-sm" onClick={() => onChange([...allWiki, ...custom])} disabled={allWiki.length === 0}>
            <RotateCcw className="h-4 w-4" />
            {t('stories.languagesAllWiki')}
          </button>
        </div>
        {groups
          .filter((g) => g.names.length > 0)
          .map((g) => (
            <div key={g.label}>
              <div className="mb-1 flex flex-wrap items-baseline gap-2">
                <p className="label !mb-0">{g.label}</p>
                {groups.length > 1 && (
                  <span className="text-xs">
                    <button type="button" className="underline" onClick={() => setGroup(g.names, true)}>
                      {t('stories.pickAll')}
                    </button>
                    {' · '}
                    <button type="button" className="underline" onClick={() => setGroup(g.names, false)}>
                      {t('stories.pickNone')}
                    </button>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.names.map((n) => (
                  <label key={n} className="chip-check">
                    <input type="checkbox" checked={has(n)} onChange={(e) => toggle(n, e.target.checked)} />
                    {n}
                  </label>
                ))}
              </div>
            </div>
          ))}
        <div>
          <p className="label">{customLabel}</p>
          {custom.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {custom.map((v) => (
                <li key={v} className="inline-flex items-center gap-1 rounded-full border border-parchment-400/70 bg-white/50 py-0.5 pl-3 pr-1 text-sm dark:border-night-700 dark:bg-night-950/40">
                  {v}
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-red-700 hover:bg-red-100 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950"
                    onClick={() => onChange(value.filter((x) => x !== v))}
                    disabled={!canRemove()}
                    aria-label={`${t('common.delete')}: ${v}`}
                    title={t('common.delete')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-sm italic text-parchment-700 dark:text-parchment-400">{noCustomLabel}</p>
          )}
          <div className="flex max-w-md gap-2">
            <input
              className="input !py-1"
              value={draft}
              maxLength={100}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder={placeholder}
              aria-label={placeholder}
            />
            <button type="button" className="btn-secondary !py-1" onClick={add} disabled={!draft.trim() || has(draft)}>
              <Plus className="h-4 w-4" />
              {t('stories.addOption')}
            </button>
          </div>
          {draft.trim() && has(draft) && <p className="mt-1 text-xs text-red-700 dark:text-red-400">{t('stories.optionExists')}</p>}
        </div>
      </div>
    </details>
  );
}

function OptionListEditor({
  title,
  hint,
  value,
  defaults,
  onChange,
  placeholder,
}: {
  title: string;
  hint: string;
  value: string[];
  defaults: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const exists = (name: string) => value.some((v) => v.toLocaleLowerCase('de') === name.trim().toLocaleLowerCase('de'));
  const add = () => {
    const name = draft.trim();
    if (!name || exists(name) || value.length >= 150) return;
    onChange([...value, name]);
    setDraft('');
  };
  return (
    <details className="parchment group p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <h3 className="flex-1 font-display text-lg font-bold">
          {title} <span className="text-sm font-normal text-parchment-700 dark:text-parchment-400">({value.length})</span>
        </h3>
        <span className="text-sm text-parchment-700 group-open:hidden dark:text-parchment-400">{t('stories.expand')}</span>
      </summary>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-start gap-2">
          <p className="flex-1 text-sm text-parchment-700 dark:text-parchment-400">{hint}</p>
          <button type="button" className="btn-ghost !py-1 text-sm" onClick={() => onChange(defaults)}>
            <RotateCcw className="h-4 w-4" />
            {t('stories.lifestylesReset')}
          </button>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full border border-parchment-400/70 bg-white/50 py-0.5 pl-3 pr-1 text-sm dark:border-night-700 dark:bg-night-950/40">
              {v}
              <button
                type="button"
                className="rounded-full p-0.5 text-red-700 hover:bg-red-100 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950"
                onClick={() => onChange(value.filter((x) => x !== v))}
                disabled={value.length <= 1}
                aria-label={`${t('common.delete')}: ${v}`}
                title={t('common.delete')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex max-w-md gap-2">
          <input
            className="input !py-1"
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
          />
          <button type="button" className="btn-secondary !py-1" onClick={add} disabled={!draft.trim() || exists(draft)}>
            <Plus className="h-4 w-4" />
            {t('stories.addOption')}
          </button>
        </div>
        {draft.trim() && exists(draft) && <p className="text-xs text-red-700 dark:text-red-400">{t('stories.optionExists')}</p>}
      </div>
    </details>
  );
}
