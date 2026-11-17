import { beforeEach, describe, expect, it } from 'vitest';
import { app, CSRF, createUser, loginAs, request, resetDb } from './helpers';
import { prisma } from '../src/lib/prisma';

describe('Benutzer – Export & Import (Admin)', () => {
  beforeEach(async () => {
    await resetDb({ seed: true });
  });

  async function exportWithUsers() {
    const { agent: frodo } = await createUser('frodo', 'user', 'ringbearer1');
    await createUser('gandalf', 'dungeonmaster', 'youshallnot');
    const fireball = (await frodo.get('/api/spells/fireball')).body.spell.id;
    await frodo.post('/api/favorites').set(CSRF).send({ spellId: fireball });
    await frodo.patch('/api/auth/me').set(CSRF).send({ language: 'en' });
    const admin = await loginAs('admin', 'admin-password');
    return (await admin.get('/api/users/export')).body;
  }

  it('ist nur für Admins verfügbar', async () => {
    const { agent: dm } = await createUser('gandalf', 'dungeonmaster');
    expect((await dm.get('/api/users/export')).status).toBe(403);
    expect((await dm.post('/api/users/import').set(CSRF).send({ users: [{}] })).status).toBe(403);
    expect((await request(app).get('/api/users/export')).status).toBe(401);
  });

  it('exportiert Benutzer mit Passwort-Hash, Rolle, Sprache und Zauberbuch', async () => {
    const file = await exportWithUsers();
    expect(file).toMatchObject({ format: 'zauberbuch-users', version: 1, includesPasswords: true });
    const frodo = file.users.find((u: { username: string }) => u.username === 'frodo');
    expect(frodo).toMatchObject({ role: 'user', language: 'en', favorites: ['fireball'], email: 'frodo@example.com' });
    expect(frodo.passwordHash).toMatch(/^\$2[aby]\$/);

    const admin = await loginAs('admin', 'admin-password');
    const noPw = (await admin.get('/api/users/export?passwords=false')).body;
    expect(noPw.includesPasswords).toBe(false);
    expect(noPw.users.every((u: { passwordHash?: string }) => u.passwordHash === undefined)).toBe(true);
  });

  it('stellt Benutzer nach Verlust der Datenbank wieder her (alte Passwörter, Zauberbuch)', async () => {
    const file = await exportWithUsers();
    await resetDb({ seed: true }); // Datenbank „verloren“, nur der ENV-Admin existiert wieder
    expect((await request(app).post('/api/auth/login').set(CSRF).send({ identifier: 'frodo', password: 'ringbearer1' })).status).toBe(401);

    const admin = await loginAs('admin', 'admin-password');
    const preview = await admin.post('/api/users/import/preview').set(CSRF).send({ users: file.users });
    expect(preview.body.summary).toMatchObject({ total: 3, new: 2, self: 1 });

    const res = await admin.post('/api/users/import').set(CSRF).send({ users: file.users });
    expect(res.body).toMatchObject({ created: 2, updated: 0, skipped: 1, invalid: 0, favoritesLinked: 1, favoritesMissing: 0 });

    const frodo = await loginAs('frodo', 'ringbearer1');
    const me = (await frodo.get('/api/auth/me')).body.user;
    expect(me).toMatchObject({ username: 'frodo', role: 'user', language: 'en' });
    expect((await frodo.get('/api/spells?favorites=true')).body.items.map((s: { slug: string }) => s.slug)).toEqual(['fireball']);
    const gandalf = await loginAs('gandalf', 'youshallnot');
    expect((await gandalf.get('/api/auth/me')).body.user.role).toBe('dungeonmaster');
  });

  it('überspringt oder aktualisiert vorhandene Benutzer und schützt das eigene Konto', async () => {
    const file = await exportWithUsers();
    const admin = await loginAs('admin', 'admin-password');
    const frodoEntry = file.users.find((u: { username: string }) => u.username === 'frodo');
    const adminEntry = { ...file.users.find((u: { username: string }) => u.username === 'admin'), role: 'user' };

    const skip = await admin.post('/api/users/import').set(CSRF).send({ users: [{ ...frodoEntry, role: 'admin' }, adminEntry] });
    expect(skip.body).toMatchObject({ created: 0, updated: 0, skipped: 2 });
    expect((await prisma.user.findUnique({ where: { username: 'frodo' } }))!.role).toBe('user');

    const upd = await admin.post('/api/users/import').set(CSRF).send({ users: [{ ...frodoEntry, role: 'dungeonmaster' }, adminEntry], mode: 'update' });
    expect(upd.body).toMatchObject({ updated: 1, skipped: 1 });
    expect((await prisma.user.findUnique({ where: { username: 'frodo' } }))!.role).toBe('dungeonmaster');
    // eigenes Admin-Konto unverändert
    expect((await admin.get('/api/auth/me')).body.user.role).toBe('admin');
  });

  it('verlangt ein Startpasswort für Einträge ohne Hash und erkennt ungültige Einträge', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const users = [
      { username: 'merry', email: 'merry@example.com', role: 'user', favorites: ['fireball', 'gibt-es-nicht'] },
      { username: 'x' },
      { username: 'pippin', passwordHash: 'kein-hash' },
      { username: 'merry' },
    ];
    const prev = await admin.post('/api/users/import/preview').set(CSRF).send({ users });
    expect(prev.body.items.map((i: { status: string }) => i.status)).toEqual(['no_password', 'invalid', 'invalid', 'invalid']);

    const res = await admin.post('/api/users/import').set(CSRF).send({ users, defaultPassword: 'startpasswort1' });
    expect(res.body).toMatchObject({ created: 1, invalid: 3, favoritesLinked: 1, favoritesMissing: 1 });
    await loginAs('merry', 'startpasswort1');
  });
});
