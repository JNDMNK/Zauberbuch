import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, resetDb } from './helpers';

describe('Chatgruppen', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('nur Mitglieder sehen Gruppen; Ersteller verwaltet; verlassen, löschen, ungelesen', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('gandalf');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const pippin = await createUser('pippin');
    const fremd = await createUser('saruman');
    const s = (await admin.post('/api/stories').set(CSRF).send({ name: 'Ringkrieg', members: [{ userId: dm.user.id, role: 'dm' }, { userId: frodo.user.id, role: 'player' }, { userId: sam.user.id, role: 'player' }, { userId: pippin.user.id, role: 'player' }] })).body.story;
    const char = (await sam.agent.post('/api/characters').set(CSRF).send({ name: 'Samweis', storyId: s.id })).body.character;
    const groups = async (a: typeof frodo.agent) => (await a.get(`/api/chat/stories/${s.id}`)).body.groups as { id: string; name: string; canManage: boolean; unread: number; members: { username: string }[]; last: { sender: string } | null }[];

    // Anlegen: nur Mitglieder der Geschichte als Mitglieder, mindestens eine weitere Person
    expect((await frodo.agent.post(`/api/chat/stories/${s.id}/groups`).set(CSRF).send({ name: 'Hobbits', memberIds: [] })).status).toBe(400);
    expect((await frodo.agent.post(`/api/chat/stories/${s.id}/groups`).set(CSRF).send({ name: 'Hobbits', memberIds: [fremd.user.id] })).status).toBe(400);
    expect((await fremd.agent.post(`/api/chat/stories/${s.id}/groups`).set(CSRF).send({ name: 'x', memberIds: [frodo.user.id] })).status).toBe(404);
    const created = await frodo.agent.post(`/api/chat/stories/${s.id}/groups`).set(CSRF).send({ name: 'Hobbits', memberIds: [sam.user.id, pippin.user.id] });
    expect(created.status).toBe(201);
    const gid = created.body.group.id;

    // Sichtbarkeit: Mitglieder ja, DM und Admin nicht
    expect((await groups(frodo.agent))[0]).toMatchObject({ name: 'Hobbits', canManage: true });
    expect((await groups(sam.agent))[0]).toMatchObject({ name: 'Hobbits', canManage: false });
    expect(await groups(dm.agent)).toEqual([]);
    expect(await groups(admin)).toEqual([]);
    expect((await dm.agent.get(`/api/chat/groups/${gid}/messages`)).status).toBe(404);
    expect((await admin.get(`/api/chat/groups/${gid}/messages`)).status).toBe(404);
    expect((await dm.agent.post(`/api/chat/groups/${gid}/messages`).set(CSRF).send({ body: 'Lauschen' })).status).toBe(404);

    // Nachrichten: als Charakter, Wurf; ungelesen bei den anderen
    const m1 = await sam.agent.post(`/api/chat/groups/${gid}/messages`).set(CSRF).send({ body: 'Zweites Frühstück?', characterId: char.id });
    expect(m1.body.message).toMatchObject({ groupId: gid, recipientId: null, senderName: 'sam', characterName: 'Samweis' });
    await frodo.agent.post(`/api/chat/groups/${gid}/messages`).set(CSRF).send({ dice: { expression: '1W20', total: 7, dice: [{ sides: 20, value: 7 }] } });
    expect((await pippin.agent.get('/api/chat/unread')).body).toEqual({ total: 2, byStory: { [s.id]: 2 } });
    expect((await sam.agent.get('/api/chat/unread')).body.total).toBe(1);
    expect((await groups(pippin.agent))[0]).toMatchObject({ unread: 2, last: { sender: 'frodo' } });
    const conv = (await pippin.agent.get(`/api/chat/groups/${gid}/messages`)).body;
    expect(conv.messages.map((m: { senderName: string; kind: string }) => `${m.senderName}:${m.kind}`)).toEqual(['sam:text', 'frodo:dice']);
    expect((await pippin.agent.get('/api/chat/unread')).body.total).toBe(0);
    // DM-Zweiergespräche sind davon unberührt
    expect((await dm.agent.get('/api/chat/unread')).body.total).toBe(0);

    // Bearbeiten/Löschen eigener Nachrichten
    expect((await sam.agent.put(`/api/chat/messages/${m1.body.message.id}`).set(CSRF).send({ body: 'Elevenses?' })).body.message).toMatchObject({ body: 'Elevenses?', edited: true });
    expect((await frodo.agent.put(`/api/chat/messages/${m1.body.message.id}`).set(CSRF).send({ body: 'x' })).status).toBe(404);

    // Verwalten: nur Ersteller; Pippin entfernen → sieht Gruppe nicht mehr
    expect((await sam.agent.put(`/api/chat/groups/${gid}`).set(CSRF).send({ name: 'X', memberIds: [frodo.user.id] })).status).toBe(403);
    expect((await frodo.agent.put(`/api/chat/groups/${gid}`).set(CSRF).send({ name: 'Gefährten', memberIds: [sam.user.id, dm.user.id] })).status).toBe(200);
    expect(await groups(pippin.agent)).toEqual([]);
    expect((await pippin.agent.get(`/api/chat/groups/${gid}/messages`)).status).toBe(404);
    expect((await groups(dm.agent))[0].members.map((m) => m.username).sort()).toEqual(['frodo', 'gandalf', 'sam']);

    // Ersteller verlässt die Gruppe → Verwaltung geht an das älteste Mitglied (Sam)
    expect((await frodo.agent.post(`/api/chat/groups/${gid}/leave`).set(CSRF)).status).toBe(204);
    expect(await groups(frodo.agent)).toEqual([]);
    expect((await groups(sam.agent))[0].canManage).toBe(true);
    expect((await dm.agent.delete(`/api/chat/groups/${gid}`).set(CSRF)).status).toBe(403);
    expect((await sam.agent.delete(`/api/chat/groups/${gid}`).set(CSRF)).status).toBe(204);
    expect(await groups(dm.agent)).toEqual([]);
  });
});
