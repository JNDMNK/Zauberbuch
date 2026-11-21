import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, resetDb } from './helpers';
import { backfillBackgroundFields, backfillSubclassSources, seedWiki } from '../src/routes/wiki';
import { prisma } from '../src/lib/prisma';

describe('Wiki', () => {
  beforeEach(async () => {
    await resetDb();
    await seedWiki();
  });

  it('SRD-Grundausstattung für alle lesbar; nur Admin/Moderator bearbeiten', async () => {
    const frodo = await createUser('frodo');
    const mod = await createUser('moderator', 'dungeonmaster');
    const list = (await frodo.agent.get('/api/wiki')).body.entries;
    expect(list.filter((e: { kind: string }) => e.kind === 'race')).toHaveLength(9);
    expect(list.filter((e: { kind: string }) => e.kind === 'class')).toHaveLength(12);
    expect(list.find((e: { kind: string }) => e.kind === 'feat')).toMatchObject({ name: 'Ringer', data: { prerequisite: 'Stärke 13 oder höher', repeatable: false } });
    const bg = list.find((e: { kind: string }) => e.kind === 'background');
    expect(bg).toMatchObject({ name: 'Tempeldiener', data: { skills: 'Motiv erkennen, Religion', feature: { name: 'Zuflucht der Gläubigen' } } });
    expect([bg.data.personalityTraits.length, bg.data.ideals.length, bg.data.bonds.length, bg.data.flaws.length]).toEqual([8, 6, 6, 6]);
    expect(bg.data).toMatchObject({ abilityScores: ['int', 'wis', 'cha'], feat: 'Eingeweihter der Magie (Kleriker)' });
    // ältere Installation: Felder fehlen -> werden beim Start nachgetragen (nur unverändert)
    const rawBg = JSON.parse((await prisma.wikiEntry.findUniqueOrThrow({ where: { id: bg.id } })).data);
    delete rawBg.abilityScores;
    delete rawBg.feat;
    await prisma.wikiEntry.update({ where: { id: bg.id }, data: { data: JSON.stringify(rawBg) } });
    expect(await backfillBackgroundFields()).toBe(1);
    expect(await backfillBackgroundFields()).toBe(0);
    const zwerg = list.find((e: { name: string }) => e.name === 'Zwerg');
    expect(zwerg.data).toMatchObject({ abilityIncrease: 'Konstitution +2', speed: expect.stringContaining('7,5 m') });
    expect(zwerg.data.subraces[0]).toMatchObject({ name: 'Hügelzwerg', abilityIncrease: 'Weisheit +1' });
    const magier = list.find((e: { name: string }) => e.name === 'Magier');
    expect(magier.data).toMatchObject({ hitDie: 'd6', saves: 'Intelligenz, Weisheit', subclassTitle: 'Arkane Tradition' });
    expect(magier.data.features[0].level).toBe(1);

    expect((await frodo.agent.post('/api/wiki').set(CSRF).send({ kind: 'race', name: 'Goliath' })).status).toBe(403);
    expect((await frodo.agent.put(`/api/wiki/${zwerg.id}`).set(CSRF).send({ kind: 'race', name: 'X' })).status).toBe(403);
    const created = await mod.agent
      .post('/api/wiki')
      .set(CSRF)
      .send({ kind: 'class', name: 'Artifizient', summary: 'Erfinder', data: { hitDie: 'd8', features: [{ level: 2, name: 'Infusionen' }, { level: 1, name: 'Magisches Tüfteln' }, { name: '' }] } });
    expect(created.status).toBe(201);
    expect(created.body.entry).toMatchObject({ kind: 'class', name: 'Artifizient', updatedBy: 'moderator' });
    expect(created.body.entry.data.features.map((f: { name: string }) => f.name)).toEqual(['Magisches Tüfteln', 'Infusionen']);
    expect((await mod.agent.post('/api/wiki').set(CSRF).send({ kind: 'monster', name: 'X' })).status).toBe(400);
    const upd = await mod.agent.put(`/api/wiki/${zwerg.id}`).set(CSRF).send({ kind: 'race', name: 'Zwerg', data: { ...zwerg.data, speed: '7,5 m' } });
    expect(upd.body.entry.data.speed).toBe('7,5 m');
    expect((await mod.agent.delete(`/api/wiki/${created.body.entry.id}`).set(CSRF)).status).toBe(204);
    // kein erneutes Befüllen, wenn schon Einträge da sind
    expect(await seedWiki()).toBe(0);
    // neue Rubriken (z. B. nach einem Update) werden einzeln nachgetragen, ohne die anderen anzutasten
    const featNew = await mod.agent.post('/api/wiki').set(CSRF).send({ kind: 'feat', name: 'Kriegszauberer', data: { prerequisite: 'Fähigkeit, Zauber zu wirken', benefits: '- Vorteil auf Konzentration', repeatable: true } });
    expect(featNew.body.entry.data).toMatchObject({ prerequisite: 'Fähigkeit, Zauber zu wirken', repeatable: true });
    await prisma.wikiEntry.deleteMany({ where: { kind: 'background' } });
    expect(await seedWiki()).toBe(1);
    expect((await frodo.agent.get('/api/wiki')).body.entries.filter((e: { kind: string }) => e.kind === 'feat')).toHaveLength(2);
    const bg2 = await mod.agent.post('/api/wiki').set(CSRF).send({ kind: 'background', name: 'Soldat', data: { abilityScores: ['str', 'dex', 'con', 'str', 'xyz'], feat: 'Wilder Angreifer', skills: 'Athletik, Einschüchtern', personalityTraits: ['Ich bin höflich', '', 'Ich prahle'] } });
    expect(bg2.body.entry.data).toMatchObject({ abilityScores: ['str', 'dex', 'con'], feat: 'Wilder Angreifer' }); // doppelte/ungültige Werte entfallen
    expect(bg2.body.entry.data.personalityTraits).toEqual(['Ich bin höflich', 'Ich prahle']);

    // Unterklassen: eigene Quelle (SRD-Unterklassen gehören zum Spielerhandbuch)
    expect(magier.data.subclasses[0]).toMatchObject({ name: 'Schule der Hervorrufung', sourceId: 'src_phb' });
    const withSub = await mod.agent
      .put(`/api/wiki/${magier.id}`)
      .set(CSRF)
      .send({ kind: 'class', name: 'Magier', sourceId: 'src_phb', data: { ...magier.data, subclasses: [...magier.data.subclasses, { name: 'Klingengesang', sourceId: 'src_tce', features: [] }, { name: 'Ohne', sourceId: 'kaputt' }] } });
    expect(withSub.body.entry.data.subclasses.map((s: { name: string; sourceId: string | null }) => `${s.name}:${s.sourceId}`)).toEqual(['Schule der Hervorrufung:src_phb', 'Klingengesang:src_tce', 'Ohne:null']);

    // Nachtragen für ältere, unveränderte SRD-Klassen
    const barbar = list.find((e: { name: string }) => e.name === 'Barbar');
    const raw = JSON.parse((await prisma.wikiEntry.findUniqueOrThrow({ where: { id: barbar.id } })).data);
    raw.subclasses = raw.subclasses.map((s: object) => ({ ...s, sourceId: null }));
    await prisma.wikiEntry.update({ where: { id: barbar.id }, data: { data: JSON.stringify(raw) } });
    expect(await backfillSubclassSources()).toBe(1);
    expect((await frodo.agent.get('/api/wiki')).body.entries.find((e: { name: string }) => e.name === 'Barbar').data.subclasses[0].sourceId).toBe('src_phb');
    expect(await backfillSubclassSources()).toBe(0);
  });
});
