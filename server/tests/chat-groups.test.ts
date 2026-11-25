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

  it('Gruppenadmins: vom Besitzer ernannt, ändern Name/Mitglieder/Bild, Besitz geht beim Verlassen an Admins', async () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const admin = await loginAs('admin', 'admin-password');
    const [frodo, sam, pippin, merry] = await Promise.all(['frodo', 'sam', 'pippin', 'merry'].map((n) => createUser(n)));
    const s = (await admin.post('/api/stories').set(CSRF).send({ name: 'Ringkrieg', members: [frodo, sam, pippin, merry].map((u) => ({ userId: u.user.id, role: 'player' })) })).body.story;
    const gid = (await frodo.agent.post(`/api/chat/stories/${s.id}/groups`).set(CSRF).send({ name: 'Hobbits', memberIds: [sam.user.id, pippin.user.id] })).body.group.id;
    const group = async (a: typeof frodo.agent) => (await a.get(`/api/chat/stories/${s.id}`)).body.groups[0];
    const put = (a: typeof frodo.agent, body: object) => a.put(`/api/chat/groups/${gid}`).set(CSRF).send(body);

    // Admins schon beim Anlegen
    const g0 = (await frodo.agent.post(`/api/chat/stories/${s.id}/groups`).set(CSRF).send({ name: 'Zweite', memberIds: [merry.user.id], adminIds: [merry.user.id, frodo.user.id] })).body.group.id;
    const z = (await merry.agent.get(`/api/chat/stories/${s.id}`)).body.groups.find((x: { id: string }) => x.id === g0);
    expect(z.members.map((m: { username: string; isAdmin: boolean }) => `${m.username}:${m.isAdmin}`)).toEqual(['frodo:false', 'merry:true']);
    await frodo.agent.delete(`/api/chat/groups/${g0}`).set(CSRF);
    // Nur der Besitzer ernennt Admins
    expect((await put(frodo.agent, { name: 'Hobbits', memberIds: [sam.user.id, pippin.user.id], adminIds: [sam.user.id] })).status).toBe(200);
    const g1 = await group(sam.agent);
    expect(g1).toMatchObject({ ownerId: frodo.user.id, isOwner: false, canManage: true, imageUrl: null });
    expect(g1.members.find((m: { username: string }) => m.username === 'sam').isAdmin).toBe(true);
    expect((await group(pippin.agent)).canManage).toBe(false);

    // Admin Sam: Merry hinzufügen, Namen ändern; Versuch, Pippin zum Admin zu machen bzw. Frodo zu entfernen, greift nicht
    expect((await put(sam.agent, { name: 'Gefährten', memberIds: [pippin.user.id, merry.user.id], adminIds: [pippin.user.id] })).status).toBe(200);
    const g2 = await group(frodo.agent);
    expect(g2.name).toBe('Gefährten');
    expect(g2.members.map((m: { username: string }) => m.username).sort()).toEqual(['frodo', 'merry', 'pippin', 'sam']);
    expect(g2.members.filter((m: { isAdmin: boolean }) => m.isAdmin).map((m: { username: string }) => m.username)).toEqual(['sam']);
    // Pippin (kein Admin) darf nichts ändern
    expect((await put(pippin.agent, { name: 'X', memberIds: [frodo.user.id] })).status).toBe(403);
    expect((await pippin.agent.put(`/api/chat/groups/${gid}/image`).set(CSRF).send({ image: PNG })).status).toBe(403);

    // Bild: Admin lädt hoch, Mitglieder sehen es, Fremde nicht
    const img = await sam.agent.put(`/api/chat/groups/${gid}/image`).set(CSRF).send({ image: PNG });
    expect(img.body.imageUrl).toMatch(new RegExp(`^/api/chat/groups/${gid}/image\\?v=\\d+$`));
    expect((await group(pippin.agent)).imageUrl).toBe(img.body.imageUrl);
    const got = await merry.agent.get(img.body.imageUrl);
    expect([got.status, got.headers['content-type']]).toEqual([200, 'image/png']);
    expect((await admin.get(img.body.imageUrl)).status).toBe(404);
    expect((await sam.agent.put(`/api/chat/groups/${gid}/image`).set(CSRF).send({ image: 'data:image/svg+xml;base64,PHN2Zz4=' })).status).toBe(400);

    // Löschen nur durch den Besitzer
    expect((await sam.agent.delete(`/api/chat/groups/${gid}`).set(CSRF)).status).toBe(403);
    // Besitzer verlässt → Admin Sam wird Besitzer (obwohl Pippin früher dabei war)
    expect((await frodo.agent.post(`/api/chat/groups/${gid}/leave`).set(CSRF)).status).toBe(204);
    expect(await group(sam.agent)).toMatchObject({ ownerId: sam.user.id, isOwner: true });
    // Bild entfernen
    expect((await sam.agent.put(`/api/chat/groups/${gid}/image`).set(CSRF).send({ image: null })).body.imageUrl).toBeNull();
    expect((await merry.agent.get(img.body.imageUrl)).status).toBe(404);
  });
});
