import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, resetDb } from './helpers';

// 1×1-PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('Profilbilder', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('setzen, ausliefern, im Chat verwenden, entfernen', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const s = (await admin.post('/api/stories').set(CSRF).send({ name: 'Ringkrieg', members: [{ userId: frodo.user.id, role: 'player' }, { userId: sam.user.id, role: 'player' }] })).body.story;

    expect((await frodo.agent.get('/api/auth/me')).body.user.avatarUrl).toBeNull();
    expect((await frodo.agent.put('/api/auth/me/avatar').set(CSRF).send({ avatar: 'data:image/svg+xml;base64,PHN2Zz4=' })).status).toBe(400);
    expect((await frodo.agent.put('/api/auth/me/avatar').set(CSRF).send({ avatar: 'x'.repeat(10) })).status).toBe(400);
    const set = await frodo.agent.put('/api/auth/me/avatar').set(CSRF).send({ avatar: PNG });
    expect(set.status).toBe(200);
    const url = set.body.user.avatarUrl as string;
    expect(url).toMatch(new RegExp(`^/api/avatars/${frodo.user.id}\\?v=\\d+$`));

    // Ausliefern: angemeldet ja, sonst nein
    const img = await sam.agent.get(url);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.body.length).toBeGreaterThan(50);
    const { default: request } = await import('supertest');
    const { app } = await import('./helpers');
    expect((await request(app).get(url)).status).toBe(401);
    expect((await sam.agent.get(`/api/avatars/${sam.user.id}`)).status).toBe(404);

    // Chat: Profilbild und Charakter mit Porträt je Mitglied
    const char = (await sam.agent.post('/api/characters').set(CSRF).send({ name: 'Sam', storyId: s.id })).body.character;
    await sam.agent.put(`/api/characters/${char.id}`).set(CSRF).send({ data: { ...char.data, portrait: PNG } });
    await sam.agent.post('/api/characters').set(CSRF).send({ name: 'Ohne Bild', storyId: s.id });
    const people = (await frodo.agent.get(`/api/chat/stories/${s.id}`)).body.people;
    expect(people[frodo.user.id]).toEqual({ avatarUrl: url, characterId: null });
    expect(people[sam.user.id]).toEqual({ avatarUrl: null, characterId: char.id });

    // Entfernen
    const del = await frodo.agent.put('/api/auth/me/avatar').set(CSRF).send({ avatar: null });
    expect(del.body.user.avatarUrl).toBeNull();
    expect((await sam.agent.get(url)).status).toBe(404);
    expect((await frodo.agent.put('/api/auth/me/avatar').set(CSRF).send({ avatar: null })).status).toBe(200);
  });
});
