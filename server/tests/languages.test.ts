import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, resetDb } from './helpers';
import { seedWiki } from '../src/routes/wiki';
import { prisma } from '../src/lib/prisma';

describe('Sprachen aus dem Wiki', () => {
  beforeEach(async () => {
    await resetDb();
    await seedWiki();
  });

  it('Wiki ist Standard; Geschichte startet damit und wird angepasst; Bogen sieht Geschichte bzw. Wiki', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const frodo = await createUser('frodo');
    const wiki = (await frodo.agent.get('/api/wiki')).body.entries.filter((e: { kind: string }) => e.kind === 'language');
    expect(wiki).toHaveLength(16);
    expect(wiki.find((e: { name: string }) => e.name === 'Tiefensprache')).toMatchObject({ data: { type: 'exotic', speakers: 'Abolethen, Mantler' } });

    // neue Sprache im Wiki -> neue Geschichten und Bögen ohne Geschichte sehen sie
    await admin.post('/api/wiki').set(CSRF).send({ kind: 'language', name: 'Druidisch', data: { type: 'exotic', speakers: 'Druiden' } });
    const story = (await admin.post('/api/stories').set(CSRF).send({ name: 'Strahd', memberIds: [frodo.user.id] })).body.story;
    expect(story.languages).toHaveLength(17);
    expect(story.languages).toContain('Druidisch');
    expect(story.languages).toContain('Goblinisch');

    const free = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Ohne' })).body.character;
    expect(free.languages).toContain('Druidisch');

    // Geschichte passt an: entfernen und eigene ergänzen
    const custom = ['Gemeinsprache', 'Elfisch', 'Barovianisch'];
    await admin.patch(`/api/stories/${story.id}`).set(CSRF).send({ languages: custom });
    const ch = (await frodo.agent.post('/api/characters').set(CSRF).send({ name: 'Vaelor' })).body.character;
    await frodo.agent.put(`/api/characters/${ch.id}/settings`).set(CSRF).send({ storyId: story.id, editorIds: [] });
    expect((await frodo.agent.get(`/api/characters/${ch.id}`)).body.character.languages).toEqual(custom);
    // ohne Geschichte: alle Wiki-Sprachen
    expect((await frodo.agent.get(`/api/characters/${free.id}`)).body.character.languages).toHaveLength(17);

    // ältere Geschichte ohne eigene Liste folgt live dem Wiki
    await prisma.story.update({ where: { id: story.id }, data: { languages: '' } });
    expect((await frodo.agent.get(`/api/characters/${ch.id}`)).body.character.languages).toHaveLength(17);
  });
});
