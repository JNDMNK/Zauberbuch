import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Trash2 } from 'lucide-react';
import type { NotificationDto } from '@zauberbuch/shared';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';

const POLL_MS = 30_000;

/** Glocke mit ungelesenen Benachrichtigungen; neue werden zusätzlich kurz eingeblendet */
export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const text = useCallback((n: NotificationDto) => t(`notifications.types.${n.type}`, { ...n.data, defaultValue: n.type }), [t]);

  const load = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    api
      .notifications()
      .then((r) => {
        setItems(r.notifications);
        setUnread(r.unread);
        // Beim ersten Laden nur merken; danach neue ungelesene als Hinweis einblenden
        const fresh = r.notifications.filter((n) => !n.readAt && seen.current && !seen.current.has(n.id));
        fresh.slice(0, 3).forEach((n) => toast.show(text(n)));
        seen.current = new Set(r.notifications.map((n) => n.id));
      })
      .catch(() => undefined);
  }, [toast, text]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    document.addEventListener('visibilitychange', load);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', load);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    // Beim Öffnen als gelesen markieren (die Liste zeigt sie dabei noch als neu hervorgehoben)
    if (next && unread > 0) {
      setUnread(0);
      api.markNotificationsRead().catch(() => undefined);
    }
    if (!next) setItems((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
  };

  const clear = async () => {
    await api.clearNotifications().catch(() => undefined);
    setItems([]);
    setUnread(0);
  };

  const label = unread > 0 ? t('notifications.unread', { count: unread }) : t('notifications.title');
  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn-icon relative" onClick={toggle} aria-expanded={open} aria-haspopup="dialog" aria-label={label} title={label}>
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-red-700 px-1 text-center text-[0.65rem] font-bold leading-[1.1rem] text-white">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label={t('notifications.title')} className="parchment absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-parchment-400/60 px-4 py-2 dark:border-night-700">
            <h2 className="font-display text-sm font-bold">{t('notifications.title')}</h2>
            {items.length > 0 && (
              <button type="button" className="inline-flex items-center gap-1 text-xs underline" onClick={clear}>
                <Trash2 className="h-3.5 w-3.5" />
                {t('notifications.clear')}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-parchment-700 dark:text-parchment-400">{t('notifications.empty')}</p>
          ) : (
            <ul className="max-h-96 divide-y divide-parchment-300/70 overflow-y-auto dark:divide-night-700">
              {items.map((n) => (
                <li key={n.id} className={`px-4 py-3 text-sm ${n.readAt ? '' : 'bg-amber-50 dark:bg-amber-950/40'}`}>
                  <p>{text(n)}</p>
                  <p className="mt-0.5 text-xs text-parchment-700 dark:text-parchment-400">{new Date(n.createdAt).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
