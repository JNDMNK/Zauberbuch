import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useLiveEvent } from './useLiveEvents';

const EVENT = 'zauberbuch:combat-active';
const POLL_MS = 120_000;

export const refreshCombatActive = () => window.dispatchEvent(new Event(EVENT));

/** Anzahl laufender Kämpfe in den eigenen Geschichten (Markierung im Menü) */
export function useCombatActive(enabled: boolean): number {
  const [count, setCount] = useState(0);
  useLiveEvent((e) => e.type === 'combat', () => window.dispatchEvent(new Event(EVENT)));
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
  }, [enabled]);
  return count;
}
