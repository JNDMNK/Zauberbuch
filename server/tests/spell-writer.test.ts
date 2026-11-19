import { beforeEach, describe, expect, it } from 'vitest';
import { app, CSRF, createUser, loginAs, makeSpell, request, resetDb } from './helpers';

describe('Zusatzrecht „Zauber bearbeiten“', () => {
  beforeEach(async () => {
    await resetDb({ seed: true });
  });

  async function writer() {
    const { agent, user } = await createUser('schreiber');
    const admin = await loginAs('admin', 'admin-password');
    const res = await admin.patch(`/api/users/${user.id}`).set(CSRF).send({ canEditSpells: true });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: 'user', canEditSpells: true });
    return { agent, user, admin };
  }

  it('ist standardmäßig aus und wird in /me gemeldet', async () => {
    const { agent } = await createUser('normal');
    expect((await agent.get('/api/auth/me')).body.user.canEditSpells).toBe(false);
    expect((await agent.post('/api/spells').set(CSRF).send(makeSpell())).status).toBe(403);
    const { agent: w } = await writer();
    expect((await w.get('/api/auth/me')).body.user.canEditSpells).toBe(true);
  });

  it('erlaubt Anlegen, Bearbeiten und Duplizieren, aber kein Löschen', async () => {
    const { agent } = await writer();
    const created = await agent.post('/api/spells').set(CSRF).send(makeSpell({ slug: 'schreiber-zauber' }));
    expect(created.status).toBe(201);
    const id = created.body.spell.id;
    expect((await agent.put(`/api/spells/${id}`).set(CSRF).send(makeSpell({ slug: 'schreiber-zauber', level: 3 }))).body.spell.level).toBe(3);
    const dup = await agent.post(`/api/spells/${id}/duplicate`).set(CSRF);
    expect(dup.status).toBe(201);
    expect((await agent.delete(`/api/spells/${id}`).set(CSRF)).status).toBe(403);
  });

  it('gibt keine weiteren Rechte (Zauberbücher, Charakterbögen, Import/Export, Benutzer)', async () => {
    const { agent } = await writer();
    expect((await agent.get('/api/spellbooks')).status).toBe(403);
    expect((await agent.get('/api/characters/all')).body.characters).toEqual([]);
    expect((await agent.get('/api/spells/export')).status).toBe(403);
    expect((await agent.post('/api/spells/import').set(CSRF).send({ spells: [makeSpell()] })).status).toBe(403);
    expect((await agent.get('/api/users')).status).toBe(403);
  });

  it('lässt sich beim Anlegen setzen, wieder entziehen und wird exportiert/importiert', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const created = await admin.post('/api/users').set(CSRF).send({ username: 'merry', password: 'password123', canEditSpells: true });
    expect(created.body.user.canEditSpells).toBe(true);
    const merry = await loginAs('merry', 'password123');
    expect((await merry.post('/api/spells').set(CSRF).send(makeSpell({ slug: 'merrys-zauber' }))).status).toBe(201);

    await admin.patch(`/api/users/${created.body.user.id}`).set(CSRF).send({ canEditSpells: false });
    expect((await merry.post('/api/spells').set(CSRF).send(makeSpell({ slug: 'noch-einer' }))).status).toBe(403);
    await admin.patch(`/api/users/${created.body.user.id}`).set(CSRF).send({ canEditSpells: true });

    const exp = (await admin.get('/api/users/export')).body.users.find((u: { username: string }) => u.username === 'merry');
    expect(exp.canEditSpells).toBe(true);
    await resetDb({ seed: true });
    const admin2 = await loginAs('admin', 'admin-password');
    await admin2.post('/api/users/import').set(CSRF).send({ users: [exp] });
    const merry2 = await loginAs('merry', 'password123');
    expect((await merry2.get('/api/auth/me')).body.user.canEditSpells).toBe(true);
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});
