import { Router, type Request } from 'express';
import type { Prisma } from '@prisma/client';
import {
  isEditorRole,
  itemTransferSchema,
  magicItemSchema,
  type CharacterItemsDto,
  type ItemCharacterRef,
  type ItemStoryDto,
  type MagicItemDto,
} from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { notifyUsers } from '../lib/notifications';
import { requireAuth } from '../middleware/auth';
import { dmStoryIds, storyRole } from '../lib/stories';

/**
 * Magische Gegenstände (Verwaltung → Magische Gegenstände und Reiter im Charakterbogen).
 * Verwalten: Admin, Moderator und die Dungeon Master der Geschichte.
 * Weitergeben/Zurückgeben: Besitzer und Mitbearbeiter des Bogens, der den Gegenstand hat.
 */
export const itemsRouter = Router();
itemsRouter.use(requireAuth);

const characterRefSelect = { id: true, name: true, user: { select: { username: true } } } as const;
const itemInclude = {
  holders: { include: { character: { select: characterRefSelect } }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.MagicItemInclude;
type ItemWithHolders = Prisma.MagicItemGetPayload<{ include: typeof itemInclude }>;

const toRef = (c: { id: string; name: string; user: { username: string } }): ItemCharacterRef => ({ id: c.id, name: c.name || '—', owner: c.user.username });

function toDto(i: ItemWithHolders): MagicItemDto {
  return {
    id: i.id,
    storyId: i.storyId,
    name: i.name,
    description: i.description,
    weight: i.weight,
    holders: i.holders.map((h) => toRef(h.character)),
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

async function canManageStory(req: Request, storyId: string) {
  if (isEditorRole(req.user!.role)) return true;
  return (await storyRole(req.user!, storyId)) === 'dm';
}

async function requireManage(req: Request, storyId: string) {
  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story) throw notFound();
  if (!(await canManageStory(req, storyId))) throw forbidden();
  return story;
}

/** Nur Charakterbögen, die der Geschichte zugeordnet sind, können Gegenstände erhalten */
async function validHolders(storyId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const chars = await prisma.character.findMany({ where: { id: { in: unique }, storyId }, select: { id: true } });
  if (chars.length !== unique.length) throw badRequest('invalid_holder', 'Characters must belong to the story');
  return unique;
}

/** Besitzer neu hinzugekommener Bögen benachrichtigen */
async function notifyReceived(itemId: string, characterIds: string[], from: string, exceptUserId: string) {
  if (characterIds.length === 0) return;
  const item = await prisma.magicItem.findUniqueOrThrow({ where: { id: itemId }, include: { story: { select: { name: true } } } });
  const chars = await prisma.character.findMany({ where: { id: { in: characterIds } }, select: { id: true, name: true, userId: true, editors: { select: { userId: true } } } });
  for (const c of chars) {
    const users = [c.userId, ...c.editors.map((e) => e.userId)].filter((u) => u !== exceptUserId);
    await notifyUsers(users, 'item_received', { from, item: item.name, character: c.name || '—', story: item.story.name, link: `/characters/${c.id}?tab=items` });
  }
}

// ---------------------------------------------------------------- Verwaltung

/** Geschichten, deren Gegenstände der Benutzer verwalten darf (auch für den Zugang zur Verwaltung) */
itemsRouter.get('/stories', async (req, res) => {
  const where: Prisma.StoryWhereInput = isEditorRole(req.user!.role) ? {} : { id: { in: await dmStoryIds(req.user!) } };
  const stories = await prisma.story.findMany({ where, orderBy: [{ archived: 'asc' }, { name: 'asc' }], include: { _count: { select: { magicItems: true } } } });
  const body: ItemStoryDto[] = stories.map((s) => ({ id: s.id, name: s.name, archived: s.archived, itemCount: s._count.magicItems }));
  res.json({ stories: body });
});

itemsRouter.get('/stories/:storyId', async (req, res) => {
  const story = await requireManage(req, String(req.params.storyId));
  const [items, characters] = await Promise.all([
    prisma.magicItem.findMany({ where: { storyId: story.id }, include: itemInclude, orderBy: { name: 'asc' } }),
    prisma.character.findMany({ where: { storyId: story.id }, select: characterRefSelect, orderBy: [{ user: { username: 'asc' } }, { name: 'asc' }] }),
  ]);
  res.json({ items: items.map(toDto), characters: characters.map(toRef) });
});

itemsRouter.post('/stories/:storyId', async (req, res) => {
  const story = await requireManage(req, String(req.params.storyId));
  const input = validate(magicItemSchema, req.body);
  const holders = await validHolders(story.id, input.holderIds);
  const item = await prisma.magicItem.create({
    data: { storyId: story.id, name: input.name, description: input.description, weight: input.weight, holders: { create: holders.map((characterId) => ({ characterId })) } },
    include: itemInclude,
  });
  await notifyReceived(item.id, holders, req.user!.username, req.user!.id);
  res.status(201).json({ item: toDto(item) });
});

itemsRouter.put('/:id', async (req, res) => {
  const existing = await prisma.magicItem.findUnique({ where: { id: String(req.params.id) }, include: { holders: true } });
  if (!existing) throw notFound();
  await requireManage(req, existing.storyId);
  const input = validate(magicItemSchema, req.body);
  const holders = await validHolders(existing.storyId, input.holderIds);
  const before = new Set(existing.holders.map((h) => h.characterId));
  const item = await prisma.$transaction(async (tx) => {
    await tx.magicItemHolder.deleteMany({ where: { itemId: existing.id, characterId: { notIn: holders } } });
    for (const characterId of holders.filter((id) => !before.has(id))) await tx.magicItemHolder.create({ data: { itemId: existing.id, characterId } });
    return tx.magicItem.update({ where: { id: existing.id }, data: { name: input.name, description: input.description, weight: input.weight }, include: itemInclude });
  });
  await notifyReceived(item.id, holders.filter((id) => !before.has(id)), req.user!.username, req.user!.id);
  res.json({ item: toDto(item) });
});

itemsRouter.delete('/:id', async (req, res) => {
  const existing = await prisma.magicItem.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound();
  await requireManage(req, existing.storyId);
  await prisma.magicItem.delete({ where: { id: existing.id } });
  res.status(204).end();
});

// ---------------------------------------------------------------- Charakterbogen

/** Lese-/Schreibrecht auf einen Bogen (wie beim Charakterbogen selbst) */
async function characterAccess(req: Request, characterId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { editors: { select: { userId: true } }, user: { select: { username: true } } } });
  if (!c) throw notFound('character_not_found', 'Character not found');
  const me = req.user!;
  const canEdit = c.userId === me.id || c.editors.some((e) => e.userId === me.id);
  const storyDm = !!c.storyId && (await storyRole(me, c.storyId)) === 'dm';
  if (!canEdit && !storyDm && !isEditorRole(me.role)) throw notFound('character_not_found', 'Character not found');
  return { c, canEdit };
}

itemsRouter.get('/character/:characterId', async (req, res) => {
  const { c, canEdit } = await characterAccess(req, String(req.params.characterId));
  const holdings = await prisma.magicItemHolder.findMany({ where: { characterId: c.id }, include: { item: { include: itemInclude } }, orderBy: { item: { name: 'asc' } } });
  const items = holdings.map((h) => h.item);
  // Empfänger: andere Bögen der Geschichten dieser Gegenstände (bzw. der Geschichte des Bogens)
  const storyIds = [...new Set([...items.map((i) => i.storyId), ...(c.storyId ? [c.storyId] : [])])];
  const targets = await prisma.character.findMany({
    where: { storyId: { in: storyIds }, id: { not: c.id } },
    select: { ...characterRefSelect, storyId: true },
    orderBy: [{ user: { username: 'asc' } }, { name: 'asc' }],
  });
  const body: CharacterItemsDto = { items: items.map(toDto), canTransfer: canEdit, targets: targets.map(toRef) };
  res.json(body);
});

/** Weitergeben an einen anderen Bogen der Geschichte oder an den DM zurückgeben */
itemsRouter.post('/:id/transfer', async (req, res) => {
  const item = await prisma.magicItem.findUnique({ where: { id: String(req.params.id) }, include: { holders: true, story: { select: { id: true, name: true } } } });
  if (!item) throw notFound();
  const { fromCharacterId, toCharacterId } = validate(itemTransferSchema, req.body);
  const { c: from, canEdit } = await characterAccess(req, fromCharacterId);
  if (!canEdit) throw forbidden();
  if (!item.holders.some((h) => h.characterId === from.id)) throw badRequest('not_holder', 'Character does not hold this item');
  if (toCharacterId) {
    if (toCharacterId === from.id) throw badRequest('invalid_target', 'Invalid target');
    const target = await prisma.character.findFirst({ where: { id: toCharacterId, storyId: item.storyId } });
    if (!target) throw badRequest('invalid_target', 'Target must belong to the story');
  }
  await prisma.$transaction(async (tx) => {
    await tx.magicItemHolder.delete({ where: { itemId_characterId: { itemId: item.id, characterId: from.id } } });
    if (toCharacterId) {
      await tx.magicItemHolder.upsert({ where: { itemId_characterId: { itemId: item.id, characterId: toCharacterId } }, create: { itemId: item.id, characterId: toCharacterId }, update: {} });
    }
  });
  const fromName = from.name || '—';
  if (toCharacterId) {
    await notifyReceived(item.id, [toCharacterId], `${req.user!.username} (${fromName})`, req.user!.id);
  } else {
    // Zurück an den DM: Dungeon Master der Geschichte informieren
    const dms = await prisma.storyMember.findMany({ where: { storyId: item.storyId, role: 'dm' }, select: { userId: true } });
    await notifyUsers(
      dms.map((d) => d.userId).filter((u) => u !== req.user!.id),
      'item_returned',
      { from: req.user!.username, character: fromName, item: item.name, story: item.story.name, link: `/admin/items?story=${item.storyId}` },
    );
  }
  res.status(204).end();
});
