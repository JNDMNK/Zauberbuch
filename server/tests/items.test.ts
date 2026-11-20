import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, resetDb } from './helpers';

describe('Magische Gegenstände (allgemeine Datenbank)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup() {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('leiterin');
    const dm2 = await createUser('zweitdm');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const pippin = await createUser('pippin');
    const story = (await admin.post('/api/stories').set(CSRF).send({ name: 'Strahd', memberIds: [frodo.user.id, sam.user.id], dmIds: [dm.user.id] })).body.story;
    const other = (await admin.post('/api/stories').set(CSRF).send({ name: 'Andere', memberIds: [pippin.user.id], dmIds: [dm2.user.id] })).body.story;
    const mk = async (agent: typeof frodo.agent, name: string, storyId: string | null) => {
      const ch = (await agent.post('/api/characters').set(CSRF).send({ name })).body.character;
      if (storyId) await agent.put(`/api/characters/${ch.id}/settings`).set(CSRF).send({ storyId, editorIds: [] });
      return ch.id as string;
    };
    const vaelor = await mk(frodo.agent, 'Vaelor', story.id);
    const bruni = await mk(sam.agent, 'Bruni', story.id);
    const fremd = await mk(pippin.agent, 'Fremd', other.id);
    return { admin, dm, dm2, frodo, sam, pippin, storyId: story.id as string, otherStoryId: other.id as string, vaelor, bruni, fremd };
  }

  it('eine Datenbank für alle Geschichten: Admin, Moderator und alle DMs bearbeiten; Spieler nicht', async () => {
    const { admin, dm, dm2, frodo, storyId, otherStoryId } = await setup();
    const mod = await createUser('moderator', 'dungeonmaster');
    // Geschichten für die Besitzer-Vergabe: DM nur die eigene, Moderator alle
    expect((await dm.agent.get('/api/items/stories')).body.stories.map((s: { name: string }) => s.name)).toEqual(['Strahd']);
    expect((await mod.agent.get('/api/items/stories')).body.stories).toHaveLength(2);
    expect((await frodo.agent.get('/api/items/stories')).body.stories).toEqual([]);
    expect((await frodo.agent.get('/api/items')).status).toBe(403);
    expect((await frodo.agent.post('/api/items').set(CSRF).send({ name: 'X' })).status).toBe(403);

    // DM legt an – alle anderen Verwalter sehen und bearbeiten denselben Eintrag
    const item = (await dm.agent.post('/api/items').set(CSRF).send({ name: 'Ring der Unsichtbarkeit', value: '5.000 GM' })).body.item;
    expect((await dm2.agent.get('/api/items')).body.items.map((i: { name: string }) => i.name)).toEqual(['Ring der Unsichtbarkeit']);
    expect((await mod.agent.get('/api/items')).body.items).toHaveLength(1);
    expect((await dm2.agent.put(`/api/items/${item.id}`).set(CSRF).send({ name: 'Ring der Unsichtbarkeit', value: '6.000 GM' })).body.item.value).toBe('6.000 GM');
    // Charakterbögen nur für Geschichten, die man leitet
    expect((await dm.agent.get(`/api/items?storyId=${storyId}`)).body.characters.map((c: { name: string }) => c.name).sort()).toEqual(['Bruni', 'Vaelor']);
    expect((await dm.agent.get(`/api/items?storyId=${otherStoryId}`)).status).toBe(403);
    expect((await admin.get(`/api/items?storyId=${otherStoryId}`)).body.characters.map((c: { name: string }) => c.name)).toEqual(['Fremd']);
    expect((await mod.agent.delete(`/api/items/${item.id}`).set(CSRF)).status).toBe(204);
  });

  it('Besitzer je Geschichte: gleicher Gegenstand in mehreren Geschichten, fremde Besitzer nur als Anzahl', async () => {
    const { admin, dm, dm2, storyId, otherStoryId, vaelor, bruni, fremd } = await setup();
    const item = (await dm.agent.post('/api/items').set(CSRF).send({ name: 'Heiltrank (groß)', storyId, holderIds: [vaelor, bruni] })).body.item;
    expect(item.holders.map((h: { name: string }) => h.name).sort()).toEqual(['Bruni', 'Vaelor']);
    // fremde Geschichte bzw. Bogen einer anderen Geschichte: nicht erlaubt
    expect((await dm.agent.put(`/api/items/${item.id}/holders`).set(CSRF).send({ storyId: otherStoryId, holderIds: [fremd] })).status).toBe(403);
    expect((await dm.agent.put(`/api/items/${item.id}/holders`).set(CSRF).send({ storyId, holderIds: [fremd] })).status).toBe(400);
    // DM der anderen Geschichte vergibt denselben Gegenstand an seinen Spieler – Besitzer in Strahd bleiben
    const r2 = (await dm2.agent.put(`/api/items/${item.id}/holders`).set(CSRF).send({ storyId: otherStoryId, holderIds: [fremd] })).body.item;
    expect(r2.holders.map((h: { name: string }) => h.name)).toEqual(['Fremd']);
    expect(r2.otherHolders).toBe(2);
    const viewDm = (await dm.agent.get('/api/items')).body.items[0];
    expect(viewDm.holders.map((h: { name: string }) => h.name).sort()).toEqual(['Bruni', 'Vaelor']);
    expect(viewDm.otherHolders).toBe(1);
    expect((await admin.get('/api/items')).body.items[0].holders).toHaveLength(3);
    // Bearbeiten mit storyId setzt nur die Besitzer dieser Geschichte
    await dm.agent.put(`/api/items/${item.id}`).set(CSRF).send({ name: 'Heiltrank (groß)', storyId, holderIds: [vaelor] });
    expect((await admin.get('/api/items')).body.items[0].holders.map((h: { name: string }) => h.name).sort()).toEqual(['Fremd', 'Vaelor']);
    // Zähler je Geschichte
    expect((await admin.get('/api/items/stories')).body.stories.map((s: { name: string; itemCount: number }) => `${s.name}:${s.itemCount}`)).toEqual(['Andere:1', 'Strahd:1']);
  });

  it('Benachrichtigung beim Erhalten, Anzeige im Bogen, Weitergeben und Zurückgeben innerhalb der Geschichte', async () => {
    const { dm, dm2, frodo, sam, pippin, storyId, otherStoryId, vaelor, bruni, fremd } = await setup();
    const item = (await dm.agent.post('/api/items').set(CSRF).send({ name: 'Flammenzunge', description: 'Langschwert +2', weight: 3.5, storyId, holderIds: [vaelor] })).body.item;
    expect(item.weight).toBe(3.5);
    expect((await dm.agent.put(`/api/items/${item.id}`).set(CSRF).send({ name: 'Flammenzunge', weight: -1 })).status).toBe(400);
    await dm2.agent.put(`/api/items/${item.id}/holders`).set(CSRF).send({ storyId: otherStoryId, holderIds: [fremd] });

    const n = (await frodo.agent.get('/api/notifications')).body;
    expect(n.notifications[0]).toMatchObject({ type: 'item_received', data: { from: 'leiterin', item: 'Flammenzunge', character: 'Vaelor', story: 'Strahd', link: `/characters/${vaelor}?tab=items` } });
    expect((await sam.agent.get('/api/notifications')).body.unread).toBe(0);
    expect((await pippin.agent.get('/api/notifications')).body.notifications[0]).toMatchObject({ data: { story: 'Andere', character: 'Fremd' } });

    const mine = (await frodo.agent.get(`/api/items/character/${vaelor}`)).body;
    expect(mine.canTransfer).toBe(true);
    expect(mine.items.map((i: { name: string }) => i.name)).toEqual(['Flammenzunge']);
    // im Bogen nur Besitzer der eigenen Geschichte
    expect(mine.items[0].holders.map((h: { name: string }) => h.name)).toEqual(['Vaelor']);
    expect(mine.targets.map((t: { name: string }) => t.name)).toEqual(['Bruni']);
    expect((await dm.agent.get(`/api/items/character/${vaelor}`)).body.canTransfer).toBe(false);
    expect((await pippin.agent.get(`/api/items/character/${vaelor}`)).status).toBe(404);
    expect((await frodo.agent.post(`/api/items/${item.id}/transfer`).set(CSRF).send({ fromCharacterId: vaelor, toCharacterId: fremd })).status).toBe(400);

    // Weitergeben an Bruni -> Sam wird benachrichtigt
    expect((await frodo.agent.post(`/api/items/${item.id}/transfer`).set(CSRF).send({ fromCharacterId: vaelor, toCharacterId: bruni })).status).toBe(204);
    expect((await frodo.agent.get(`/api/items/character/${vaelor}`)).body.items).toEqual([]);
    expect((await sam.agent.get('/api/notifications')).body.notifications[0]).toMatchObject({ type: 'item_received', data: { from: 'frodo (Vaelor)', item: 'Flammenzunge' } });

    // Zurück an den DM -> nur die DMs dieser Geschichte werden benachrichtigt; Besitzer der anderen Geschichte bleibt
    expect((await sam.agent.post(`/api/items/${item.id}/transfer`).set(CSRF).send({ fromCharacterId: bruni, toCharacterId: null })).status).toBe(204);
    expect((await dm.agent.get('/api/notifications')).body.notifications[0]).toMatchObject({ type: 'item_returned', data: { from: 'sam', character: 'Bruni', item: 'Flammenzunge', link: `/admin/items?story=${storyId}` } });
    expect((await dm2.agent.get('/api/notifications')).body.notifications.some((x: { type: string }) => x.type === 'item_returned')).toBe(false);
    const after = (await dm.agent.get('/api/items')).body.items[0];
    expect(after).toMatchObject({ holders: [], otherHolders: 1 });
  });
});
