import { beforeEach, describe, expect, it } from 'vitest';
import { app, CSRF, createUser, loginAs, request, resetDb } from './helpers';

describe('Charakterbögen – Export & Import (Admin)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup() {
    const { agent: frodo } = await createUser('frodo');
    const c = (await frodo.post('/api/characters').set(CSRF).send({ name: 'Vaelor' })).body.character;
    c.data.abilities.int = 17;
    c.data.identity.classLevel = 'Artifizient 3';
    await frodo.put(`/api/characters/${c.id}`).set(CSRF).send({ data: c.data });
    const admin = await loginAs('admin', 'admin-password');
    return { frodo, admin };
  }

  it('ist nur für Admins verfügbar', async () => {
    const { frodo } = await setup();
    const { agent: dm } = await createUser('gandalf', 'dungeonmaster');
    for (const agent of [frodo, dm]) {
      expect((await agent.get('/api/characters/export')).status).toBe(403);
      expect((await agent.post('/api/characters/import/preview').set(CSRF).send({ characters: [{}] })).status).toBe(403);
      expect((await agent.post('/api/characters/import').set(CSRF).send({ characters: [{}] })).status).toBe(403);
    }
    expect((await request(app).get('/api/characters/export')).status).toBe(401);
  });

  it('exportiert alle Bögen mit Besitzer und importiert sie wieder', async () => {
    const { admin } = await setup();
    const exp = await admin.get('/api/characters/export');
    expect(exp.status).toBe(200);
    expect(exp.headers['content-disposition']).toMatch(/zauberbuch-charaktere-.*\.json/);
    expect(exp.body).toMatchObject({ format: 'zauberbuch-characters', version: 1 });
    expect(exp.body.characters).toHaveLength(1);
    expect(exp.body.characters[0]).toMatchObject({ owner: 'frodo', name: 'Vaelor' });
    expect(exp.body.characters[0].data.abilities.int).toBe(17);

    // Gleiche Datei erneut: Dublette (gleicher Name beim selben Spieler)
    const prev = await admin.post('/api/characters/import/preview').set(CSRF).send({ characters: exp.body.characters });
    expect(prev.body.summary).toMatchObject({ total: 1, duplicate: 1, new: 0 });
    const skip = await admin.post('/api/characters/import').set(CSRF).send({ characters: exp.body.characters });
    expect(skip.body).toEqual({ created: 0, skipped: 1, invalid: 0 });
    const create = await admin.post('/api/characters/import').set(CSRF).send({ characters: exp.body.characters, duplicates: 'create' });
    expect(create.body).toEqual({ created: 1, skipped: 0, invalid: 0 });

    const all = (await admin.get('/api/characters/all')).body.characters;
    expect(all).toHaveLength(2);
    expect(all.every((c: { owner: { username: string } }) => c.owner.username === 'frodo')).toBe(true);
  });

  it('ordnet unbekannte Spieler einem Ersatz-Benutzer zu oder überspringt sie', async () => {
    const { admin } = await setup();
    const { user: sam } = await createUser('sam');
    const entries = [
      { owner: 'unbekannt', name: 'Fremder', data: { identity: { name: 'Fremder' }, abilities: { str: 99 } } },
      { owner: 'FRODO', name: 'Neu', data: { identity: { name: 'Neu' } } },
      { owner: 'frodo', name: 'kaputt' },
      'unsinn',
    ];
    const prev = await admin.post('/api/characters/import/preview').set(CSRF).send({ characters: entries });
    expect(prev.body.items.map((i: { status: string }) => i.status)).toEqual(['no_owner', 'new', 'invalid', 'invalid']);
    expect(prev.body.items[1].targetUser).toBe('frodo');

    const withFallback = await admin.post('/api/characters/import/preview').set(CSRF).send({ characters: entries, fallbackOwnerId: sam.id });
    expect(withFallback.body.items[0]).toMatchObject({ status: 'new', targetUser: 'sam' });

    const res = await admin.post('/api/characters/import').set(CSRF).send({ characters: entries, fallbackOwnerId: sam.id });
    expect(res.body).toEqual({ created: 2, skipped: 0, invalid: 2 });
    const samAgent = await loginAs('sam', 'password123');
    const own = (await samAgent.get('/api/characters')).body.characters;
    expect(own).toHaveLength(1);
    const sheet = (await samAgent.get(`/api/characters/${own[0].id}`)).body.character.data;
    expect(sheet.abilities.str).toBe(10); // ungültiger Wert bereinigt
  });

  it('verarbeitet große Dateien mit Bildern über dem normalen Body-Limit', async () => {
    const { admin } = await setup();
    const portrait = `data:image/jpeg;base64,${'A'.repeat(1_400_000)}`;
    const entries = Array.from({ length: 10 }, (_, i) => ({ owner: 'frodo', name: `Held ${i}`, data: { identity: { name: `Held ${i}` }, portrait } }));
    const res = await admin.post('/api/characters/import').set(CSRF).send({ characters: entries });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(10);
  });
});
