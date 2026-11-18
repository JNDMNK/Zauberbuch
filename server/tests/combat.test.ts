import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, prisma, resetDb } from './helpers';

describe('Kampfhilfe', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup() {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('meister', 'dungeonmaster');
    const frodo = await createUser('frodo');
    const pippin = await createUser('pippin');
    const story = (await dm.agent.post('/api/board/stories').set(CSRF).send({ name: 'Strahd', memberIds: [frodo.user.id] })).body.story;
    // Frodos Charakterbogen
    const ch = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Vaelor' })).body.character;
    const sheet = { ...ch.data, identity: { ...ch.data.identity, name: 'Vaelor' }, combat: { ...ch.data.combat, ac: '16+1', hpMax: 24, hpCurrent: 10, hpTemp: 3 } };
    expect((await frodo.agent.put(`/api/characters/${ch.id}`).set(CSRF).send({ data: sheet })).status).toBe(200);
    const enc = await dm.agent.post('/api/combat/encounters').set(CSRF).send({ storyId: story.id, name: 'Überfall' });
    expect(enc.status).toBe(201);
    return { admin, dm, frodo, pippin, storyId: story.id as string, characterId: ch.id as string, encounterId: enc.body.encounter.id as string };
  }

  it('nur DM/Admin verwalten; Mitspieler lesen; Fremde sehen nichts', async () => {
    const { dm, frodo, pippin, storyId, encounterId } = await setup();
    expect((await frodo.agent.post('/api/combat/encounters').set(CSRF).send({ storyId, name: 'X' })).status).toBe(403);
    expect((await frodo.agent.patch(`/api/combat/encounters/${encounterId}`).set(CSRF).send({ round: 3 })).status).toBe(403);
    expect((await frodo.agent.get(`/api/combat/encounters/${encounterId}`)).body.encounter.canManage).toBe(false);
    expect((await frodo.agent.get('/api/combat/active')).body.count).toBe(1);
    expect((await pippin.agent.get(`/api/combat/encounters/${encounterId}`)).status).toBe(404);
    expect((await pippin.agent.get('/api/combat/encounters')).body.encounters).toEqual([]);
    expect((await dm.agent.get(`/api/combat/encounters/${encounterId}`)).body.encounter.canManage).toBe(true);
  });

  it('Spielercharaktere: Werte live und nur lesend aus dem Bogen', async () => {
    const { dm, frodo, characterId, encounterId } = await setup();
    const added = await dm.agent.post(`/api/combat/encounters/${encounterId}/characters`).set(CSRF).send({ characterIds: [characterId, characterId] });
    expect(added.body.encounter.combatants).toHaveLength(1);
    const pc = added.body.encounter.combatants[0];
    expect(pc).toMatchObject({ kind: 'character', name: 'Vaelor', ac: '16+1', hpCurrent: 10, hpMax: 24, hpTemp: 3, status: 'bloodied', owner: 'frodo', characterId });

    // Doppelt hinzufügen wird ignoriert
    expect((await dm.agent.post(`/api/combat/encounters/${encounterId}/characters`).set(CSRF).send({ characterIds: [characterId] })).body.encounter.combatants).toHaveLength(1);
    // Initiative und Zustände darf der DM setzen, Bogenwerte nicht
    const ini = await dm.agent.patch(`/api/combat/combatants/${pc.id}`).set(CSRF).send({ initiative: 17, conditions: ['poisoned', 'prone'] });
    expect(ini.body.encounter.combatants[0]).toMatchObject({ initiative: 17, conditions: ['poisoned', 'prone'] });
    expect((await dm.agent.patch(`/api/combat/combatants/${pc.id}`).set(CSRF).send({ hpCurrent: 1 })).status).toBe(400);
    expect((await dm.agent.post(`/api/combat/combatants/${pc.id}/hp`).set(CSRF).send({ delta: -5 })).status).toBe(400);
    const char = await prisma.character.findUnique({ where: { id: characterId } });
    expect(JSON.parse(char!.data).combat.hpCurrent).toBe(10);

    // Änderung im Bogen erscheint sofort
    const ch = (await frodo.agent.get(`/api/characters/${characterId}`)).body.character;
    await frodo.agent.put(`/api/characters/${characterId}`).set(CSRF).send({ data: { ...ch.data, combat: { ...ch.data.combat, hpCurrent: 24 } } });
    expect((await frodo.agent.get(`/api/combat/encounters/${encounterId}`)).body.encounter.combatants[0]).toMatchObject({ hpCurrent: 24, status: 'unharmed' });
  });

  it('Monster: mehrere anlegen, Schaden/Heilung, verdeckte Werte für Spieler', async () => {
    const { dm, frodo, encounterId } = await setup();
    const res = await dm.agent.post(`/api/combat/encounters/${encounterId}/monsters`).set(CSRF).send({ name: 'Goblin', count: 2, ac: 15, hpMax: 7, initiative: 12 });
    const [g1, g2] = res.body.encounter.combatants;
    expect(g1).toMatchObject({ name: 'Goblin 1', ac: '15', hpCurrent: 7, hpMax: 7, hideStats: true });
    expect(g2.name).toBe('Goblin 2');

    const hit = await dm.agent.post(`/api/combat/combatants/${g1.id}/hp`).set(CSRF).send({ delta: -5 });
    expect(hit.body.encounter.combatants[0]).toMatchObject({ hpCurrent: 2, status: 'bloodied' });
    expect((await dm.agent.post(`/api/combat/combatants/${g1.id}/hp`).set(CSRF).send({ delta: -50 })).body.encounter.combatants[0].hpCurrent).toBe(0);
    expect((await dm.agent.post(`/api/combat/combatants/${g1.id}/hp`).set(CSRF).send({ delta: 99 })).body.encounter.combatants[0].hpCurrent).toBe(7);
    await dm.agent.post(`/api/combat/combatants/${g1.id}/hp`).set(CSRF).send({ delta: -3 });

    // Spieler: keine Zahlen, nur grober Zustand
    const pv = (await frodo.agent.get(`/api/combat/encounters/${encounterId}`)).body.encounter.combatants[0];
    expect(pv).toMatchObject({ ac: null, hpCurrent: null, hpMax: null, status: 'injured', hideStats: true });
    // DM blendet ein
    await dm.agent.patch(`/api/combat/combatants/${g1.id}`).set(CSRF).send({ hideStats: false });
    expect((await frodo.agent.get(`/api/combat/encounters/${encounterId}`)).body.encounter.combatants[0]).toMatchObject({ ac: '15', hpCurrent: 4, hpMax: 7 });
    // LP-Maximum senken begrenzt aktuelle LP
    const lower = await dm.agent.patch(`/api/combat/combatants/${g1.id}`).set(CSRF).send({ hpMax: 3, name: 'Goblin-Boss' });
    expect(lower.body.encounter.combatants[0]).toMatchObject({ name: 'Goblin-Boss', hpMax: 3, hpCurrent: 3 });
  });

  it('Zugreihenfolge nach Initiative mit Rundenwechsel; besiegte Monster werden übersprungen', async () => {
    const { dm, characterId, encounterId } = await setup();
    await dm.agent.post(`/api/combat/encounters/${encounterId}/characters`).set(CSRF).send({ characterIds: [characterId] });
    let enc = (await dm.agent.post(`/api/combat/encounters/${encounterId}/monsters`).set(CSRF).send({ name: 'Ork', ac: 13, hpMax: 15, initiative: 20 })).body.encounter;
    enc = (await dm.agent.post(`/api/combat/encounters/${encounterId}/monsters`).set(CSRF).send({ name: 'Wolf', ac: 13, hpMax: 11, initiative: 5 })).body.encounter;
    const byName = (n: string) => enc.combatants.find((c: { name: string }) => c.name === n).id;
    await dm.agent.patch(`/api/combat/combatants/${byName('Vaelor')}`).set(CSRF).send({ initiative: 14 });

    const turn = async (direction: 1 | -1) => (await dm.agent.post(`/api/combat/encounters/${encounterId}/turn`).set(CSRF).send({ direction })).body.encounter;
    const name = (e: { turnCombatantId: string; combatants: { id: string; name: string }[] }) => e.combatants.find((c) => c.id === e.turnCombatantId)!.name;
    let e = await turn(1);
    expect([name(e), e.round]).toEqual(['Ork', 1]);
    e = await turn(1);
    expect(name(e)).toBe('Vaelor');
    e = await turn(1);
    expect(name(e)).toBe('Wolf');
    e = await turn(1);
    expect([name(e), e.round]).toEqual(['Ork', 2]);
    e = await turn(-1);
    expect([name(e), e.round]).toEqual(['Wolf', 1]);
    // Wolf besiegt -> übersprungen
    await dm.agent.post(`/api/combat/combatants/${byName('Wolf')}/hp`).set(CSRF).send({ delta: -99 });
    e = await turn(1);
    expect([name(e), e.round]).toEqual(['Ork', 2]);
    e = await turn(1);
    e = await turn(1);
    expect([name(e), e.round]).toEqual(['Ork', 3]);
  });

  it('Kampf beenden/löschen; gelöschter Charakter verschwindet aus dem Kampf', async () => {
    const { dm, frodo, characterId, encounterId } = await setup();
    await dm.agent.post(`/api/combat/encounters/${encounterId}/characters`).set(CSRF).send({ characterIds: [characterId] });
    expect((await dm.agent.patch(`/api/combat/encounters/${encounterId}`).set(CSRF).send({ ended: true })).body.encounter.ended).toBe(true);
    expect((await frodo.agent.get('/api/combat/active')).body.count).toBe(0);
    await frodo.agent.delete(`/api/characters/${characterId}`).set(CSRF);
    expect((await dm.agent.get(`/api/combat/encounters/${encounterId}`)).body.encounter.combatants).toEqual([]);
    expect((await dm.agent.delete(`/api/combat/encounters/${encounterId}`).set(CSRF)).status).toBe(204);
    expect((await dm.agent.get('/api/combat/encounters')).body.encounters).toEqual([]);
  });
});

describe('Kampfhilfe – Spielermodus für Admins', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('Admin sieht mit asPlayer=true die Spieleransicht und nur Kämpfe als Mitspieler', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const adminId = (await admin.get('/api/auth/me')).body.user.id;
    const mit = (await admin.post('/api/board/stories').set(CSRF).send({ name: 'Mit Admin', memberIds: [adminId] })).body.story;
    const ohne = (await admin.post('/api/board/stories').set(CSRF).send({ name: 'Ohne Admin' })).body.story;
    const e1 = (await admin.post('/api/combat/encounters').set(CSRF).send({ storyId: mit.id, name: 'Kampf A' })).body.encounter;
    await admin.post('/api/combat/encounters').set(CSRF).send({ storyId: ohne.id, name: 'Kampf B' });
    await admin.post(`/api/combat/encounters/${e1.id}/monsters`).set(CSRF).send({ name: 'Oger', ac: 11, hpMax: 59 });

    expect((await admin.get('/api/combat/encounters')).body.encounters).toHaveLength(2);
    expect((await admin.get('/api/combat/active')).body.count).toBe(2);
    const dmView = (await admin.get(`/api/combat/encounters/${e1.id}`)).body.encounter;
    expect(dmView.canManage).toBe(true);
    expect(dmView.combatants[0]).toMatchObject({ ac: '11', hpMax: 59 });

    const list = (await admin.get('/api/combat/encounters?asPlayer=true')).body.encounters;
    expect(list.map((e: { name: string }) => e.name)).toEqual(['Kampf A']);
    expect((await admin.get('/api/combat/active?asPlayer=true')).body.count).toBe(1);
    const pv = (await admin.get(`/api/combat/encounters/${e1.id}?asPlayer=true`)).body.encounter;
    expect(pv.canManage).toBe(false);
    expect(pv.combatants[0]).toMatchObject({ ac: null, hpCurrent: null, hpMax: null, status: 'unharmed' });

    // Für Dungeon Master hat der Parameter keine Wirkung
    const dm = await createUser('meister', 'dungeonmaster');
    expect((await dm.agent.get('/api/combat/encounters?asPlayer=true')).body.encounters).toHaveLength(2);
  });
});
