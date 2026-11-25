import type { Response } from 'express';
import { prisma } from './prisma';
import { logger } from './logger';

/**
 * Live-Aktualisierung per Server-Sent Events.
 * Der Server schickt nur kurze Signale („Infotafel von Geschichte X geändert“) – keine Inhalte. Die Browser laden
 * den betroffenen Bereich daraufhin über die normale API nach; dabei gelten wie immer die Rechte.
 */
export type LiveEvent =
  | { type: 'board'; storyId: string }
  | { type: 'chat'; storyId: string }
  | { type: 'notifications' }
  | { type: 'combat'; storyId: string; encounterId?: string };

interface Client {
  userId: string;
  role: string;
  res: Response;
}

const HEARTBEAT_MS = 25_000;
const clients = new Set<Client>();

/** Neue SSE-Verbindung registrieren (bleibt offen, bis der Browser sie schließt) */
export function addClient(user: { id: string; role: string }, res: Response) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // nginx (auch Nginx Proxy Manager) puffert diese Antwort dann nicht
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write('retry: 5000\n\n');
  res.write('event: ready\ndata: {}\n\n');

  const client: Client = { userId: user.id, role: user.role, res };
  clients.add(client);
  // Kommentarzeile hält Proxys (Standard-Timeout 60 s) und Router wach
  const beat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
  beat.unref();
  const close = () => {
    clearInterval(beat);
    clients.delete(client);
  };
  res.on('close', close);
  res.on('error', close);
}

function send(filter: (c: Client) => boolean, event: LiveEvent) {
  const payload = `event: change\ndata: ${JSON.stringify(event)}\n\n`;
  for (const c of clients) {
    if (!filter(c)) continue;
    try {
      c.res.write(payload);
    } catch (err) {
      logger.warn(`Live-Ereignis konnte nicht gesendet werden: ${String(err)}`);
    }
  }
}

/** An bestimmte Benutzer */
export function publishToUsers(userIds: Iterable<string>, event: LiveEvent) {
  const ids = new Set(userIds);
  if (ids.size === 0 || clients.size === 0) return;
  send((c) => ids.has(c.userId), event);
}

/** An alle, die eine Geschichte sehen: Mitglieder und Admins (Admins sehen jede Geschichte) */
export function publishToStory(storyId: string, event: LiveEvent) {
  if (clients.size === 0) return;
  prisma.storyMember
    .findMany({ where: { storyId }, select: { userId: true } })
    .then((rows) => {
      const ids = new Set(rows.map((r) => r.userId));
      send((c) => ids.has(c.userId) || c.role === 'admin', event);
    })
    .catch((err) => logger.warn(`Live-Ereignis: Mitglieder konnten nicht geladen werden: ${String(err)}`));
}

/** Anzahl offener Verbindungen (für Tests) */
export const liveClientCount = () => clients.size;

/** Beim Herunterfahren alle Verbindungen schließen, sonst wartet server.close() ewig */
export function closeAllClients() {
  for (const c of clients) c.res.end();
  clients.clear();
}
