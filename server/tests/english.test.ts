import { beforeEach, describe, expect, it } from 'vitest';
import { localized, parseLifestyles } from '@zauberbuch/shared';
import { CSRF, createUser, loginAs, resetDb } from './helpers';
import { prisma } from '../src/lib/prisma';
import { backfillEnglish } from '../src/lib/englishSeed';

describe('Englische Inhalte', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('Hilfsfunktionen', () => {
    expect(localized('Zwerg', 'Dwarf', 'en')).toBe('Dwarf');
    expect(localized('Zwerg', 'Dwarf', 'de')).toBe('Zwerg');
    expect(localized('Zwerg', '  ', 'en')).toBe('Zwerg');
    // gespeicherte Tabellen ohne englische Namen erhalten die der Standardwerte
    expect(parseLifestyles(JSON.stringify([{ name: 'einfach', cost: '1 GM' }, { name: 'Eigener', cost: '3 GM' }]))).toEqual([
      { name: 'einfach', cost: '1 GM', nameEn: 'Modest' },
      { name: 'Eigener', cost: '3 GM', nameEn: undefined },
    ]);
  });

  it('EN-Felder speichern und Grundausstattung nachtragen, ohne Eigenes zu überschreiben', async () => {
    const mod = await createUser('moderator', 'dungeonmaster');
    const admin = await loginAs('admin', 'admin-password');

    // Wiki: EN-Felder werden gespeichert und geliefert
    const w = (await mod.agent.post('/api/wiki').set(CSRF).send({ kind: 'race', name: 'Zwerg', summary: 'Robust.', nameEn: '', data: {} })).body.entry;
    const own = (await mod.agent.post('/api/wiki').set(CSRF).send({ kind: 'race', name: 'Elf', summary: 'Anmutig.', nameEn: 'High Elf (eigene)', summaryEn: 'Mine', data: {} })).body.entry;
    expect(own).toMatchObject({ nameEn: 'High Elf (eigene)', summaryEn: 'Mine', descriptionEn: '' });
    // Gegenstand, magischer Gegenstand, Quelle
    const item = (await mod.agent.post('/api/catalog/standard').set(CSRF).send({ category: 'weapon', name: 'Dolch', nameEn: '' })).body.item;
    const custom = (await mod.agent.post('/api/catalog/standard').set(CSRF).send({ category: 'gear', name: 'Sternenstaub', nameEn: 'Stardust', descriptionEn: 'Sparkles.' })).body.item;
    expect(custom).toMatchObject({ nameEn: 'Stardust', descriptionEn: 'Sparkles.' });
    const magic = (await admin.post('/api/items').set(CSRF).send({ name: 'Ring der Unsichtbarkeit', nameEn: 'Ring of Invisibility', descriptionEn: 'You turn invisible.' })).body.item;
    expect(magic).toMatchObject({ nameEn: 'Ring of Invisibility', descriptionEn: 'You turn invisible.' });
    const src = (await mod.agent.post('/api/sources').set(CSRF).send({ name: 'Monsterhandbuch', abbreviation: 'MHB', nameEn: 'Monster Manual', abbreviationEn: 'MM' })).body.source;
    expect(src).toMatchObject({ nameEn: 'Monster Manual', abbreviationEn: 'MM' });

    // Nachtragen: nur Leeres mit bekanntem deutschen Namen
    await backfillEnglish();
    const zwerg = await prisma.wikiEntry.findUniqueOrThrow({ where: { id: w.id } });
    expect([zwerg.nameEn, zwerg.summaryEn]).toEqual(['Dwarf', 'Bold, hardy and steeped in tradition – masters of stone and forge.']);
    expect((await prisma.wikiEntry.findUniqueOrThrow({ where: { id: own.id } })).nameEn).toBe('High Elf (eigene)');
    expect((await prisma.catalogItem.findUniqueOrThrow({ where: { id: item.id } })).nameEn).toBe('Dagger');
    expect((await prisma.catalogItem.findUniqueOrThrow({ where: { id: custom.id } })).nameEn).toBe('Stardust');
    const phb = await prisma.source.findFirstOrThrow({ where: { name: 'Spielerhandbuch' } });
    expect([phb.nameEn, phb.abbreviationEn]).toEqual(['Player’s Handbook', 'PHB']);
    // zweiter Lauf ändert nichts mehr
    expect(await backfillEnglish()).toBe(0);
  });
});
