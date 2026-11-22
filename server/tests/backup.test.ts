import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, resetDb } from './helpers';
import { prisma } from '../src/lib/prisma';

describe('Gesamt-Export / -Import', () => {
  beforeEach(async () => {
    await resetDb({ seed: true });
  });

  it('exportiert alle Tabellen und stellt sie per Import exakt wieder her; nur Admin', async () => {
    const frodo = await createUser('frodo');
    const admin = await loginAs('admin', 'admin-password');
    expect((await frodo.agent.get('/api/backup/export')).status).toBe(403);
    const char = await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Bilbo' });
    expect(char.status).toBe(201);
    const story = await prisma.story.create({ data: { name: 'Der Ring' } });
    const before = { users: await prisma.user.count(), spells: await prisma.spell.count(), char: await prisma.character.findUniqueOrThrow({ where: { id: char.body.character.id } }) };

    const exp = await admin.get('/api/backup/export');
    expect(exp.status).toBe(200);
    expect(exp.headers['content-disposition']).toContain('zauberbuch-gesamt-');
    const backup = exp.body;
    expect(backup).toMatchObject({ format: 'zauberbuch-backup', version: 1 });
    expect(backup.migration).toMatch(/^\d{14}_/);
    expect(backup.tables.User).toHaveLength(before.users);
    expect(backup.tables.Spell).toHaveLength(before.spells);
    expect(backup.tables._prisma_migrations).toBeUndefined();
    expect(typeof backup.tables.User[0].createdAt).toBe('number');

    // Daten verändern: Charakter löschen, Geschichte umbenennen, neue Geschichte
    await prisma.character.deleteMany();
    await prisma.story.update({ where: { id: story.id }, data: { name: 'Geändert' } });
    await prisma.story.create({ data: { name: 'Neu' } });

    expect((await admin.post('/api/backup/import').set(CSRF).send({ backup })).status).toBe(400); // ohne Bestätigung
    expect((await frodo.agent.post('/api/backup/import').set(CSRF).send({ backup, confirm: true })).status).toBe(403);
    const imp = await admin.post('/api/backup/import').set(CSRF).send({ backup, confirm: true });
    expect(imp.status).toBe(200);
    expect(imp.body.counts.User).toBe(before.users);
    expect(imp.body.safetyCopy).toMatch(/^vor-import-.*\.db$/);

    const after = await prisma.character.findUniqueOrThrow({ where: { id: char.body.character.id } });
    expect(after).toEqual(before.char);
    expect((await prisma.story.findMany()).map((s) => s.name)).toEqual(['Der Ring']);
    // Anmeldung funktioniert weiter (Passwort-Hashes übernommen)
    expect((await (await loginAs('frodo', 'password123')).get('/api/characters')).body.characters).toHaveLength(1);
  });

  it('lehnt ungültige Dateien und Sicherungen neuerer Versionen ab, ohne Daten zu verändern', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const spells = await prisma.spell.count();
    expect((await admin.post('/api/backup/import').set(CSRF).send({ backup: { format: 'x' }, confirm: true })).body.error.code).toBe('backup_invalid');
    const backup = (await admin.get('/api/backup/export')).body;
    const newer = { ...backup, migration: '99991231000000_zukunft' };
    expect((await admin.post('/api/backup/import').set(CSRF).send({ backup: newer, confirm: true })).body.error.code).toBe('backup_newer');
    // kaputte Verweise -> Transaktion wird zurückgerollt
    const broken = { ...backup, tables: { ...backup.tables, SpellTranslation: [...backup.tables.SpellTranslation, { ...backup.tables.SpellTranslation[0], id: 'kaputt', spellId: 'gibtsnicht', locale: 'xx' }] } };
    const res = await admin.post('/api/backup/import').set(CSRF).send({ backup: broken, confirm: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('backup_import_failed');
    expect(await prisma.spell.count()).toBe(spells);
    // ältere Sicherung ohne neue Spalte/Tabelle: Standardwerte greifen, unbekannte Tabellen werden ignoriert
    const older = { ...backup, tables: { ...backup.tables, MagicItem: [], Alt: [{ a: 1 }], Source: backup.tables.Source.map(({ abbreviation: _a, ...s }: Record<string, unknown>) => s) } };
    const ok = await admin.post('/api/backup/import').set(CSRF).send({ backup: older, confirm: true });
    expect(ok.status).toBe(200);
    expect(ok.body.ignored).toEqual(['Alt']);
    expect((await prisma.source.findFirstOrThrow()).abbreviation).toBe('');
  });
});
