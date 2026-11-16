import { beforeAll, describe, expect, it } from 'vitest';
import type { Agent } from 'supertest';
import { app, CSRF, createUser, loginAs, makeSpell, request, resetDb } from './helpers';

const names = (body: { items: { translations: { de?: { name: string }; en?: { name: string } } }[] }, lang: 'de' | 'en' = 'de') =>
  body.items.map((s) => s.translations[lang]?.name);

describe('Zauber – Suche & Filter', () => {
  let viewer: Agent;
  beforeAll(async () => {
    await resetDb({ seed: true });
    viewer = (await createUser('reader')).agent;
  });

  it('zeigt ohne Anmeldung keine Daten', async () => {
    expect((await request(app).get('/api/spells')).status).toBe(401);
    expect((await request(app).get('/api/spells/fireball')).status).toBe(401);
    expect((await request(app).get('/api/spells/sources')).status).toBe(401);
  });

  it('listet alle Beispielzauber, sortiert nach Name', async () => {
    const res = await viewer.get('/api/spells?lang=de');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(names(res.body)).toEqual(['Feuerball', 'Heilendes Wort', 'Licht', 'Magisches Geschoss', 'Schild']);
    // Listen enthalten keine langen Beschreibungen
    expect(res.body.items[0].translations.de.description).toBeUndefined();
  });

  it('sucht sprachübergreifend (Feuerball = Fireball)', async () => {
    const de = await viewer.get('/api/spells').query({ query: 'Feuerball' });
    const en = await viewer.get('/api/spells').query({ query: 'fireball' });
    expect(de.body.total).toBe(1);
    expect(en.body.total).toBe(1);
    expect(de.body.items[0].id).toBe(en.body.items[0].id);
    expect(de.body.items[0].slug).toBe('fireball');
  });

  it('durchsucht auch die Beschreibung', async () => {
    const res = await viewer.get('/api/spells').query({ query: 'Fledermausguano' });
    expect(res.body.total).toBe(0); // Materialkomponente ist nicht Teil der Suche
    const res2 = await viewer.get('/api/spells').query({ query: 'unsichtbare barriere' });
    expect(res2.body.items.map((s: { slug: string }) => s.slug)).toEqual(['shield']);
  });

  it('filtert nach Grad (Mehrfachauswahl), Klasse und Zauberzeit', async () => {
    const levels = await viewer.get('/api/spells?level=0,3');
    expect(levels.body.items.map((s: { slug: string }) => s.slug).sort()).toEqual(['fireball', 'light']);
    const cls = await viewer.get('/api/spells?class=cleric');
    expect(cls.body.items.map((s: { slug: string }) => s.slug).sort()).toEqual(['healing-word', 'light']);
    const reaction = await viewer.get('/api/spells?castingTime=reaction');
    expect(reaction.body.items.map((s: { slug: string }) => s.slug)).toEqual(['shield']);
    const school = await viewer.get('/api/spells?school=abjuration');
    expect(school.body.total).toBe(1);
    const noMaterial = await viewer.get('/api/spells?material=false&level=1');
    expect(noMaterial.body.total).toBe(3);
  });

  it('sortiert nach Grad absteigend und paginiert', async () => {
    const page1 = await viewer.get('/api/spells?sort=level&order=desc&pageSize=2&page=1');
    expect(page1.body.totalPages).toBe(3);
    expect(page1.body.items[0].slug).toBe('fireball');
    const page3 = await viewer.get('/api/spells?sort=level&order=desc&pageSize=2&page=3');
    expect(page3.body.items.map((s: { slug: string }) => s.slug)).toEqual(['light']);
  });

  it('liefert Details per slug und 404 für unbekannte Zauber', async () => {
    const res = await viewer.get('/api/spells/fireball');
    expect(res.status).toBe(200);
    expect(res.body.spell.translations.en.higherLevels).toContain('1d6');
    expect(res.body.spell.classes).toEqual(['sorcerer', 'wizard']);
    expect((await viewer.get('/api/spells/does-not-exist')).status).toBe(404);
  });

  it('liefert Schaden/Heilung und filtert nach Schadensart', async () => {
    const fb = await viewer.get('/api/spells/fireball');
    expect(fb.body.spell.damage).toEqual({ dice: '8d6', type: 'fire' });
    const shield = await viewer.get('/api/spells/shield');
    expect(shield.body.spell.damage).toBeNull();

    const fire = await viewer.get('/api/spells?damageType=fire,force');
    expect(fire.body.items.map((s: { slug: string }) => s.slug).sort()).toEqual(['fireball', 'magic-missile']);
    const heal = await viewer.get('/api/spells?damageType=healing');
    expect(heal.body.items.map((s: { slug: string }) => s.slug)).toEqual(['healing-word']);
    expect(heal.body.items[0].damage).toEqual({ dice: '1d4+mod', type: 'healing' });
  });

  it('weist ungültige Abfrageparameter ab', async () => {
    expect((await viewer.get('/api/spells?sort=evil')).status).toBe(400);
  });
});

describe('Zauber – Verwaltung', () => {
  let viewer: Agent;
  beforeAll(async () => {
    await resetDb({ seed: true });
    viewer = (await createUser('reader')).agent;
  });

  it('erlaubt nur Admin und Dungeon Master das Anlegen und validiert', async () => {
    expect((await request(app).post('/api/spells').set(CSRF).send(makeSpell())).status).toBe(401);
    const { agent: user } = await createUser('bilbo');
    expect((await user.post('/api/spells').set(CSRF).send(makeSpell())).status).toBe(403);

    const admin = await loginAs('admin', 'admin-password');
    const invalid = await admin.post('/api/spells').set(CSRF).send(makeSpell({ level: 12, slug: 'Bad Slug' }));
    expect(invalid.status).toBe(400);
    const created = await admin.post('/api/spells').set(CSRF).send(makeSpell());
    expect(created.status).toBe(201);
    expect(created.body.spell.isHomebrew).toBe(true);
    expect((await admin.post('/api/spells').set(CSRF).send(makeSpell())).status).toBe(409);

    const found = await viewer.get('/api/spells?homebrew=true');
    expect(found.body.items.map((s: { slug: string }) => s.slug)).toEqual(['test-spell']);
  });

  it('normalisiert und validiert Schadenswerte', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const ok = await admin
      .post('/api/spells')
      .set(CSRF)
      .send(makeSpell({ slug: 'dmg-ok', damageDice: ' 2W8 + 1d6 + Mod ', damageType: 'radiant' }));
    expect(ok.status).toBe(201);
    expect(ok.body.spell.damage).toEqual({ dice: '2d8+1d6+mod', type: 'radiant' });

    const bad = await admin.post('/api/spells').set(CSRF).send(makeSpell({ slug: 'dmg-bad', damageDice: 'viel', damageType: 'fire' }));
    expect(bad.status).toBe(400);
    expect(bad.body.error.details).toContainEqual({ path: 'damageDice', message: 'damage_dice_invalid' });

    const noType = await admin.post('/api/spells').set(CSRF).send(makeSpell({ slug: 'dmg-notype', damageDice: '1d6' }));
    expect(noType.status).toBe(400);
    expect(noType.body.error.details).toContainEqual({ path: 'damageType', message: 'damage_type_required' });

    // Leerer Würfelausdruck ohne Art = kein Schaden
    const none = await admin.post('/api/spells').set(CSRF).send(makeSpell({ slug: 'dmg-none', damageDice: '', damageType: null }));
    expect(none.status).toBe(201);
    expect(none.body.spell.damage).toBeNull();

    await admin.delete(`/api/spells/${ok.body.spell.id}`).set(CSRF);
    await admin.delete(`/api/spells/${none.body.spell.id}`).set(CSRF);
  });

  it('aktualisiert, dupliziert und löscht Zauber', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const { body } = await viewer.get('/api/spells/test-spell');
    const id = body.spell.id;
    const updated = await admin.put(`/api/spells/${id}`).set(CSRF).send(makeSpell({ level: 4, translations: { en: { name: 'Renamed', description: 'x' } } }));
    expect(updated.status).toBe(200);
    expect(updated.body.spell.level).toBe(4);
    expect(updated.body.spell.translations.de).toBeUndefined();

    const dup = await admin.post(`/api/spells/${id}/duplicate`).set(CSRF);
    expect(dup.status).toBe(201);
    expect(dup.body.spell.slug).toBe('test-spell-copy');

    expect((await admin.delete(`/api/spells/${dup.body.spell.id}`).set(CSRF)).status).toBe(204);
    expect((await viewer.get('/api/spells/test-spell-copy')).status).toBe(404);
  });

  it('lässt den Dungeon Master Zauber anlegen, bearbeiten, duplizieren und löschen', async () => {
    const { agent: dm } = await createUser('gandalf', 'dungeonmaster');
    const created = await dm.post('/api/spells').set(CSRF).send(makeSpell({ slug: 'dm-spell' }));
    expect(created.status).toBe(201);
    const id = created.body.spell.id;
    expect((await dm.put(`/api/spells/${id}`).set(CSRF).send(makeSpell({ slug: 'dm-spell', level: 5 }))).body.spell.level).toBe(5);
    const dup = await dm.post(`/api/spells/${id}/duplicate`).set(CSRF);
    expect(dup.status).toBe(201);
    expect((await dm.delete(`/api/spells/${dup.body.spell.id}`).set(CSRF)).status).toBe(204);
    expect((await dm.delete(`/api/spells/${id}`).set(CSRF)).status).toBe(204);
    // Import/Export bleibt dem Admin vorbehalten
    expect((await dm.get('/api/spells/export')).status).toBe(403);
    expect((await dm.post('/api/spells/import').set(CSRF).send({ spells: [makeSpell()] })).status).toBe(403);
  });

  it('importiert mit Vorschau und Dublettenprüfung und exportiert', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const spells = [makeSpell({ slug: 'fireball' }), makeSpell({ slug: 'brand-new' }), { slug: 'broken' }];
    const preview = await admin.post('/api/spells/import/preview').set(CSRF).send({ spells });
    expect(preview.status).toBe(200);
    expect(preview.body.summary).toEqual({ total: 3, new: 1, duplicate: 1, invalid: 1 });

    const skip = await admin.post('/api/spells/import').set(CSRF).send({ spells, mode: 'skip' });
    expect(skip.body).toEqual({ created: 1, updated: 0, skipped: 1, invalid: 1 });
    const fb = await viewer.get('/api/spells/fireball');
    expect(fb.body.spell.translations.de.name).toBe('Feuerball');

    const overwrite = await admin.post('/api/spells/import').set(CSRF).send({ spells, mode: 'overwrite' });
    expect(overwrite.body).toEqual({ created: 0, updated: 2, skipped: 0, invalid: 1 });

    const exp = await admin.get('/api/spells/export');
    expect(exp.status).toBe(200);
    expect(exp.body.format).toBe('zauberbuch-spells');
    expect(exp.body.spells.length).toBe(7);
    const fbExport = exp.body.spells.find((sp: { slug: string }) => sp.slug === 'fireball');
    expect(fbExport).toMatchObject({ damageDice: null, damageType: null }); // durch Import überschrieben
    const mm = exp.body.spells.find((sp: { slug: string }) => sp.slug === 'magic-missile');
    expect(mm).toMatchObject({ damageDice: '1d4+1', damageType: 'force' });
  });
});
