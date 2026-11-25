import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Live-Aktualisierung per Server-Sent Events (`/api/events`).
 * Der Server meldet nur, *was* sich geändert hat; die Bereiche laden dann selbst nach. Nach einem Verbindungsabbruch
 * verbindet sich der Browser neu und alle Bereiche laden einmal nach (`resync`), damit nichts verpasst wird.
 * Die bisherigen Abfragen bleiben als seltenes Sicherheitsnetz bestehen.
 */
export type LiveEvent =
  | { type: 'board'; storyId: string }
  | { type: 'chat'; storyId: string }
  | { type: 'notifications' }
  | { type: 'combat'; storyId: string }
  | { type: 'resync' };

type Handler = (e: LiveEvent) => void;
const handlers = new Set<Handler>();
let source: EventSource | null = null;
let wasReady = false;
let retry: number | null = null;

const emit = (e: LiveEvent) => handlers.forEach((h) => h(e));

function connect() {
  if (source || typeof EventSource === 'undefined') return;
  const es = new EventSource('/api/events', { withCredentials: true });
  source = es;
  es.addEventListener('ready', () => {
    // nach einem Abbruch alles einmal nachladen
    if (wasReady) emit({ type: 'resync' });
    wasReady = true;
  });
  es.addEventListener('change', (m) => {
    try {
      emit(JSON.parse((m as MessageEvent<string>).data) as LiveEvent);
    } catch {
      /* unbekanntes Format ignorieren */
    }
  });
  es.onerror = () => {
    // Der Browser verbindet sich selbst neu; nur wenn er aufgegeben hat (z. B. 401/502), später erneut versuchen
    if (es.readyState === EventSource.CLOSED && source === es) {
      source = null;
      retry ??= window.setTimeout(() => {
        retry = null;
        connect();
      }, 15_000);
    }
  };
}

function disconnect() {
  if (retry !== null) window.clearTimeout(retry);
  retry = null;
  source?.close();
  source = null;
  wasReady = false;
}

/** Hält die Verbindung, solange jemand angemeldet ist (einmal in der App einbinden) */
export function LiveEventsConnection() {
  const { user } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    connect();
    return disconnect;
  }, [userId]);
  return null;
}

/**
 * Bei passenden Ereignissen `onChange` aufrufen (gebündelt: mehrere Signale kurz hintereinander lösen nur ein
 * Nachladen aus). `resync` passt immer.
 */
export function useLiveEvent(match: (e: LiveEvent) => boolean, onChange: () => void) {
  const ref = useRef({ match, onChange });
  ref.current = { match, onChange };
  useEffect(() => {
    let timer: number | null = null;
    const h: Handler = (e) => {
      if (e.type !== 'resync' && !ref.current.match(e)) return;
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        ref.current.onChange();
      }, 250);
    };
    handlers.add(h);
    return () => {
      handlers.delete(h);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);
}
