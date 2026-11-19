import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, prisma, resetDb } from './helpers';

describe('Charakterbogen – Einstellungen', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup() {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('meister', 'dungeonmaster');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const pippin = await createUser('pippin');
    const story = (await dm.agent.post('/api/stories').set(CSRF).send({ name: 'Strahd' })).body.story;
    const other = (await dm.agent.post('/api/stories').set(CSRF).send({ name: 'Tomb' })).body.story;
    const ch = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Vaelor' })).body.character;
    return { admin, dm, frodo, sam, pippin, storyId: story.id as string, otherStoryId: other.id as string, ch };
  }

  it('Besitzer setzt Mitbearbeiter; diese dürfen bearbeiten, aber nicht löschen/duplizieren/Einstellungen ändern', async () => {
    const { frodo, sam, pippin, ch } = await setup();
    expect(ch).toMatchObject({ canEdit: true, canManageSettings: true, isOwner: true, story: null });
    const opts = (await frodo.agent.get(`/api/characters/${ch.id}/settings`)).body.settings;
    expect(opts.options.users.map((u: { username: string }) => u.username)).not.toContain('frodo');
    expect(opts.options.stories.map((s: { name: string }) => s.name)).toEqual(['Strahd', 'Tomb']);

    const r = await frodo.agent.put(`/api/characters/${ch.id}/settings`).set(CSRF).send({ storyId: null, editorIds: [sam.user.id, frodo.user.id, sam.user.id] });
    expect(r.body.settings.editors.map((e: { username: string }) => e.username)).toEqual(['sam']);

    // Sam sieht den Bogen unter „geteilt“ und darf ihn bearbeiten
    const list = (await sam.agent.get('/api/characters')).body;
    expect(list.characters).toEqual([]);
    expect(list.shared.map((c: { name: string; owner: { username: string } }) => [c.name, c.owner.username])).toEqual([['Vaelor', 'frodo']]);
    const view = (await sam.agent.get(`/api/characters/${ch.id}`)).body.character;
    expect(view).toMatchObject({ canEdit: true, canManageSettings: false, isOwner: false });
    const put = await sam.agent.put(`/api/characters/${ch.id}`).set(CSRF).send({ data: { ...view.data, combat: { ...view.data.combat, hpCurrent: 7 } } });
    expect(put.status).toBe(200);
    expect(put.body.character).toMatchObject({ canEdit: true, isOwner: false, owner: { username: 'frodo' } });
    expect((await frodo.agent.get(`/api/characters/${ch.id}`)).body.character.data.combat.hpCurrent).toBe(7);

    expect((await sam.agent.delete(`/api/characters/${ch.id}`).set(CSRF)).status).toBe(403);
    expect((await sam.agent.post(`/api/characters/${ch.id}/duplicate`).set(CSRF)).status).toBe(403);
    expect((await sam.agent.get(`/api/characters/${ch.id}/settings`)).status).toBe(403);
    expect((await sam.agent.put(`/api/characters/${ch.id}/settings`).set(CSRF).send({ storyId: null, editorIds: [] })).status).toBe(403);

    // Ohne Recht weiterhin unsichtbar
    expect((await pippin.agent.get(`/api/characters/${ch.id}`)).status).toBe(404);
    // Entziehen
    await frodo.agent.put(`/api/characters/${ch.id}/settings`).set(CSRF).send({ storyId: null, editorIds: [] });
    expect((await sam.agent.get(`/api/characters/${ch.id}`)).status).toBe(404);
  });

  it('Geschichte zuordnen macht den Besitzer zum Mitspieler; DM/Admin dürfen Einstellungen ändern, aber nicht bearbeiten', async () => {
    const { admin, dm, frodo, storyId, otherStoryId, ch } = await setup();
    const r = await frodo.agent.put(`/api/characters/${ch.id}/settings`).set(CSRF).send({ storyId, editorIds: [] });
    expect(r.body.settings.storyId).toBe(storyId);
    const story = (await frodo.agent.get('/api/board/stories')).body.stories;
    expect(story.map((s: { name: string }) => s.name)).toEqual(['Strahd']); // Frodo ist jetzt Mitspieler
    expect((await frodo.agent.get('/api/characters')).body.characters[0].story).toEqual({ id: storyId, name: 'Strahd' });

    // DM ordnet um; alle-Liste enthält die Geschichte
    const dmView = (await dm.agent.get(`/api/characters/${ch.id}`)).body.character;
    expect(dmView).toMatchObject({ canEdit: false, canManageSettings: true, isOwner: false });
    await dm.agent.put(`/api/characters/${ch.id}/settings`).set(CSRF).send({ storyId: otherStoryId, editorIds: [] });
    const all = (await dm.agent.get('/api/characters/all')).body.characters;
    expect(all[0].story).toEqual({ id: otherStoryId, name: 'Tomb' });
    expect((await dm.agent.put(`/api/characters/${ch.id}`).set(CSRF).send({ data: dmView.data })).status).toBe(403);
    expect((await admin.get(`/api/characters/${ch.id}/settings`)).status).toBe(200);

    // Unbekannte bzw. archivierte Geschichte
    expect((await frodo.agent.put(`/api/characters/${ch.id}/settings`).set(CSRF).send({ storyId: 'gibtsnicht', editorIds: [] })).status).toBe(400);
    await dm.agent.patch(`/api/stories/${storyId}`).set(CSRF).send({ archived: true });
    expect((await frodo.agent.put(`/api/characters/${ch.id}/settings`).set(CSRF).send({ storyId, editorIds: [] })).status).toBe(400);

    // Geschichte gelöscht -> Zuordnung fällt weg
    await admin.delete(`/api/stories/${otherStoryId}`).set(CSRF);
    expect((await prisma.character.findUnique({ where: { id: ch.id } }))!.storyId).toBeNull();
  });

  it('Export/Import übernimmt Geschichte und Mitbearbeiter', async () => {
    const { admin, frodo, sam, storyId, ch } = await setup();
    await frodo.agent.put(`/api/characters/${ch.id}/settings`).set(CSRF).send({ storyId, editorIds: [sam.user.id] });
    const exp = (await admin.get('/api/characters/export')).body;
    expect(exp.characters[0]).toMatchObject({ owner: 'frodo', story: 'Strahd', editors: ['sam'] });
    await prisma.character.deleteMany();
    const imp = await admin.post('/api/characters/import').set(CSRF).send({ characters: exp.characters });
    expect(imp.body.created).toBe(1);
    const c = await prisma.character.findFirst({ include: { editors: true } });
    expect(c!.storyId).toBe(storyId);
    expect(c!.editors.map((e) => e.userId)).toEqual([sam.user.id]);
  });
});

describe('Charakterbögen – Dungeon Master einer Geschichte', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('liest die Bögen seiner Geschichte und darf deren Einstellungen ändern', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('leiterin');
    const frodo = await createUser('frodo');
    const story = (await admin.post('/api/stories').set(CSRF).send({ name: 'S', dmIds: [dm.user.id] })).body.story;
    const ch = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Vaelor' })).body.character;
    const other = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Zweitcharakter' })).body.character;
    expect((await dm.agent.get(`/api/characters/${ch.id}`)).status).toBe(404);
    await frodo.agent.put(`/api/characters/${ch.id}/settings`).set(CSRF).send({ storyId: story.id, editorIds: [] });
    const view = (await dm.agent.get(`/api/characters/${ch.id}`)).body.character;
    expect(view).toMatchObject({ canEdit: false, canManageSettings: true });
    expect((await dm.agent.get(`/api/characters/${other.id}`)).status).toBe(404);
    expect((await dm.agent.get('/api/characters/all')).body.characters.map((c: { name: string }) => c.name)).toEqual(['Vaelor']);
  });
});
