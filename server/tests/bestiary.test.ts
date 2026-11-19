import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, resetDb } from './helpers';

describe('Monster-Datenbanken', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup() {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('meister', 'dungeonmaster');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const pippin = await createUser('pippin');
    const story = (await dm.agent.post('/api/stories').set(CSRF).send({ name: 'Strahd', memberIds: [frodo.user.id, sam.user.id] })).body.story;
    return { admin, dm, frodo, sam, pippin, storyId: story.id as string };
  }

  it('DM-Datenbank: nur DM/Admin, gemeinsam genutzt', async () => {
    const { admin, dm, frodo, storyId } = await setup();
    const created = await dm.agent.post(`/api/bestiary/dm?storyId=${storyId}`).set(CSRF).send({ name: 'Goblin', ac: 15, hp: 7, attack: 'Krummsäbel +4, 1W6+2 Hieb', description: 'Klein und gemein.' });
    expect(created.status).toBe(201);
    expect(created.body.template).toMatchObject({ name: 'Goblin', ac: 15, hp: 7, createdBy: { username: 'meister' } });
    const id = created.body.template.id;

    // Admin sieht und bearbeitet dieselbe Datenbank
    const list = (await admin.get(`/api/bestiary/dm?storyId=${storyId}`)).body.templates;
    expect(list.map((t: { name: string }) => t.name)).toEqual(['Goblin']);
    const upd = await admin.put(`/api/bestiary/dm/${id}?storyId=${storyId}`).set(CSRF).send({ name: 'Goblin', ac: 15, hp: 9, attack: 'Kurzbogen +4, 1W6+2 Stich' });
    expect(upd.body.template).toMatchObject({ hp: 9, updatedBy: { username: 'admin' }, createdBy: { username: 'meister' } });

    // Spieler haben keinen Zugriff
    expect((await frodo.agent.get(`/api/bestiary/dm?storyId=${storyId}`)).status).toBe(403);
    expect((await frodo.agent.post(`/api/bestiary/dm?storyId=${storyId}`).set(CSRF).send({ name: 'X', hp: 1 })).status).toBe(403);
    expect((await dm.agent.post(`/api/bestiary/dm?storyId=${storyId}`).set(CSRF).send({ name: 'Ohne LP' })).status).toBe(400);
    expect((await dm.agent.delete(`/api/bestiary/dm/${id}?storyId=${storyId}`).set(CSRF)).status).toBe(204);
  });

  it('Spieler-Datenbank je Geschichte: Mitspieler bearbeiten gemeinsam, DM liest nur, Fremde sehen nichts', async () => {
    const { admin, dm, frodo, sam, pippin, storyId } = await setup();
    await dm.agent.post(`/api/bestiary/dm?storyId=${storyId}`).set(CSRF).send({ name: 'Geheimes DM-Monster', hp: 99 });

    const e = await frodo.agent.post(`/api/bestiary/stories/${storyId}`).set(CSRF).send({ name: 'Werwolf', attack: 'Biss', description: 'Nur Silber hilft!' });
    expect(e.status).toBe(201);
    expect(e.body.entry).toMatchObject({ name: 'Werwolf', ac: null, hp: null, createdBy: { username: 'frodo' } });
    // Sam korrigiert Frodos Eintrag
    const upd = await sam.agent.put(`/api/bestiary/entries/${e.body.entry.id}`).set(CSRF).send({ name: 'Werwolf', ac: 12, hp: '50-60', attack: 'Biss 2W4+2', description: 'Silber oder Magie!' });
    expect(upd.body.entry).toMatchObject({ ac: 12, hp: '50-60', createdBy: { username: 'frodo' }, updatedBy: { username: 'sam' } });

    const fl = await frodo.agent.get(`/api/bestiary/stories/${storyId}`);
    expect(fl.body).toMatchObject({ canWrite: true });
    expect(fl.body.entries.map((x: { name: string }) => x.name)).toEqual(['Werwolf']); // keine DM-Daten

    // DM und Admin: nur lesen
    const dl = await dm.agent.get(`/api/bestiary/stories/${storyId}`);
    expect(dl.body.canWrite).toBe(false);
    expect(dl.body.entries).toHaveLength(1);
    expect((await dm.agent.post(`/api/bestiary/stories/${storyId}`).set(CSRF).send({ name: 'X' })).status).toBe(403);
    expect((await dm.agent.put(`/api/bestiary/entries/${e.body.entry.id}`).set(CSRF).send({ name: 'X' })).status).toBe(403);
    expect((await admin.delete(`/api/bestiary/entries/${e.body.entry.id}`).set(CSRF)).status).toBe(403);

    // Fremder Spieler sieht die Geschichte nicht
    expect((await pippin.agent.get(`/api/bestiary/stories/${storyId}`)).status).toBe(404);
    expect((await pippin.agent.put(`/api/bestiary/entries/${e.body.entry.id}`).set(CSRF).send({ name: 'X' })).status).toBe(404);

    expect((await sam.agent.delete(`/api/bestiary/entries/${e.body.entry.id}`).set(CSRF)).status).toBe(204);
  });

  it('Admin mit Spielerrolle darf die Spieler-Datenbank bearbeiten, ohne Spielerrolle nur lesen', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const adminId = (await admin.get('/api/auth/me')).body.user.id;
    const story = (await admin.post('/api/stories').set(CSRF).send({ name: 'Admin spielt mit' })).body.story;
    expect((await admin.get(`/api/bestiary/stories/${story.id}`)).body.canWrite).toBe(false);
    expect((await admin.post(`/api/bestiary/stories/${story.id}`).set(CSRF).send({ name: 'Ghul' })).status).toBe(403);
    await admin.patch(`/api/stories/${story.id}`).set(CSRF).send({ members: [{ userId: adminId, role: 'player' }] });
    expect((await admin.post(`/api/bestiary/stories/${story.id}`).set(CSRF).send({ name: 'Ghul' })).status).toBe(201);
  });

  it('DM-Datenbank nur für Dungeon Master einer Geschichte, nicht für Moderatoren ohne Geschichte', async () => {
    const mod = await createUser('moderator', 'dungeonmaster');
    expect((await mod.agent.get('/api/bestiary/dm')).status).toBe(403);
    const frodo = await createUser('frodo');
    const admin = await loginAs('admin', 'admin-password');
    const s = (await admin.post('/api/stories').set(CSRF).send({ name: 'S', dmIds: [frodo.user.id] })).body.story;
    const other = (await admin.post('/api/stories').set(CSRF).send({ name: 'Andere', memberIds: [frodo.user.id] })).body.story;
    expect((await mod.agent.get(`/api/bestiary/dm?storyId=${s.id}`)).status).toBe(403);
    expect((await frodo.agent.get(`/api/bestiary/dm?storyId=${s.id}`)).status).toBe(200); // Benutzer, aber DM der Geschichte
    // gleiche (gemeinsame) Datenbank – aber nicht im Kontext einer Geschichte, in der man Spieler ist
    expect((await frodo.agent.get(`/api/bestiary/dm?storyId=${other.id}`)).status).toBe(403);
    expect((await frodo.agent.get('/api/bestiary/dm')).status).toBe(403);
    // Admin: in Geschichten ohne Spielerrolle DM, als Spieler eingetragen nicht
    expect((await admin.get(`/api/bestiary/dm?storyId=${s.id}`)).status).toBe(200);
    const played = (await admin.post('/api/stories').set(CSRF).send({ name: 'Admin spielt' })).body.story;
    await admin.patch(`/api/stories/${played.id}`).set(CSRF).send({ members: [{ userId: (await admin.get('/api/auth/me')).body.user.id, role: 'player' }] });
    expect((await admin.get(`/api/bestiary/dm?storyId=${played.id}`)).status).toBe(403);
  });

  it('Vorlagen im Kampf: Angriff/Beschreibung nur für den DM, optional als Vorlage speichern', async () => {
    const { dm, frodo, storyId } = await setup();
    const enc = (await dm.agent.post('/api/combat/encounters').set(CSRF).send({ storyId, name: 'K' })).body.encounter;
    const r = await dm.agent
      .post(`/api/combat/encounters/${enc.id}/monsters`)
      .set(CSRF)
      .send({ name: 'Oger', ac: 11, hpMax: 59, attack: 'Großkeule +6, 2W8+4 Wucht', description: 'Dumm, aber stark.', saveAsTemplate: true, hideStats: false });
    const c = r.body.encounter.combatants[0];
    expect(c).toMatchObject({ attack: 'Großkeule +6, 2W8+4 Wucht', description: 'Dumm, aber stark.' });
    expect((await dm.agent.get(`/api/bestiary/dm?storyId=${storyId}`)).body.templates[0]).toMatchObject({ name: 'Oger', ac: 11, hp: 59, attack: 'Großkeule +6, 2W8+4 Wucht' });

    // Spieler erhalten Angriff/Beschreibung nie – auch bei sichtbaren Werten
    const pv = (await frodo.agent.get(`/api/combat/encounters/${enc.id}`)).body.encounter.combatants[0];
    expect(pv).toMatchObject({ ac: '11', hpMax: 59, attack: null, description: null });

    const upd = await dm.agent.patch(`/api/combat/combatants/${c.id}`).set(CSRF).send({ attack: 'Wurfspeer +6, 2W6+4 Stich' });
    expect(upd.body.encounter.combatants[0].attack).toBe('Wurfspeer +6, 2W6+4 Stich');
  });
});

describe('Monster-Datenbanken – Schaden und LP-Bereiche', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('Schaden wie bei Zaubern (Würfel + Art), Würfel normalisiert, nur gemeinsam', async () => {
    const dm = await createUser('meister', 'dungeonmaster');
    const own = (await dm.agent.post('/api/stories').set(CSRF).send({ name: 'Eigene Geschichte' })).body.story; // wird dadurch DM
    const ok = await dm.agent.post(`/api/bestiary/dm?storyId=${own.id}`).set(CSRF).send({ name: 'Goblin', ac: 15, hp: 7, attack: 'Krummsäbel +4', damageDice: '1W6 + 2', damageType: 'slashing' });
    expect(ok.status).toBe(201);
    expect(ok.body.template).toMatchObject({ damageDice: '1d6+2', damageType: 'slashing' });
    expect((await dm.agent.post(`/api/bestiary/dm?storyId=${own.id}`).set(CSRF).send({ name: 'X', hp: 1, damageDice: '1d6' })).status).toBe(400);
    expect((await dm.agent.post(`/api/bestiary/dm?storyId=${own.id}`).set(CSRF).send({ name: 'X', hp: 1, damageType: 'fire' })).status).toBe(400);
    expect((await dm.agent.post(`/api/bestiary/dm?storyId=${own.id}`).set(CSRF).send({ name: 'X', hp: 1, damageDice: 'viel', damageType: 'fire' })).status).toBe(400);
    expect((await dm.agent.post(`/api/bestiary/dm?storyId=${own.id}`).set(CSRF).send({ name: 'X', hp: 1, damageDice: '2d6', damageType: 'banana' })).status).toBe(400);
  });

  it('Vollständiger Werteblock (Größe, Attribute, Merkmale, Aktionen) in beiden Datenbanken', async () => {
    const dm = await createUser('meister', 'dungeonmaster');
    const frodo = await createUser('frodo');
    const storyId = (await dm.agent.post('/api/stories').set(CSRF).send({ name: 'Strahd', memberIds: [frodo.user.id] })).body.story.id;
    const stats = {
      size: 'small',
      type: 'Humanoide (Goblinoide)',
      alignment: 'neutral böse',
      acNote: 'Lederrüstung, Schild',
      hitDice: '2W6',
      speed: '9 m',
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      skills: 'Heimlichkeit +6',
      senses: 'Dunkelsicht 18 m, passive Wahrnehmung 9',
      languages: 'Gemeinsprache, Goblinisch',
      cr: '1/4',
      traits: [{ name: 'Flinke Flucht', text: 'Kann als Bonusaktion Rückzug oder Verstecken nutzen.' }],
      actions: [
        { name: 'Krummsäbel', text: '*Nahkampfwaffenangriff:* +4 zum Treffen, Reichweite 1,5 m. *Treffer:* 5 (1W6 + 2) Hieb.' },
        { name: '', text: '' },
      ],
      habitat: 'Wald, Grasland, Hügel, Unterreich',
      tags: 'Goblinoide',
    };
    const tpl = (await dm.agent.post(`/api/bestiary/dm?storyId=${storyId}`).set(CSRF).send({ name: 'Goblin', ac: 15, hp: 7, stats })).body.template;
    expect(tpl.stats).toMatchObject({ size: 'small', abilities: { dex: 14, cha: 8 }, cr: '1/4', habitat: 'Wald, Grasland, Hügel, Unterreich' });
    expect(tpl.stats.actions).toHaveLength(1); // leere Aktion verworfen
    expect(tpl.stats.reactions).toEqual([]);
    // ungültige Einzelwerte werden verworfen, der Eintrag bleibt gültig
    const odd = await dm.agent.put(`/api/bestiary/dm/${tpl.id}?storyId=${storyId}`).set(CSRF).send({ name: 'Goblin', hp: 7, stats: { ...stats, size: 'riesig', abilities: { str: 99 } } });
    expect(odd.body.template.stats).toMatchObject({ size: null, abilities: { str: null, dex: null } });
    // ohne stats: leerer Block
    expect((await dm.agent.post(`/api/bestiary/dm?storyId=${storyId}`).set(CSRF).send({ name: 'Ork', hp: 15 })).body.template.stats).toMatchObject({ size: null, traits: [] });
    // Spieler-Datenbank
    const e = (await frodo.agent.post(`/api/bestiary/stories/${storyId}`).set(CSRF).send({ name: 'Goblin', hp: '5-9', stats: { size: 'small', cr: '1/4' } })).body.entry;
    expect(e.stats).toMatchObject({ size: 'small', cr: '1/4' });
  });

  it('Spieler-LP als Zahl oder Bereich', async () => {
    const dm = await createUser('meister', 'dungeonmaster');
    const frodo = await createUser('frodo');
    const story = (await dm.agent.post('/api/stories').set(CSRF).send({ name: 'S', memberIds: [frodo.user.id] })).body.story;
    const post = (hp: unknown) => frodo.agent.post(`/api/bestiary/stories/${story.id}`).set(CSRF).send({ name: 'Oger', hp, damageDice: '2w8+4', damageType: 'bludgeoning' });
    expect((await post('10 - 15')).body.entry).toMatchObject({ hp: '10-15', damageDice: '2d8+4', damageType: 'bludgeoning' });
    expect((await post('10–15')).body.entry.hp).toBe('10-15');
    expect((await post('58')).body.entry.hp).toBe('58');
    expect((await post('')).body.entry.hp).toBeNull();
    expect((await post('15-10')).status).toBe(400);
    expect((await post('viele')).status).toBe(400);
    expect((await post(58)).status).toBe(400); // Text erwartet
  });

  it('Schaden im Kampf: aus Vorlage übernehmen, nur für den DM, änderbar', async () => {
    const dm = await createUser('meister', 'dungeonmaster');
    const frodo = await createUser('frodo');
    const story = (await dm.agent.post('/api/stories').set(CSRF).send({ name: 'S', memberIds: [frodo.user.id] })).body.story;
    const enc = (await dm.agent.post('/api/combat/encounters').set(CSRF).send({ storyId: story.id, name: 'K' })).body.encounter;
    const r = await dm.agent.post(`/api/combat/encounters/${enc.id}/monsters`).set(CSRF).send({ name: 'Oger', hpMax: 59, hideStats: false, damageDice: '2d8+4', damageType: 'bludgeoning', saveAsTemplate: true });
    const c = r.body.encounter.combatants[0];
    expect(c.damage).toEqual({ dice: '2d8+4', type: 'bludgeoning' });
    expect((await dm.agent.get(`/api/bestiary/dm?storyId=${story.id}`)).body.templates[0]).toMatchObject({ damageDice: '2d8+4', damageType: 'bludgeoning' });
    expect((await frodo.agent.get(`/api/combat/encounters/${enc.id}`)).body.encounter.combatants[0].damage).toBeNull();
    const upd = await dm.agent.patch(`/api/combat/combatants/${c.id}`).set(CSRF).send({ damageDice: '1d12', damageType: 'piercing' });
    expect(upd.body.encounter.combatants[0].damage).toEqual({ dice: '1d12', type: 'piercing' });
    const cleared = await dm.agent.patch(`/api/combat/combatants/${c.id}`).set(CSRF).send({ damageDice: null, damageType: null });
    expect(cleared.body.encounter.combatants[0].damage).toBeNull();
    expect((await dm.agent.post(`/api/combat/encounters/${enc.id}/monsters`).set(CSRF).send({ name: 'X', hpMax: 1, damageDice: '1d4' })).status).toBe(400);
  });
});
