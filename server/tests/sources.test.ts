import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, resetDb } from './helpers';
import { seedCatalog } from '../src/routes/catalog';
import { seedWiki } from '../src/routes/wiki';
import { prisma } from '../src/lib/prisma';

describe('Quellen', () => {
  beforeEach(async () => {
    await resetDb();
    await seedCatalog();
    await seedWiki();
  });

  it('Grundausstattung, Rechte, Zuordnung in Wiki und Gegenständen, Umbenennen zieht Zauber mit', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const frodo = await createUser('frodo');
    const mod = await createUser('moderator', 'dungeonmaster');
    const list = (await frodo.agent.get('/api/sources')).body.sources;
    expect(list.map((s: { name: string }) => s.name)).toEqual(['Spielerhandbuch', 'Tashas Kessel der Schöpfung', 'Xanathars Ratgeber für alles']);
    const phb = list[0];
    // SRD-Grundausstattung gehört zum Spielerhandbuch
    expect(phb.usage.wiki).toBe(106); // 9 Völker, 12 Klassen, 1 Talent, 1 Hintergrund, 16 Sprachen, 67 Götter
    expect(phb.usage.catalog).toBeGreaterThan(80);
    expect((await frodo.agent.get('/api/wiki')).body.entries[0].sourceId).toBe(phb.id);

    expect((await frodo.agent.post('/api/sources').set(CSRF).send({ name: 'Monsterhandbuch' })).status).toBe(403);
    const mm = (await mod.agent.post('/api/sources').set(CSRF).send({ name: 'Monsterhandbuch', abbreviation: 'MHB' })).body.source;
    expect(mm).toMatchObject({ name: 'Monsterhandbuch', abbreviation: 'MHB' });
    expect((await mod.agent.post('/api/sources').set(CSRF).send({ name: 'Monsterhandbuch' })).status).toBe(409);

    // Wiki und Gegenstände: Quelle wählen, unbekannte ids werden verworfen
    const tce = list.find((s: { name: string }) => s.name.startsWith('Tashas')).id;
    const art = (await mod.agent.post('/api/wiki').set(CSRF).send({ kind: 'class', name: 'Artifizient', sourceId: tce })).body.entry;
    expect(art.sourceId).toBe(tce);
    expect((await mod.agent.post('/api/wiki').set(CSRF).send({ kind: 'race', name: 'X', sourceId: 'gibtsnicht' })).body.entry.sourceId).toBeNull();
    const item = (await mod.agent.post('/api/catalog/standard').set(CSRF).send({ category: 'gear', name: 'Taschenuhr', sourceId: tce })).body.item;
    expect(item.sourceId).toBe(tce);

    // Umbenennen: Zauber mit dem alten Namen werden mitgezogen
    await prisma.spell.updateMany({ data: { source: 'Tashas Kessel der Schöpfung' } });
    const spells = await prisma.spell.count();
    const ren = (await admin.put(`/api/sources/${tce}`).set(CSRF).send({ name: 'Tashas Kessel', abbreviation: 'TK' })).body.source;
    expect(ren.usage.spells).toBe(spells);
    expect(await prisma.spell.count({ where: { source: 'Tashas Kessel' } })).toBe(spells);

    // Löschen: Verknüpfungen entfallen, Einträge bleiben
    expect((await mod.agent.delete(`/api/sources/${tce}`).set(CSRF)).status).toBe(204);
    expect((await frodo.agent.get('/api/wiki')).body.entries.find((e: { name: string }) => e.name === 'Artifizient').sourceId).toBeNull();
  });
});
