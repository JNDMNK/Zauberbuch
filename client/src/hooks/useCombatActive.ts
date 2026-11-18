import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const EVENT = 'zauberbuch:combat-active';
const POLL_MS = 60_000;

export const refreshCombatActive = () => window.dispatchEvent(new Event(EVENT));

/** Anzahl laufender Kämpfe in den eigenen Geschichten (Markierung im Menü) */
export function useCombatActive(enabled: boolean, asPlayer = false): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      api
        .combatActive()
        .then((r) => !cancelled && setCount(r.count))
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
  }, [enabled, asPlayer]);
  return count;
}
