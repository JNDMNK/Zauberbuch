import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clapperboard,
  Clock,
  Dices,
  EyeOff,
  Gem,
  History,
  ImagePlus,
  KeyRound,
  Link2,
  MapPin,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Save,
  ScrollText,
  Search,
  Share2,
  Swords,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import {
  DM_NOTE_KINDS,
  DM_NOTE_STATUSES,
  MAX_DM_NOTE_BODY,
  parseTableRow,
  stripDmSecrets,
  tableDie,
  type CharacterSummaryDto,
  type ChatContactDto,
  type DmNoteDto,
  type DmNoteInput,
  type DmNoteKind,
  type DmNoteMonster,
  type DmNoteStatus,
  type DmNoteVersionDto,
  type MonsterTemplateDto,
} from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../ConfirmDialog';
import { Markdown } from '../Markdown';
import { MarkdownEditor } from '../MarkdownEditor';
import { Modal } from '../Modal';
import { Alert, PageSpinner, Spinner } from '../ui';
import { resizeImage } from '../sheet/ImageField';

/** Symbol je Abschnittstyp */
const KIND_ICON: Record<DmNoteKind, typeof BookOpen> = {
  chapter: BookOpen,
  scene: Clapperboard,
  encounter: Swords,
  place: MapPin,
  npc: UserRound,
  faction: Users,
  item: Gem,
  clue: KeyRound,
  lore: ScrollText,
  session: CalendarDays,
  table: Dices,
};
const STATUS_CLS: Record<DmNoteStatus, string> = {
  none: '',
  prepared: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  active: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  done: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  discarded: 'bg-parchment-200 text-parchment-700 line-through dark:bg-night-700 dark:text-parchment-400',
};
const STATUS_DOT: Record<DmNoteStatus, string> = { none: 'bg-transparent', prepared: 'bg-sky-500', active: 'bg-amber-500', done: 'bg-emerald-600', discarded: 'bg-parchment-500' };

type View = 'tree' | 'timeline' | 'sessions';
const COLLAPSED_KEY = (storyId: string) => `zauberbuch.dmnotes.collapsed.${storyId}`;
const loadSet = (key: string) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[]);
  } catch {
    return new Set<string>();
  }
};
const saveSet = (key: string, set: Set<string>) => {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* ohne Speicher geht es auch */
  }
};

/** Fairer Würfel 1..sides */
function rollDie(sides: number) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return (buf[0] % sides) + 1;
}

const TASK_RE = /^(\s*(?:[-*+]|\d+\.)\s+)\[( |x|X)\]/gm;
/** n-tes Kästchen einer Checkliste umschalten */
function toggleTask(body: string, index: number) {
  let i = 0;
  return body.replace(TASK_RE, (m, prefix: string, mark: string) => (i++ === index ? `${prefix}[${mark === ' ' ? 'x' : ' '}]` : m));
}

/**
 * Text für die Anzeige beim DM: geheime Stellen hervorheben und `[[Titel]]` auf andere Abschnitte verlinken
 * (unbekannte Titel bleiben als Text stehen).
 */
function prepareBody(body: string, byTitle: Map<string, DmNoteDto>, secretLabel: string) {
  return body
    .replace(/^:::\s*(geheim|secret)\s*$([\s\S]*?)^:::\s*$/gim, (_m, _w, inner: string) =>
      [`> 🔒 **${secretLabel}**`, '>', ...inner.trim().split('\n').map((l) => `> ${l}`)].join('\n'),
    )
    .replace(/\[\[([^\]\n]{1,120})\]\]/g, (_m, title: string) => {
      const n = byTitle.get(title.trim().toLocaleLowerCase('de'));
      return n ? `[${title.trim()}](#dm:${n.id})` : title.trim();
    });
}

/**
 * Infotafel → Reiter „DM-Notizen“: Kampagnenbuch der Dungeon Master. Abschnitte im Kapitelbaum mit Typ, Status,
 * Schlagwörtern, Querverweisen, Bildern, Zufallstabellen, Begegnungen (→ Kampf vorbereiten) und Sitzungsprotokollen;
 * Abschnitte lassen sich ohne geheime Stellen an die Spieler freigeben.
 */
export function DmNotesPanel({ storyId, readOnly }: { storyId: string; readOnly: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [notes, setNotes] = useState<DmNoteDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState<DmNoteStatus | ''>('');
  const [fKind, setFKind] = useState<DmNoteKind | ''>('');
  const [fTag, setFTag] = useState('');
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [view, setView] = useState<View>('tree');
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; parentId: string | null } | null>(null);
  const [collapsed, setCollapsed] = useState(() => loadSet(COLLAPSED_KEY(storyId)));
  const [toDelete, setToDelete] = useState<DmNoteDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [characters, setCharacters] = useState<CharacterSummaryDto[]>([]);
  const detailRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api.dmNotes(storyId).then((r) => setNotes(r.notes), setError);
  }, [storyId]);
  useEffect(load, [load]);
  useEffect(() => {
    api.allCharacters().then((r) => setCharacters(r.characters.filter((c) => c.story?.id === storyId)), () => undefined);
  }, [storyId]);

  const all = useMemo(() => notes ?? [], [notes]);
  const byId = useMemo(() => new Map(all.map((n) => [n.id, n])), [all]);
  const byTitle = useMemo(() => new Map(all.map((n) => [n.title.toLocaleLowerCase('de'), n])), [all]);
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, DmNoteDto[]>();
    for (const n of all) {
      const key = n.parentId && byId.has(n.parentId) ? n.parentId : null;
      map.set(key, [...(map.get(key) ?? []), n]);
    }
    return map;
  }, [all, byId]);
  /** Baum in Lesereihenfolge (für Zeitleiste und Auswahl des übergeordneten Abschnitts) */
  const flat = useMemo(() => {
    const out: { note: DmNoteDto; depth: number }[] = [];
    const walk = (parent: string | null, depth: number) => (childrenOf.get(parent) ?? []).forEach((n) => (out.push({ note: n, depth }), walk(n.id, depth + 1)));
    walk(null, 0);
    return out;
  }, [childrenOf]);
  const allTags = useMemo(() => [...new Set(all.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b, 'de')), [all]);

  const needle = q.trim().toLocaleLowerCase('de');
  const filtering = !!(needle || fStatus || fKind || fTag || onlyPinned);
  const matches = (n: DmNoteDto) =>
    (!needle || `${n.title}\n${n.body}\n${n.tags.join(' ')}\n${n.tableRows.join('\n')}`.toLocaleLowerCase('de').includes(needle)) &&
    (!fStatus || n.status === fStatus) &&
    (!fKind || n.kind === fKind) &&
    (!fTag || n.tags.includes(fTag)) &&
    (!onlyPinned || n.pinned);

  const replace = (note: DmNoteDto) => setNotes((l) => l?.map((n) => (n.id === note.id ? note : n)) ?? null);
  const select = (id: string | null) => {
    setSelected(id);
    setEditing(null);
    if (id && window.innerWidth < 1024) window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const toggleCollapsed = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
    saveSet(COLLAPSED_KEY(storyId), next);
  };

  const move = async (note: DmNoteDto, dir: -1 | 1) => {
    const siblings = childrenOf.get(note.parentId && byId.has(note.parentId) ? note.parentId : null) ?? [];
    const i = siblings.findIndex((n) => n.id === note.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= siblings.length) return;
    const ids = siblings.map((n) => n.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      setNotes((await api.orderDmNotes(storyId, ids)).notes);
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  const save = async (id: string | null, input: DmNoteInput) => {
    if (id === null) {
      const r = await api.createDmNote(storyId, input);
      setNotes((l) => [...(l ?? []), r.note]);
      setSelected(r.note.id);
    } else {
      replace((await api.updateDmNote(id, input)).note);
    }
    setEditing(null);
    toast.success(t('dmNotes.saved'));
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.deleteDmNote(toDelete.id);
      setToDelete(null);
      if (selected === toDelete.id) setSelected(null);
      load();
      toast.success(t('dmNotes.deleted'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!notes) return <PageSpinner />;

  const current = selected ? byId.get(selected) : undefined;

  const row = (n: DmNoteDto, depth: number, withChildren: boolean) => {
    const Icon = KIND_ICON[n.kind];
    const kids = withChildren ? (childrenOf.get(n.id) ?? []) : [];
    const open = !collapsed.has(n.id);
    return (
      <li key={n.id}>
        <div className={`flex items-center gap-1 rounded-md pr-1 ${selected === n.id ? 'bg-parchment-300/70 dark:bg-night-700' : 'hover:bg-parchment-200/60 dark:hover:bg-night-700/50'}`} style={{ paddingLeft: `${depth * 0.9}rem` }}>
          {kids.length > 0 ? (
            <button type="button" className="btn-icon h-6 w-6 shrink-0" onClick={() => toggleCollapsed(n.id)} aria-expanded={open} aria-label={n.title}>
              <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
          ) : (
            <span className="w-6 shrink-0" />
          )}
          <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left" onClick={() => select(n.id)} aria-current={selected === n.id}>
            <Icon className="h-4 w-4 shrink-0 text-parchment-700 dark:text-parchment-400" aria-label={t(`dmNotes.kind.${n.kind}`)} />
            <span className={`min-w-0 flex-1 truncate ${n.kind === 'chapter' ? 'font-display font-bold' : ''} ${n.status === 'discarded' ? 'line-through opacity-60' : ''}`}>{n.title}</span>
            {n.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-red-700 dark:text-red-400" aria-label={t('dmNotes.pinned')} />}
            {n.sharedAt && <Share2 className="h-3.5 w-3.5 shrink-0 text-sky-700 dark:text-sky-400" aria-label={t('dmNotes.shared')} />}
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[n.status]}`} title={t(`dmNotes.status.${n.status}`)} />
          </button>
        </div>
        {kids.length > 0 && open && <ul>{kids.map((k) => row(k, depth + 1, true))}</ul>}
      </li>
    );
  };

  const listContent = (): ReactNode => {
    if (all.length === 0) return <p className="px-2 py-6 text-center text-sm italic">{t('dmNotes.empty')}</p>;
    if (view === 'timeline') {
      const items = flat.filter(({ note }) => note.gameDate && matches(note));
      if (!items.length) return <p className="px-2 py-6 text-center text-sm italic">{t('dmNotes.timelineEmpty')}</p>;
      return (
        <ol className="relative ml-3 space-y-2 border-l-2 border-parchment-400 pl-4 dark:border-night-700">
          {items.map(({ note }) => (
            <li key={note.id} className="relative">
              <span className={`absolute -left-[1.42rem] top-2 h-3 w-3 rounded-full border-2 border-parchment-50 dark:border-night-800 ${note.status === 'done' ? 'bg-emerald-600' : 'bg-parchment-700'}`} />
              <button type="button" className={`w-full rounded-md px-2 py-1 text-left ${selected === note.id ? 'bg-parchment-300/70 dark:bg-night-700' : 'hover:bg-parchment-200/60 dark:hover:bg-night-700/50'}`} onClick={() => select(note.id)}>
                <span className="block text-xs font-semibold text-parchment-700 dark:text-parchment-400">{note.gameDate}</span>
                <span className="block truncate">{note.title}</span>
              </button>
            </li>
          ))}
        </ol>
      );
    }
    if (view === 'sessions') {
      const items = all.filter((n) => n.kind === 'session' && matches(n)).sort((a, b) => b.sessionDate.localeCompare(a.sessionDate) || b.position - a.position);
      if (!items.length) return <p className="px-2 py-6 text-center text-sm italic">{t('dmNotes.sessionsEmpty')}</p>;
      const xp = items.reduce((s, n) => s + (n.xp ?? 0), 0);
      return (
        <>
          <p className="px-2 pb-2 text-xs text-parchment-700 dark:text-parchment-400">{t('dmNotes.sessionsSummary', { count: items.length, xp })}</p>
          <ul>{items.map((n) => row(n, 0, false))}</ul>
        </>
      );
    }
    if (filtering) {
      const items = flat.filter(({ note }) => matches(note));
      if (!items.length) return <p className="px-2 py-6 text-center text-sm italic">{t('search.noResults')}</p>;
      return <ul>{items.map(({ note }) => row(note, 0, false))}</ul>;
    }
    return <ul>{(childrenOf.get(null) ?? []).map((n) => row(n, 0, true))}</ul>;
  };

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-parchment-700 dark:text-parchment-400">
        <EyeOff className="h-4 w-4 shrink-0" />
        {t('dmNotes.hint')}
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        {/* Übersicht */}
        <aside className="parchment flex min-w-0 flex-col gap-2 p-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-700 dark:text-parchment-400" />
              <input type="search" className="input !py-1.5 !pl-8 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('dmNotes.search')} aria-label={t('dmNotes.search')} />
            </div>
            {!readOnly && (
              <button type="button" className="btn-primary !px-2.5 !py-1.5" onClick={() => (setEditing({ id: null, parentId: null }), setSelected(null))} title={t('dmNotes.new')} aria-label={t('dmNotes.new')}>
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-sm">
            <select className="input !py-1 text-sm" value={fKind} onChange={(e) => setFKind(e.target.value as DmNoteKind | '')} aria-label={t('dmNotes.kindLabel')}>
              <option value="">{t('dmNotes.allKinds')}</option>
              {DM_NOTE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`dmNotes.kind.${k}`)}
                </option>
              ))}
            </select>
            <select className="input !py-1 text-sm" value={fStatus} onChange={(e) => setFStatus(e.target.value as DmNoteStatus | '')} aria-label={t('dmNotes.statusLabel')}>
              <option value="">{t('dmNotes.allStatuses')}</option>
              {DM_NOTE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`dmNotes.status.${s}`)}
                </option>
              ))}
            </select>
            {allTags.length > 0 && (
              <select className="input !py-1 text-sm" value={fTag} onChange={(e) => setFTag(e.target.value)} aria-label={t('dmNotes.tags')}>
                <option value="">{t('dmNotes.allTags')}</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
            )}
            <label className="chip-check !py-0.5 justify-center">
              <input type="checkbox" checked={onlyPinned} onChange={(e) => setOnlyPinned(e.target.checked)} />
              <Pin className="h-3.5 w-3.5" />
              {t('dmNotes.onlyPinned')}
            </label>
          </div>
          <div className="flex rounded-lg border border-parchment-400 p-0.5 text-sm dark:border-night-700" role="tablist">
            {(['tree', 'timeline', 'sessions'] as View[]).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className={`flex-1 rounded-md px-2 py-1 ${view === v ? 'bg-parchment-800 text-parchment-50 dark:bg-parchment-300 dark:text-night-900' : ''}`} onClick={() => setView(v)}>
                {t(`dmNotes.view.${v}`)}
              </button>
            ))}
          </div>
          <nav className="-mx-1 min-h-0 flex-1 overflow-y-auto" aria-label={t('dmNotes.tab')}>
            {listContent()}
          </nav>
        </aside>

        {/* Inhalt */}
        <div ref={detailRef} className="min-w-0 scroll-mt-20">
          {editing ? (
            <section className="parchment p-4">
              <NoteForm
                storyId={storyId}
                note={editing.id ? byId.get(editing.id) : undefined}
                defaultParent={editing.parentId}
                flat={flat}
                allTags={allTags}
                characters={characters}
                onCancel={() => setEditing(null)}
                onSave={(input) => save(editing.id, input)}
              />
            </section>
          ) : current ? (
            <NoteView
              key={current.id}
              note={current}
              storyId={storyId}
              readOnly={readOnly}
              all={all}
              byId={byId}
              byTitle={byTitle}
              childrenOf={childrenOf}
              characters={characters}
              onSelect={select}
              onReplace={replace}
              onEdit={() => setEditing({ id: current.id, parentId: current.parentId })}
              onAddChild={() => setEditing({ id: null, parentId: current.id })}
              onMove={(dir) => move(current, dir)}
              onDelete={() => setToDelete(current)}
            />
          ) : (
            <div className="parchment px-6 py-10 text-center text-parchment-700 dark:text-parchment-400">
              <BookOpen className="mx-auto mb-2 h-8 w-8" />
              <p className="italic">{all.length ? t('dmNotes.pick') : t('dmNotes.empty')}</p>
              {!readOnly && (
                <button type="button" className="btn-primary mt-4" onClick={() => setEditing({ id: null, parentId: null })}>
                  <Plus className="h-4 w-4" />
                  {t('dmNotes.new')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title={t('dmNotes.deleteTitle')}
        message={t('dmNotes.deleteText', { name: toDelete?.title ?? '' })}
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Ansicht eines Abschnitts

function NoteView({
  note,
  storyId,
  readOnly,
  all,
  byId,
  byTitle,
  childrenOf,
  characters,
  onSelect,
  onReplace,
  onEdit,
  onAddChild,
  onMove,
  onDelete,
}: {
  note: DmNoteDto;
  storyId: string;
  readOnly: boolean;
  all: DmNoteDto[];
  byId: Map<string, DmNoteDto>;
  byTitle: Map<string, DmNoteDto>;
  childrenOf: Map<string | null, DmNoteDto[]>;
  characters: CharacterSummaryDto[];
  onSelect: (id: string | null) => void;
  onReplace: (n: DmNoteDto) => void;
  onEdit: () => void;
  onAddChild: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [roll, setRoll] = useState<{ value: number; index: number } | null>(null);
  const [dialog, setDialog] = useState<'share' | 'versions' | null>(null);
  const [busy, setBusy] = useState(false);
  const Icon = KIND_ICON[note.kind];

  // Pfad (Brotkrumen)
  const path: DmNoteDto[] = [];
  for (let p = note.parentId ? byId.get(note.parentId) : undefined, i = 0; p && i < 20; p = p.parentId ? byId.get(p.parentId) : undefined, i++) path.unshift(p);
  const kids = childrenOf.get(note.id) ?? [];
  const parentKey = note.parentId && byId.has(note.parentId) ? note.parentId : null;
  const siblings = childrenOf.get(parentKey) ?? [];
  const pos = siblings.findIndex((n) => n.id === note.id);
  const mention = `[[${note.title.toLocaleLowerCase('de')}]]`;
  const backlinks = all.filter((n) => n.id !== note.id && n.body.toLocaleLowerCase('de').includes(mention));
  const linkedChars = characters.filter((c) => note.characterIds.includes(c.id));

  const patch = async (input: { status?: DmNoteStatus; pinned?: boolean; body?: string }) => {
    // sofort anzeigen, im Hintergrund speichern (bei Fehler zurück)
    onReplace({ ...note, ...input });
    try {
      onReplace((await api.patchDmNote(note.id, input)).note);
    } catch (err) {
      onReplace(note);
      toast.error(errorMessage(t, err));
    }
  };
  const doRoll = () => {
    const die = tableDie(note.tableRows);
    const value = rollDie(die.sides);
    setRoll({ value, index: die.pick(value) });
  };
  const prepareFight = async () => {
    setBusy(true);
    try {
      const r = await api.dmNoteEncounter(note.id);
      toast.success(t('dmNotes.encounterCreated'));
      navigate(`/combat/${r.encounterId}`);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };
  const date = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
  const sharedText = note.sharedInfo === 'board' ? t('dmNotes.sharedBoard') : note.sharedInfo.startsWith('chat:') ? t('dmNotes.sharedChat', { names: note.sharedInfo.slice(5) }) : '';

  return (
    <article className="parchment space-y-4 p-4 sm:p-5">
      <button type="button" className="btn-ghost !px-1 !py-0.5 text-sm lg:hidden" onClick={() => onSelect(null)}>
        <ArrowLeft className="h-4 w-4" />
        {t('dmNotes.backToList')}
      </button>
      {path.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1 text-sm text-parchment-700 dark:text-parchment-400" aria-label={t('dmNotes.path')}>
          {path.map((p) => (
            <span key={p.id} className="flex items-center gap-1">
              <button type="button" className="hover:underline" onClick={() => onSelect(p.id)}>
                {p.title}
              </button>
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          ))}
        </nav>
      )}
      <header className="flex flex-wrap items-start gap-3">
        <Icon className="mt-1 h-6 w-6 shrink-0 text-parchment-700 dark:text-parchment-400" />
        <div className="min-w-[12rem] flex-1">
          <h2 className="break-words font-display text-2xl font-bold">{note.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="rounded-full border border-parchment-400 px-2 text-xs dark:border-night-700">{t(`dmNotes.kind.${note.kind}`)}</span>
            {note.status !== 'none' && <span className={`rounded-full px-2 text-xs font-semibold ${STATUS_CLS[note.status]}`}>{t(`dmNotes.status.${note.status}`)}</span>}
            {note.gameDate && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-parchment-700 dark:text-parchment-400">
                <Clock className="h-3.5 w-3.5" />
                {note.gameDate}
              </span>
            )}
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-parchment-200 px-2 text-xs dark:bg-night-700">
                #{tag}
              </span>
            ))}
          </div>
        </div>
        {!readOnly && (
          <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
            <select className="input !w-auto !py-1 text-sm" value={note.status} onChange={(e) => patch({ status: e.target.value as DmNoteStatus })} aria-label={t('dmNotes.statusLabel')}>
              {DM_NOTE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`dmNotes.status.${s}`)}
                </option>
              ))}
            </select>
            <button type="button" className="btn-icon" onClick={() => patch({ pinned: !note.pinned })} title={t(note.pinned ? 'dmNotes.unpin' : 'dmNotes.pin')} aria-label={t(note.pinned ? 'dmNotes.unpin' : 'dmNotes.pin')} aria-pressed={note.pinned}>
              {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
            <button type="button" className="btn-icon" onClick={() => onMove(-1)} disabled={pos <= 0} title={t('dmNotes.up')} aria-label={t('dmNotes.up')}>
              <ArrowUp className="h-4 w-4" />
            </button>
            <button type="button" className="btn-icon" onClick={() => onMove(1)} disabled={pos < 0 || pos >= siblings.length - 1} title={t('dmNotes.down')} aria-label={t('dmNotes.down')}>
              <ArrowDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary !py-1 text-sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            {t('common.edit')}
          </button>
          <button type="button" className="btn-secondary !py-1 text-sm" onClick={onAddChild}>
            <Plus className="h-4 w-4" />
            {t('dmNotes.addChild')}
          </button>
          <button type="button" className="btn-secondary !py-1 text-sm" onClick={() => setDialog('share')}>
            <Share2 className="h-4 w-4" />
            {t('dmNotes.share')}
          </button>
          <button type="button" className="btn-secondary !py-1 text-sm" onClick={() => setDialog('versions')}>
            <History className="h-4 w-4" />
            {t('dmNotes.versions')}
          </button>
          <button type="button" className="btn-secondary !py-1 text-sm text-red-700 dark:text-red-400" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            {t('common.delete')}
          </button>
        </div>
      )}

      {note.kind === 'session' && (note.sessionDate || note.xp !== null) && (
        <p className="flex flex-wrap gap-4 rounded-lg bg-parchment-200/60 px-3 py-2 text-sm dark:bg-night-900/50">
          {note.sessionDate && (
            <span>
              <CalendarDays className="mr-1 inline h-4 w-4" />
              {new Date(`${note.sessionDate}T12:00:00`).toLocaleDateString(i18n.language, { dateStyle: 'full' })}
            </span>
          )}
          {note.xp !== null && <span className="font-semibold">{t('dmNotes.xpValue', { xp: note.xp })}</span>}
        </p>
      )}

      {note.body ? (
        <Markdown
          links
          className="max-w-none"
          onTaskToggle={readOnly ? undefined : (index) => patch({ body: toggleTask(note.body, index) })}
          onInternalLink={(href) => onSelect(href.slice(4))}
        >
          {prepareBody(note.body, byTitle, t('dmNotes.secret'))}
        </Markdown>
      ) : (
        <p className="italic text-parchment-700 dark:text-parchment-400">{t('dmNotes.noText')}</p>
      )}

      {note.kind === 'table' && note.tableRows.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="flex-1 font-display font-bold">{t('dmNotes.table')}</h3>
            <button type="button" className="btn-primary !py-1 text-sm" onClick={doRoll}>
              <Dices className="h-4 w-4" />
              {t('dmNotes.rollTable', { sides: tableDie(note.tableRows).sides })}
            </button>
          </div>
          {roll && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200" aria-live="polite">
              {t('dmNotes.rolled', { value: roll.value, text: roll.index >= 0 ? parseTableRow(note.tableRows[roll.index]).text : '–' })}
            </p>
          )}
          <ol className="divide-y divide-parchment-300/70 rounded-lg border border-parchment-300 text-sm dark:divide-night-700 dark:border-night-700">
            {note.tableRows.map((r, i) => {
              const p = parseTableRow(r);
              return (
                <li key={i} className={`flex gap-3 px-3 py-1.5 ${roll?.index === i ? 'bg-amber-100 font-semibold dark:bg-amber-950' : ''}`}>
                  <span className="w-12 shrink-0 tabular-nums text-parchment-700 dark:text-parchment-400">{p.from !== null ? (p.to !== p.from ? `${p.from}–${p.to}` : p.from) : i + 1}</span>
                  <span>{p.text}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {note.kind === 'encounter' && (
        <section className="space-y-2">
          <h3 className="font-display font-bold">{t('dmNotes.monsters')}</h3>
          {note.monsters.length ? (
            <ul className="flex flex-wrap gap-2 text-sm">
              {note.monsters.map((m) => (
                <li key={m.templateId} className="rounded-full bg-red-100 px-3 py-0.5 text-red-900 dark:bg-red-950 dark:text-red-200">
                  {m.count}× {m.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic">{t('dmNotes.noMonsters')}</p>
          )}
          {!readOnly && (
            <button type="button" className="btn-primary !py-1 text-sm" onClick={prepareFight} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Swords className="h-4 w-4" />}
              {t('dmNotes.prepareFight')}
            </button>
          )}
        </section>
      )}

      {linkedChars.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">{t('dmNotes.characters')}</h3>
          <div className="flex flex-wrap gap-2">
            {linkedChars.map((c) => (
              <Link key={c.id} to={`/characters/${c.id}`} className="inline-flex items-center gap-1 rounded-full border border-parchment-400 px-2.5 py-0.5 text-sm hover:bg-parchment-200 dark:border-night-700 dark:hover:bg-night-700">
                <UserRound className="h-3.5 w-3.5" />
                {c.name || '—'}
                {c.owner && <span className="text-xs opacity-70">({c.owner.username})</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {kids.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">{t('dmNotes.children')}</h3>
          <ul className="flex flex-wrap gap-2">
            {kids.map((k) => {
              const KIcon = KIND_ICON[k.kind];
              return (
                <li key={k.id}>
                  <button type="button" className="inline-flex items-center gap-1 rounded-md border border-parchment-400 px-2 py-0.5 text-sm hover:bg-parchment-200 dark:border-night-700 dark:hover:bg-night-700" onClick={() => onSelect(k.id)}>
                    <KIcon className="h-3.5 w-3.5" />
                    {k.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {backlinks.length > 0 && (
        <section>
          <h3 className="mb-1 flex items-center gap-1 text-sm font-semibold">
            <Link2 className="h-4 w-4" />
            {t('dmNotes.backlinks')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {backlinks.map((b) => (
              <button key={b.id} type="button" className="wiki-link text-sm" onClick={() => onSelect(b.id)}>
                {b.title}
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className="space-y-0.5 border-t border-parchment-300/70 pt-2 text-xs text-parchment-700 dark:border-night-700 dark:text-parchment-400">
        {note.sharedAt && (
          <p className="flex items-center gap-1 text-sky-800 dark:text-sky-300">
            <Share2 className="h-3.5 w-3.5" />
            {t('dmNotes.sharedAt', { date: date(note.sharedAt), where: sharedText })}
          </p>
        )}
        <p>{t('dmNotes.updated', { date: date(note.updatedAt), user: note.updatedBy ?? '–' })}</p>
      </footer>

      {dialog === 'share' && <ShareDialog note={note} storyId={storyId} onClose={() => setDialog(null)} onShared={(n) => (onReplace(n), setDialog(null))} />}
      {dialog === 'versions' && <VersionsDialog note={note} onClose={() => setDialog(null)} onRestored={(n) => (onReplace(n), setDialog(null))} />}
    </article>
  );
}

// ---------------------------------------------------------------- Freigeben

function ShareDialog({ note, storyId, onClose, onShared }: { note: DmNoteDto; storyId: string; onClose: () => void; onShared: (n: DmNoteDto) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const [to, setTo] = useState<'board' | 'chat'>('board');
  const [players, setPlayers] = useState<ChatContactDto[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.chatStory(storyId).then((r) => setPlayers(r.contacts.filter((c) => c.userId !== user?.id)), () => setPlayers([]));
  }, [storyId, user?.id]);
  const preview = stripDmSecrets(note.body);
  const share = async () => {
    setBusy(true);
    try {
      const r = await api.shareDmNote(note.id, to === 'board' ? { to } : { to, userIds: [...chosen] });
      toast.success(t(to === 'board' ? 'dmNotes.sharedToBoard' : 'dmNotes.sharedToChat'));
      onShared(r.note);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={t('dmNotes.shareTitle', { name: note.title })}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" role="radiogroup">
          <label className="chip-check">
            <input type="radio" name="dmshare" checked={to === 'board'} onChange={() => setTo('board')} />
            {t('dmNotes.shareBoard')}
          </label>
          <label className="chip-check">
            <input type="radio" name="dmshare" checked={to === 'chat'} onChange={() => setTo('chat')} />
            {t('dmNotes.shareChat')}
          </label>
        </div>
        {to === 'chat' && (
          <div className="flex flex-wrap gap-2">
            {players === null ? (
              <Spinner />
            ) : (
              players.map((p) => (
                <label key={p.userId} className="chip-check">
                  <input type="checkbox" checked={chosen.has(p.userId)} onChange={() => setChosen((s) => (s.has(p.userId) ? new Set([...s].filter((x) => x !== p.userId)) : new Set([...s, p.userId])))} />
                  {p.username}
                </label>
              ))
            )}
          </div>
        )}
        <div>
          <p className="mb-1 text-sm font-semibold">{t('dmNotes.sharePreview')}</p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-parchment-300 bg-white/60 p-3 dark:border-night-700 dark:bg-night-900/50">
            <p className="font-display font-bold">{note.title}</p>
            {preview ? <Markdown className="text-sm">{preview}</Markdown> : <p className="text-sm italic">{t('dmNotes.noText')}</p>}
          </div>
          <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">{t('dmNotes.shareHint')}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={share} disabled={busy || (to === 'chat' && chosen.size === 0)}>
            {busy ? <Spinner className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {t('dmNotes.share')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Versionen

function VersionsDialog({ note, onClose, onRestored }: { note: DmNoteDto; onClose: () => void; onRestored: (n: DmNoteDto) => void }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [versions, setVersions] = useState<DmNoteVersionDto[] | null>(null);
  const [shown, setShown] = useState<DmNoteVersionDto | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.dmNoteVersions(note.id).then((r) => (setVersions(r.versions), setShown(r.versions[0] ?? null)), () => setVersions([]));
  }, [note.id]);
  const restore = async (v: DmNoteVersionDto) => {
    setBusy(true);
    try {
      onRestored((await api.restoreDmNoteVersion(note.id, v.id)).note);
      toast.success(t('dmNotes.restored'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} size="max-w-4xl" title={t('dmNotes.versionsTitle', { name: note.title })}>
      {versions === null ? (
        <Spinner />
      ) : versions.length === 0 ? (
        <p className="italic">{t('dmNotes.noVersions')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {versions.map((v) => (
              <li key={v.id}>
                <button type="button" className={`w-full rounded-md px-2 py-1 text-left text-sm ${shown?.id === v.id ? 'bg-parchment-300/70 dark:bg-night-700' : 'hover:bg-parchment-200/60 dark:hover:bg-night-700/50'}`} onClick={() => setShown(v)}>
                  <span className="block font-semibold">{new Date(v.createdAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span className="block truncate text-xs opacity-80">
                    {v.title} · {v.updatedBy ?? '–'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {shown && (
            <div className="min-w-0 space-y-2">
              <div className="max-h-[52vh] overflow-y-auto rounded-lg border border-parchment-300 p-3 dark:border-night-700">
                <p className="font-display text-lg font-bold">{shown.title}</p>
                {shown.body ? <Markdown className="text-sm">{shown.body}</Markdown> : <p className="text-sm italic">{t('dmNotes.noText')}</p>}
              </div>
              <button type="button" className="btn-primary" onClick={() => restore(shown)} disabled={busy}>
                {busy ? <Spinner className="h-4 w-4" /> : <History className="h-4 w-4" />}
                {t('dmNotes.restore')}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- Bearbeiten

function NoteForm({
  storyId,
  note,
  defaultParent,
  flat,
  allTags,
  characters,
  onSave,
  onCancel,
}: {
  storyId: string;
  note?: DmNoteDto;
  defaultParent: string | null;
  flat: { note: DmNoteDto; depth: number }[];
  allTags: string[];
  characters: CharacterSummaryDto[];
  onSave: (input: DmNoteInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [kind, setKind] = useState<DmNoteKind>(note?.kind ?? (defaultParent ? 'scene' : 'chapter'));
  const [status, setStatus] = useState<DmNoteStatus>(note?.status ?? 'none');
  const [parentId, setParentId] = useState<string>(note?.parentId ?? defaultParent ?? '');
  const [tags, setTags] = useState((note?.tags ?? []).join(', '));
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [gameDate, setGameDate] = useState(note?.gameDate ?? '');
  const [sessionDate, setSessionDate] = useState(note?.sessionDate ?? '');
  const [xp, setXp] = useState(note?.xp != null ? String(note.xp) : '');
  const [tableRows, setTableRows] = useState((note?.tableRows ?? []).join('\n'));
  const [monsters, setMonsters] = useState<DmNoteMonster[]>(note?.monsters ?? []);
  const [charIds, setCharIds] = useState<Set<string>>(new Set(note?.characterIds ?? []));
  const [templates, setTemplates] = useState<MonsterTemplateDto[] | null>(null);
  const [pick, setPick] = useState({ templateId: '', count: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (kind === 'encounter' && templates === null) api.monsterTemplates(storyId).then((r) => setTemplates(r.templates), () => setTemplates([]));
  }, [kind, templates, storyId]);

  // Nicht unter sich selbst oder eigene Unterabschnitte einordnen
  const blocked = useMemo(() => {
    const out = new Set<string>();
    if (!note) return out;
    out.add(note.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const { note: n } of flat) if (n.parentId && out.has(n.parentId) && !out.has(n.id)) (out.add(n.id), (grew = true));
    }
    return out;
  }, [note, flat]);

  const onImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const { url } = await api.uploadDmNoteImage(storyId, await resizeImage(file, 1600));
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '');
      setBody((b) => `${b.trimEnd()}${b.trim() ? '\n\n' : ''}![${alt}](${url})\n`.slice(0, MAX_DM_NOTE_BODY));
    } catch (err) {
      toast.error(err instanceof Error && err.message === 'too_large' ? t('sheet.imageError') : errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        body,
        kind,
        status,
        parentId: parentId || null,
        tags: tags
          .split(',')
          .map((s) => s.trim().replace(/^#/, ''))
          .filter(Boolean),
        pinned,
        gameDate: gameDate.trim(),
        sessionDate: kind === 'session' ? sessionDate : '',
        xp: kind === 'session' && xp.trim() ? Math.max(0, Math.round(Number(xp)) || 0) : null,
        tableRows: kind === 'table' ? tableRows.split('\n').map((r) => r.trim()).filter(Boolean) : [],
        monsters: kind === 'encounter' ? monsters : [],
        characterIds: [...charIds],
      });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="dmn-title">
            {t('dmNotes.title')}
          </label>
          <input id="dmn-title" className="input" value={title} maxLength={120} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder={t('dmNotes.titlePlaceholder')} />
        </div>
        <div>
          <label className="label" htmlFor="dmn-kind">
            {t('dmNotes.kindLabel')}
          </label>
          <select id="dmn-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as DmNoteKind)}>
            {DM_NOTE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`dmNotes.kind.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dmn-parent">
            {t('dmNotes.parent')}
          </label>
          <select id="dmn-parent" className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">{t('dmNotes.topLevel')}</option>
            {flat
              .filter(({ note: n }) => !blocked.has(n.id))
              .map(({ note: n, depth }) => (
                <option key={n.id} value={n.id}>
                  {'  '.repeat(depth)}
                  {n.title}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dmn-status">
            {t('dmNotes.statusLabel')}
          </label>
          <select id="dmn-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as DmNoteStatus)}>
            {DM_NOTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`dmNotes.status.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dmn-tags">
            {t('dmNotes.tags')}
          </label>
          <input id="dmn-tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('dmNotes.tagsPlaceholder')} list="dmn-tag-list" />
          <datalist id="dmn-tag-list">
            {allTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="dmn-gamedate">
            {t('dmNotes.gameDate')}
          </label>
          <input id="dmn-gamedate" className="input" value={gameDate} maxLength={80} onChange={(e) => setGameDate(e.target.value)} placeholder={t('dmNotes.gameDatePlaceholder')} />
        </div>
        <label className="chip-check self-end">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          <Pin className="h-4 w-4" />
          {t('dmNotes.pinForSession')}
        </label>
        {kind === 'session' && (
          <>
            <div>
              <label className="label" htmlFor="dmn-session">
                {t('dmNotes.sessionDate')}
              </label>
              <input id="dmn-session" type="date" className="input" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="dmn-xp">
                {t('dmNotes.xp')}
              </label>
              <input id="dmn-xp" type="number" min={0} className="input" value={xp} onChange={(e) => setXp(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {kind === 'table' && (
        <div>
          <label className="label" htmlFor="dmn-table">
            {t('dmNotes.tableRows')}
          </label>
          <textarea id="dmn-table" className="input min-h-[8rem] font-mono text-sm" value={tableRows} onChange={(e) => setTableRows(e.target.value)} placeholder={t('dmNotes.tableRowsPlaceholder')} />
          <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">{t('dmNotes.tableRowsHint')}</p>
        </div>
      )}

      {kind === 'encounter' && (
        <fieldset className="space-y-2">
          <legend className="label">{t('dmNotes.monsters')}</legend>
          {monsters.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {monsters.map((m) => (
                <li key={m.templateId} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
                  {m.count}× {m.name}
                  <button type="button" className="btn-icon !p-0.5" onClick={() => setMonsters((l) => l.filter((x) => x.templateId !== m.templateId))} aria-label={`${t('common.delete')}: ${m.name}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {templates === null ? (
            <Spinner />
          ) : templates.length === 0 ? (
            <p className="text-sm italic">{t('dmNotes.noTemplates')}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select className="input !w-auto min-w-[12rem] flex-1" value={pick.templateId} onChange={(e) => setPick((p) => ({ ...p, templateId: e.target.value }))} aria-label={t('dmNotes.monster')}>
                <option value="">{t('dmNotes.pickMonster')}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
              <input type="number" min={1} max={20} className="input !w-20" value={pick.count} onChange={(e) => setPick((p) => ({ ...p, count: Math.max(1, Math.min(20, Number(e.target.value) || 1)) }))} aria-label={t('dmNotes.count')} />
              <button
                type="button"
                className="btn-secondary"
                disabled={!pick.templateId}
                onClick={() => {
                  const tpl = templates.find((x) => x.id === pick.templateId);
                  if (!tpl) return;
                  setMonsters((l) => [...l.filter((x) => x.templateId !== tpl.id), { templateId: tpl.id, name: tpl.name, count: pick.count }].slice(0, 20));
                  setPick({ templateId: '', count: 1 });
                }}
              >
                <Plus className="h-4 w-4" />
                {t('dmNotes.addMonster')}
              </button>
            </div>
          )}
        </fieldset>
      )}

      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <label className="label !mb-0 flex-1" htmlFor="dmn-body">
            {t('dmNotes.body')}
          </label>
          <button type="button" className="btn-ghost !px-2 !py-0.5 text-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            <ImagePlus className="h-4 w-4" />
            {t('dmNotes.insertImage')}
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={onImage} tabIndex={-1} aria-label={t('dmNotes.insertImage')} />
        </div>
        <MarkdownEditor id="dmn-body" value={body} onChange={(v) => setBody(v.slice(0, MAX_DM_NOTE_BODY))} rows={14} />
        <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">{t('dmNotes.syntaxHint')}</p>
      </div>

      {characters.length > 0 && (
        <fieldset>
          <legend className="label">{t('dmNotes.characters')}</legend>
          <div className="flex flex-wrap gap-2">
            {characters.map((c) => (
              <label key={c.id} className="chip-check">
                <input type="checkbox" checked={charIds.has(c.id)} onChange={() => setCharIds((s) => (s.has(c.id) ? new Set([...s].filter((x) => x !== c.id)) : new Set([...s, c.id])))} />
                {c.name || '—'}
                {c.owner && <span className="text-xs opacity-70">({c.owner.username})</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn-primary" disabled={busy || !title.trim()}>
          {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {t('common.save')}
        </button>
      </div>
    </form>
  );
}
