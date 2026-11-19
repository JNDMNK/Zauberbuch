import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, resetDb } from './helpers';

describe('DM-Notizen', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('nur DMs der Geschichte (und Admin) lesen und schreiben; Abschnitte sortierbar', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('leiterin');
    const frodo = await createUser('frodo');
    const mod = await createUser('moderator', 'dungeonmaster');
    const story = (await admin.post('/api/stories').set(CSRF).send({ name: 'Strahd', memberIds: [frodo.user.id], dmIds: [dm.user.id] })).body.story;
    const other = (await admin.post('/api/stories').set(CSRF).send({ name: 'Andere', dmIds: [frodo.user.id] })).body.story;
    const base = `/api/dm-notes/stories/${story.id}`;

    // Spieler und Moderator ohne DM-Rolle: kein Zugriff
    expect((await frodo.agent.get(base)).status).toBe(403);
    expect((await mod.agent.get(base)).status).toBe(403);
    expect((await frodo.agent.post(base).set(CSRF).send({ title: 'X' })).status).toBe(403);

    const a = (await dm.agent.post(base).set(CSRF).send({ title: 'Dorf Barovia', body: '- Ismark bittet um Hilfe\n- **Ireena** ist gebissen' })).body.note;
    const b = (await dm.agent.post(base).set(CSRF).send({ title: 'Vallaki' })).body.note;
    const c = (await admin.post(base).set(CSRF).send({ title: 'Burg Ravenloft' })).body.note;
    expect([a.position, b.position, c.position]).toEqual([0, 1, 2]);
    expect(a.updatedBy).toBe('leiterin');
    expect((await dm.agent.post(base).set(CSRF).send({ title: '' })).status).toBe(400);

    // Reihenfolge ändern (fremde ids ignoriert)
    const fremd = (await frodo.agent.post(`/api/dm-notes/stories/${other.id}`).set(CSRF).send({ title: 'Fremd' })).body.note;
    const ordered = (await dm.agent.put(`${base}/order`).set(CSRF).send({ ids: [c.id, fremd.id, a.id, b.id] })).body.notes;
    expect(ordered.map((n: { title: string }) => n.title)).toEqual(['Burg Ravenloft', 'Dorf Barovia', 'Vallaki']);
    expect((await frodo.agent.get(`/api/dm-notes/stories/${other.id}`)).body.notes.map((n: { title: string }) => n.title)).toEqual(['Fremd']);

    // Bearbeiten / Löschen
    expect((await frodo.agent.put(`/api/dm-notes/${a.id}`).set(CSRF).send({ title: 'Hack' })).status).toBe(403);
    expect((await admin.put(`/api/dm-notes/${a.id}`).set(CSRF).send({ title: 'Dorf Barovia', body: 'Neu' })).body.note).toMatchObject({ body: 'Neu', updatedBy: 'admin' });
    expect((await dm.agent.delete(`/api/dm-notes/${b.id}`).set(CSRF)).status).toBe(204);
    expect((await dm.agent.get(base)).body.notes).toHaveLength(2);
  });
});
