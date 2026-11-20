import { Router, type Request } from 'express';
import type { Prisma } from '@prisma/client';
import {
  isEditorRole,
  itemHoldersSchema,
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
 * Eine allgemeine Datenbank für alle Geschichten: anlegen/bearbeiten dürfen Admin, Moderator und alle Dungeon Master.
 * Besitzer werden je Geschichte vergeben – nur in Geschichten, die man leitet (Admin/Moderator: alle).
 * Weitergeben/Zurückgeben: Besitzer und Mitbearbeiter des Bogens, innerhalb der Geschichte des Bogens.
 */
export const itemsRouter = Router();
itemsRouter.use(requireAuth);

const characterRefSelect = { id: true, name: true, storyId: true, user: { select: { username: true } } } as const;
const itemInclude = {
  holders: { include: { character: { select: characterRefSelect } }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.MagicItemInclude;
type ItemWithHolders = Prisma.MagicItemGetPayload<{ include: typeof itemInclude }>;

const toRef = (c: { id: string; name: string; storyId: string | null; user: { username: string } }): ItemCharacterRef => ({ id: c.id, name: c.name || '—', owner: c.user.username, storyId: c.storyId });

/** visible: Geschichten, deren Besitzer der Betrachter sehen darf (null = alle) */
function toDto(i: ItemWithHolders, visible: Set<string> | null): MagicItemDto {
  const shown = i.holders.filter((h) => visible === null || (h.character.storyId !== null && visible.has(h.character.storyId)));
  return {
    id: i.id,
    name: i.name,
    description: i.description,
    weight: i.weight,
    value: i.value,
    attunement: i.attunement,
    holders: shown.map((h) => toRef(h.character)),
    otherHolders: i.holders.length - shown.length,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

/** Geschichten, in denen der Benutzer Besitzer vergeben darf (null = alle, für Admin/Moderator) */
async function manageableStories(req: Request): Promise<Set<string> | null> {
  if (isEditorRole(req.user!.role)) return null;
  return new Set(await dmStoryIds(req.user!));
}

/** Datenbank bearbeiten: Admin, Moderator und wer in irgendeiner Geschichte DM ist */
async function requireManager(req: Request) {
  const stories = await manageableStories(req);
  if (stories !== null && stories.size === 0) throw forbidden();
  return stories;
}

async function requireStoryManage(req: Request, storyId: string) {
  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story) throw notFound();
  const stories = await manageableStories(req);
  if (stories !== null && !stories.has(storyId)) throw forbidden();
  return story;
}

/** Nur Charakterbögen, die der Geschichte zugeordnet sind, können Gegenstände erhalten */
async function validHolders(storyId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const chars = await prisma.character.findMany({ where: { id: { in: unique }, storyId }, select: { id: true } });
  if (chars.length !== unique.length) throw badRequest('invalid_holder', 'Characters must belong to the story');
  return unique;
}

/** Besitzer innerhalb einer Geschichte setzen; liefert die neu hinzugekommenen Bögen */
async function setStoryHolders(itemId: string, storyId: string, holderIds: string[]) {
  const holders = await validHolders(storyId, holderIds);
  const current = await prisma.magicItemHolder.findMany({ where: { itemId, character: { storyId } }, select: { characterId: true } });
  const before = new Set(current.map((h) => h.characterId));
  await prisma.$transaction(async (tx) => {
    await tx.magicItemHolder.deleteMany({ where: { itemId, character: { storyId }, characterId: { notIn: holders } } });
    for (const characterId of holders.filter((id) => !before.has(id))) await tx.magicItemHolder.create({ data: { itemId, characterId } });
  });
  return holders.filter((id) => !before.has(id));
}

/** Besitzer neu hinzugekommener Bögen benachrichtigen */
async function notifyReceived(itemId: string, characterIds: string[], from: string, exceptUserId: string) {
  if (characterIds.length === 0) return;
  const item = await prisma.magicItem.findUniqueOrThrow({ where: { id: itemId } });
  const chars = await prisma.character.findMany({
    where: { id: { in: characterIds } },
    select: { id: true, name: true, userId: true, editors: { select: { userId: true } }, story: { select: { name: true } } },
  });
  for (const c of chars) {
    const users = [c.userId, ...c.editors.map((e) => e.userId)].filter((u) => u !== exceptUserId);
    await notifyUsers(users, 'item_received', { from, item: item.name, character: c.name || '—', story: c.story?.name ?? '', link: `/characters/${c.id}?tab=items` });
  }
}

// ---------------------------------------------------------------- Verwaltung

/** Geschichten, in denen der Benutzer Besitzer vergeben darf (auch für den Zugang zur Verwaltung) */
itemsRouter.get('/stories', async (req, res) => {
  const stories = await manageableStories(req);
  const where: Prisma.StoryWhereInput = stories === null ? {} : { id: { in: [...stories] } };
  const list = await prisma.story.findMany({ where, orderBy: [{ archived: 'asc' }, { name: 'asc' }], select: { id: true, name: true, archived: true } });
  const held = await prisma.magicItemHolder.findMany({ where: { character: { storyId: { in: list.map((s) => s.id) } } }, select: { itemId: true, character: { select: { storyId: true } } } });
  const count = new Map<string, Set<string>>();
  for (const h of held) {
    const sid = h.character.storyId!;
    if (!count.has(sid)) count.set(sid, new Set());
    count.get(sid)!.add(h.itemId);
  }
  const body: ItemStoryDto[] = list.map((s) => ({ ...s, itemCount: count.get(s.id)?.size ?? 0 }));
  res.json({ stories: body });
});

/** Alle Gegenstände; mit ?storyId zusätzlich die Charakterbögen dieser Geschichte (für die Besitzer-Vergabe) */
itemsRouter.get('/', async (req, res) => {
  const visible = await requireManager(req);
  const storyId = typeof req.query.storyId === 'string' && req.query.storyId ? req.query.storyId : null;
  if (storyId) await requireStoryManage(req, storyId);
  const [items, characters] = await Promise.all([
    prisma.magicItem.findMany({ include: itemInclude, orderBy: { name: 'asc' } }),
    storyId ? prisma.character.findMany({ where: { storyId }, select: characterRefSelect, orderBy: [{ user: { username: 'asc' } }, { name: 'asc' }] }) : Promise.resolve([]),
  ]);
  res.json({ items: items.map((i) => toDto(i, visible)), characters: characters.map(toRef) });
});

itemsRouter.post('/', async (req, res) => {
  const visible = await requireManager(req);
  const input = validate(magicItemSchema, req.body);
  if (input.storyId) await requireStoryManage(req, input.storyId);
  else if (input.holderIds.length) throw badRequest('invalid_holder', 'storyId required for holders');
  const item = await prisma.magicItem.create({ data: { name: input.name, description: input.description, weight: input.weight, value: input.value, attunement: input.attunement } });
  const added = input.storyId ? await setStoryHolders(item.id, input.storyId, input.holderIds) : [];
  await notifyReceived(item.id, added, req.user!.username, req.user!.id);
  res.status(201).json({ item: toDto(await prisma.magicItem.findUniqueOrThrow({ where: { id: item.id }, include: itemInclude }), visible) });
});

/** Gegenstand bearbeiten (gilt für alle Geschichten); mit storyId werden zugleich die Besitzer dieser Geschichte gesetzt */
itemsRouter.put('/:id', async (req, res) => {
  const visible = await requireManager(req);
  const existing = await prisma.magicItem.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound();
  const input = validate(magicItemSchema, req.body);
  if (input.storyId) await requireStoryManage(req, input.storyId);
  await prisma.magicItem.update({ where: { id: existing.id }, data: { name: input.name, description: input.description, weight: input.weight, value: input.value, attunement: input.attunement } });
  const added = input.storyId ? await setStoryHolders(existing.id, input.storyId, input.holderIds) : [];
  await notifyReceived(existing.id, added, req.user!.username, req.user!.id);
  res.json({ item: toDto(await prisma.magicItem.findUniqueOrThrow({ where: { id: existing.id }, include: itemInclude }), visible) });
});

/** Nur die Besitzer innerhalb einer Geschichte setzen */
itemsRouter.put('/:id/holders', async (req, res) => {
  const visible = await requireManager(req);
  const existing = await prisma.magicItem.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound();
  const input = validate(itemHoldersSchema, req.body);
  await requireStoryManage(req, input.storyId);
  const added = await setStoryHolders(existing.id, input.storyId, input.holderIds);
  await notifyReceived(existing.id, added, req.user!.username, req.user!.id);
  res.json({ item: toDto(await prisma.magicItem.findUniqueOrThrow({ where: { id: existing.id }, include: itemInclude }), visible) });
});

itemsRouter.delete('/:id', async (req, res) => {
  await requireManager(req);
  const existing = await prisma.magicItem.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound();
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
  // Besitzer und Empfänger: nur innerhalb der Geschichte des Bogens
  const visible = new Set(c.storyId ? [c.storyId] : []);
  const targets = c.storyId
    ? await prisma.character.findMany({ where: { storyId: c.storyId, id: { not: c.id } }, select: characterRefSelect, orderBy: [{ user: { username: 'asc' } }, { name: 'asc' }] })
    : [];
  const body: CharacterItemsDto = { items: holdings.map((h) => toDto(h.item, visible)), canTransfer: canEdit, targets: targets.map(toRef) };
  res.json(body);
});

/** Weitergeben an einen anderen Bogen der Geschichte oder an den DM zurückgeben */
itemsRouter.post('/:id/transfer', async (req, res) => {
  const item = await prisma.magicItem.findUnique({ where: { id: String(req.params.id) }, include: { holders: true } });
  if (!item) throw notFound();
  const { fromCharacterId, toCharacterId } = validate(itemTransferSchema, req.body);
  const { c: from, canEdit } = await characterAccess(req, fromCharacterId);
  if (!canEdit) throw forbidden();
  if (!item.holders.some((h) => h.characterId === from.id)) throw badRequest('not_holder', 'Character does not hold this item');
  if (toCharacterId) {
    if (toCharacterId === from.id || !from.storyId) throw badRequest('invalid_target', 'Invalid target');
    const target = await prisma.character.findFirst({ where: { id: toCharacterId, storyId: from.storyId } });
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
  } else if (from.storyId) {
    // Zurück an den DM: Dungeon Master der Geschichte des Bogens informieren
    const story = await prisma.story.findUnique({ where: { id: from.storyId }, select: { name: true } });
    const dms = await prisma.storyMember.findMany({ where: { storyId: from.storyId, role: 'dm' }, select: { userId: true } });
    await notifyUsers(
      dms.map((d) => d.userId).filter((u) => u !== req.user!.id),
      'item_returned',
      { from: req.user!.username, character: fromName, item: item.name, story: story?.name ?? '', link: `/admin/items?story=${from.storyId}` },
    );
  }
  res.status(204).end();
});
