import { beforeAll, describe, expect, it } from 'vitest';
import { app, CSRF, registerUser, request, resetDb } from './helpers';

describe('Favoriten', () => {
  let fireballId: string;
  let shieldId: string;

  beforeAll(async () => {
    await resetDb({ seed: true });
    fireballId = (await request(app).get('/api/spells/fireball')).body.spell.id;
    shieldId = (await request(app).get('/api/spells/shield')).body.spell.id;
  });

  it('ist für Gäste nicht verfügbar', async () => {
    expect((await request(app).get('/api/favorites')).status).toBe(401);
    expect((await request(app).post('/api/favorites').set(CSRF).send({ spellId: fireballId })).status).toBe(401);
    expect((await request(app).get('/api/spells?favorites=true')).status).toBe(401);
  });

  it('fügt Favoriten hinzu, listet und filtert sie und entfernt sie wieder', async () => {
    const { agent } = await registerUser('aragorn');
    const { agent: other } = await registerUser('legolas');

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
    const { agent } = await registerUser('gimli');
    expect((await agent.post('/api/favorites').set(CSRF).send({ spellId: 'nope' })).status).toBe(404);
  });

  it('entfernt Favoriten, wenn der Zauber gelöscht wird', async () => {
    const { agent } = await registerUser('boromir');
    await agent.post('/api/favorites').set(CSRF).send({ spellId: shieldId });
    const admin = request.agent(app);
    await admin.post('/api/auth/login').set(CSRF).send({ identifier: 'admin', password: 'admin-password' });
    expect((await admin.delete(`/api/spells/${shieldId}`).set(CSRF)).status).toBe(204);
    expect((await agent.get('/api/favorites')).body.spellIds).toEqual([]);
  });
});
