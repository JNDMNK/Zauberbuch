import { beforeEach, describe, expect, it } from 'vitest';
import { app, CSRF, createUser, loginAs, prisma, request, resetDb } from './helpers';

describe('Charakterbögen', () => {
  beforeEach(async () => {
    await resetDb({ seed: true });
  });

  it('erfordert eine Anmeldung', async () => {
    expect((await request(app).get('/api/characters')).status).toBe(401);
    expect((await request(app).post('/api/characters').set(CSRF).send({})).status).toBe(401);
  });

  it('legt Charaktere an, speichert den Bogen und listet nur eigene', async () => {
    const { agent } = await createUser('frodo');
    const { agent: other } = await createUser('sam');

    const created = await agent.post('/api/characters').set(CSRF).send({ name: 'Vaelor Blackcoil' });
    expect(created.status).toBe(201);
    const { id, data } = created.body.character;
    expect(data.identity).toMatchObject({ name: 'Vaelor Blackcoil', playerName: 'frodo', level: 1 });
    expect(data.abilities.str).toBe(10);
    expect(data.spellcasting.slots).toHaveLength(9);

    data.identity.classLevel = 'Artifizient 3';
    data.identity.level = 3;
    data.abilities.int = 17;
    data.skills.arcana = 2;
    data.attacks = [{ name: 'Feuerpfeil', ability: 'int', proficient: true, range: '36m', damage: '1W10', damageType: 'Feuer' }];
    data.spellcasting.spells = [{ level: 0, name: 'Feuerpfeil', slug: 'feuerpfeil' }];
    const saved = await agent.put(`/api/characters/${id}`).set(CSRF).send({ data });
    expect(saved.status).toBe(200);
    expect(saved.body.character).toMatchObject({ classLevel: 'Artifizient 3', level: 3 });

    const loaded = await agent.get(`/api/characters/${id}`);
    expect(loaded.body.character.canEdit).toBe(true);
    expect(loaded.body.character.data.skills.arcana).toBe(2);
    expect(loaded.body.character.data.attacks[0]).toMatchObject({ name: 'Feuerpfeil', bonus: 0, description: '' });

    expect((await agent.get('/api/characters')).body.characters).toHaveLength(1);
    expect((await other.get('/api/characters')).body.characters).toHaveLength(0);
    // Fremde Bögen sind für normale Benutzer nicht auffindbar
    expect((await other.get(`/api/characters/${id}`)).status).toBe(404);
    expect((await other.put(`/api/characters/${id}`).set(CSRF).send({ data })).status).toBe(404);
    expect((await other.delete(`/api/characters/${id}`).set(CSRF)).status).toBe(404);
  });

  it('bereinigt ungültige Werte statt den Bogen abzulehnen', async () => {
    const { agent } = await createUser('merry');
    const { id } = (await agent.post('/api/characters').set(CSRF).send({})).body.character;
    const res = await agent
      .put(`/api/characters/${id}`)
      .set(CSRF)
      .send({ data: { abilities: { str: 99, dex: '14' }, identity: { level: 50 }, portrait: 'javascript:alert(1)', unknownField: 'x' } });
    expect(res.status).toBe(200);
    const d = res.body.character.data;
    expect(d.abilities).toMatchObject({ str: 10, dex: 14 });
    expect(d.identity.level).toBe(1);
    expect(d.portrait).toBe('');
    expect(d.unknownField).toBeUndefined();
  });

  it('berechnet die benötigten Erfahrungspunkte für die nächste Stufe automatisch', async () => {
    const { agent } = await createUser('rosie');
    const created = (await agent.post('/api/characters').set(CSRF).send({ name: 'Rosie' })).body.character;
    expect(created.data.identity.xpNext).toBe(300); // Stufe 1 -> 2
    const { id, data } = created;
    data.identity.level = 3;
    data.identity.xp = 1310;
    data.identity.xpNext = 12345; // falscher Wert wird ignoriert
    const saved = await agent.put(`/api/characters/${id}`).set(CSRF).send({ data });
    expect(saved.body.character.data.identity).toMatchObject({ level: 3, xp: 1310, xpNext: 2700 });
    data.identity.level = 20;
    const max = await agent.put(`/api/characters/${id}`).set(CSRF).send({ data });
    expect(max.body.character.data.identity.xpNext).toBe(0); // Höchststufe
  });

  it('begrenzt Waffen & Angriffszauber auf 5, ohne vorhandene zu löschen', async () => {
    const { agent } = await createUser('bilbo');
    const { id, data } = (await agent.post('/api/characters').set(CSRF).send({ name: 'Bilbo' })).body.character;
    const atk = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Angriff ${i + 1}` }));

    expect((await agent.put(`/api/characters/${id}`).set(CSRF).send({ data: { ...data, attacks: atk(5) } })).status).toBe(200);
    const tooMany = await agent.put(`/api/characters/${id}`).set(CSRF).send({ data: { ...data, attacks: atk(6) } });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.code).toBe('too_many_attacks');

    // Bestand mit mehr als 5 (z. B. aus einer älteren Version) bleibt erhalten und speicherbar, wächst aber nicht
    const row = await prisma.character.findUniqueOrThrow({ where: { id } });
    await prisma.character.update({ where: { id }, data: { data: JSON.stringify({ ...JSON.parse(row.data), attacks: atk(7) }) } });
    expect((await agent.get(`/api/characters/${id}`)).body.character.data.attacks).toHaveLength(7);
    expect((await agent.put(`/api/characters/${id}`).set(CSRF).send({ data: { ...data, attacks: atk(7) } })).status).toBe(200);
    expect((await agent.put(`/api/characters/${id}`).set(CSRF).send({ data: { ...data, attacks: atk(8) } })).status).toBe(400);
    expect((await agent.put(`/api/characters/${id}`).set(CSRF).send({ data: { ...data, attacks: atk(6) } })).status).toBe(200);
  });

  it('lässt Admin und Dungeon Master alle Bögen lesen, aber nicht bearbeiten', async () => {
    const { agent: owner } = await createUser('pippin');
    const { id, data } = (await owner.post('/api/characters').set(CSRF).send({ name: 'Peregrin' })).body.character;
    const { agent: dm } = await createUser('gandalf', 'dungeonmaster');
    const { agent: user } = await createUser('bill');

    const all = await dm.get('/api/characters/all');
    expect(all.status).toBe(200);
    expect(all.body.characters).toEqual([expect.objectContaining({ id, name: 'Peregrin', owner: expect.objectContaining({ username: 'pippin' }) })]);
    const read = await dm.get(`/api/characters/${id}`);
    expect(read.status).toBe(200);
    expect(read.body.character.canEdit).toBe(false);
    expect((await dm.put(`/api/characters/${id}`).set(CSRF).send({ data })).status).toBe(403);
    expect((await dm.delete(`/api/characters/${id}`).set(CSRF)).status).toBe(403);

    const admin = await loginAs('admin', 'admin-password');
    expect((await admin.get(`/api/characters/${id}`)).body.character.canEdit).toBe(false);
    expect((await user.get('/api/characters/all')).status).toBe(403);
  });

  it('dupliziert und löscht eigene Charaktere; Löschen des Benutzers entfernt seine Bögen', async () => {
    const { agent, user } = await createUser('gimli');
    const { id } = (await agent.post('/api/characters').set(CSRF).send({ name: 'Gimli' })).body.character;
    const dup = await agent.post(`/api/characters/${id}/duplicate`).set(CSRF);
    expect(dup.status).toBe(201);
    expect(dup.body.character.name).toBe('Gimli (Kopie)');
    expect((await agent.delete(`/api/characters/${dup.body.character.id}`).set(CSRF)).status).toBe(204);
    expect((await agent.get('/api/characters')).body.characters).toHaveLength(1);

    const admin = await loginAs('admin', 'admin-password');
    expect((await admin.delete(`/api/users/${user.id}`).set(CSRF)).status).toBe(204);
    expect((await admin.get('/api/characters/all')).body.characters).toHaveLength(0);
  });

  it('liefert die Zaubernamen für die Autovervollständigung', async () => {
    const { agent } = await createUser('legolas');
    const res = await agent.get('/api/spells/names');
    expect(res.status).toBe(200);
    expect(res.body.spells).toContainEqual({ slug: 'fireball', level: 3, de: 'Feuerball', en: 'Fireball' });
    expect((await request(app).get('/api/spells/names')).status).toBe(401);
  });
});
