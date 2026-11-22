import { Router, type Request } from 'express';
import type { BoardComment, BoardPost, Prisma, Story, User } from '@prisma/client';
import {
  BOARD_EXPORT_FORMAT,
  BOARD_PAGE_SIZE,
  BOARD_RESTORE_DAYS,
  boardImportSchema,
  boardSearchText,
  commentInputSchema,
  pinSchema,
  postInputSchema,
  postQuerySchema,
  type BoardCategory,
  type BoardCommentDto,
  type BoardExportFile,
  type BoardImportResult,
  type BoardPostDto,
  type BoardPostsPage,
  type BoardUnreadDto,
  type BoardUserRef,
  type DeletedBoardPostDto,
  type StoryDto,
  type StoryRole,
  DEFAULT_LIFESTYLES,
  DEFAULT_LANGUAGES,
  DEFAULT_TOOLS,
  storyOptionLists,
} from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { wikiGodNames, wikiLanguageNames } from './wiki';
import { validate } from '../lib/validate';
import { conflict, forbidden, notFound } from '../lib/errors';
import { logger } from '../lib/logger';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { roleFromMembership, visibleStoryWhere } from '../lib/stories';
import { notifyUsers } from '../lib/notifications';

/**
 * Infotafel pro Geschichte.
 * - Geschichten verwalten Admin und Dungeon Master; Benutzer sehen nur Geschichten, in denen sie Mitspieler sind.
 * - Beiträge/Kommentare darf jeder Mitspieler schreiben; ändern/löschen nur Ersteller, Dungeon Master oder Admin.
 * - Anheften: Dungeon Master und Admin.
 * - Gelöschte Beiträge landen im Papierkorb und können vom Admin 90 Tage lang wiederhergestellt werden.
 */
export const boardRouter = Router();
boardRouter.use(requireAuth);

const DAY_MS = 24 * 60 * 60 * 1000;
const userRefSelect = { select: { id: true, username: true } } as const;

const ref = (u: Pick<User, 'id' | 'username'> | null | undefined): BoardUserRef | null => (u ? { id: u.id, username: u.username } : null);

/** DM-Rechte in der Geschichte der aktuellen Anfrage (gesetzt von loadStory) */
const storyDm = new WeakMap<Request, boolean>();
const canModify = (req: Request, authorId: string | null) => storyDm.get(req) === true || (authorId !== null && authorId === req.user!.id);

type CommentWithAuthor = BoardComment & { author: Pick<User, 'id' | 'username'> | null };
type PostWithRelations = BoardPost & {
  author: Pick<User, 'id' | 'username'> | null;
  editedBy: Pick<User, 'id' | 'username'> | null;
  comments: CommentWithAuthor[];
};

const postInclude = {
  author: userRefSelect,
  editedBy: userRefSelect,
  comments: { orderBy: { createdAt: 'asc' }, include: { author: userRefSelect } },
} satisfies Prisma.BoardPostInclude;

function toCommentDto(req: Request, c: CommentWithAuthor): BoardCommentDto {
  return {
    id: c.id,
    body: c.body,
    author: ref(c.author),
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt?.toISOString() ?? null,
    canEdit: canModify(req, c.authorId),
  };
}

function toPostDto(req: Request, p: PostWithRelations): BoardPostDto {
  return {
    id: p.id,
    storyId: p.storyId,
    title: p.title,
    body: p.body,
    category: p.category as BoardCategory,
    pinned: p.pinned,
    author: ref(p.author),
    createdAt: p.createdAt.toISOString(),
    editedAt: p.editedAt?.toISOString() ?? null,
    editedBy: ref(p.editedBy),
    comments: p.comments.map((c) => toCommentDto(req, c)),
    canEdit: canModify(req, p.authorId),
  };
}

/** Kurzer Textauszug für Benachrichtigungen (Markdown grob entfernt) */
function postSnippet(body: string, max = 80) {
  const plain = body
    .replace(/[#>*_`~\[\]()|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}

/** Lädt eine Geschichte und prüft den Zugriff. Ohne Zugriff 404, damit fremde Geschichten verborgen bleiben. */
async function loadStory(req: Request, id: string) {
  const story = await prisma.story.findUnique({ where: { id }, include: { members: { select: { userId: true, role: true } } } });
  if (!story) throw notFound();
  const role = roleFromMembership(req.user!, story.members.find((m) => m.userId === req.user!.id)?.role);
  if (!role) throw notFound();
  storyDm.set(req, role === 'dm');
  return { ...story, role };
}

function assertWritable(story: Pick<Story, 'archived'>) {
  if (story.archived) throw conflict('story_archived', 'Story is archived');
}

/** Nicht gelöschter Beitrag mit Zugriffsprüfung über seine Geschichte */
async function loadPost(req: Request, id: string) {
  const post = await prisma.boardPost.findUnique({ where: { id } });
  if (!post || post.deletedAt) throw notFound();
  const story = await loadStory(req, post.storyId);
  return { post, story };
}

/** Geschichten, die der Benutzer sehen darf */
function storyWhere(req: Request, includeArchived: boolean): Prisma.StoryWhereInput {
  return { ...(includeArchived ? {} : { archived: false }), ...visibleStoryWhere(req.user!) };
}

/** Neue Beiträge und Kommentare anderer seit dem letzten Lesen, je Geschichte */
async function unreadCounts(userId: string, storyIds: string[]): Promise<Record<string, number>> {
  if (storyIds.length === 0) return {};
  const reads = await prisma.boardRead.findMany({ where: { userId, storyId: { in: storyIds } } });
  const lastRead = new Map(reads.map((r) => [r.storyId, r.lastReadAt]));
  const result: Record<string, number> = {};
  await Promise.all(
    storyIds.map(async (storyId) => {
      const since = lastRead.get(storyId);
      const createdAt = since ? { gt: since } : undefined;
      const notMine = { OR: [{ authorId: null }, { authorId: { not: userId } }] };
      const [posts, comments] = await Promise.all([
        prisma.boardPost.count({ where: { storyId, deletedAt: null, createdAt, ...notMine } }),
        prisma.boardComment.count({ where: { post: { storyId, deletedAt: null }, createdAt, ...notMine } }),
      ]);
      result[storyId] = posts + comments;
    }),
  );
  return result;
}

/** Endgültiges Entfernen abgelaufener Papierkorb-Einträge */
export async function purgeDeletedBoardPosts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - BOARD_RESTORE_DAYS * DAY_MS);
  const { count } = await prisma.boardPost.deleteMany({ where: { deletedAt: { lt: cutoff } } });
  if (count > 0) logger.info(`Infotafel: ${count} gelöschte Beiträge nach ${BOARD_RESTORE_DAYS} Tagen endgültig entfernt.`);
  return count;
}

const storyInclude = {
  members: { include: { user: userRefSelect }, orderBy: { user: { username: 'asc' } } },
  _count: { select: { posts: { where: { deletedAt: null } } } },
} satisfies Prisma.StoryInclude;
type StoryWithMembers = Prisma.StoryGetPayload<{ include: typeof storyInclude }>;

/** Geschichten als DTO inkl. Rollen, eigener Rolle und Ungelesen-Zähler */
export async function buildStoryDtos(user: Pick<User, 'id' | 'role'>, stories: StoryWithMembers[]): Promise<StoryDto[]> {
  const unread = await unreadCounts(user.id, stories.filter((s) => !s.archived).map((s) => s.id));
  const languages = await wikiLanguageNames();
  const gods = await wikiGodNames();
  return stories.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    archived: s.archived,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    members: s.members.map((m) => ({ ...ref(m.user)!, role: (m.role === 'dm' ? 'dm' : 'player') as StoryRole })),
    myRole: roleFromMembership(user, s.members.find((m) => m.userId === user.id)?.role),
    ...storyOptionLists(s, { languages, gods }),
    postCount: s._count.posts,
    unread: unread[s.id] ?? 0,
  }));
}
export { storyInclude };

// ---------------------------------------------------------------- Geschichten

/** Geschichten für Infotafel/Kampf (gemäß Rolle; Verwaltung siehe /api/stories) */
boardRouter.get('/stories', async (req, res) => {
  const includeArchived = req.query.archived === 'true';
  const stories = await prisma.story.findMany({ where: storyWhere(req, includeArchived), orderBy: [{ archived: 'asc' }, { name: 'asc' }], include: storyInclude });
  res.json({ stories: await buildStoryDtos(req.user!, stories) });
});

boardRouter.post('/stories/:id/read', async (req, res) => {
  const story = await loadStory(req, String(req.params.id));
  const now = new Date();
  await prisma.boardRead.upsert({
    where: { userId_storyId: { userId: req.user!.id, storyId: story.id } },
    create: { userId: req.user!.id, storyId: story.id, lastReadAt: now },
    update: { lastReadAt: now },
  });
  res.status(204).end();
});

boardRouter.get('/unread', async (req, res) => {
  const stories = await prisma.story.findMany({ where: storyWhere(req, false), select: { id: true } });
  const counts = await unreadCounts(req.user!.id, stories.map((s) => s.id));
  const body: BoardUnreadDto = { total: Object.values(counts).reduce((a, b) => a + b, 0), stories: counts };
  res.json(body);
});

// ---------------------------------------------------------------- Beiträge

boardRouter.get('/stories/:id/posts', async (req, res) => {
  const story = await loadStory(req, String(req.params.id));
  const query = validate(postQuerySchema, req.query);
  const q = query.q.toLocaleLowerCase('de');
  const where: Prisma.BoardPostWhereInput = {
    storyId: story.id,
    deletedAt: null,
    ...(query.category ? { category: query.category } : {}),
    ...(q ? { OR: [{ searchText: { contains: q } }, { comments: { some: { body: { contains: q } } } }] } : {}),
  };
  const [total, posts] = await Promise.all([
    prisma.boardPost.count({ where }),
    prisma.boardPost.findMany({
      where,
      include: postInclude,
      orderBy: [{ pinned: 'desc' }, { pinnedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * BOARD_PAGE_SIZE,
      take: BOARD_PAGE_SIZE,
    }),
  ]);
  const body: BoardPostsPage = { posts: posts.map((p) => toPostDto(req, p)), total, page: query.page, pageSize: BOARD_PAGE_SIZE };
  res.json(body);
});

boardRouter.post('/stories/:id/posts', async (req, res) => {
  const story = await loadStory(req, String(req.params.id));
  assertWritable(story);
  const input = validate(postInputSchema, req.body);
  const post = await prisma.boardPost.create({
    data: { storyId: story.id, authorId: req.user!.id, title: input.title, body: input.body, category: input.category, searchText: boardSearchText(input.title, input.body) },
    include: postInclude,
  });
  // Alle anderen Mitspieler der Geschichte informieren (Glocke)
  const others = story.members.map((m) => m.userId).filter((id) => id !== req.user!.id);
  await notifyUsers(others, 'board_post', {
    author: req.user!.username,
    story: story.name,
    title: input.title || postSnippet(input.body),
    link: `/board/${story.id}`,
  });
  res.status(201).json({ post: toPostDto(req, post) });
});

boardRouter.patch('/posts/:id', async (req, res) => {
  const { post, story } = await loadPost(req, String(req.params.id));
  assertWritable(story);
  if (!canModify(req, post.authorId)) throw forbidden();
  const input = validate(postInputSchema, req.body);
  const updated = await prisma.boardPost.update({
    where: { id: post.id },
    data: {
      title: input.title,
      body: input.body,
      category: input.category,
      searchText: boardSearchText(input.title, input.body),
      editedAt: new Date(),
      editedById: req.user!.id,
    },
    include: postInclude,
  });
  res.json({ post: toPostDto(req, updated) });
});

boardRouter.post('/posts/:id/pin', async (req, res) => {
  const { post, story } = await loadPost(req, String(req.params.id));
  if (story.role !== 'dm') throw forbidden();
  const { pinned } = validate(pinSchema, req.body);
  const updated = await prisma.boardPost.update({
    where: { id: post.id },
    data: { pinned, pinnedAt: pinned ? new Date() : null },
    include: postInclude,
  });
  res.json({ post: toPostDto(req, updated) });
});

/** In den Papierkorb verschieben */
boardRouter.delete('/posts/:id', async (req, res) => {
  const { post } = await loadPost(req, String(req.params.id));
  if (!canModify(req, post.authorId)) throw forbidden();
  await prisma.boardPost.update({ where: { id: post.id }, data: { deletedAt: new Date(), deletedById: req.user!.id } });
  res.status(204).end();
});

// ---------------------------------------------------------------- Papierkorb (Admin)

boardRouter.get('/deleted', requireAdmin, async (req, res) => {
  storyDm.set(req, true);
  await purgeDeletedBoardPosts();
  const storyId = typeof req.query.storyId === 'string' && req.query.storyId ? req.query.storyId : undefined;
  const posts = await prisma.boardPost.findMany({
    where: { deletedAt: { not: null }, ...(storyId ? { storyId } : {}) },
    include: { ...postInclude, deletedBy: userRefSelect, story: { select: { name: true } } },
    orderBy: { deletedAt: 'desc' },
    take: 500,
  });
  const body: DeletedBoardPostDto[] = posts.map((p) => ({
    ...toPostDto(req, p),
    storyName: p.story.name,
    deletedAt: p.deletedAt!.toISOString(),
    deletedBy: ref(p.deletedBy),
    purgeAt: new Date(p.deletedAt!.getTime() + BOARD_RESTORE_DAYS * DAY_MS).toISOString(),
  }));
  res.json({ posts: body });
});

boardRouter.post('/posts/:id/restore', requireAdmin, async (req, res) => {
  const post = await prisma.boardPost.findUnique({ where: { id: String(req.params.id) } });
  if (!post || !post.deletedAt) throw notFound();
  const updated = await prisma.boardPost.update({ where: { id: post.id }, data: { deletedAt: null, deletedById: null }, include: postInclude });
  storyDm.set(req, true);
  res.json({ post: toPostDto(req, updated) });
});

/** Sofort endgültig löschen (aus dem Papierkorb) */
boardRouter.delete('/posts/:id/permanent', requireAdmin, async (req, res) => {
  const post = await prisma.boardPost.findUnique({ where: { id: String(req.params.id) } });
  if (!post || !post.deletedAt) throw notFound();
  await prisma.boardPost.delete({ where: { id: post.id } });
  res.status(204).end();
});

// ---------------------------------------------------------------- Kommentare

boardRouter.post('/posts/:id/comments', async (req, res) => {
  const { post, story } = await loadPost(req, String(req.params.id));
  assertWritable(story);
  const { body } = validate(commentInputSchema, req.body);
  const comment = await prisma.boardComment.create({ data: { postId: post.id, authorId: req.user!.id, body }, include: { author: userRefSelect } });
  res.status(201).json({ comment: toCommentDto(req, comment) });
});

async function loadComment(req: Request, id: string) {
  const comment = await prisma.boardComment.findUnique({ where: { id } });
  if (!comment) throw notFound();
  const { story } = await loadPost(req, comment.postId);
  if (!canModify(req, comment.authorId)) throw forbidden();
  return { comment, story };
}

boardRouter.patch('/comments/:id', async (req, res) => {
  const { comment, story } = await loadComment(req, String(req.params.id));
  assertWritable(story);
  const { body } = validate(commentInputSchema, req.body);
  const updated = await prisma.boardComment.update({ where: { id: comment.id }, data: { body, editedAt: new Date() }, include: { author: userRefSelect } });
  res.json({ comment: toCommentDto(req, updated) });
});

boardRouter.delete('/comments/:id', async (req, res) => {
  const { comment } = await loadComment(req, String(req.params.id));
  await prisma.boardComment.delete({ where: { id: comment.id } });
  res.status(204).end();
});

// ---------------------------------------------------------------- Export / Import (Admin)

boardRouter.get('/export', requireAdmin, async (_req, res) => {
  const stories = await prisma.story.findMany({
    orderBy: { name: 'asc' },
    include: {
      members: { include: { user: { select: { username: true } } } },
      posts: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { username: true } }, comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: { username: true } } } } },
      },
    },
  });
  const wikiLangs = await wikiLanguageNames();
  const wikiGods = await wikiGodNames();
  const file: BoardExportFile = {
    format: BOARD_EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    stories: stories.map((s) => ({
      name: s.name,
      description: s.description,
      archived: s.archived,
      members: s.members.filter((m) => m.role !== 'dm').map((m) => m.user.username),
      dms: s.members.filter((m) => m.role === 'dm').map((m) => m.user.username),
      ...storyOptionLists(s, { languages: wikiLangs, gods: wikiGods }),
      posts: s.posts.map((p) => ({
        title: p.title,
        body: p.body,
        category: p.category as BoardCategory,
        pinned: p.pinned,
        author: p.author?.username ?? null,
        createdAt: p.createdAt.toISOString(),
        editedAt: p.editedAt?.toISOString() ?? null,
        comments: p.comments.map((c) => ({ author: c.author?.username ?? null, body: c.body, createdAt: c.createdAt.toISOString(), editedAt: c.editedAt?.toISOString() ?? null })),
      })),
    })),
  };
  res.setHeader('Content-Disposition', `attachment; filename="zauberbuch-infotafel-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(file);
});

/**
 * Import: Geschichten mit gleichem Namen werden zusammengeführt (Mitspieler ergänzt), sonst neu angelegt.
 * Beiträge, die es bereits gibt (gleicher Ersteller, Zeitpunkt und Titel), werden übersprungen.
 * Ersteller werden über den Benutzernamen zugeordnet; unbekannte Namen werden zu „gelöschter Benutzer“.
 */
boardRouter.post('/import', requireAdmin, async (req, res) => {
  const input = validate(boardImportSchema, req.body);
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  const byName = new Map(users.map((u) => [u.username.toLowerCase(), u.id]));
  const unknown = new Set<string>();
  const userId = (name: string | null) => {
    if (!name) return null;
    const id = byName.get(name.toLowerCase());
    if (!id) unknown.add(name);
    return id ?? null;
  };
  const importLangs = (await wikiLanguageNames()).length ? await wikiLanguageNames() : DEFAULT_LANGUAGES;
  const result: BoardImportResult = { storiesCreated: 0, storiesMerged: 0, postsCreated: 0, postsSkipped: 0, commentsCreated: 0, unknownUsers: [] };

  await prisma.$transaction(
    async (tx) => {
      for (const s of input.stories) {
        let story = await tx.story.findFirst({ where: { name: s.name } });
        if (story) result.storiesMerged++;
        else {
          story = await tx.story.create({ data: { name: s.name, description: s.description, archived: s.archived, lifestyles: JSON.stringify(s.lifestyles ?? DEFAULT_LIFESTYLES), languages: JSON.stringify(s.languages ?? importLangs), tools: JSON.stringify(s.tools ?? DEFAULT_TOOLS), gods: s.gods ? JSON.stringify(s.gods) : '' } });
          result.storiesCreated++;
        }
        for (const [names, role] of [[s.members, 'player'], [s.dms, 'dm']] as const) {
          for (const m of names) {
            const id = userId(m);
            if (id) await tx.storyMember.upsert({ where: { storyId_userId: { storyId: story.id, userId: id } }, create: { storyId: story.id, userId: id, role }, update: { role } });
          }
        }
        for (const p of s.posts) {
          const authorId = userId(p.author);
          const exists = await tx.boardPost.findFirst({ where: { storyId: story.id, authorId, createdAt: p.createdAt, title: p.title } });
          if (exists) {
            result.postsSkipped++;
            continue;
          }
          await tx.boardPost.create({
            data: {
              storyId: story.id,
              authorId,
              title: p.title,
              body: p.body,
              category: p.category,
              pinned: p.pinned,
              pinnedAt: p.pinned ? p.createdAt : null,
              searchText: boardSearchText(p.title, p.body),
              createdAt: p.createdAt,
              editedAt: p.editedAt,
              comments: { create: p.comments.map((c) => ({ authorId: userId(c.author), body: c.body, createdAt: c.createdAt, editedAt: c.editedAt })) },
            },
          });
          result.postsCreated++;
          result.commentsCreated += p.comments.length;
        }
      }
    },
    { timeout: 120_000 },
  );
  result.unknownUsers = [...unknown].sort();
  res.json(result);
});
