import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { CSRF, app, createUser, loginAs, resetDb } from './helpers';
import { closeAllClients, liveClientCount } from '../src/lib/events';

let server: Server;
let base = '';
beforeAll(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  closeAllClients();
  await new Promise((r) => server.close(r));
});

async function cookieFor(identifier: string, password: string) {
  const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...CSRF }, body: JSON.stringify({ identifier, password }) });
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

/** Öffnet /api/events und sammelt empfangene „change“-Ereignisse */
async function listen(cookie: string) {
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/events`, { headers: { cookie }, signal: ctrl.signal });
  const events: unknown[] = [];
  let buf = '';
  const reader = res.body!.getReader();
  const ready = new Promise<void>((resolve) => {
    void (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) return;
          buf += new TextDecoder().decode(value);
          let i: number;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            if (block.includes('event: ready')) resolve();
            const data = block.match(/^event: change\ndata: (.*)$/m);
            if (data) events.push(JSON.parse(data[1]));
          }
        }
      } catch {
        /* abgebrochen */
      }
    })();
  });
  await ready;
  return { res, events, close: () => ctrl.abort() };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Live-Ereignisse und Reaktionen', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('SSE nur angemeldet; Signale nur an Berechtigte; Likes/Dislikes', async () => {
    expect((await fetch(`${base}/api/events`)).status).toBe(401);

    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('gandalf');
    const frodo = await createUser('frodo');
    const fremd = await createUser('saruman');
    const s = (await admin.post('/api/stories').set(CSRF).send({ name: 'Ringkrieg', members: [{ userId: dm.user.id, role: 'dm' }, { userId: frodo.user.id, role: 'player' }] })).body.story;

    const fFrodo = await listen(await cookieFor('frodo', 'password123'));
    const fFremd = await listen(await cookieFor('saruman', 'password123'));
    expect(fFrodo.res.headers.get('content-type')).toContain('text/event-stream');
    expect(fFrodo.res.headers.get('x-accel-buffering')).toBe('no');
    expect(liveClientCount()).toBe(2);

    // Beitrag des DM → Frodo erhält „board“ und „notifications“, der Fremde nichts
    const post = (await dm.agent.post(`/api/board/stories/${s.id}/posts`).set(CSRF).send({ title: 'Treffpunkt', body: 'Bree', category: 'places' })).body.post;
    expect(post).toMatchObject({ likedBy: [], dislikedBy: [], myReaction: 0 });
    // Chat DM → Frodo
    await dm.agent.post(`/api/chat/stories/${s.id}/with/${frodo.user.id}`).set(CSRF).send({ body: 'Hallo' });
    await wait(200);
    expect(fFrodo.events).toEqual(expect.arrayContaining([{ type: 'board', storyId: s.id }, { type: 'notifications' }, { type: 'chat', storyId: s.id }]));
    expect(fFremd.events).toEqual([]);

    // Reaktionen: Like, Wechsel zu Dislike, zurücknehmen; je Benutzer nur eine
    const react = (agent: typeof frodo.agent, value: number) => agent.put(`/api/board/posts/${post.id}/reaction`).set(CSRF).send({ value });
    expect((await react(frodo.agent, 1)).body.post).toMatchObject({ likedBy: ['frodo'], dislikedBy: [], myReaction: 1 });
    expect((await react(dm.agent, 1)).body.post.likedBy).toEqual(['frodo', 'gandalf']);
    expect((await react(frodo.agent, -1)).body.post).toMatchObject({ likedBy: ['gandalf'], dislikedBy: ['frodo'], myReaction: -1 });
    expect((await react(frodo.agent, 0)).body.post).toMatchObject({ dislikedBy: [], myReaction: 0 });
    expect((await react(frodo.agent, 2)).status).toBe(400);
    expect((await react(fremd.agent, 1)).status).toBe(404);
    // Liste liefert die eigene Reaktion je Benutzer
    const list = (await dm.agent.get(`/api/board/stories/${s.id}/posts`)).body.posts[0];
    expect(list).toMatchObject({ likedBy: ['gandalf'], myReaction: 1 });

    fFrodo.close();
    fFremd.close();
    await wait(100);
    expect(liveClientCount()).toBe(0);
  });
});
