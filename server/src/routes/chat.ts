import { Router } from 'express';
import type { ChatMessage } from '@prisma/client';
import { chatDiceSchema, chatEditSchema, chatGroupInputSchema, chatMessageInputSchema, type ChatContactDto, type ChatGroupDto, type ChatMessageDto, type ChatStoryDto } from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { roleFromMembership, visibleStoryWhere } from '../lib/stories';
import { publishToUsers } from '../lib/events';

/**
 * Chat je Geschichte: private Zweiergespräche zwischen Mitgliedern (Spieler ↔ DM, Spieler ↔ Spieler).
 * Nur die beiden Beteiligten sehen ein Gespräch – auch der DM liest Gespräche zwischen Spielern nicht mit.
 */
export const chatRouter = Router();
chatRouter.use(requireAuth);

const MAX_PAGE = 200;

type MessageWithSender = ChatMessage & { sender?: { username: string } | null };
const withSender = { sender: { select: { username: true } } } as const;

function toDto(m: MessageWithSender): ChatMessageDto {
  let dice: ChatMessageDto['dice'] = null;
  if (m.kind === 'dice' && m.dice) {
    const parsed = chatDiceSchema.safeParse(JSON.parse(m.dice));
    dice = parsed.success ? parsed.data : null;
  }
  return {
    id: m.id,
    senderId: m.senderId,
    senderName: m.sender?.username ?? '',
    recipientId: m.recipientId,
    groupId: m.groupId,
    characterId: m.characterId,
    characterName: m.characterName,
    kind: m.kind === 'dice' ? 'dice' : 'text',
    body: m.deleted ? '' : m.body,
    dice: m.deleted ? null : dice,
    edited: m.edited,
    deleted: m.deleted,
    read: m.readAt !== null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

/** Geschichte, die der Benutzer sieht (Mitglied bzw. Admin), samt Mitgliedern */
async function loadStory(user: Express.Request['user'], storyId: string) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, ...visibleStoryWhere(user!) },
    include: { members: { include: { user: { select: { id: true, username: true, role: true } } } } },
  });
  if (!story) throw notFound('story_not_found', 'Story not found');
  return story;
}

/** Gespräch zwischen mir und einem anderen Mitglied der Geschichte */
const between = (storyId: string, me: string, other: string) => ({
  storyId,
  OR: [
    { senderId: me, recipientId: other },
    { senderId: other, recipientId: me },
  ],
});

/** Ungelesene Gruppennachrichten je Mitgliedschaft (Nachrichten anderer seit dem letzten Lesen) */
async function groupUnread(userId: string, storyId?: string) {
  const memberships = await prisma.chatGroupMember.findMany({ where: { userId, ...(storyId ? { group: { storyId } } : {}) }, select: { groupId: true, lastReadAt: true, group: { select: { storyId: true } } } });
  return Promise.all(
    memberships.map(async (m) => ({
      groupId: m.groupId,
      storyId: m.group.storyId,
      count: await prisma.chatMessage.count({ where: { groupId: m.groupId, senderId: { not: userId }, deleted: false, createdAt: { gt: m.lastReadAt } } }),
    })),
  );
}

const groupInclude = { members: { orderBy: { joinedAt: 'asc' }, include: { user: { select: { id: true, username: true, role: true } } } } } as const;

/** Verwalten darf der Ersteller; ist er nicht mehr dabei, das am längsten dabei befindliche Mitglied */
function managerId(g: { createdById: string | null; members: { userId: string }[] }) {
  return g.createdById && g.members.some((m) => m.userId === g.createdById) ? g.createdById : (g.members[0]?.userId ?? null);
}

/** Gruppe laden – nur für Mitglieder (sonst 404, damit fremde Gruppen verborgen bleiben) */
async function loadGroup(user: Express.Request['user'], id: string) {
  const g = await prisma.chatGroup.findUnique({ where: { id }, include: { ...groupInclude, story: { include: { members: true } } } });
  if (!g || !g.members.some((m) => m.userId === user!.id)) throw notFound('chat_group_not_found', 'Group not found');
  // Wer die Geschichte nicht (mehr) sieht, sieht auch ihre Gruppen nicht
  await loadStory(user, g.storyId);
  return g;
}

/** Gültige weitere Mitglieder: Mitglieder der Geschichte außer mir */
function validMemberIds(story: { members: { userId: string }[] }, ids: string[], me: string) {
  const allowed = new Set(story.members.map((m) => m.userId));
  const unique = [...new Set(ids)].filter((id) => id !== me);
  if (unique.some((id) => !allowed.has(id))) throw badRequest('chat_group_member_invalid', 'Members must belong to the story');
  return unique;
}

/** Ungelesene Nachrichten (für das Symbol in der Kopfzeile) */
chatRouter.get('/unread', async (req, res) => {
  const me = req.user!.id;
  const rows = await prisma.chatMessage.groupBy({ by: ['storyId'], where: { recipientId: me, readAt: null, deleted: false }, _count: { _all: true } });
  const byStory: Record<string, number> = Object.fromEntries(rows.map((r) => [r.storyId, r._count._all]));
  for (const g of await groupUnread(me)) if (g.count) byStory[g.storyId] = (byStory[g.storyId] ?? 0) + g.count;
  res.json({ total: Object.values(byStory).reduce((n, c) => n + c, 0), byStory });
});

/** Gesprächspartner einer Geschichte mit letzter Nachricht und Ungelesenen, eigene Charaktere */
chatRouter.get('/stories/:storyId', async (req, res) => {
  const me = req.user!;
  const story = await loadStory(me, String(req.params.storyId));
  const others = story.members.filter((m) => m.userId !== me.id);
  const [unread, characters] = await Promise.all([
    prisma.chatMessage.groupBy({ by: ['senderId'], where: { storyId: story.id, recipientId: me.id, readAt: null, deleted: false }, _count: { _all: true } }),
    prisma.character.findMany({ where: { storyId: story.id, userId: me.id }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  const contacts: ChatContactDto[] = await Promise.all(
    others.map(async (m) => {
      const last = await prisma.chatMessage.findFirst({ where: between(story.id, me.id, m.userId), orderBy: { createdAt: 'desc' } });
      return {
        userId: m.userId,
        username: m.user.username,
        role: roleFromMembership(m.user, m.role),
        unread: unread.find((u) => u.senderId === m.userId)?._count._all ?? 0,
        last: last ? { body: last.deleted ? '' : last.kind === 'dice' ? `🎲 ${last.body || ''}`.trim() : last.body.slice(0, 120), at: last.createdAt.toISOString(), mine: last.senderId === me.id } : null,
      };
    }),
  );
  // Zuletzt aktive Gespräche zuerst, dann DM vor Spielern, dann Name
  contacts.sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? '') || Number(b.role === 'dm') - Number(a.role === 'dm') || a.username.localeCompare(b.username));
  const roleOf = new Map(story.members.map((m) => [m.userId, m.role]));
  const [groups, gUnread] = await Promise.all([
    prisma.chatGroup.findMany({ where: { storyId: story.id, members: { some: { userId: me.id } } }, include: groupInclude }),
    groupUnread(me.id, story.id),
  ]);
  const groupDtos: ChatGroupDto[] = await Promise.all(
    groups.map(async (g) => {
      const last = await prisma.chatMessage.findFirst({ where: { groupId: g.id }, orderBy: { createdAt: 'desc' }, include: withSender });
      return {
        id: g.id,
        name: g.name,
        createdById: g.createdById,
        canManage: managerId(g) === me.id,
        members: g.members.map((m) => ({ userId: m.userId, username: m.user.username, role: roleFromMembership(m.user, roleOf.get(m.userId)) })),
        unread: gUnread.find((u) => u.groupId === g.id)?.count ?? 0,
        last: last ? { body: last.deleted ? '' : last.kind === 'dice' ? `🎲 ${last.body || ''}`.trim() : last.body.slice(0, 120), at: last.createdAt.toISOString(), mine: last.senderId === me.id, sender: last.characterName || last.sender.username } : null,
      };
    }),
  );
  groupDtos.sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? '') || a.name.localeCompare(b.name));
  const body: ChatStoryDto = { storyId: story.id, archived: story.archived, contacts, groups: groupDtos, myCharacters: characters.map((c) => ({ id: c.id, name: c.name || '—' })) };
  res.json(body);
});

/** Porträts der Charaktere einer Geschichte (einmal beim Öffnen; für Nachrichten „als Charakter“) */
chatRouter.get('/stories/:storyId/portraits', async (req, res) => {
  const story = await loadStory(req.user, String(req.params.storyId));
  const chars = await prisma.character.findMany({ where: { storyId: story.id }, select: { id: true, data: true } });
  const portraits: Record<string, string> = {};
  for (const c of chars) {
    try {
      const p = (JSON.parse(c.data) as { portrait?: unknown }).portrait;
      if (typeof p === 'string' && p.startsWith('data:image/')) portraits[c.id] = p;
    } catch {
      /* ungültige Daten überspringen */
    }
  }
  res.json({ portraits });
});

function partner(story: Awaited<ReturnType<typeof loadStory>>, userId: string) {
  const m = story.members.find((x) => x.userId === userId);
  if (!m) throw notFound('chat_partner_not_found', 'Not a member of this story');
  return m;
}

/** Verlauf mit einem Mitglied; ?since=ISO liefert nur seither geänderte/neue Nachrichten. Markiert Empfangenes als gelesen. */
chatRouter.get('/stories/:storyId/with/:userId', async (req, res) => {
  const me = req.user!;
  const story = await loadStory(me, String(req.params.storyId));
  const other = partner(story, String(req.params.userId)).userId;
  const sinceRaw = typeof req.query.since === 'string' ? new Date(req.query.since) : null;
  const since = sinceRaw && !Number.isNaN(sinceRaw.getTime()) ? sinceRaw : null;
  const serverTime = new Date();
  const messages = since
    ? await prisma.chatMessage.findMany({ where: { ...between(story.id, me.id, other), updatedAt: { gt: since } }, orderBy: { createdAt: 'asc' }, take: MAX_PAGE, include: withSender })
    : (await prisma.chatMessage.findMany({ where: between(story.id, me.id, other), orderBy: { createdAt: 'desc' }, take: MAX_PAGE, include: withSender })).reverse();
  const read = await prisma.chatMessage.updateMany({ where: { storyId: story.id, senderId: other, recipientId: me.id, readAt: null }, data: { readAt: serverTime } });
  // Lesebestätigung live an den Absender
  if (read.count > 0) publishToUsers([other], { type: 'chat', storyId: story.id });
  res.json({ messages: messages.map(toDto), serverTime: serverTime.toISOString() });
});

chatRouter.post('/stories/:storyId/with/:userId', async (req, res) => {
  const me = req.user!;
  const story = await loadStory(me, String(req.params.storyId));
  if (story.archived) throw forbidden('story_archived', 'Story is archived');
  const other = partner(story, String(req.params.userId)).userId;
  if (other === me.id) throw badRequest('chat_self', 'Cannot chat with yourself');
  const m = await prisma.chatMessage.create({ data: { ...(await messageData(me.id, story.id, req.body)), recipientId: other }, include: withSender });
  publishToUsers([me.id, other], { type: 'chat', storyId: story.id });
  res.status(201).json({ message: toDto(m) });
});

/** Gemeinsame Felder einer neuen Nachricht; „als Charakter“ nur mit eigenen Charakteren der Geschichte */
async function messageData(me: string, storyId: string, raw: unknown) {
  const input = validate(chatMessageInputSchema, raw);
  const character = input.characterId ? await prisma.character.findFirst({ where: { id: input.characterId, userId: me, storyId }, select: { id: true, name: true } }) : null;
  if (input.characterId && !character) throw badRequest('chat_character_invalid', 'Character not available');
  return {
    storyId,
    senderId: me,
    characterId: character?.id ?? null,
    characterName: character?.name ?? '',
    kind: input.dice ? 'dice' : 'text',
    body: input.dice ? input.body.trim() || input.dice.expression : input.body.trim(),
    dice: input.dice ? JSON.stringify(input.dice) : '',
  };
}

/** Empfänger von Live-Signalen zu einer Nachricht: beide Gesprächspartner bzw. alle Gruppenmitglieder */
async function audience(m: Pick<ChatMessage, 'senderId' | 'recipientId' | 'groupId'>) {
  if (m.groupId) return (await prisma.chatGroupMember.findMany({ where: { groupId: m.groupId }, select: { userId: true } })).map((x) => x.userId);
  return [m.senderId, m.recipientId].filter((x): x is string => !!x);
}

async function ownMessage(userId: string, id: string) {
  const m = await prisma.chatMessage.findUnique({ where: { id }, include: { story: { select: { archived: true } } } });
  if (!m || m.senderId !== userId) throw notFound('chat_message_not_found', 'Message not found');
  if (m.groupId && !(await prisma.chatGroupMember.findUnique({ where: { groupId_userId: { groupId: m.groupId, userId } } }))) throw notFound('chat_message_not_found', 'Message not found');
  if (m.story.archived) throw forbidden('story_archived', 'Story is archived');
  return m;
}

/** Eigene Nachricht bearbeiten (nur Text, keine Würfe) */
chatRouter.put('/messages/:id', async (req, res) => {
  const m = await ownMessage(req.user!.id, String(req.params.id));
  if (m.deleted || m.kind !== 'text') throw badRequest('chat_not_editable', 'Message cannot be edited');
  const { body } = validate(chatEditSchema, req.body);
  const updated = await prisma.chatMessage.update({ where: { id: m.id }, data: { body, edited: true }, include: withSender });
  publishToUsers(await audience(m), { type: 'chat', storyId: m.storyId });
  res.json({ message: toDto(updated) });
});

/** Eigene Nachricht löschen (bleibt als „gelöscht“ im Verlauf sichtbar) */
chatRouter.delete('/messages/:id', async (req, res) => {
  const m = await ownMessage(req.user!.id, String(req.params.id));
  const updated = await prisma.chatMessage.update({ where: { id: m.id }, data: { deleted: true, body: '', dice: '' }, include: withSender });
  publishToUsers(await audience(m), { type: 'chat', storyId: m.storyId });
  res.json({ message: toDto(updated) });
});

// ---------------------------------------------------------------- Gruppen

/** Gruppe anlegen: jedes Mitglied der Geschichte; der Ersteller ist automatisch dabei */
chatRouter.post('/stories/:storyId/groups', async (req, res) => {
  const me = req.user!;
  const story = await loadStory(me, String(req.params.storyId));
  if (story.archived) throw forbidden('story_archived', 'Story is archived');
  // Nur echte Mitglieder (ein Admin ohne Mitgliedschaft kann niemanden „hinzuholen“)
  if (!story.members.some((m) => m.userId === me.id)) throw forbidden('chat_group_not_member', 'Only story members can create groups');
  const input = validate(chatGroupInputSchema, req.body);
  const others = validMemberIds(story, input.memberIds, me.id);
  if (others.length === 0) throw badRequest('chat_group_empty', 'Add at least one other member');
  const g = await prisma.chatGroup.create({
    data: { storyId: story.id, name: input.name, createdById: me.id, members: { create: [me.id, ...others].map((userId) => ({ userId })) } },
  });
  publishToUsers([me.id, ...others], { type: 'chat', storyId: story.id });
  res.status(201).json({ group: { id: g.id } });
});

/** Name/Mitglieder ändern: nur wer die Gruppe verwaltet */
chatRouter.put('/groups/:id', async (req, res) => {
  const me = req.user!;
  const g = await loadGroup(me, String(req.params.id));
  if (g.story.archived) throw forbidden('story_archived', 'Story is archived');
  if (managerId(g) !== me.id) throw forbidden('chat_group_forbidden', 'Only the group creator can change it');
  const input = validate(chatGroupInputSchema, req.body);
  const others = validMemberIds(g.story, input.memberIds, me.id);
  if (others.length === 0) throw badRequest('chat_group_empty', 'Add at least one other member');
  const wanted = new Set([me.id, ...others]);
  const before = g.members.map((m) => m.userId);
  await prisma.$transaction([
    prisma.chatGroup.update({ where: { id: g.id }, data: { name: input.name, createdById: me.id } }),
    prisma.chatGroupMember.deleteMany({ where: { groupId: g.id, userId: { notIn: [...wanted] } } }),
    ...[...wanted].filter((id) => !before.includes(id)).map((userId) => prisma.chatGroupMember.create({ data: { groupId: g.id, userId } })),
  ]);
  publishToUsers(new Set([...before, ...wanted]), { type: 'chat', storyId: g.storyId });
  res.json({ group: { id: g.id } });
});

/** Gruppe verlassen; die letzte Person löscht sie damit */
chatRouter.post('/groups/:id/leave', async (req, res) => {
  const me = req.user!;
  const g = await loadGroup(me, String(req.params.id));
  const rest = g.members.filter((m) => m.userId !== me.id);
  if (rest.length === 0) await prisma.chatGroup.delete({ where: { id: g.id } });
  else {
    await prisma.chatGroupMember.delete({ where: { groupId_userId: { groupId: g.id, userId: me.id } } });
    // Verwaltung geht an das am längsten dabei befindliche Mitglied
    if (managerId(g) === me.id) await prisma.chatGroup.update({ where: { id: g.id }, data: { createdById: rest[0].userId } });
  }
  publishToUsers(g.members.map((m) => m.userId), { type: 'chat', storyId: g.storyId });
  res.status(204).end();
});

/** Gruppe samt Verlauf löschen: nur wer sie verwaltet */
chatRouter.delete('/groups/:id', async (req, res) => {
  const me = req.user!;
  const g = await loadGroup(me, String(req.params.id));
  if (managerId(g) !== me.id) throw forbidden('chat_group_forbidden', 'Only the group creator can delete it');
  await prisma.chatGroup.delete({ where: { id: g.id } });
  publishToUsers(g.members.map((m) => m.userId), { type: 'chat', storyId: g.storyId });
  res.status(204).end();
});

/** Verlauf einer Gruppe (?since=ISO wie bei Zweiergesprächen); markiert als gelesen */
chatRouter.get('/groups/:id/messages', async (req, res) => {
  const me = req.user!;
  const g = await loadGroup(me, String(req.params.id));
  const sinceRaw = typeof req.query.since === 'string' ? new Date(req.query.since) : null;
  const since = sinceRaw && !Number.isNaN(sinceRaw.getTime()) ? sinceRaw : null;
  const serverTime = new Date();
  const messages = since
    ? await prisma.chatMessage.findMany({ where: { groupId: g.id, updatedAt: { gt: since } }, orderBy: { createdAt: 'asc' }, take: MAX_PAGE, include: withSender })
    : (await prisma.chatMessage.findMany({ where: { groupId: g.id }, orderBy: { createdAt: 'desc' }, take: MAX_PAGE, include: withSender })).reverse();
  await prisma.chatGroupMember.update({ where: { groupId_userId: { groupId: g.id, userId: me.id } }, data: { lastReadAt: serverTime } });
  res.json({ messages: messages.map(toDto), serverTime: serverTime.toISOString() });
});

chatRouter.post('/groups/:id/messages', async (req, res) => {
  const me = req.user!;
  const g = await loadGroup(me, String(req.params.id));
  if (g.story.archived) throw forbidden('story_archived', 'Story is archived');
  const m = await prisma.chatMessage.create({ data: { ...(await messageData(me.id, g.storyId, req.body)), groupId: g.id }, include: withSender });
  // eigene Nachricht gilt als gelesen
  await prisma.chatGroupMember.update({ where: { groupId_userId: { groupId: g.id, userId: me.id } }, data: { lastReadAt: m.createdAt } });
  publishToUsers(g.members.map((x) => x.userId), { type: 'chat', storyId: g.storyId });
  res.status(201).json({ message: toDto(m) });
});
