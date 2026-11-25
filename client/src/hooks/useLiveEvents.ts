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
const emit = (e: LiveEvent) => handlers.forEach((h) => h(e));

interface Connection {
  close: () => void;
}
let conn: Connection | null = null;
let wasReady = false;
let retry: number | null = null;
let wanted = false;
let paused = false;
let waitingForLoad = false;

function onReady() {
  // nach einem Abbruch alles einmal nachladen
  if (wasReady) emit({ type: 'resync' });
  wasReady = true;
}
function onChange(data: string) {
  try {
    emit(JSON.parse(data) as LiveEvent);
  } catch {
    /* unbekanntes Format ignorieren */
  }
}
function onClosed(c: Connection) {
  if (conn !== c) return;
  c.close();
  conn = null;
  retry ??= window.setTimeout(() => {
    retry = null;
    connect();
  }, 15_000);
}

function openInPage(): Connection | null {
  if (typeof EventSource === 'undefined') return null;
  const es = new EventSource('/api/events', { withCredentials: true });
  const c: Connection = { close: () => es.close() };
  es.addEventListener('ready', onReady);
  es.addEventListener('change', (m) => onChange((m as MessageEvent<string>).data));
  es.onerror = () => es.readyState === EventSource.CLOSED && onClosed(c);
  return c;
}

function connect() {
  if (conn || paused || !wanted) return;
  // Erst nach dem vollständigen Laden verbinden (sonst kann Safari das Laden als nie beendet ansehen)
  if (document.readyState !== 'complete') {
    if (!waitingForLoad) {
      waitingForLoad = true;
      window.addEventListener('load', () => ((waitingForLoad = false), window.setTimeout(connect, 0)), { once: true });
    }
    return;
  }
  conn = openInPage();
}

/**
 * Drucken (Knopf und ⌘P/Strg+P).
 * Safari/WebKit wertet die dauerhaft offene Live-Verbindung als „Seite lädt noch“ und verschiebt window.print()
 * bis zum Ende des Ladens – also endlos. Deshalb wird sie vor dem Drucken getrennt. Safari meldet „afterprint“ schon,
 * während der Druckdialog noch offen ist; verbunden wird daher erst wieder, wenn man danach etwas tut (Klick,
 * Taste), spätestens nach 2 Minuten. Beim Wiederverbinden lädt alles einmal nach.
 */
export function printPage() {
  if (conn || retry !== null) {
    paused = true;
    if (retry !== null) window.clearTimeout(retry);
    retry = null;
    conn?.close();
    conn = null;
    const since = Date.now();
    const resume = () => {
      if (!paused || Date.now() - since < 1500) return;
      paused = false;
      window.removeEventListener('pointerdown', resume, true);
      window.removeEventListener('keydown', resume, true);
      connect();
    };
    window.addEventListener('pointerdown', resume, true);
    window.addEventListener('keydown', resume, true);
    window.setTimeout(() => {
      if (paused) {
        paused = false;
        window.removeEventListener('pointerdown', resume, true);
        window.removeEventListener('keydown', resume, true);
        connect();
      }
    }, 120_000);
  }
  window.print();
}

function disconnect() {
  if (retry !== null) window.clearTimeout(retry);
  retry = null;
  conn?.close();
  conn = null;
  wasReady = false;
}

/** Hält die Verbindung, solange jemand angemeldet ist (einmal in der App einbinden) */
export function LiveEventsConnection() {
  const { user } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    wanted = true;
    connect();
    // ⌘P / Strg+P über printPage leiten (sonst blockiert die Live-Verbindung den Druck in Safari)
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        printPage();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      wanted = false;
      disconnect();
    };
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
