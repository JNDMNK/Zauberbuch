import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, resetDb } from './helpers';

describe('Chat je Geschichte', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('private Zweiergespräche, ungelesen, als Charakter, Würfe, bearbeiten/löschen, Rechte', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('gandalf');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const fremd = await createUser('saruman');
    const s = (await admin.post('/api/stories').set(CSRF).send({ name: 'Ringkrieg', members: [{ userId: dm.user.id, role: 'dm' }, { userId: frodo.user.id, role: 'player' }, { userId: sam.user.id, role: 'player' }] })).body.story;
    const char = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Frodo Beutlin', storyId: s.id })).body.character;
    const url = (userId: string) => `/api/chat/stories/${s.id}/with/${userId}`;

    // Kontakte: alle anderen Mitglieder, eigene Charaktere
    const story = (await frodo.agent.get(`/api/chat/stories/${s.id}`)).body;
    expect(story.contacts.map((c: { username: string }) => c.username).sort()).toEqual(['gandalf', 'sam']);
    expect(story.myCharacters).toEqual([{ id: char.id, name: 'Frodo Beutlin' }]);
    expect((await fremd.agent.get(`/api/chat/stories/${s.id}`)).status).toBe(404);

    // Frodo → DM (als Charakter), Frodo → Sam, Wurf an den DM
    const m1 = await frodo.agent.post(url(dm.user.id)).set(CSRF).send({ body: 'Ich schleiche mich davon.', characterId: char.id });
    expect(m1.status).toBe(201);
    expect(m1.body.message).toMatchObject({ characterName: 'Frodo Beutlin', kind: 'text', read: false });
    await frodo.agent.post(url(sam.user.id)).set(CSRF).send({ body: 'Geheim, Sam!' });
    const roll = await frodo.agent.post(url(dm.user.id)).set(CSRF).send({ dice: { expression: '1W20 + 5', total: 18, modifier: 5, dice: [{ sides: 20, value: 13 }] } });
    expect(roll.body.message).toMatchObject({ kind: 'dice', body: '1W20 + 5', dice: { total: 18 } });
    expect((await frodo.agent.post(url(dm.user.id)).set(CSRF).send({ body: '  ' })).status).toBe(400);
    expect((await frodo.agent.post(url(fremd.user.id)).set(CSRF).send({ body: 'x' })).status).toBe(404);
    expect((await sam.agent.post(url(dm.user.id)).set(CSRF).send({ body: 'x', characterId: char.id })).status).toBe(400); // fremder Charakter

    // Ungelesen beim DM; DM sieht Frodo↔Sam nicht
    expect((await dm.agent.get('/api/chat/unread')).body).toEqual({ total: 2, byStory: { [s.id]: 2 } });
    const dmStory = (await dm.agent.get(`/api/chat/stories/${s.id}`)).body;
    expect(dmStory.contacts.find((c: { username: string }) => c.username === 'frodo').unread).toBe(2);
    const conv = (await dm.agent.get(url(frodo.user.id))).body;
    expect(conv.messages.map((m: { body: string }) => m.body)).toEqual(['Ich schleiche mich davon.', '1W20 + 5']);
    expect((await dm.agent.get('/api/chat/unread')).body.total).toBe(0);
    expect((await sam.agent.get(url(frodo.user.id))).body.messages.map((m: { body: string }) => m.body)).toEqual(['Geheim, Sam!']);

    // Bearbeiten/Löschen nur eigene; ?since liefert Änderungen
    const since = conv.serverTime;
    expect((await dm.agent.put(`/api/chat/messages/${m1.body.message.id}`).set(CSRF).send({ body: 'gehackt' })).status).toBe(404);
    expect((await frodo.agent.put(`/api/chat/messages/${roll.body.message.id}`).set(CSRF).send({ body: 'x' })).status).toBe(400); // Wurf nicht bearbeitbar
    const ed = await frodo.agent.put(`/api/chat/messages/${m1.body.message.id}`).set(CSRF).send({ body: 'Ich schleiche mich leise davon.' });
    expect(ed.body.message).toMatchObject({ edited: true, body: 'Ich schleiche mich leise davon.' });
    const del = await frodo.agent.delete(`/api/chat/messages/${roll.body.message.id}`).set(CSRF);
    expect(del.body.message).toMatchObject({ deleted: true, body: '', dice: null });
    const delta = (await dm.agent.get(`${url(frodo.user.id)}?since=${encodeURIComponent(since)}`)).body.messages;
    expect(delta.map((m: { edited: boolean; deleted: boolean }) => [m.edited, m.deleted])).toEqual([[true, false], [false, true]]);

    // Archiviert: lesen ja, schreiben nein
    await admin.patch(`/api/stories/${s.id}`).set(CSRF).send({ archived: true });
    expect((await frodo.agent.post(url(dm.user.id)).set(CSRF).send({ body: 'Hallo?' })).status).toBe(403);
    expect((await frodo.agent.get(url(dm.user.id))).status).toBe(200);
  });

  it('merkt „Schreiben als“ je Geschichte, nur mit eigenen Charakteren dieser Geschichte', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const mk = async (name: string) => (await admin.post('/api/stories').set(CSRF).send({ name, members: [{ userId: frodo.user.id, role: 'player' }, { userId: sam.user.id, role: 'player' }] })).body.story;
    const a = await mk('Ringkrieg');
    const b = await mk('Hobbingen');
    const charA = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Frodo', storyId: a.id })).body.character;
    const charB = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Herr Beutlin', storyId: b.id })).body.character;
    const samChar = (await sam.agent.post('/api/characters').set(CSRF).send({ name: 'Sam', storyId: a.id })).body.character;
    const speakAs = async (storyId: string) => (await frodo.agent.get(`/api/chat/stories/${storyId}`)).body.speakAs;
    const put = (storyId: string, characterId: string | null) => frodo.agent.put(`/api/chat/stories/${storyId}/speak-as`).set(CSRF).send({ characterId });

    expect(await speakAs(a.id)).toBeNull();
    expect((await put(a.id, charA.id)).status).toBe(200);
    expect(await speakAs(a.id)).toBe(charA.id);
    expect(await speakAs(b.id)).toBeNull(); // je Geschichte getrennt
    expect((await put(b.id, charA.id)).status).toBe(400); // Charakter einer anderen Geschichte
    expect((await put(a.id, samChar.id)).status).toBe(400); // fremder Charakter
    expect((await put(b.id, charB.id)).status).toBe(200);
    expect([await speakAs(a.id), await speakAs(b.id)]).toEqual([charA.id, charB.id]);
    // Charakter wechselt die Geschichte → gespeicherte Wahl gilt dort nicht mehr
    await frodo.agent.put(`/api/characters/${charA.id}/settings`).set(CSRF).send({ storyId: b.id, editorIds: [] });
    expect(await speakAs(a.id)).toBeNull();
    expect((await put(a.id, null)).status).toBe(200);
  });
});
