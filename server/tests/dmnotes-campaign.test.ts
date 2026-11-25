import { beforeEach, describe, expect, it } from 'vitest';
import { stripDmSecrets, tableDie } from '@zauberbuch/shared';
import { CSRF, createUser, loginAs, resetDb } from './helpers';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('DM-Notizen als Kampagnenbuch', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('Hilfsfunktionen: geheime Stellen, Zufallstabellen', () => {
    expect(stripDmSecrets('Offen\n\n:::geheim\nStrahd ist der Wolf\n:::\n\nAuch offen')).toBe('Offen\n\nAuch offen');
    const plain = tableDie(['Wölfe', 'Zigeuner', 'Nebel']);
    expect([plain.sides, plain.pick(2)]).toEqual([3, 1]);
    const ranged = tableDie(['1-3: Wölfe', '4–5: Zombies', '6: Strahd']);
    expect([ranged.sides, ranged.pick(2), ranged.pick(5), ranged.pick(6)]).toEqual([6, 0, 1, 2]);
  });

  it('Baum, Felder, Versionen, Bilder, Freigeben, Kampf vorbereiten', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('leiterin');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const s = (await admin.post('/api/stories').set(CSRF).send({ name: 'Strahd', members: [{ userId: dm.user.id, role: 'dm' }, { userId: frodo.user.id, role: 'player' }, { userId: sam.user.id, role: 'player' }] })).body.story;
    const base = `/api/dm-notes/stories/${s.id}`;
    const char = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Ireena', storyId: s.id })).body.character;
    const fremdChar = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Woanders' })).body.character;

    // Kapitelbaum mit Feldern
    const akt = (await dm.agent.post(base).set(CSRF).send({ title: 'Akt 1', kind: 'chapter' })).body.note;
    const dorf = (await dm.agent.post(base).set(CSRF).send({ title: 'Dorf Barovia', kind: 'place', parentId: akt.id, status: 'prepared', tags: ['Hauptplot', 'Hauptplot', 'Barovia'], pinned: true, gameDate: '1. Nachtal', characterIds: [char.id, fremdChar.id], body: 'Nebel.\n\n:::geheim\nStrahd beobachtet alles.\n:::\n\n- [ ] Ismark treffen' })).body.note;
    expect(dorf).toMatchObject({ parentId: akt.id, kind: 'place', status: 'prepared', tags: ['Hauptplot', 'Barovia'], pinned: true, gameDate: '1. Nachtal', characterIds: [char.id] });
    expect((await dm.agent.post(base).set(CSRF).send({ title: 'X', parentId: 'gibtsnicht' })).status).toBe(400);
    // kein Kreis: Akt unter Dorf hängen
    expect((await dm.agent.put(`/api/dm-notes/${akt.id}`).set(CSRF).send({ title: 'Akt 1', parentId: dorf.id })).status).toBe(400);

    // Status/Pin/Checkliste per PATCH
    const patched = (await dm.agent.patch(`/api/dm-notes/${dorf.id}`).set(CSRF).send({ status: 'active', body: dorf.body.replace('[ ]', '[x]') })).body.note;
    expect(patched.status).toBe('active');
    expect(patched.body).toContain('- [x] Ismark treffen');
    expect((await frodo.agent.patch(`/api/dm-notes/${dorf.id}`).set(CSRF).send({ status: 'done' })).status).toBe(403);

    // Versionen: Änderung durch eine andere Person sichert die alte Fassung; Wiederherstellen
    await admin.put(`/api/dm-notes/${dorf.id}`).set(CSRF).send({ title: 'Dorf Barovia (neu)', body: 'Ganz anders' });
    const versions = (await dm.agent.get(`/api/dm-notes/${dorf.id}/versions`)).body.versions;
    expect(versions[0]).toMatchObject({ title: 'Dorf Barovia', updatedBy: 'leiterin' });
    expect(versions[0].body).toContain('Nebel.');
    const restored = (await dm.agent.post(`/api/dm-notes/${dorf.id}/versions/${versions[0].id}/restore`).set(CSRF)).body.note;
    expect(restored.title).toBe('Dorf Barovia');
    expect((await dm.agent.get(`/api/dm-notes/${dorf.id}/versions`)).body.versions[0].title).toBe('Dorf Barovia (neu)');

    // Bild: DM ja, Spieler erst nach Freigabe
    const img = (await dm.agent.post(`${base}/images`).set(CSRF).send({ image: PNG })).body.url as string;
    expect(img).toMatch(/^\/api\/dm-notes\/images\/\w+$/);
    expect((await dm.agent.get(img)).headers['content-type']).toBe('image/png');
    expect((await frodo.agent.get(img)).status).toBe(404);
    await dm.agent.put(`/api/dm-notes/${dorf.id}`).set(CSRF).send({ title: 'Dorf Barovia', body: `Nebel.\n\n![Karte](${img})\n\n:::geheim\nStrahd beobachtet alles.\n:::` });

    // Freigeben auf die Infotafel: ohne geheime Stellen, Bild wird sichtbar
    const shared = (await dm.agent.post(`/api/dm-notes/${dorf.id}/share`).set(CSRF).send({ to: 'board' })).body.note;
    expect(shared).toMatchObject({ sharedInfo: 'board' });
    const post = (await frodo.agent.get(`/api/board/stories/${s.id}/posts`)).body.posts[0];
    expect(post).toMatchObject({ title: 'Dorf Barovia', category: 'places' });
    expect(post.body).not.toContain('Strahd beobachtet');
    expect(post.body).toContain(img);
    expect((await frodo.agent.get(img)).status).toBe(200);
    // Freigeben per Chat an Sam
    const viaChat = (await dm.agent.post(`/api/dm-notes/${akt.id}/share`).set(CSRF).send({ to: 'chat', userIds: [sam.user.id] })).body.note;
    expect(viaChat.sharedInfo).toBe('chat:sam');
    expect((await sam.agent.get(`/api/chat/stories/${s.id}/with/${dm.user.id}`)).body.messages[0].body).toContain('**Akt 1**');
    expect((await dm.agent.post(`/api/dm-notes/${akt.id}/share`).set(CSRF).send({ to: 'chat', userIds: ['fremd'] })).status).toBe(400);

    // Kampf vorbereiten aus einer Begegnung
    const tpl = (await dm.agent.post(`/api/bestiary/dm?storyId=${s.id}`).set(CSRF).send({ name: 'Wolf', ac: 13, hp: 11 })).body.template;
    const enc = (await dm.agent.post(base).set(CSRF).send({ title: 'Wolfsrudel', kind: 'encounter', monsters: [{ templateId: tpl.id, name: 'Wolf', count: 3 }] })).body.note;
    const made = await dm.agent.post(`/api/dm-notes/${enc.id}/encounter`).set(CSRF);
    expect(made.status).toBe(201);
    const fight = (await dm.agent.get(`/api/combat/encounters/${made.body.encounterId}`)).body.encounter;
    expect(fight.name).toBe('Wolfsrudel');
    expect(fight.combatants.map((c: { name: string; hpMax: number }) => `${c.name}:${c.hpMax}`)).toEqual(['Wolf 1:11', 'Wolf 2:11', 'Wolf 3:11']);

    // Zufallstabelle und Sitzung speichern
    const table = (await dm.agent.post(base).set(CSRF).send({ title: 'Begegnungen im Wald', kind: 'table', tableRows: ['1-3: Wölfe', '4-6: Nebel'] })).body.note;
    expect(table.tableRows).toEqual(['1-3: Wölfe', '4-6: Nebel']);
    const session = (await dm.agent.post(base).set(CSRF).send({ title: 'Sitzung 1', kind: 'session', sessionDate: '2026-11-20', xp: 450 })).body.note;
    expect(session).toMatchObject({ sessionDate: '2026-11-20', xp: 450 });

    // Löschen: Unterabschnitte rücken nach oben
    await dm.agent.delete(`/api/dm-notes/${akt.id}`).set(CSRF);
    const all = (await dm.agent.get(base)).body.notes;
    expect(all.find((n: { id: string }) => n.id === dorf.id).parentId).toBeNull();
  });
});
