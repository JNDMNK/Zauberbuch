import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, resetDb } from './helpers';

describe('Magische Gegenstände', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup() {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('leiterin');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const pippin = await createUser('pippin');
    const story = (await admin.post('/api/stories').set(CSRF).send({ name: 'Strahd', memberIds: [frodo.user.id, sam.user.id], dmIds: [dm.user.id] })).body.story;
    const other = (await admin.post('/api/stories').set(CSRF).send({ name: 'Andere' })).body.story;
    const mk = async (agent: typeof frodo.agent, name: string, storyId: string | null) => {
      const ch = (await agent.post('/api/characters').set(CSRF).send({ name })).body.character;
      if (storyId) await agent.put(`/api/characters/${ch.id}/settings`).set(CSRF).send({ storyId, editorIds: [] });
      return ch.id as string;
    };
    const vaelor = await mk(frodo.agent, 'Vaelor', story.id);
    const bruni = await mk(sam.agent, 'Bruni', story.id);
    const fremd = await mk(pippin.agent, 'Fremd', other.id);
    return { admin, dm, frodo, sam, pippin, storyId: story.id as string, otherStoryId: other.id as string, vaelor, bruni, fremd };
  }

  it('Verwaltung durch DM der Geschichte, Admin und Moderator; Spieler haben keinen Zugriff', async () => {
    const { admin, dm, frodo, storyId, otherStoryId, vaelor, bruni, fremd } = await setup();
    const mod = await createUser('moderator', 'dungeonmaster');
    expect((await dm.agent.get('/api/items/stories')).body.stories.map((s: { name: string }) => s.name)).toEqual(['Strahd']);
    expect((await mod.agent.get('/api/items/stories')).body.stories).toHaveLength(2);
    expect((await frodo.agent.get('/api/items/stories')).body.stories).toEqual([]);
    expect((await frodo.agent.get(`/api/items/stories/${storyId}`)).status).toBe(403);
    expect((await dm.agent.get(`/api/items/stories/${otherStoryId}`)).status).toBe(403);

    const list = (await dm.agent.get(`/api/items/stories/${storyId}`)).body;
    expect(list.characters.map((c: { name: string }) => c.name).sort()).toEqual(['Bruni', 'Vaelor']);

    // Zwei Besitzer möglich; nur Bögen der Geschichte
    const r = await dm.agent.post(`/api/items/stories/${storyId}`).set(CSRF).send({ name: 'Ring der Unsichtbarkeit', description: 'Unsichtbar bis zum Angriff.', holderIds: [vaelor, bruni] });
    expect(r.status).toBe(201);
    expect(r.body.item.holders.map((h: { name: string; owner: string }) => `${h.name}/${h.owner}`).sort()).toEqual(['Bruni/sam', 'Vaelor/frodo']);
    expect((await dm.agent.post(`/api/items/stories/${storyId}`).set(CSRF).send({ name: 'X', holderIds: [fremd] })).status).toBe(400);
    expect((await admin.put(`/api/items/${r.body.item.id}`).set(CSRF).send({ name: 'Ring der Unsichtbarkeit', holderIds: [vaelor] })).body.item.holders).toHaveLength(1);
    expect((await mod.agent.delete(`/api/items/${r.body.item.id}`).set(CSRF)).status).toBe(204);
  });

  it('Benachrichtigung beim Erhalten, Anzeige im Bogen, Weitergeben und Zurückgeben', async () => {
    const { dm, frodo, sam, pippin, storyId, vaelor, bruni, fremd } = await setup();
    const item = (await dm.agent.post(`/api/items/stories/${storyId}`).set(CSRF).send({ name: 'Flammenzunge', description: 'Langschwert +2', weight: 3.5, value: ' 200 GM ', attunement: true, holderIds: [vaelor] })).body.item;
    expect(item.weight).toBe(3.5);
    expect(item.value).toBe('200 GM');
    expect((await dm.agent.put(`/api/items/${item.id}`).set(CSRF).send({ name: 'Flammenzunge', weight: 3.5, value: '200 GM', holderIds: [vaelor] })).body.item.attunement).toBe(false);
    await dm.agent.put(`/api/items/${item.id}`).set(CSRF).send({ name: 'Flammenzunge', weight: 3.5, value: '200 GM', attunement: true, holderIds: [vaelor] });
    expect((await dm.agent.put(`/api/items/${item.id}`).set(CSRF).send({ name: 'Flammenzunge', weight: -1, holderIds: [vaelor] })).status).toBe(400);

    const n = (await frodo.agent.get('/api/notifications')).body;
    expect(n.notifications[0]).toMatchObject({ type: 'item_received', data: { from: 'leiterin', item: 'Flammenzunge', character: 'Vaelor', link: `/characters/${vaelor}?tab=items` } });
    expect((await sam.agent.get('/api/notifications')).body.unread).toBe(0);

    const mine = (await frodo.agent.get(`/api/items/character/${vaelor}`)).body;
    expect(mine.canTransfer).toBe(true);
    expect(mine.items.map((i: { name: string }) => i.name)).toEqual(['Flammenzunge']);
    expect(mine.items[0]).toMatchObject({ weight: 3.5, value: '200 GM', attunement: true });
    expect(mine.targets.map((t: { name: string }) => t.name)).toEqual(['Bruni']); // nur Bögen der Geschichte
    // DM darf den Bogen sehen, aber nicht weitergeben
    expect((await dm.agent.get(`/api/items/character/${vaelor}`)).body.canTransfer).toBe(false);
    expect((await pippin.agent.get(`/api/items/character/${vaelor}`)).status).toBe(404);
    expect((await sam.agent.post(`/api/items/${item.id}/transfer`).set(CSRF).send({ fromCharacterId: vaelor, toCharacterId: bruni })).status).toBe(404);
    expect((await frodo.agent.post(`/api/items/${item.id}/transfer`).set(CSRF).send({ fromCharacterId: vaelor, toCharacterId: fremd })).status).toBe(400);

    // Weitergeben an Bruni -> Sam wird benachrichtigt
    expect((await frodo.agent.post(`/api/items/${item.id}/transfer`).set(CSRF).send({ fromCharacterId: vaelor, toCharacterId: bruni })).status).toBe(204);
    expect((await frodo.agent.get(`/api/items/character/${vaelor}`)).body.items).toEqual([]);
    expect((await sam.agent.get(`/api/items/character/${bruni}`)).body.items[0].name).toBe('Flammenzunge');
    expect((await sam.agent.get('/api/notifications')).body.notifications[0]).toMatchObject({ type: 'item_received', data: { from: 'frodo (Vaelor)', item: 'Flammenzunge' } });

    // Zurück an den DM -> DM wird benachrichtigt, niemand besitzt den Gegenstand mehr
    expect((await sam.agent.post(`/api/items/${item.id}/transfer`).set(CSRF).send({ fromCharacterId: bruni, toCharacterId: null })).status).toBe(204);
    expect((await dm.agent.get('/api/notifications')).body.notifications[0]).toMatchObject({ type: 'item_returned', data: { from: 'sam', character: 'Bruni', item: 'Flammenzunge' } });
    expect((await dm.agent.get(`/api/items/stories/${storyId}`)).body.items[0].holders).toEqual([]);
    expect((await sam.agent.post(`/api/items/${item.id}/transfer`).set(CSRF).send({ fromCharacterId: bruni, toCharacterId: null })).status).toBe(400);
  });
});
