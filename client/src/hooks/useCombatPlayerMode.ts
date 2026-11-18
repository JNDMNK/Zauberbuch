import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const KEY = 'zauberbuch.combat.asPlayer';
const EVENT = 'zauberbuch:combat-player-mode';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Spielermodus der Kampfhilfe (nur Admins): Der Admin sieht und spielt Kämpfe wie ein Benutzer.
 * Wird pro Browser gemerkt und zwischen Menü und Seiten synchron gehalten.
 */
export function useCombatPlayerMode(): [boolean, (on: boolean) => void] {
  const { isAdmin } = useAuth();
  const [on, setOn] = useState(read);
  useEffect(() => {
    const sync = () => setOn(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const set = useCallback((value: boolean) => {
    try {
      if (value) localStorage.setItem(KEY, '1');
      else localStorage.removeItem(KEY);
    } catch {
      /* ohne Speicher gilt die Einstellung nur bis zum Neuladen */
    }
    setOn(value);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [isAdmin && on, set];
}
