import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const EVENT = 'zauberbuch:board-unread';
const POLL_MS = 60_000;

/** Andere Komponenten (z. B. nach dem Lesen einer Geschichte) stoßen damit eine Aktualisierung an */
export const refreshBoardUnread = () => window.dispatchEvent(new Event(EVENT));

/** Anzahl ungelesener Beiträge/Kommentare auf der Infotafel; aktualisiert sich regelmäßig */
export function useBoardUnread(enabled: boolean): number {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setTotal(0);
      return;
    }
    let cancelled = false;
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      api
        .boardUnread()
        .then((r) => !cancelled && setTotal(r.total))
        .catch(() => undefined);
    };
    load();
    const id = window.setInterval(load, POLL_MS);
    window.addEventListener(EVENT, load);
    document.addEventListener('visibilitychange', load);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener(EVENT, load);
      document.removeEventListener('visibilitychange', load);
    };
  }, [enabled]);
  return total;
}
