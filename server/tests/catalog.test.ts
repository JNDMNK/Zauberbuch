import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, resetDb } from './helpers';
import { seedCatalog } from '../src/routes/catalog';

describe('Gegenstands-Datenbank', () => {
  beforeEach(async () => {
    await resetDb();
    await seedCatalog();
  });

  it('Standard-Datenbank: vorbefüllt, lesbar für alle, bearbeitbar für Admin/Moderator', async () => {
    const frodo = await createUser('frodo');
    const mod = await createUser('moderator', 'dungeonmaster');
    const list = (await frodo.agent.get('/api/catalog')).body.items;
    expect(list.length).toBeGreaterThan(80);
    const lang = list.find((i: { name: string }) => i.name === 'Langschwert');
    expect(lang).toMatchObject({ category: 'weapon', damage: { dice: '1d8', type: 'slashing' }, weight: 3, value: '15 GM', origin: 'standard' });
    expect(list.find((i: { name: string }) => i.name === 'Kettenhemd')).toMatchObject({ category: 'armor', ac: '13 + GES (max. 2)', weight: 20, damage: null });
    expect(list.find((i: { name: string }) => i.name === 'Plattenpanzer')).toMatchObject({ category: 'armor', ac: '18', strength: 15 });
    expect(list.find((i: { name: string }) => i.name === 'Kettenhemd').strength).toBeNull();
    expect(list.find((i: { name: string }) => i.name === 'Heiltrank')).toMatchObject({ category: 'gear', damage: { dice: '2d4+2', type: 'healing' } });

    expect((await frodo.agent.post('/api/catalog/standard').set(CSRF).send({ category: 'gear', name: 'X' })).status).toBe(403);
    const created = await mod.agent.post('/api/catalog/standard').set(CSRF).send({ category: 'weapon', name: 'Sternenklinge', damageDice: '1W10', damageType: 'force', weight: 2.5, value: ' 120 GM ', description: 'Funkelt.' });
    expect(created.body.item).toMatchObject({ name: 'Sternenklinge', damage: { dice: '1d10', type: 'force' }, weight: 2.5, value: '120 GM' });
    // Rüstung ignoriert Schaden, Waffe ignoriert RK
    const armor = await mod.agent.put(`/api/catalog/${created.body.item.id}`).set(CSRF).send({ category: 'armor', name: 'Sternenpanzer', ac: '15', strength: 14, damageDice: '1d4', damageType: 'fire' });
    expect(armor.body.item).toMatchObject({ category: 'armor', ac: '15', strength: 14, damage: null });
    expect((await mod.agent.post('/api/catalog/standard').set(CSRF).send({ category: 'gear', name: 'Y', damageDice: '1d4' })).status).toBe(400);
    expect((await mod.agent.delete(`/api/catalog/${created.body.item.id}`).set(CSRF)).status).toBe(204);
  });

  it('Geschichte erbt den Standard live; Anpassen, Ausblenden, eigene Einträge, Zurücksetzen', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const frodo = await createUser('frodo');
    const story = (await admin.post('/api/stories').set(CSRF).send({ name: 'Faerûn' })).body.story;
    const std = (await admin.get('/api/catalog')).body.items;
    const lang = std.find((i: { name: string }) => i.name === 'Langschwert');
    const seil = std.find((i: { name: string }) => i.name === 'Seil (Hanf, 15 m)');
    const count = std.length;

    // Anpassen
    const ov = await admin.put(`/api/catalog/stories/${story.id}/override/${lang.id}`).set(CSRF).send({ name: 'Elfenlangschwert', damageDice: '1d8+1', damageType: 'slashing', weight: 2, category: 'gear' });
    expect(ov.body.item).toMatchObject({ name: 'Elfenlangschwert', category: 'weapon', origin: 'override', baseId: lang.id });
    // Ausblenden
    await admin.post(`/api/catalog/stories/${story.id}/hide/${seil.id}`).set(CSRF);
    // Eigener Eintrag
    await admin.post(`/api/catalog/stories/${story.id}`).set(CSRF).send({ category: 'gear', name: 'Barovianischer Wein', weight: 1 });

    const eff = (await frodo.agent.get(`/api/catalog?storyId=${story.id}`)).body.items;
    expect(eff).toHaveLength(count); // -1 ausgeblendet, +1 eigener
    expect(eff.find((i: { name: string }) => i.name === 'Langschwert')).toBeUndefined();
    expect(eff.find((i: { name: string }) => i.name === 'Elfenlangschwert')).toMatchObject({ origin: 'override' });
    expect(eff.find((i: { name: string }) => i.name.startsWith('Seil (Hanf'))).toBeUndefined();
    expect(eff.find((i: { name: string }) => i.name === 'Barovianischer Wein')).toMatchObject({ origin: 'story' });
    // Verwaltung sieht Ausgeblendete
    const manage = (await admin.get(`/api/catalog/stories/${story.id}`)).body.items;
    expect(manage.find((i: { name: string }) => i.name.startsWith('Seil (Hanf'))).toMatchObject({ hidden: true });
    expect((await frodo.agent.get(`/api/catalog/stories/${story.id}`)).status).toBe(403);

    // Live-Vererbung: Standard-Änderung kommt an (nicht bei angepassten Einträgen)
    const dolch = std.find((i: { name: string }) => i.name === 'Dolch');
    await admin.put(`/api/catalog/${dolch.id}`).set(CSRF).send({ category: 'weapon', name: 'Dolch', damageDice: '1d4', damageType: 'piercing', weight: 0.5 });
    expect((await frodo.agent.get(`/api/catalog?storyId=${story.id}`)).body.items.find((i: { name: string }) => i.name === 'Dolch').weight).toBe(0.5);

    // Zurücksetzen
    await admin.delete(`/api/catalog/stories/${story.id}/override/${lang.id}`).set(CSRF);
    await admin.delete(`/api/catalog/stories/${story.id}/override/${seil.id}`).set(CSRF);
    const back = (await frodo.agent.get(`/api/catalog?storyId=${story.id}`)).body.items;
    expect(back.find((i: { name: string }) => i.name === 'Langschwert')).toMatchObject({ origin: 'standard' });
    expect(back).toHaveLength(count + 1);
  });

  it('Inventar speichert die Verknüpfung zum Katalog', async () => {
    const frodo = await createUser('frodo');
    const lang = (await frodo.agent.get('/api/catalog')).body.items.find((i: { name: string }) => i.name === 'Langschwert');
    const ch = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Vaelor' })).body.character;
    const saved = await frodo.agent.put(`/api/characters/${ch.id}`).set(CSRF).send({ data: { ...ch.data, inventory: [{ name: 'Langschwert · 1W8 Hieb', qty: 1, weight: 3, ref: lang.id }, { name: 'Seil', qty: 1, weight: 10 }] } });
    expect(saved.body.character.data.inventory).toEqual([
      { name: 'Langschwert · 1W8 Hieb', qty: 1, weight: 3, ref: lang.id },
      { name: 'Seil', qty: 1, weight: 10, ref: null },
    ]);
  });
});
