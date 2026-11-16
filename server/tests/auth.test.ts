import { beforeEach, describe, expect, it } from 'vitest';
import { app, CSRF, createUser, loginAs, request, resetDb } from './helpers';

describe('Auth & Benutzerverwaltung', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('legt den Admin aus den ENV-Variablen an', async () => {
    const agent = await loginAs('admin', 'admin-password');
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ username: 'admin', role: 'admin' });
  });

  it('bietet keine Selbstregistrierung mehr an', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set(CSRF)
      .send({ username: 'frodo', email: 'frodo@example.com', password: 'ringbearer1' });
    expect(res.status).toBe(404);
  });

  it('lässt den Admin Benutzer anlegen und setzt beim Login ein httpOnly-Cookie', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const created = await admin
      .post('/api/users')
      .set(CSRF)
      .send({ username: 'frodo', email: 'Frodo@Shire.example', password: 'ringbearer1' });
    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({ username: 'frodo', email: 'frodo@shire.example', role: 'user' });
    expect(created.body.user.passwordHash).toBeUndefined();

    // E-Mail ist optional
    const noMail = await admin.post('/api/users').set(CSRF).send({ username: 'sam', email: '', password: 'potatoes123', role: 'dungeonmaster' });
    expect(noMail.status).toBe(201);
    expect(noMail.body.user).toMatchObject({ email: null, role: 'dungeonmaster' });

    const login = await request(app).post('/api/auth/login').set(CSRF).send({ identifier: 'frodo', password: 'ringbearer1' });
    expect(login.status).toBe(200);
    const cookie = String(login.headers['set-cookie']);
    expect(cookie).toMatch(/zb_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('lehnt doppelte Benutzernamen und ungültige Eingaben ab', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const body = { username: 'sam', email: 'sam@example.com', password: 'potatoes123' };
    expect((await admin.post('/api/users').set(CSRF).send(body)).status).toBe(201);
    const dup = await admin.post('/api/users').set(CSRF).send({ ...body, email: 'x@example.com' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('username_taken');
    const invalid = await admin.post('/api/users').set(CSRF).send({ username: 'x', email: 'nope', password: '123', role: 'king' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('validation_error');
  });

  it('erlaubt das Anlegen von Benutzern nur dem Admin', async () => {
    const { agent: dm } = await createUser('gandalf', 'dungeonmaster');
    const { agent: user } = await createUser('pippin');
    const body = { username: 'merry', password: 'brandybuck' };
    expect((await request(app).post('/api/users').set(CSRF).send(body)).status).toBe(401);
    expect((await user.post('/api/users').set(CSRF).send(body)).status).toBe(403);
    expect((await dm.post('/api/users').set(CSRF).send(body)).status).toBe(403);
    expect((await dm.get('/api/users')).status).toBe(403);
  });

  it('erlaubt Login per Benutzername oder E-Mail und lehnt falsche Passwörter ab', async () => {
    await createUser('merry', 'user', 'brandybuck');
    expect((await request(app).post('/api/auth/login').set(CSRF).send({ identifier: 'merry', password: 'brandybuck' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').set(CSRF).send({ identifier: 'MERRY@example.com', password: 'brandybuck' })).status).toBe(200);
    const wrong = await request(app).post('/api/auth/login').set(CSRF).send({ identifier: 'merry', password: 'wrong-pass' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('invalid_credentials');
  });

  it('verlangt den CSRF-Header bei schreibenden Anfragen', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: 'admin', password: 'admin-password' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('csrf_failed');
  });

  it('meldet ab und gibt danach keinen Benutzer mehr zurück', async () => {
    const agent = await loginAs('admin', 'admin-password');
    expect((await agent.post('/api/auth/logout').set(CSRF)).status).toBe(204);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
  });

  it('ändert das eigene Passwort und macht alte Tokens ungültig', async () => {
    const other = await loginAs('admin', 'admin-password');
    const agent = await loginAs('admin', 'admin-password');
    const wrong = await agent.post('/api/auth/password').set(CSRF).send({ currentPassword: 'nope', newPassword: 'new-password-1' });
    expect(wrong.status).toBe(400);
    const ok = await agent.post('/api/auth/password').set(CSRF).send({ currentPassword: 'admin-password', newPassword: 'new-password-1' });
    expect(ok.status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user?.username).toBe('admin');
    expect((await other.get('/api/auth/me')).body.user).toBeNull();
    await loginAs('admin', 'new-password-1');
  });

  it('lässt den Admin Passwörter zurücksetzen und Rollen ändern', async () => {
    const { agent: userAgent, user } = await createUser('gollum', 'user', 'precious1');
    const admin = await loginAs('admin', 'admin-password');
    const reset = await admin.patch(`/api/users/${user.id}`).set(CSRF).send({ password: 'precious-new' });
    expect(reset.status).toBe(200);
    expect((await userAgent.get('/api/auth/me')).body.user).toBeNull(); // alte Sitzung abgemeldet
    await loginAs('gollum', 'precious-new');

    const promote = await admin.patch(`/api/users/${user.id}`).set(CSRF).send({ role: 'dungeonmaster' });
    expect(promote.body.user.role).toBe('dungeonmaster');
    expect((await admin.patch(`/api/users/${user.id}`).set(CSRF).send({})).status).toBe(400);
    const users = await admin.get('/api/users');
    expect(users.body.users).toHaveLength(2);
  });

  it('schützt den letzten Admin', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const me = (await admin.get('/api/auth/me')).body.user;
    const demote = await admin.patch(`/api/users/${me.id}`).set(CSRF).send({ role: 'user' });
    expect(demote.status).toBe(400);
    expect(demote.body.error.code).toBe('last_admin');
  });

  it('speichert die Sprache pro Benutzer', async () => {
    const agent = await loginAs('admin', 'admin-password');
    const res = await agent.patch('/api/auth/me').set(CSRF).send({ language: 'en' });
    expect(res.status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user.language).toBe('en');
  });

  it('liefert Healthcheck und Konfiguration ohne Anmeldung', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    const cfg = await request(app).get('/api/config');
    expect(cfg.body).toEqual({ defaultLanguage: 'de', version: expect.any(String) });
  });
});
