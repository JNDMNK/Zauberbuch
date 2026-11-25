import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Dices, LogOut, MessageCircle, Pencil, Plus, Send, Settings, Trash2, Users, X } from 'lucide-react';
import type { ChatDice, ChatGroupDto, ChatMessageDto, ChatStoryDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useActiveStory } from '../../hooks/useActiveStory';
import { useLiveEvent } from '../../hooks/useLiveEvents';
import { Markdown } from '../Markdown';
import { Spinner } from '../ui';

// Sicherheitsnetz; neue Nachrichten kommen normalerweise sofort per Live-Ereignis
const UNREAD_POLL_MS = 120_000;
const STORY_POLL_MS = 60_000;
const MESSAGES_POLL_MS = 30_000;

interface ChatCtx {
  open: boolean;
  unread: number;
  unreadByStory: Record<string, number>;
  /** Chat öffnen, optional für eine Geschichte und „als Charakter“ */
  openChat: (opts?: { storyId?: string | null; characterId?: string | null }) => void;
  close: () => void;
  /** Würfelwurf zum Senden vormerken und den Chat öffnen */
  shareDice: (dice: ChatDice, characterId?: string) => void;
  refreshUnread: () => void;
}
const Ctx = createContext<ChatCtx | null>(null);
export const useChat = () => useContext(Ctx);

/**
 * Chat je Geschichte: private Zweiergespräche zwischen Mitgliedern (Spieler ↔ DM, Spieler ↔ Spieler).
 * Stellt Zustand und Ungelesen-Zähler bereit und zeigt das Chatfenster am rechten Rand.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<{ storyId: string | null; characterId: string | null; dice: ChatDice | null; key: number }>({ storyId: null, characterId: null, dice: null, key: 0 });
  const [unread, setUnread] = useState({ total: 0, byStory: {} as Record<string, number> });

  const refreshUnread = useCallback(() => {
    if (!user) return;
    api.chatUnread().then(setUnread, () => undefined);
  }, [user]);
  useLiveEvent((e) => e.type === 'chat', refreshUnread);
  useEffect(() => {
    if (!user) return;
    refreshUnread();
    const id = window.setInterval(refreshUnread, UNREAD_POLL_MS);
    return () => window.clearInterval(id);
  }, [user, refreshUnread]);

  const value = useMemo<ChatCtx>(
    () => ({
      open,
      unread: unread.total,
      unreadByStory: unread.byStory,
      openChat: (opts) => {
        setStart((s) => ({ storyId: opts?.storyId ?? null, characterId: opts?.characterId ?? null, dice: null, key: s.key + 1 }));
        setOpen(true);
      },
      close: () => setOpen(false),
      shareDice: (dice, characterId) => {
        setStart((s) => ({ storyId: null, characterId: characterId ?? null, dice, key: s.key + 1 }));
        setOpen(true);
      },
      refreshUnread,
    }),
    [open, unread, refreshUnread],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {open && user && createPortal(<ChatPanel key={start.key} start={start} onClose={() => (setOpen(false), refreshUnread())} />, document.body)}
    </Ctx.Provider>
  );
}

/** Sprechblase mit Zähler in der Kopfzeile */
export function ChatButton() {
  const { t } = useTranslation();
  const chat = useChat();
  if (!chat) return null;
  const label = chat.unread > 0 ? t('chat.unread', { count: chat.unread }) : t('chat.title');
  return (
    <button type="button" className="btn-icon relative" onClick={() => (chat.open ? chat.close() : chat.openChat())} aria-label={label} title={label} aria-expanded={chat.open}>
      <MessageCircle className="h-5 w-5" />
      {chat.unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-red-700 px-1 text-center text-[0.65rem] font-bold leading-[1.1rem] text-white">{chat.unread > 9 ? '9+' : chat.unread}</span>
      )}
    </button>
  );
}

const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

/** Gesprächsziel: Zweiergespräch mit einem Mitglied oder eine Gruppe */
type Target = { kind: 'user'; id: string } | { kind: 'group'; id: string };
type View = { mode: 'list' } | { mode: 'chat'; target: Target } | { mode: 'group-form'; groupId: string | null };

function ChatPanel({ start, onClose }: { start: { storyId: string | null; characterId: string | null; dice: ChatDice | null }; onClose: () => void }) {
  const { t } = useTranslation();
  const chat = useChat()!;
  const { story: activeStory, stories } = useActiveStory();
  const [storyId, setStoryId] = useState<string>(start.storyId ?? activeStory?.id ?? '');
  const [data, setData] = useState<ChatStoryDto | null>(null);
  const [view, setView] = useState<View>({ mode: 'list' });
  const [portraits, setPortraits] = useState<Record<string, string>>({});
  const [pendingDice, setPendingDice] = useState<ChatDice | null>(start.dice);
  // „Schreiben als“: je Geschichte auf dem Server gemerkt; gilt, bis man es selbst ändert
  const [asCharacter, setAsCharacter] = useState('');
  const appliedFor = useRef<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  // Ohne Vorgabe: aktive Geschichte, sonst die erste
  useEffect(() => {
    if (!storyId && stories?.length) setStoryId(activeStory?.id ?? stories[0].id);
  }, [stories, activeStory, storyId]);

  const loadStory = useCallback(async () => {
    if (!storyId) return;
    await api.chatStory(storyId).then(setData, setError);
  }, [storyId]);
  useEffect(() => {
    setData(null);
    setView({ mode: 'list' });
    setPortraits({});
    if (!storyId) return;
    void loadStory();
    api.chatPortraits(storyId).then((r) => setPortraits(r.portraits), () => undefined);
    const id = window.setInterval(loadStory, STORY_POLL_MS);
    return () => window.clearInterval(id);
  }, [storyId, loadStory]);
  useLiveEvent((e) => e.type === 'chat' && e.storyId === storyId, loadStory);
  // Als-Charakter-Auswahl nur mit eigenen Charakteren dieser Geschichte
  useEffect(() => {
    if (data && asCharacter && !data.myCharacters.some((c) => c.id === asCharacter)) setAsCharacter('');
  }, [data, asCharacter]);
  const chooseAs = useCallback(
    (characterId: string) => {
      setAsCharacter(characterId);
      api.chatSpeakAs(storyId, characterId || null).catch(() => undefined);
    },
    [storyId],
  );
  // Beim ersten Laden einer Geschichte: gespeicherte Wahl übernehmen. Wurde der Chat ausdrücklich als ein Charakter
  // geöffnet (Charakterbogen, Würfelbecher), gilt dieser – und wird ebenfalls gemerkt.
  useEffect(() => {
    if (!data || appliedFor.current === data.storyId) return;
    appliedFor.current = data.storyId;
    const explicit = start.characterId && data.myCharacters.some((c) => c.id === start.characterId) ? start.characterId : null;
    if (explicit && explicit !== data.speakAs) chooseAs(explicit);
    else setAsCharacter(explicit ?? data.speakAs ?? '');
  }, [data, start.characterId, chooseAs]);
  // Aus einer Gruppe entfernt oder Gruppe gelöscht → zurück zur Übersicht
  useEffect(() => {
    if (!data) return;
    const gid = view.mode === 'chat' && view.target.kind === 'group' ? view.target.id : view.mode === 'group-form' ? view.groupId : null;
    if (gid && !data.groups.some((g) => g.id === gid)) setView({ mode: 'list' });
  }, [data, view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const target = view.mode === 'chat' ? view.target : null;
  const contact = target?.kind === 'user' ? (data?.contacts.find((c) => c.userId === target.id) ?? null) : null;
  const group = target?.kind === 'group' ? (data?.groups.find((g) => g.id === target.id) ?? null) : null;
  const back = () => (setView({ mode: 'list' }), void loadStory());
  const title = view.mode === 'group-form' ? t(view.groupId ? 'chat.group.settings' : 'chat.group.new') : contact ? contact.username : group ? group.name : t('chat.title');
  const subtitle = contact?.role ? t(`storyRole.${contact.role}`) : group ? group.members.map((m) => m.username).join(', ') : '';
  const unreadTotal = (d: ChatStoryDto) => d.contacts.length + d.groups.length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 sm:bg-black/20" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-label={t('chat.title')} className="flex h-full w-full flex-col border-l border-parchment-400/70 bg-parchment-50 shadow-2xl dark:border-night-700 dark:bg-night-800 sm:w-[28rem]">
        <header className="flex items-center gap-2 border-b border-parchment-400/60 px-3 py-2.5 dark:border-night-700">
          {view.mode !== 'list' ? (
            <button type="button" className="btn-icon" onClick={back} aria-label={t('chat.back')} title={t('chat.back')}>
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <MessageCircle className="ml-1 h-5 w-5" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-bold">{title}</h2>
            {subtitle && <p className="truncate text-xs text-parchment-700 dark:text-parchment-400">{subtitle}</p>}
          </div>
          {group && (
            <button type="button" className="btn-icon" onClick={() => setView({ mode: 'group-form', groupId: group.id })} aria-label={t('chat.group.settings')} title={t('chat.group.settings')}>
              <Settings className="h-5 w-5" />
            </button>
          )}
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
            <X className="h-5 w-5" />
          </button>
        </header>
        {view.mode === 'list' && (stories?.length ?? 0) > 0 && (
          <div className="border-b border-parchment-400/60 px-3 py-2 dark:border-night-700">
            <label htmlFor="chat-story" className="sr-only">
              {t('chat.story')}
            </label>
            <select id="chat-story" className="input" value={storyId} onChange={(e) => setStoryId(e.target.value)}>
              {stories!.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {chat.unreadByStory[s.id] ? ` (${chat.unreadByStory[s.id]})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {pendingDice && view.mode === 'list' && (
          <p className="flex items-center gap-2 border-b border-parchment-400/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-night-700 dark:bg-amber-950/40 dark:text-amber-200">
            <Dices className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t('chat.pickForDice', { expression: pendingDice.expression, total: pendingDice.total })}</span>
            <button type="button" className="btn-icon !p-1" onClick={() => setPendingDice(null)} aria-label={t('chat.removeDice')}>
              <X className="h-4 w-4" />
            </button>
          </p>
        )}

        <div className="min-h-0 flex-1">
          {stories && stories.length === 0 ? (
            <p className="p-6 text-center italic text-parchment-700 dark:text-parchment-400">{t('chat.noStories')}</p>
          ) : error ? (
            <p className="p-6 text-center text-red-700 dark:text-red-400">{errorMessage(t, error)}</p>
          ) : !data ? (
            <div className="flex justify-center p-6">
              <Spinner />
            </div>
          ) : view.mode === 'group-form' ? (
            <GroupForm
              storyId={storyId}
              data={data}
              group={view.groupId ? (data.groups.find((g) => g.id === view.groupId) ?? null) : null}
              onDone={async (groupId) => {
                await loadStory();
                setView(groupId ? { mode: 'chat', target: { kind: 'group', id: groupId } } : { mode: 'list' });
              }}
            />
          ) : target && (contact || group) ? (
            <Conversation
              key={`${target.kind}:${target.id}`}
              storyId={storyId}
              target={target}
              title={contact?.username ?? group?.name ?? ''}
              data={data}
              portraits={portraits}
              asCharacter={asCharacter}
              setAsCharacter={chooseAs}
              pendingDice={pendingDice}
              clearDice={() => setPendingDice(null)}
              onRead={chat.refreshUnread}
            />
          ) : unreadTotal(data) === 0 ? (
            <p className="p-6 text-center italic text-parchment-700 dark:text-parchment-400">{t('chat.noContacts')}</p>
          ) : (
            <div className="h-full overflow-y-auto">
              <div className="flex items-center gap-2 bg-parchment-100/70 px-3 py-1.5 dark:bg-night-900/40">
                <h3 className="flex flex-1 items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-parchment-700 dark:text-parchment-400">
                  <Users className="h-3.5 w-3.5" />
                  {t('chat.group.title')}
                </h3>
                {!data.archived && data.contacts.length > 0 && (
                  <button type="button" className="btn-ghost !px-2 !py-0.5 text-sm" onClick={() => setView({ mode: 'group-form', groupId: null })}>
                    <Plus className="h-4 w-4" />
                    {t('chat.group.new')}
                  </button>
                )}
              </div>
              {data.groups.length === 0 ? (
                <p className="px-3 py-2 text-sm italic text-parchment-700 dark:text-parchment-400">{t('chat.group.none')}</p>
              ) : (
                <ul className="divide-y divide-parchment-300/70 dark:divide-night-700">
                  {data.groups.map((g) => (
                    <li key={g.id}>
                      <ListRow
                        avatar={<Users className="h-5 w-5" />}
                        avatarCls="bg-emerald-800 text-white"
                        name={g.name}
                        extra={t('chat.group.memberCount', { count: g.members.length })}
                        preview={g.last ? `${g.last.mine ? t('chat.you') : g.last.sender}: ${g.last.body || t('chat.deleted')}` : t('chat.noMessages')}
                        unread={g.unread}
                        onClick={() => setView({ mode: 'chat', target: { kind: 'group', id: g.id } })}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="bg-parchment-100/70 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-parchment-700 dark:bg-night-900/40 dark:text-parchment-400">{t('chat.direct')}</h3>
              <ul className="divide-y divide-parchment-300/70 dark:divide-night-700">
                {data.contacts.map((c) => (
                  <li key={c.userId}>
                    <ListRow
                      avatar={initial(c.username)}
                      avatarCls={c.role === 'dm' ? 'bg-red-800 text-white' : 'bg-parchment-300 text-ink dark:bg-night-700 dark:text-parchment-100'}
                      name={c.username}
                      extra={c.role ? t(`storyRole.${c.role}`) : ''}
                      preview={c.last ? `${c.last.mine ? `${t('chat.you')}: ` : ''}${c.last.body || t('chat.deleted')}` : t('chat.noMessages')}
                      unread={c.unread}
                      onClick={() => setView({ mode: 'chat', target: { kind: 'user', id: c.userId } })}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {view.mode === 'list' && data && <p className="border-t border-parchment-400/60 px-3 py-2 text-xs text-parchment-700 dark:border-night-700 dark:text-parchment-400">{t('chat.privacy')}</p>}
      </aside>
    </div>
  );
}

function ListRow({ avatar, avatarCls, name, extra, preview, unread, onClick }: { avatar: ReactNode; avatarCls: string; name: string; extra: string; preview: string; unread: number; onClick: () => void }) {
  return (
    <button type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-parchment-200/60 dark:hover:bg-night-700/60" onClick={onClick}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display font-bold ${avatarCls}`}>{avatar}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={`truncate ${unread ? 'font-bold' : 'font-semibold'}`}>{name}</span>
          {extra && <span className="shrink-0 text-xs text-parchment-700 dark:text-parchment-400">{extra}</span>}
        </span>
        <span className="block truncate text-sm text-parchment-700 dark:text-parchment-400">{preview}</span>
      </span>
      {unread > 0 && <span className="min-w-[1.4rem] rounded-full bg-red-700 px-1.5 text-center text-xs font-bold leading-[1.4rem] text-white">{unread}</span>}
    </button>
  );
}

/** Gruppe anlegen bzw. verwalten (Ersteller) oder ansehen und verlassen (andere Mitglieder) */
function GroupForm({ storyId, data, group, onDone }: { storyId: string; data: ChatStoryDto; group: ChatGroupDto | null; onDone: (groupId: string | null) => void | Promise<void> }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const manage = !group || group.canManage;
  const [name, setName] = useState(group?.name ?? '');
  const [members, setMembers] = useState<Set<string>>(() => new Set(group?.members.map((m) => m.userId).filter((id) => id !== user?.id) ?? []));
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null);
  const toggle = (id: string) => setMembers((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))));

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    try {
      await onDone(await fn());
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      const input = { name: name.trim(), memberIds: [...members] };
      if (group) return (await api.updateChatGroup(group.id, input)).group.id;
      return (await api.createChatGroup(storyId, input)).group.id;
    });

  if (!manage && group) {
    return (
      <div className="h-full space-y-3 overflow-y-auto p-4">
        <h3 className="font-semibold">{t('chat.group.members')}</h3>
        <ul className="space-y-1">
          {group.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-parchment-300 text-xs font-bold text-ink dark:bg-night-700 dark:text-parchment-100">{initial(m.username)}</span>
              {m.username}
              {m.role && <span className="text-xs text-parchment-700 dark:text-parchment-400">{t(`storyRole.${m.role}`)}</span>}
            </li>
          ))}
        </ul>
        <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('chat.group.onlyCreator')}</p>
        {confirm === 'leave' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{t('chat.group.confirmLeave')}</span>
            <button type="button" className="btn-danger" disabled={busy} onClick={() => run(async () => (await api.leaveChatGroup(group.id), null))}>
              {t('chat.group.leave')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button type="button" className="btn-secondary" onClick={() => setConfirm('leave')}>
            <LogOut className="h-4 w-4" />
            {t('chat.group.leave')}
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() && members.size) void save();
      }}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label htmlFor="chat-group-name" className="mb-1 block text-sm font-semibold">
            {t('chat.group.name')}
          </label>
          <input id="chat-group-name" className="input" value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} placeholder={t('chat.group.namePlaceholder')} />
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">{t('chat.group.members')}</legend>
          <div className="flex flex-wrap gap-2">
            {data.contacts.map((c) => (
              <label key={c.userId} className="chip-check">
                <input type="checkbox" checked={members.has(c.userId)} onChange={() => toggle(c.userId)} />
                {c.username}
                {c.role === 'dm' && <span className="text-xs opacity-70">({t('storyRole.dm')})</span>}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-parchment-700 dark:text-parchment-400">{t('chat.group.hint')}</p>
        </fieldset>
        {group && (
          <div className="flex flex-wrap items-center gap-2 border-t border-parchment-300/70 pt-3 dark:border-night-700">
            {confirm ? (
              <>
                <span className="text-sm">{t(confirm === 'delete' ? 'chat.group.confirmDelete' : 'chat.group.confirmLeave')}</span>
                <button type="button" className="btn-danger" disabled={busy} onClick={() => run(async () => (confirm === 'delete' ? await api.deleteChatGroup(group.id) : await api.leaveChatGroup(group.id), null))}>
                  {t(confirm === 'delete' ? 'chat.group.delete' : 'chat.group.leave')}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setConfirm(null)}>
                  {t('common.cancel')}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-secondary" onClick={() => setConfirm('leave')}>
                  <LogOut className="h-4 w-4" />
                  {t('chat.group.leave')}
                </button>
                <button type="button" className="btn-secondary text-red-700 dark:text-red-400" onClick={() => setConfirm('delete')}>
                  <Trash2 className="h-4 w-4" />
                  {t('chat.group.delete')}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-parchment-400/60 px-4 py-3 dark:border-night-700">
        <button type="submit" className="btn-primary w-full" disabled={busy || !name.trim() || members.size === 0}>
          {busy ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {t(group ? 'common.save' : 'chat.group.create')}
        </button>
      </div>
    </form>
  );
}

function Conversation({
  storyId,
  target,
  title,
  data,
  portraits,
  asCharacter,
  setAsCharacter,
  pendingDice,
  clearDice,
  onRead,
}: {
  storyId: string;
  target: Target;
  title: string;
  data: ChatStoryDto;
  portraits: Record<string, string>;
  asCharacter: string;
  setAsCharacter: (v: string) => void;
  pendingDice: ChatDice | null;
  clearDice: () => void;
  onRead: () => void;
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageDto[] | null>(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const since = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const partnerName = title;
  const isGroup = target.kind === 'group';
  const tickRef = useRef<() => Promise<void>>(async () => undefined);
  useLiveEvent((e) => e.type === 'chat' && e.storyId === storyId, () => void tickRef.current());

  const merge = (incoming: ChatMessageDto[]) =>
    setMessages((list) => {
      const map = new Map((list ?? []).map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, m);
      return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });

  useEffect(() => {
    let alive = true;
    since.current = null;
    setMessages(null);
    const tick = async () => {
      try {
        const r = isGroup ? await api.chatGroupMessages(target.id, since.current ?? undefined) : await api.chatMessages(storyId, target.id, since.current ?? undefined);
        if (!alive) return;
        if (since.current === null) setMessages(r.messages);
        else if (r.messages.length) merge(r.messages);
        if (r.messages.some((m) => m.senderId !== user?.id)) onRead();
        since.current = r.serverTime;
      } catch {
        /* nächster Versuch beim nächsten Takt */
      }
    };
    tickRef.current = tick;
    void tick();
    const id = window.setInterval(tick, MESSAGES_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [storyId, target.kind, target.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Neue Nachrichten: nach unten scrollen, solange man unten war
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    if ((!text.trim() && !pendingDice) || busy || data.archived) return;
    setBusy(true);
    try {
      const input = { body: text, characterId: asCharacter || null, dice: pendingDice };
      const r = isGroup ? await api.sendGroupChat(target.id, input) : await api.sendChat(storyId, target.id, input);
      merge([r.message]);
      setText('');
      clearDice();
      stick.current = true;
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };
  const saveEdit = async () => {
    if (!editing?.body.trim()) return;
    try {
      merge([(await api.editChat(editing.id, editing.body.trim())).message]);
      setEditing(null);
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };
  const remove = async (id: string) => {
    if (!window.confirm(t('chat.confirmDelete'))) return;
    try {
      merge([(await api.deleteChat(id)).message]);
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  const time = (iso: string) => {
    const d = new Date(iso);
    const today = new Date().toDateString() === d.toDateString();
    return d.toLocaleString(i18n.language, today ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-full flex-col">
      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        aria-live="polite"
      >
        {!messages ? (
          <div className="flex justify-center p-6">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <p className="p-6 text-center italic text-parchment-700 dark:text-parchment-400">{isGroup ? t('chat.group.start') : t('chat.startWith', { name: partnerName })}</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
            const portrait = m.characterId ? portraits[m.characterId] : undefined;
            const who = m.characterName || (mine ? t('chat.you') : isGroup ? m.senderName : partnerName);
            return (
              <div key={m.id} className={`group flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                {portrait ? (
                  <img src={portrait} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-parchment-300 text-sm font-bold text-ink dark:bg-night-700 dark:text-parchment-100">{initial(who)}</span>
                )}
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? 'rounded-br-sm bg-parchment-800 text-parchment-50 dark:bg-parchment-300 dark:text-night-900' : 'rounded-bl-sm bg-parchment-200 text-ink dark:bg-night-700 dark:text-parchment-100'}`}>
                  {isGroup && !mine ? (
                    <p className="text-xs font-bold opacity-80">{m.characterName ? t('chat.characterOf', { name: m.characterName, user: m.senderName }) : m.senderName}</p>
                  ) : (
                    m.characterName && <p className="text-xs font-bold opacity-80">{t('chat.asCharacterLabel', { name: m.characterName })}</p>
                  )}
                  {m.deleted ? (
                    <p className="italic opacity-70">{t('chat.deleted')}</p>
                  ) : editing?.id === m.id ? (
                    <div className="space-y-1">
                      <textarea
                        className="input min-h-[3rem] !text-ink"
                        value={editing.body}
                        maxLength={4000}
                        autoFocus
                        onChange={(e) => setEditing({ id: m.id, body: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) (e.preventDefault(), void saveEdit());
                          if (e.key === 'Escape') (e.stopPropagation(), setEditing(null));
                        }}
                        aria-label={t('chat.edit')}
                      />
                      <div className="flex justify-end gap-1">
                        <button type="button" className="btn-icon !p-1" onClick={() => setEditing(null)} aria-label={t('common.cancel')}>
                          <X className="h-4 w-4" />
                        </button>
                        <button type="button" className="btn-icon !p-1" onClick={saveEdit} aria-label={t('common.save')}>
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : m.kind === 'dice' && m.dice ? (
                    <div>
                      <p className="flex items-center gap-1.5 text-sm">
                        <Dices className="h-4 w-4" />
                        {m.dice.expression}
                      </p>
                      <p className="font-display text-2xl font-bold tabular-nums">{m.dice.total}</p>
                      {(m.dice.dice.length > 1 || m.dice.modifier !== 0 || m.dice.dice.some((d) => d.dropped !== undefined)) && (
                      <p className="text-xs opacity-80">
                        {m.dice.dice.map((d, i) => (
                          <span key={i} className="mr-1.5">
                            {d.value}
                            {d.dropped !== undefined && <s className="ml-0.5 opacity-60">{d.dropped}</s>}
                          </span>
                        ))}
                        {m.dice.modifier ? (m.dice.modifier > 0 ? `+${m.dice.modifier}` : `−${Math.abs(m.dice.modifier)}`) : ''}
                      </p>
                      )}
                    </div>
                  ) : (
                    <Markdown links className={`!space-y-1 break-words text-[15px] [&_a]:!text-inherit ${mine ? '[&_.wiki-link]:!text-inherit' : ''}`}>
                      {m.body}
                    </Markdown>
                  )}
                  <p className="mt-0.5 text-right text-[0.65rem] opacity-70">
                    {m.edited && !m.deleted && `${t('chat.edited')} · `}
                    {time(m.createdAt)}
                    {mine && !isGroup && m.read && ' · ✓✓'}
                  </p>
                </div>
                {mine && !m.deleted && !data.archived && editing?.id !== m.id && (
                  <div className="flex shrink-0 flex-col opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    {m.kind === 'text' && (
                      <button type="button" className="btn-icon !p-1" onClick={() => setEditing({ id: m.id, body: m.body })} aria-label={t('chat.edit')} title={t('chat.edit')}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button type="button" className="btn-icon !p-1 text-red-700 dark:text-red-400" onClick={() => remove(m.id)} aria-label={t('chat.delete')} title={t('chat.delete')}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {data.archived ? (
        <p className="border-t border-parchment-400/60 px-3 py-3 text-center text-sm italic dark:border-night-700">{t('chat.archived')}</p>
      ) : (
        <div className="space-y-2 border-t border-parchment-400/60 px-3 py-2.5 dark:border-night-700">
          {data.myCharacters.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="chat-as" className="text-parchment-700 dark:text-parchment-400">
                {t('chat.speakAs')}
              </label>
              <select id="chat-as" className="input !w-auto !py-1 text-sm" value={asCharacter} onChange={(e) => setAsCharacter(e.target.value)}>
                <option value="">{user?.username}</option>
                {data.myCharacters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {pendingDice && (
            <p className="flex items-center gap-2 rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <Dices className="h-4 w-4" />
              <span className="flex-1">{t('chat.diceAttached', { expression: pendingDice.expression, total: pendingDice.total })}</span>
              <button type="button" className="btn-icon !p-0.5" onClick={clearDice} aria-label={t('chat.removeDice')}>
                <X className="h-4 w-4" />
              </button>
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              className="input min-h-[2.75rem] flex-1 resize-none"
              rows={Math.min(5, Math.max(1, text.split('\n').length))}
              value={text}
              maxLength={4000}
              placeholder={pendingDice ? t('chat.diceComment') : t('chat.placeholder', { name: partnerName })}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              aria-label={t('chat.placeholder', { name: partnerName })}
            />
            <button type="button" className="btn-primary !px-3" onClick={send} disabled={busy || (!text.trim() && !pendingDice)} aria-label={t('chat.send')} title={t('chat.send')}>
              {busy ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
