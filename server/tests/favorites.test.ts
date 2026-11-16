import { beforeAll, describe, expect, it } from 'vitest';
import { app, CSRF, createUser, loginAs, request, resetDb } from './helpers';

describe('Favoriten', () => {
  let fireballId: string;
  let shieldId: string;

  beforeAll(async () => {
    await resetDb({ seed: true });
    const admin = await loginAs('admin', 'admin-password');
    fireballId = (await admin.get('/api/spells/fireball')).body.spell.id;
    shieldId = (await admin.get('/api/spells/shield')).body.spell.id;
  });

  it('ist für Gäste nicht verfügbar', async () => {
    expect((await request(app).get('/api/favorites')).status).toBe(401);
    expect((await request(app).post('/api/favorites').set(CSRF).send({ spellId: fireballId })).status).toBe(401);
    expect((await request(app).get('/api/spells?favorites=true')).status).toBe(401);
  });

  it('fügt Favoriten hinzu, listet und filtert sie und entfernt sie wieder', async () => {
    const { agent } = await createUser('aragorn');
    const { agent: other } = await createUser('legolas');

    expect((await agent.post('/api/favorites').set(CSRF).send({ spellId: fireballId })).status).toBe(201);
    // idempotent
    expect((await agent.post('/api/favorites').set(CSRF).send({ spellId: fireballId })).status).toBe(201);
    await agent.post('/api/favorites').set(CSRF).send({ spellId: shieldId });

    const list = await agent.get('/api/favorites');
    expect(list.body.spellIds.sort()).toEqual([fireballId, shieldId].sort());

    const filtered = await agent.get('/api/spells?favorites=true&query=fireball');
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.items[0].isFavorite).toBe(true);

    const all = await agent.get('/api/spells');
    const flags = Object.fromEntries(all.body.items.map((s: { slug: string; isFavorite: boolean }) => [s.slug, s.isFavorite]));
    expect(flags).toMatchObject({ fireball: true, shield: true, light: false });

    // Favoriten sind pro Benutzer getrennt
    expect((await other.get('/api/favorites')).body.spellIds).toEqual([]);
    expect((await other.get('/api/spells/fireball')).body.spell.isFavorite).toBe(false);
    expect((await agent.get('/api/spells/fireball')).body.spell.isFavorite).toBe(true);

    expect((await agent.delete(`/api/favorites/${fireballId}`).set(CSRF)).status).toBe(204);
    expect((await agent.get('/api/favorites')).body.spellIds).toEqual([shieldId]);
  });

  it('meldet 404 für unbekannte Zauber', async () => {
    const { agent } = await createUser('gimli');
    expect((await agent.post('/api/favorites').set(CSRF).send({ spellId: 'nope' })).status).toBe(404);
  });

  it('entfernt Favoriten, wenn der Zauber gelöscht wird', async () => {
    const { agent } = await createUser('boromir');
    await agent.post('/api/favorites').set(CSRF).send({ spellId: shieldId });
    const admin = await loginAs('admin', 'admin-password');
    expect((await admin.delete(`/api/spells/${shieldId}`).set(CSRF)).status).toBe(204);
    expect((await agent.get('/api/favorites')).body.spellIds).toEqual([]);
  });

  it('lässt Dungeon Master und Admin die Zauberbücher anderer Benutzer sehen', async () => {
    const { agent: owner, user } = await createUser('frodo');
    await owner.post('/api/favorites').set(CSRF).send({ spellId: fireballId });
    const { agent: dm } = await createUser('elrond', 'dungeonmaster');
    const { agent: other } = await createUser('sam');

    const list = await dm.get('/api/spellbooks');
    expect(list.status).toBe(200);
    expect(list.body.owners).toContainEqual({ id: user.id, username: 'frodo', role: 'user', spellCount: 1 });

    const book = await dm.get(`/api/spells?owner=${user.id}`);
    expect(book.status).toBe(200);
    expect(book.body.items.map((s: { slug: string }) => s.slug)).toEqual(['fireball']);
    // isFavorite bezieht sich weiterhin auf das eigene Zauberbuch des Betrachters
    expect(book.body.items[0].isFavorite).toBe(false);

    const admin = await loginAs('admin', 'admin-password');
    expect((await admin.get(`/api/spells?owner=${user.id}`)).body.total).toBe(1);

    // Normale Benutzer dürfen fremde Zauberbücher nicht sehen
    expect((await other.get('/api/spellbooks')).status).toBe(403);
    expect((await other.get(`/api/spells?owner=${user.id}`)).status).toBe(403);
  });
});
