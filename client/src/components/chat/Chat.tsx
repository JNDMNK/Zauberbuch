import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Dices, MessageCircle, Pencil, Send, Trash2, X } from 'lucide-react';
import type { ChatDice, ChatMessageDto, ChatStoryDto } from '@zauberbuch/shared';
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

function ChatPanel({ start, onClose }: { start: { storyId: string | null; characterId: string | null; dice: ChatDice | null }; onClose: () => void }) {
  const { t } = useTranslation();
  const chat = useChat()!;
  const { story: activeStory, stories } = useActiveStory();
  const [storyId, setStoryId] = useState<string>(start.storyId ?? activeStory?.id ?? '');
  const [data, setData] = useState<ChatStoryDto | null>(null);
  const [partner, setPartner] = useState<string | null>(null);
  const [portraits, setPortraits] = useState<Record<string, string>>({});
  const [pendingDice, setPendingDice] = useState<ChatDice | null>(start.dice);
  const [asCharacter, setAsCharacter] = useState<string>(start.characterId ?? '');
  const [error, setError] = useState<unknown>(null);

  // Ohne Vorgabe: aktive Geschichte, sonst die erste
  useEffect(() => {
    if (!storyId && stories?.length) setStoryId(activeStory?.id ?? stories[0].id);
  }, [stories, activeStory, storyId]);

  const loadStory = useCallback(() => {
    if (!storyId) return;
    api.chatStory(storyId).then(setData, setError);
  }, [storyId]);
  useEffect(() => {
    setData(null);
    setPartner(null);
    setPortraits({});
    if (!storyId) return;
    loadStory();
    api.chatPortraits(storyId).then((r) => setPortraits(r.portraits), () => undefined);
    const id = window.setInterval(loadStory, STORY_POLL_MS);
    return () => window.clearInterval(id);
  }, [storyId, loadStory]);
  useLiveEvent((e) => e.type === 'chat' && e.storyId === storyId, loadStory);
  // Als-Charakter-Auswahl nur mit eigenen Charakteren dieser Geschichte
  useEffect(() => {
    if (data && asCharacter && !data.myCharacters.some((c) => c.id === asCharacter)) setAsCharacter('');
  }, [data, asCharacter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const contact = data?.contacts.find((c) => c.userId === partner) ?? null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 sm:bg-black/20" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-label={t('chat.title')} className="flex h-full w-full flex-col border-l border-parchment-400/70 bg-parchment-50 shadow-2xl dark:border-night-700 dark:bg-night-800 sm:w-[28rem]">
        <header className="flex items-center gap-2 border-b border-parchment-400/60 px-3 py-2.5 dark:border-night-700">
          {partner ? (
            <button type="button" className="btn-icon" onClick={() => (setPartner(null), loadStory())} aria-label={t('chat.back')} title={t('chat.back')}>
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <MessageCircle className="ml-1 h-5 w-5" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-bold">{contact ? contact.username : t('chat.title')}</h2>
            {contact?.role && <p className="text-xs text-parchment-700 dark:text-parchment-400">{t(`storyRole.${contact.role}`)}</p>}
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
            <X className="h-5 w-5" />
          </button>
        </header>
        {!partner && (stories?.length ?? 0) > 0 && (
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
        {pendingDice && !partner && (
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
          ) : partner ? (
            <Conversation
              storyId={storyId}
              partnerId={partner}
              data={data}
              portraits={portraits}
              asCharacter={asCharacter}
              setAsCharacter={setAsCharacter}
              pendingDice={pendingDice}
              clearDice={() => setPendingDice(null)}
              onRead={chat.refreshUnread}
            />
          ) : data.contacts.length === 0 ? (
            <p className="p-6 text-center italic text-parchment-700 dark:text-parchment-400">{t('chat.noContacts')}</p>
          ) : (
            <ul className="h-full divide-y divide-parchment-300/70 overflow-y-auto dark:divide-night-700">
              {data.contacts.map((c) => (
                <li key={c.userId}>
                  <button type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-parchment-200/60 dark:hover:bg-night-700/60" onClick={() => setPartner(c.userId)}>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display font-bold ${c.role === 'dm' ? 'bg-red-800 text-white' : 'bg-parchment-300 text-ink dark:bg-night-700 dark:text-parchment-100'}`}>{initial(c.username)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={`truncate ${c.unread ? 'font-bold' : 'font-semibold'}`}>{c.username}</span>
                        {c.role && <span className="text-xs text-parchment-700 dark:text-parchment-400">{t(`storyRole.${c.role}`)}</span>}
                      </span>
                      <span className="block truncate text-sm text-parchment-700 dark:text-parchment-400">{c.last ? `${c.last.mine ? `${t('chat.you')}: ` : ''}${c.last.body || t('chat.deleted')}` : t('chat.noMessages')}</span>
                    </span>
                    {c.unread > 0 && <span className="min-w-[1.4rem] rounded-full bg-red-700 px-1.5 text-center text-xs font-bold leading-[1.4rem] text-white">{c.unread}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!partner && data && <p className="border-t border-parchment-400/60 px-3 py-2 text-xs text-parchment-700 dark:border-night-700 dark:text-parchment-400">{t('chat.privacy')}</p>}
      </aside>
    </div>
  );
}

function Conversation({
  storyId,
  partnerId,
  data,
  portraits,
  asCharacter,
  setAsCharacter,
  pendingDice,
  clearDice,
  onRead,
}: {
  storyId: string;
  partnerId: string;
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
  const partnerName = data.contacts.find((c) => c.userId === partnerId)?.username ?? '';
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
        const r = await api.chatMessages(storyId, partnerId, since.current ?? undefined);
        if (!alive) return;
        if (since.current === null) setMessages(r.messages);
        else if (r.messages.length) merge(r.messages);
        if (r.messages.some((m) => m.senderId === partnerId)) onRead();
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
  }, [storyId, partnerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Neue Nachrichten: nach unten scrollen, solange man unten war
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    if ((!text.trim() && !pendingDice) || busy || data.archived) return;
    setBusy(true);
    try {
      const r = await api.sendChat(storyId, partnerId, { body: text, characterId: asCharacter || null, dice: pendingDice });
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
          <p className="p-6 text-center italic text-parchment-700 dark:text-parchment-400">{t('chat.startWith', { name: partnerName })}</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
            const portrait = m.characterId ? portraits[m.characterId] : undefined;
            const who = m.characterName || (mine ? t('chat.you') : partnerName);
            return (
              <div key={m.id} className={`group flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                {portrait ? (
                  <img src={portrait} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-parchment-300 text-sm font-bold text-ink dark:bg-night-700 dark:text-parchment-100">{initial(who)}</span>
                )}
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? 'rounded-br-sm bg-parchment-800 text-parchment-50 dark:bg-parchment-300 dark:text-night-900' : 'rounded-bl-sm bg-parchment-200 text-ink dark:bg-night-700 dark:text-parchment-100'}`}>
                  {m.characterName && <p className="text-xs font-bold opacity-80">{t('chat.asCharacterLabel', { name: m.characterName })}</p>}
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
                    {mine && m.read && ' · ✓✓'}
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
