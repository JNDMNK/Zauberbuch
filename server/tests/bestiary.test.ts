import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, resetDb } from './helpers';

describe('Monster-Datenbanken', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup() {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('meister', 'dungeonmaster');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const pippin = await createUser('pippin');
    const story = (await dm.agent.post('/api/board/stories').set(CSRF).send({ name: 'Strahd', memberIds: [frodo.user.id, sam.user.id] })).body.story;
    return { admin, dm, frodo, sam, pippin, storyId: story.id as string };
  }

  it('DM-Datenbank: nur DM/Admin, gemeinsam genutzt', async () => {
    const { admin, dm, frodo } = await setup();
    const created = await dm.agent.post('/api/bestiary/dm').set(CSRF).send({ name: 'Goblin', ac: 15, hp: 7, attack: 'Krummsäbel +4, 1W6+2 Hieb', description: 'Klein und gemein.' });
    expect(created.status).toBe(201);
    expect(created.body.template).toMatchObject({ name: 'Goblin', ac: 15, hp: 7, createdBy: { username: 'meister' } });
    const id = created.body.template.id;

    // Admin sieht und bearbeitet dieselbe Datenbank
    const list = (await admin.get('/api/bestiary/dm')).body.templates;
    expect(list.map((t: { name: string }) => t.name)).toEqual(['Goblin']);
    const upd = await admin.put(`/api/bestiary/dm/${id}`).set(CSRF).send({ name: 'Goblin', ac: 15, hp: 9, attack: 'Kurzbogen +4, 1W6+2 Stich' });
    expect(upd.body.template).toMatchObject({ hp: 9, updatedBy: { username: 'admin' }, createdBy: { username: 'meister' } });

    // Spieler haben keinen Zugriff
    expect((await frodo.agent.get('/api/bestiary/dm')).status).toBe(403);
    expect((await frodo.agent.post('/api/bestiary/dm').set(CSRF).send({ name: 'X', hp: 1 })).status).toBe(403);
    expect((await dm.agent.post('/api/bestiary/dm').set(CSRF).send({ name: 'Ohne LP' })).status).toBe(400);
    expect((await dm.agent.delete(`/api/bestiary/dm/${id}`).set(CSRF)).status).toBe(204);
  });

  it('Spieler-Datenbank je Geschichte: Mitspieler bearbeiten gemeinsam, DM liest nur, Fremde sehen nichts', async () => {
    const { admin, dm, frodo, sam, pippin, storyId } = await setup();
    await dm.agent.post('/api/bestiary/dm').set(CSRF).send({ name: 'Geheimes DM-Monster', hp: 99 });

    const e = await frodo.agent.post(`/api/bestiary/stories/${storyId}`).set(CSRF).send({ name: 'Werwolf', attack: 'Biss', description: 'Nur Silber hilft!' });
    expect(e.status).toBe(201);
    expect(e.body.entry).toMatchObject({ name: 'Werwolf', ac: null, hp: null, createdBy: { username: 'frodo' } });
    // Sam korrigiert Frodos Eintrag
    const upd = await sam.agent.put(`/api/bestiary/entries/${e.body.entry.id}`).set(CSRF).send({ name: 'Werwolf', ac: 12, hp: 58, attack: 'Biss 2W4+2', description: 'Silber oder Magie!' });
    expect(upd.body.entry).toMatchObject({ ac: 12, hp: 58, createdBy: { username: 'frodo' }, updatedBy: { username: 'sam' } });

    const fl = await frodo.agent.get(`/api/bestiary/stories/${storyId}`);
    expect(fl.body).toMatchObject({ canWrite: true });
    expect(fl.body.entries.map((x: { name: string }) => x.name)).toEqual(['Werwolf']); // keine DM-Daten

    // DM und Admin: nur lesen
    const dl = await dm.agent.get(`/api/bestiary/stories/${storyId}`);
    expect(dl.body.canWrite).toBe(false);
    expect(dl.body.entries).toHaveLength(1);
    expect((await dm.agent.post(`/api/bestiary/stories/${storyId}`).set(CSRF).send({ name: 'X' })).status).toBe(403);
    expect((await dm.agent.put(`/api/bestiary/entries/${e.body.entry.id}`).set(CSRF).send({ name: 'X' })).status).toBe(403);
    expect((await admin.delete(`/api/bestiary/entries/${e.body.entry.id}`).set(CSRF)).status).toBe(403);

    // Fremder Spieler sieht die Geschichte nicht
    expect((await pippin.agent.get(`/api/bestiary/stories/${storyId}`)).status).toBe(404);
    expect((await pippin.agent.put(`/api/bestiary/entries/${e.body.entry.id}`).set(CSRF).send({ name: 'X' })).status).toBe(404);

    expect((await sam.agent.delete(`/api/bestiary/entries/${e.body.entry.id}`).set(CSRF)).status).toBe(204);
  });

  it('Admin im Spielermodus, der Mitspieler ist, darf die Spieler-Datenbank bearbeiten', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const adminId = (await admin.get('/api/auth/me')).body.user.id;
    const story = (await admin.post('/api/board/stories').set(CSRF).send({ name: 'Admin spielt mit', memberIds: [adminId] })).body.story;
    expect((await admin.post(`/api/bestiary/stories/${story.id}`).set(CSRF).send({ name: 'Ghul' })).status).toBe(403);
    await admin.put('/api/combat/player-mode').set(CSRF).send({ asPlayer: true });
    expect((await admin.post(`/api/bestiary/stories/${story.id}`).set(CSRF).send({ name: 'Ghul' })).status).toBe(201);
  });

  it('Vorlagen im Kampf: Angriff/Beschreibung nur für den DM, optional als Vorlage speichern', async () => {
    const { dm, frodo, storyId } = await setup();
    const enc = (await dm.agent.post('/api/combat/encounters').set(CSRF).send({ storyId, name: 'K' })).body.encounter;
    const r = await dm.agent
      .post(`/api/combat/encounters/${enc.id}/monsters`)
      .set(CSRF)
      .send({ name: 'Oger', ac: 11, hpMax: 59, attack: 'Großkeule +6, 2W8+4 Wucht', description: 'Dumm, aber stark.', saveAsTemplate: true, hideStats: false });
    const c = r.body.encounter.combatants[0];
    expect(c).toMatchObject({ attack: 'Großkeule +6, 2W8+4 Wucht', description: 'Dumm, aber stark.' });
    expect((await dm.agent.get('/api/bestiary/dm')).body.templates[0]).toMatchObject({ name: 'Oger', ac: 11, hp: 59, attack: 'Großkeule +6, 2W8+4 Wucht' });

    // Spieler erhalten Angriff/Beschreibung nie – auch bei sichtbaren Werten
    const pv = (await frodo.agent.get(`/api/combat/encounters/${enc.id}`)).body.encounter.combatants[0];
    expect(pv).toMatchObject({ ac: '11', hpMax: 59, attack: null, description: null });

    const upd = await dm.agent.patch(`/api/combat/combatants/${c.id}`).set(CSRF).send({ attack: 'Wurfspeer +6, 2W6+4 Stich' });
    expect(upd.body.encounter.combatants[0].attack).toBe('Wurfspeer +6, 2W6+4 Stich');
  });
});
