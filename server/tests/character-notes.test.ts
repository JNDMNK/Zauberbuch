import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, resetDb } from './helpers';

describe('Persönliche Notizen im Charakterbogen', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('privat für Besitzer/Mitbearbeiter, freigegebene Notizen für DM und Admin lesbar', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('gandalf');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const pippin = await createUser('pippin');
    const s = (await admin.post('/api/stories').set(CSRF).send({ name: 'Ringkrieg', members: [{ userId: dm.user.id, role: 'dm' }, { userId: frodo.user.id, role: 'player' }, { userId: pippin.user.id, role: 'player' }] })).body.story;
    const c = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Frodo', storyId: s.id })).body.character;
    await frodo.agent.put(`/api/characters/${c.id}/settings`).set(CSRF).send({ storyId: s.id, editorIds: [sam.user.id] });

    const geheim = await frodo.agent.post(`/api/characters/${c.id}/notes`).set(CSRF).send({ title: 'Der Ring', body: 'Niemandem sagen!', category: 'lore' });
    expect(geheim.status).toBe(201);
    expect(geheim.body.note).toMatchObject({ title: 'Der Ring', category: 'lore', sharedWithDm: false, authorName: 'frodo' });
    await frodo.agent.post(`/api/characters/${c.id}/notes`).set(CSRF).send({ title: 'Plan', body: 'Nach Mordor', category: 'quest', sharedWithDm: true, pinned: true });
    expect((await frodo.agent.post(`/api/characters/${c.id}/notes`).set(CSRF).send({ title: '', body: '  ' })).status).toBe(400);

    const titles = async (agent: typeof admin) => {
      const r = await agent.get(`/api/characters/${c.id}/notes`);
      return r.status === 200 ? { notes: r.body.notes.map((n: { title: string }) => n.title), canWrite: r.body.canWrite } : r.status;
    };
    expect(await titles(frodo.agent)).toEqual({ notes: ['Plan', 'Der Ring'], canWrite: true }); // angepinnt zuerst
    expect(await titles(sam.agent)).toEqual({ notes: ['Plan', 'Der Ring'], canWrite: true }); // Mitbearbeiter
    expect(await titles(dm.agent)).toEqual({ notes: ['Plan'], canWrite: false });
    expect(await titles(admin)).toEqual({ notes: ['Plan'], canWrite: false });
    expect(await titles(pippin.agent)).toBe(404); // anderer Spieler sieht den Bogen gar nicht

    // DM darf nicht schreiben, Mitbearbeiter schon
    expect((await dm.agent.post(`/api/characters/${c.id}/notes`).set(CSRF).send({ title: 'x' })).status).toBe(403);
    const upd = await sam.agent.put(`/api/characters/${c.id}/notes/${geheim.body.note.id}`).set(CSRF).send({ title: 'Der Ring', body: 'Jetzt doch teilen', category: 'lore', sharedWithDm: true });
    expect(upd.body.note.sharedWithDm).toBe(true);
    expect(await titles(dm.agent)).toEqual({ notes: ['Plan', 'Der Ring'], canWrite: false });
    expect((await dm.agent.delete(`/api/characters/${c.id}/notes/${geheim.body.note.id}`).set(CSRF)).status).toBe(403);
    expect((await frodo.agent.delete(`/api/characters/${c.id}/notes/${geheim.body.note.id}`).set(CSRF)).status).toBe(204);
    expect(await titles(frodo.agent)).toEqual({ notes: ['Plan'], canWrite: true });
  });
});
