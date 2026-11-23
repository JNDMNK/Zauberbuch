import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, makeSpell, resetDb } from './helpers';
import { prisma } from '../src/lib/prisma';

describe('Quellen einer Geschichte', () => {
  beforeEach(async () => {
    await resetDb({ seed: true });
  });

  it('DM bearbeitet die Einstellungen seiner Geschichte, aber nicht Name/Mitglieder', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('gandalf');
    const frodo = await createUser('frodo');
    const other = await createUser('saruman');
    const s = (await admin.post('/api/stories').set(CSRF).send({ name: 'Ringkrieg', members: [{ userId: dm.user.id, role: 'dm' }, { userId: frodo.user.id, role: 'player' }] })).body.story;
    expect(s.sources).toBeNull();
    await admin.post('/api/stories').set(CSRF).send({ name: 'Andere' });

    expect((await other.agent.get('/api/stories')).status).toBe(403);
    expect((await frodo.agent.get('/api/stories')).status).toBe(403);
    const list = (await dm.agent.get('/api/stories')).body.stories;
    expect(list.map((x: { name: string }) => x.name)).toEqual(['Ringkrieg']);

    expect((await frodo.agent.patch(`/api/stories/${s.id}`).set(CSRF).send({ sources: ['src_phb'] })).status).toBe(403);
    const r = await dm.agent.patch(`/api/stories/${s.id}`).set(CSRF).send({ name: 'Umbenannt', members: [], sources: ['src_phb', 'homebrew'], languages: ['Gemeinsprache', 'Elfisch'] });
    expect(r.status).toBe(200);
    expect(r.body.story).toMatchObject({ name: 'Ringkrieg', sources: ['src_phb', 'homebrew'], languages: ['Gemeinsprache', 'Elfisch'] });
    expect(r.body.story.members).toHaveLength(2);
    // Spieler sehen die Quellen ihrer Geschichte (Geschichten-Ansicht)
    const mine = (await frodo.agent.get('/api/stories/mine')).body.stories;
    expect(mine[0]).toMatchObject({ name: 'Ringkrieg', role: 'player', sources: ['src_phb', 'homebrew'], languages: ['Gemeinsprache', 'Elfisch'] });
    // zurück auf „alle Quellen“
    expect((await admin.patch(`/api/stories/${s.id}`).set(CSRF).send({ sources: null })).body.story.sources).toBeNull();
  });

  it('Zauberliste und Namen filtern nach den Quellen der Geschichte', async () => {
    const admin = await loginAs('admin', 'admin-password');
    expect((await admin.post('/api/spells').set(CSRF).send(makeSpell({ slug: 'xge-zauber', source: 'Xanathars Ratgeber für alles', isHomebrew: false }))).status).toBe(201);
    expect((await admin.post('/api/spells').set(CSRF).send(makeSpell({ slug: 'eigener-zauber', source: 'Homebrew', isHomebrew: true }))).status).toBe(201);
    const phb = await prisma.spell.count({ where: { source: 'Spielerhandbuch' } });
    expect(phb).toBeGreaterThan(0);
    const s = (await admin.post('/api/stories').set(CSRF).send({ name: 'Nur SHB', sources: ['src_phb'] })).body.story;
    const slugs = async (q: string) => (await admin.get(`/api/spells?pageSize=100${q}`)).body.items.map((x: { slug: string }) => x.slug);
    expect((await slugs('')).length).toBe(phb + 2);
    expect(await slugs(`&story=${s.id}`)).toHaveLength(phb);
    await admin.patch(`/api/stories/${s.id}`).set(CSRF).send({ sources: ['src_phb', 'homebrew'] });
    expect(await slugs(`&story=${s.id}`)).toContain('eigener-zauber');
    expect(await slugs(`&story=${s.id}`)).not.toContain('xge-zauber');
    await admin.patch(`/api/stories/${s.id}`).set(CSRF).send({ sources: ['src_xge'] });
    expect(await slugs(`&story=${s.id}`)).toEqual(['xge-zauber']);
    const names = (await admin.get(`/api/spells/names?story=${s.id}`)).body.spells.map((x: { slug: string }) => x.slug);
    expect(names).toEqual(['xge-zauber']);
  });

  it('Charakter direkt in einer Geschichte anlegen; Bogen kennt Quellen und Listen der Geschichte', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const frodo = await createUser('frodo');
    const s = (await admin.post('/api/stories').set(CSRF).send({ name: 'Auenland', sources: ['src_phb'], languages: ['Gemeinsprache', 'Halblingisch'], members: [{ userId: frodo.user.id, role: 'player' }] })).body.story;
    const fremd = (await admin.post('/api/stories').set(CSRF).send({ name: 'Mordor' })).body.story;
    const res = await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Frodo', storyId: s.id });
    expect(res.status).toBe(201);
    expect(res.body.character).toMatchObject({ story: { id: s.id, name: 'Auenland' }, sources: ['src_phb'], languages: ['Gemeinsprache', 'Halblingisch'] });
    expect((await frodo.agent.get(`/api/characters/${res.body.character.id}`)).body.character.sources).toEqual(['src_phb']);
    expect((await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'X', storyId: fremd.id })).status).toBe(400);
    expect((await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Ohne' })).body.character.sources).toBeNull();
  });
});

describe('Meilenstein-Aufstieg', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('DM der Geschichte gibt frei, Spieler wird benachrichtigt, Freigabe verfällt nach dem Aufstieg', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('gandalf');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const s = (await admin.post('/api/stories').set(CSRF).send({ name: 'Ringkrieg', members: [{ userId: dm.user.id, role: 'dm' }, { userId: frodo.user.id, role: 'player' }, { userId: sam.user.id, role: 'player' }] })).body.story;
    const c = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Frodo', storyId: s.id })).body.character;
    expect(c).toMatchObject({ isStoryDm: false, milestoneLevel: null });
    expect((await frodo.agent.put(`/api/characters/${c.id}/milestone`).set(CSRF).send({ level: 2 })).status).toBe(403);
    expect((await sam.agent.put(`/api/characters/${c.id}/milestone`).set(CSRF).send({ level: 2 })).status).toBe(404);
    expect((await dm.agent.get(`/api/characters/${c.id}`)).body.character.isStoryDm).toBe(true);
    expect((await dm.agent.put(`/api/characters/${c.id}/milestone`).set(CSRF).send({ level: 1 })).status).toBe(400);
    const r = await dm.agent.put(`/api/characters/${c.id}/milestone`).set(CSRF).send({ level: 2 });
    expect(r.status).toBe(200);
    expect(r.body.character.milestoneLevel).toBe(2);
    const notes = (await frodo.agent.get('/api/notifications')).body.notifications;
    expect(notes[0]).toMatchObject({ type: 'milestone_granted', data: { dm: 'gandalf', level: '2' } });
    // Spieler steigt auf → Freigabe weg
    const sheet = (await frodo.agent.get(`/api/characters/${c.id}`)).body.character.data;
    const saved = await frodo.agent.put(`/api/characters/${c.id}`).set(CSRF).send({ data: { ...sheet, identity: { ...sheet.identity, level: 2 } } });
    expect(saved.body.character.milestoneLevel).toBeNull();
    // zurücknehmen
    await dm.agent.put(`/api/characters/${c.id}/milestone`).set(CSRF).send({ level: 3 });
    expect((await dm.agent.put(`/api/characters/${c.id}/milestone`).set(CSRF).send({ level: null })).body.character.milestoneLevel).toBeNull();
  });
});

describe('Homebrew folgt der Quelle', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('isHomebrew wird aus der Quelle abgeleitet (kein widersprüchliches Häkchen)', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const a = await admin.post('/api/spells').set(CSRF).send(makeSpell({ slug: 'buch', source: 'Spielerhandbuch', isHomebrew: true }));
    expect(a.body.spell.isHomebrew).toBe(false);
    const b = await admin.post('/api/spells').set(CSRF).send(makeSpell({ slug: 'eigen', source: 'Homebrew', isHomebrew: false }));
    expect(b.body.spell.isHomebrew).toBe(true);
    const list = (await admin.get('/api/spells?homebrew=true')).body.items.map((x: { slug: string }) => x.slug);
    expect(list).toEqual(['eigen']);
  });
});

describe('Zauber eigener Wiki-Klassen', () => {
  beforeEach(async () => {
    await resetDb({ seed: true });
  });

  it('wikiClasses speichern und mit Klassenlisten kombiniert filtern', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const res = await admin.post('/api/spells').set(CSRF).send(makeSpell({ slug: 'runenblitz', classes: [], wikiClasses: ['klasse_runen', 'klasse_runen'] }));
    expect(res.status).toBe(201);
    expect(res.body.spell.wikiClasses).toEqual(['klasse_runen']);
    const slugs = async (q: string) => (await admin.get(`/api/spells?pageSize=100&${q}`)).body.items.map((x: { slug: string }) => x.slug).sort();
    expect(await slugs('wikiClass=klasse_runen')).toEqual(['runenblitz']);
    const wizard = await slugs('class=wizard');
    expect(wizard).not.toContain('runenblitz');
    // Liste „Magier“ ODER direkt zugeordnet
    expect(await slugs('class=wizard&wikiClass=klasse_runen')).toEqual([...wizard, 'runenblitz'].sort());
    expect(await slugs('wikiClass=andere')).toEqual([]);
    // Export enthält die Zuordnung
    const exp = (await admin.get('/api/spells/export')).body.spells.find((x: { slug: string }) => x.slug === 'runenblitz');
    expect(exp.wikiClasses).toEqual(['klasse_runen']);
  });
});
