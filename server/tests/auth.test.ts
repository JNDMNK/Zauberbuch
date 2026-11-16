import { beforeEach, describe, expect, it } from 'vitest';
import { app, CSRF, loginAs, request, resetDb } from './helpers';
import { config } from '../src/config';

describe('Auth', () => {
  beforeEach(async () => {
    await resetDb();
    config.allowRegistration = true;
  });

  it('legt den Admin aus den ENV-Variablen an', async () => {
    const agent = await loginAs('admin', 'admin-password');
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ username: 'admin', role: 'admin' });
  });

  it('registriert einen Benutzer und setzt ein httpOnly-Cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set(CSRF)
      .send({ username: 'frodo', email: 'Frodo@Shire.example', password: 'ringbearer1' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: 'frodo', email: 'frodo@shire.example', role: 'user' });
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/zb_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('lehnt doppelte Benutzernamen und ungültige Eingaben ab', async () => {
    const body = { username: 'sam', email: 'sam@example.com', password: 'potatoes123' };
    expect((await request(app).post('/api/auth/register').set(CSRF).send(body)).status).toBe(201);
    const dup = await request(app).post('/api/auth/register').set(CSRF).send({ ...body, email: 'x@example.com' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('username_taken');
    const invalid = await request(app)
      .post('/api/auth/register')
      .set(CSRF)
      .send({ username: 'x', email: 'nope', password: '123' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('validation_error');
  });

  it('erlaubt Login per Benutzername oder E-Mail und lehnt falsche Passwörter ab', async () => {
    await request(app)
      .post('/api/auth/register')
      .set(CSRF)
      .send({ username: 'merry', email: 'merry@example.com', password: 'brandybuck' });
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

  it('ändert das Passwort und macht alte Tokens ungültig', async () => {
    const other = await loginAs('admin', 'admin-password');
    const agent = await loginAs('admin', 'admin-password');
    const wrong = await agent.post('/api/auth/password').set(CSRF).send({ currentPassword: 'nope', newPassword: 'new-password-1' });
    expect(wrong.status).toBe(400);
    const ok = await agent
      .post('/api/auth/password')
      .set(CSRF)
      .send({ currentPassword: 'admin-password', newPassword: 'new-password-1' });
    expect(ok.status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user?.username).toBe('admin');
    expect((await other.get('/api/auth/me')).body.user).toBeNull();
    await loginAs('admin', 'new-password-1');
  });

  it('speichert die Sprache pro Benutzer', async () => {
    const agent = await loginAs('admin', 'admin-password');
    const res = await agent.patch('/api/auth/me').set(CSRF).send({ language: 'en' });
    expect(res.status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user.language).toBe('en');
  });

  it('respektiert ALLOW_REGISTRATION=false', async () => {
    config.allowRegistration = false;
    const res = await request(app)
      .post('/api/auth/register')
      .set(CSRF)
      .send({ username: 'pippin', email: 'pippin@example.com', password: 'secondbreakfast' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('registration_disabled');
  });

  it('schützt Admin-Endpunkte', async () => {
    expect((await request(app).get('/api/users')).status).toBe(401);
    const res = await request(app)
      .post('/api/auth/register')
      .set(CSRF)
      .send({ username: 'gollum', email: 'gollum@example.com', password: 'precious1' });
    const userAgent = request.agent(app);
    await userAgent.post('/api/auth/login').set(CSRF).send({ identifier: 'gollum', password: 'precious1' });
    expect((await userAgent.get('/api/users')).status).toBe(403);
    const admin = await loginAs('admin', 'admin-password');
    const users = await admin.get('/api/users');
    expect(users.status).toBe(200);
    expect(users.body.users).toHaveLength(2);
    const promote = await admin.patch(`/api/users/${res.body.user.id}`).set(CSRF).send({ role: 'admin' });
    expect(promote.body.user.role).toBe('admin');
  });

  it('liefert den Healthcheck', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
