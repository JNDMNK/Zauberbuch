import { beforeEach, describe, expect, it } from 'vitest';
import { CSRF, createUser, loginAs, prisma, resetDb } from './helpers';
import { purgeDeletedBoardPosts } from '../src/routes/board';

describe('Infotafel', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup() {
    const admin = await loginAs('admin', 'admin-password');
    const dm = await createUser('meister', 'dungeonmaster');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const pippin = await createUser('pippin');
    const story = await dm.agent.post('/api/stories').set(CSRF).send({ name: 'Der Ring', memberIds: [frodo.user.id, sam.user.id] });
    expect(story.status).toBe(201);
    return { admin, dm, frodo, sam, pippin, storyId: story.body.story.id as string };
  }

  it('Geschichten verwalten nur Admin und DM; Benutzer sehen nur ihre Geschichten', async () => {
    const { frodo, pippin, storyId, admin } = await setup();
    expect((await frodo.agent.post('/api/stories').set(CSRF).send({ name: 'Eigene' })).status).toBe(403);
    expect((await frodo.agent.patch(`/api/stories/${storyId}`).set(CSRF).send({ name: 'X' })).status).toBe(403);
    expect((await frodo.agent.get('/api/stories/users')).status).toBe(403);

    const fl = await frodo.agent.get('/api/board/stories');
    expect(fl.body.stories.map((s: { name: string }) => s.name)).toEqual(['Der Ring']);
    expect(fl.body.stories[0].members.map((m: { username: string }) => m.username)).toEqual(['frodo', 'meister', 'sam']);
    expect((await pippin.agent.get('/api/board/stories')).body.stories).toEqual([]);
    expect((await pippin.agent.get(`/api/board/stories/${storyId}/posts`)).status).toBe(404);
    expect((await pippin.agent.post(`/api/board/stories/${storyId}/posts`).set(CSRF).send({ body: 'Hallo' })).status).toBe(404);

    // Löschen der Geschichte nur durch Admin
    expect((await (await loginAs('meister', 'password123')).delete(`/api/stories/${storyId}`).set(CSRF)).status).toBe(403);
    expect((await admin.delete(`/api/stories/${storyId}`).set(CSRF)).status).toBe(204);
  });

  it('setzt Ersteller und Zeitstempel serverseitig; nur Ersteller, DM und Admin dürfen ändern/löschen', async () => {
    const { frodo, sam, dm, storyId } = await setup();
    const before = Date.now();
    const created = await frodo.agent
      .post(`/api/board/stories/${storyId}/posts`)
      .set(CSRF)
      .send({ title: 'Händler', body: 'Borin kauft **magische** Gegenstände.', category: 'npcs', authorId: sam.user.id, createdAt: '2000-01-01' });
    expect(created.status).toBe(201);
    const post = created.body.post;
    expect(post.author.username).toBe('frodo');
    expect(new Date(post.createdAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(post).toMatchObject({ category: 'npcs', canEdit: true, editedAt: null, pinned: false });

    const samView = await sam.agent.get(`/api/board/stories/${storyId}/posts`);
    expect(samView.body.posts[0].canEdit).toBe(false);
    expect((await sam.agent.patch(`/api/board/posts/${post.id}`).set(CSRF).send({ body: 'Gehackt' })).status).toBe(403);
    expect((await sam.agent.delete(`/api/board/posts/${post.id}`).set(CSRF)).status).toBe(403);

    const edited = await frodo.agent.patch(`/api/board/posts/${post.id}`).set(CSRF).send({ title: 'Händler Borin', body: 'Neu', category: 'npcs' });
    expect(edited.body.post).toMatchObject({ title: 'Händler Borin', body: 'Neu' });
    expect(edited.body.post.editedAt).not.toBeNull();
    expect(edited.body.post.editedBy.username).toBe('frodo');

    const dmEdit = await dm.agent.patch(`/api/board/posts/${post.id}`).set(CSRF).send({ body: 'Vom DM korrigiert' });
    expect(dmEdit.status).toBe(200);
    expect(dmEdit.body.post.editedBy.username).toBe('meister');
    expect(dmEdit.body.post.author.username).toBe('frodo');
    expect((await dm.agent.delete(`/api/board/posts/${post.id}`).set(CSRF)).status).toBe(204);
    expect((await frodo.agent.get(`/api/board/stories/${storyId}/posts`)).body.total).toBe(0);
  });

  it('Anheften nur durch DM/Admin; angeheftete Beiträge stehen oben', async () => {
    const { frodo, dm, storyId } = await setup();
    const a = (await frodo.agent.post(`/api/board/stories/${storyId}/posts`).set(CSRF).send({ body: 'Erster' })).body.post;
    await frodo.agent.post(`/api/board/stories/${storyId}/posts`).set(CSRF).send({ body: 'Zweiter' });
    expect((await frodo.agent.post(`/api/board/posts/${a.id}/pin`).set(CSRF).send({ pinned: true })).status).toBe(403);
    expect((await dm.agent.post(`/api/board/posts/${a.id}/pin`).set(CSRF).send({ pinned: true })).body.post.pinned).toBe(true);
    const list = await frodo.agent.get(`/api/board/stories/${storyId}/posts`);
    expect(list.body.posts.map((p: { body: string }) => p.body)).toEqual(['Erster', 'Zweiter']);
  });

  it('Kategorien-Filter und Suche (inkl. Umlaute und Kommentare)', async () => {
    const { frodo, sam, storyId } = await setup();
    await frodo.agent.post(`/api/board/stories/${storyId}/posts`).set(CSRF).send({ title: 'Übergang am Fluss', body: 'Fähre', category: 'places' });
    const q = (await frodo.agent.post(`/api/board/stories/${storyId}/posts`).set(CSRF).send({ body: 'Finde den Ring', category: 'quests' })).body.post;
    await sam.agent.post(`/api/board/posts/${q.id}/comments`).set(CSRF).send({ body: 'Vielleicht in Bree?' });
    const get = (qs: string) => frodo.agent.get(`/api/board/stories/${storyId}/posts?${qs}`);
    expect((await get('category=places')).body.total).toBe(1);
    expect((await get('q=%C3%BCbergang')).body.total).toBe(1); // „übergang“ findet „Übergang“
    expect((await get('q=bree')).body.posts[0].id).toBe(q.id);
    expect((await get('category=bogus')).status).toBe(400);
  });

  it('Kommentare: jeder Mitspieler schreibt, ändern/löschen nur Ersteller, DM, Admin', async () => {
    const { frodo, sam, dm, storyId } = await setup();
    const post = (await frodo.agent.post(`/api/board/stories/${storyId}/posts`).set(CSRF).send({ body: 'Treffen Samstag' })).body.post;
    const c = await sam.agent.post(`/api/board/posts/${post.id}/comments`).set(CSRF).send({ body: 'Bin dabei' });
    expect(c.status).toBe(201);
    expect(c.body.comment.author.username).toBe('sam');
    expect((await frodo.agent.patch(`/api/board/comments/${c.body.comment.id}`).set(CSRF).send({ body: 'x' })).status).toBe(403);
    const e = await sam.agent.patch(`/api/board/comments/${c.body.comment.id}`).set(CSRF).send({ body: 'Bin sicher dabei' });
    expect(e.body.comment.editedAt).not.toBeNull();
    expect((await dm.agent.delete(`/api/board/comments/${c.body.comment.id}`).set(CSRF)).status).toBe(204);
  });

  it('Ungelesen-Zähler zählt Beiträge und Kommentare anderer seit dem letzten Lesen', async () => {
    const { frodo, sam, storyId } = await setup();
    await frodo.agent.post(`/api/board/stories/${storyId}/posts`).set(CSRF).send({ body: 'Eins' });
    const p = (await frodo.agent.post(`/api/board/stories/${storyId}/posts`).set(CSRF).send({ body: 'Zwei' })).body.post;
    expect((await frodo.agent.get('/api/board/unread')).body.total).toBe(0); // eigene zählen nicht
    expect((await sam.agent.get('/api/board/unread')).body).toEqual({ total: 2, stories: { [storyId]: 2 } });
    await sam.agent.post(`/api/board/stories/${storyId}/read`).set(CSRF);
    expect((await sam.agent.get('/api/board/unread')).body.total).toBe(0);
    await new Promise((r) => setTimeout(r, 5));
    await frodo.agent.post(`/api/board/posts/${p.id}/comments`).set(CSRF).send({ body: 'Nachtrag' });
    expect((await sam.agent.get('/api/board/unread')).body.total).toBe(1);
  });

  it('archivierte Geschichten sind schreibgeschützt und standardmäßig ausgeblendet', async () => {
    const { frodo, dm, storyId } = await setup();
    await dm.agent.patch(`/api/stories/${storyId}`).set(CSRF).send({ archived: true });
    expect((await frodo.agent.get('/api/board/stories')).body.stories).toEqual([]);
    expect((await frodo.agent.get('/api/board/stories?archived=true')).body.stories[0].archived).toBe(true);
    expect((await frodo.agent.get(`/api/board/stories/${storyId}/posts`)).status).toBe(200);
    expect((await frodo.agent.post(`/api/board/stories/${storyId}/posts`).set(CSRF).send({ body: 'x' })).status).toBe(409);
  });

  it('Papierkorb: Admin kann 90 Tage wiederherstellen, danach wird endgültig gelöscht', async () => {
    const { frodo, admin, dm, storyId } = await setup();
    const p1 = (await frodo.agent.post(`/api/board/stories/${storyId}/posts`).set(CSRF).send({ body: 'Wichtig' })).body.post;
    const p2 = (await frodo.agent.post(`/api/board/stories/${storyId}/posts`).set(CSRF).send({ body: 'Alt' })).body.post;
    await frodo.agent.delete(`/api/board/posts/${p1.id}`).set(CSRF);
    await frodo.agent.delete(`/api/board/posts/${p2.id}`).set(CSRF);

    expect((await dm.agent.get('/api/board/deleted')).status).toBe(403);
    expect((await dm.agent.post(`/api/board/posts/${p1.id}/restore`).set(CSRF)).status).toBe(403);
    const trash = await admin.get('/api/board/deleted');
    expect(trash.body.posts).toHaveLength(2);
    expect(trash.body.posts[0]).toMatchObject({ storyName: 'Der Ring', deletedBy: { username: 'frodo' } });

    const restored = await admin.post(`/api/board/posts/${p1.id}/restore`).set(CSRF);
    expect(restored.status).toBe(200);
    expect((await frodo.agent.get(`/api/board/stories/${storyId}/posts`)).body.posts.map((p: { id: string }) => p.id)).toEqual([p1.id]);

    // p2 liegt 91 Tage im Papierkorb -> wird bereinigt
    await prisma.boardPost.update({ where: { id: p2.id }, data: { deletedAt: new Date(Date.now() - 91 * 24 * 3600 * 1000) } });
    expect(await purgeDeletedBoardPosts()).toBe(1);
    expect(await prisma.boardPost.findUnique({ where: { id: p2.id } })).toBeNull();
  });

  it('Beiträge bleiben beim Löschen des Benutzers erhalten; Export/Import', async () => {
    const { frodo, admin, storyId } = await setup();
    const post = (await frodo.agent.post(`/api/board/stories/${storyId}/posts`).set(CSRF).send({ title: 'T', body: 'Bleibt', category: 'lore' })).body.post;
    await frodo.agent.post(`/api/board/posts/${post.id}/comments`).set(CSRF).send({ body: 'Kommentar' });

    const exp = await admin.get('/api/board/export');
    expect(exp.body.format).toBe('zauberbuch-board');
    expect(exp.body.stories[0]).toMatchObject({ name: 'Der Ring', members: ['frodo', 'sam'] });
    expect(exp.body.stories[0].posts[0]).toMatchObject({ title: 'T', author: 'frodo', comments: [{ author: 'frodo', body: 'Kommentar' }] });

    // Erneuter Import in dieselbe DB: nichts doppelt
    const again = await admin.post('/api/board/import').set(CSRF).send(exp.body);
    expect(again.body).toMatchObject({ storiesCreated: 0, storiesMerged: 1, postsCreated: 0, postsSkipped: 1 });

    await admin.delete(`/api/users/${frodo.user.id}`).set(CSRF);
    const list = await admin.get(`/api/board/stories/${storyId}/posts`);
    expect(list.body.posts[0]).toMatchObject({ body: 'Bleibt', author: null });

    // Import in leere DB
    await resetDb();
    const admin2 = await loginAs('admin', 'admin-password');
    const imp = await admin2.post('/api/board/import').set(CSRF).send(exp.body);
    expect(imp.body).toMatchObject({ storiesCreated: 1, postsCreated: 1, commentsCreated: 1, unknownUsers: ['frodo', 'meister', 'sam'] });
    const s = (await admin2.get('/api/board/stories')).body.stories[0];
    expect(s.postCount).toBe(1);
  });
});

describe('Infotafel – Benachrichtigungen', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('neuer Beitrag benachrichtigt die anderen Mitspieler der Geschichte', async () => {
    const dm = await createUser('meister', 'dungeonmaster');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    const pippin = await createUser('pippin');
    const story = (await dm.agent.post('/api/stories').set(CSRF).send({ name: 'Der Ring', memberIds: [frodo.user.id, sam.user.id] })).body.story;

    await frodo.agent.post(`/api/board/stories/${story.id}/posts`).set(CSRF).send({ title: 'Treffen', body: 'Samstag 18 Uhr' });
    const n = (await sam.agent.get('/api/notifications')).body;
    expect(n.unread).toBe(1);
    expect(n.notifications[0]).toMatchObject({ type: 'board_post', data: { author: 'frodo', story: 'Der Ring', title: 'Treffen', link: `/board/${story.id}` } });
    expect((await frodo.agent.get('/api/notifications')).body.unread).toBe(0); // nicht an sich selbst
    expect((await pippin.agent.get('/api/notifications')).body.unread).toBe(0); // kein Mitspieler

    // ohne Titel: Textauszug ohne Markdown
    await sam.agent.post(`/api/board/stories/${story.id}/posts`).set(CSRF).send({ body: '**Wichtig:** Der Händler heißt _Borin_ und wohnt am Markt.' });
    const f = (await frodo.agent.get('/api/notifications')).body.notifications[0];
    expect(f.data).toMatchObject({ author: 'sam', title: 'Wichtig: Der Händler heißt Borin und wohnt am Markt.' });
    // Kommentare lösen keine Benachrichtigung aus
    const post = (await frodo.agent.get(`/api/board/stories/${story.id}/posts`)).body.posts[0];
    await frodo.agent.post(`/api/board/posts/${post.id}/comments`).set(CSRF).send({ body: 'Danke!' });
    expect((await sam.agent.get('/api/notifications')).body.unread).toBe(1);
  });
});

describe('Geschichten – Verwaltung und Geschichten-Ansicht', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('Verwaltung durch Admin und Moderator, Rollen pro Geschichte, aktive Geschichte', async () => {
    const admin = await loginAs('admin', 'admin-password');
    const mod = await createUser('moderator', 'dungeonmaster');
    const frodo = await createUser('frodo');
    const sam = await createUser('sam');
    // Spieler dürfen nicht verwalten
    expect((await frodo.agent.post('/api/stories').set(CSRF).send({ name: 'X' })).status).toBe(403);
    expect((await frodo.agent.get('/api/stories')).status).toBe(403);
    const s = (await mod.agent.post('/api/stories').set(CSRF).send({ name: 'Strahd', members: [{ userId: frodo.user.id, role: 'player' }, { userId: sam.user.id, role: 'dm' }] })).body.story;
    // Moderator hat sich selbst angegeben? Nein -> wird automatisch DM
    expect(s.members.map((m: { username: string; role: string }) => `${m.username}:${m.role}`)).toEqual(['frodo:player', 'moderator:dm', 'sam:dm']);
    // Rolle aus Sicht des Spielers
    const fl = (await frodo.agent.get('/api/board/stories')).body.stories;
    expect(fl[0].myRole).toBe('player');
    // Sam (Benutzer, DM der Geschichte) darf anheften
    const post = (await frodo.agent.post(`/api/board/stories/${s.id}/posts`).set(CSRF).send({ body: 'Hallo' })).body.post;
    expect((await sam.agent.post(`/api/board/posts/${post.id}/pin`).set(CSRF).send({ pinned: true })).status).toBe(200);
    expect((await frodo.agent.post(`/api/board/posts/${post.id}/pin`).set(CSRF).send({ pinned: false })).status).toBe(403);
    // Moderator bearbeitet, Löschen nur Admin
    expect((await mod.agent.patch(`/api/stories/${s.id}`).set(CSRF).send({ name: 'Der Fluch von Strahd' })).body.story.name).toBe('Der Fluch von Strahd');
    expect((await mod.agent.delete(`/api/stories/${s.id}`).set(CSRF)).status).toBe(403);

    // Geschichten-Ansicht
    const mine = (await frodo.agent.get('/api/stories/mine')).body.stories;
    expect(mine).toEqual([{ id: s.id, name: 'Der Fluch von Strahd', role: 'player' }]);
    const r = await frodo.agent.put('/api/stories/active').set(CSRF).send({ storyId: s.id });
    expect(r.body.user.activeStoryId).toBe(s.id);
    expect((await frodo.agent.get('/api/auth/me')).body.user.activeStoryId).toBe(s.id);
    const other = (await admin.post('/api/stories').set(CSRF).send({ name: 'Andere' })).body.story;
    expect((await frodo.agent.put('/api/stories/active').set(CSRF).send({ storyId: other.id })).status).toBe(400);
    expect((await frodo.agent.put('/api/stories/active').set(CSRF).send({ storyId: null })).body.user.activeStoryId).toBeNull();
    expect((await admin.get('/api/stories/mine')).body.stories.map((x: { role: string }) => x.role)).toEqual(['dm', 'dm']);
    expect((await admin.delete(`/api/stories/${s.id}`).set(CSRF)).status).toBe(204);
  });
});
