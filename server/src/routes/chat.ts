import { Router } from 'express';
import type { ChatMessage } from '@prisma/client';
import { chatDiceSchema, chatEditSchema, chatMessageInputSchema, type ChatContactDto, type ChatMessageDto, type ChatStoryDto } from '@zauberbuch/shared';
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

function toDto(m: ChatMessage): ChatMessageDto {
  let dice: ChatMessageDto['dice'] = null;
  if (m.kind === 'dice' && m.dice) {
    const parsed = chatDiceSchema.safeParse(JSON.parse(m.dice));
    dice = parsed.success ? parsed.data : null;
  }
  return {
    id: m.id,
    senderId: m.senderId,
    recipientId: m.recipientId,
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

/** Ungelesene Nachrichten (für das Symbol in der Kopfzeile) */
chatRouter.get('/unread', async (req, res) => {
  const rows = await prisma.chatMessage.groupBy({ by: ['storyId'], where: { recipientId: req.user!.id, readAt: null, deleted: false }, _count: { _all: true } });
  const byStory = Object.fromEntries(rows.map((r) => [r.storyId, r._count._all]));
  res.json({ total: rows.reduce((n, r) => n + r._count._all, 0), byStory });
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
  const body: ChatStoryDto = { storyId: story.id, archived: story.archived, contacts, myCharacters: characters.map((c) => ({ id: c.id, name: c.name || '—' })) };
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
    ? await prisma.chatMessage.findMany({ where: { ...between(story.id, me.id, other), updatedAt: { gt: since } }, orderBy: { createdAt: 'asc' }, take: MAX_PAGE })
    : (await prisma.chatMessage.findMany({ where: between(story.id, me.id, other), orderBy: { createdAt: 'desc' }, take: MAX_PAGE })).reverse();
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
  const input = validate(chatMessageInputSchema, req.body);
  // „Als Charakter“: nur eigene Charaktere dieser Geschichte
  const character = input.characterId ? await prisma.character.findFirst({ where: { id: input.characterId, userId: me.id, storyId: story.id }, select: { id: true, name: true } }) : null;
  if (input.characterId && !character) throw badRequest('chat_character_invalid', 'Character not available');
  const m = await prisma.chatMessage.create({
    data: {
      storyId: story.id,
      senderId: me.id,
      recipientId: other,
      characterId: character?.id ?? null,
      characterName: character?.name ?? '',
      kind: input.dice ? 'dice' : 'text',
      body: input.dice ? input.body.trim() || input.dice.expression : input.body.trim(),
      dice: input.dice ? JSON.stringify(input.dice) : '',
    },
  });
  publishToUsers([me.id, other], { type: 'chat', storyId: story.id });
  res.status(201).json({ message: toDto(m) });
});

async function ownMessage(userId: string, id: string) {
  const m = await prisma.chatMessage.findUnique({ where: { id }, include: { story: { select: { archived: true } } } });
  if (!m || m.senderId !== userId) throw notFound('chat_message_not_found', 'Message not found');
  if (m.story.archived) throw forbidden('story_archived', 'Story is archived');
  return m;
}

/** Eigene Nachricht bearbeiten (nur Text, keine Würfe) */
chatRouter.put('/messages/:id', async (req, res) => {
  const m = await ownMessage(req.user!.id, String(req.params.id));
  if (m.deleted || m.kind !== 'text') throw badRequest('chat_not_editable', 'Message cannot be edited');
  const { body } = validate(chatEditSchema, req.body);
  const updated = await prisma.chatMessage.update({ where: { id: m.id }, data: { body, edited: true } });
  publishToUsers([m.senderId, m.recipientId], { type: 'chat', storyId: m.storyId });
  res.json({ message: toDto(updated) });
});

/** Eigene Nachricht löschen (bleibt als „gelöscht“ im Verlauf sichtbar) */
chatRouter.delete('/messages/:id', async (req, res) => {
  const m = await ownMessage(req.user!.id, String(req.params.id));
  const updated = await prisma.chatMessage.update({ where: { id: m.id }, data: { deleted: true, body: '', dice: '' } });
  publishToUsers([m.senderId, m.recipientId], { type: 'chat', storyId: m.storyId });
  res.json({ message: toDto(updated) });
});
