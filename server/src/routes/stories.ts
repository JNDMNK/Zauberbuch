import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { DEFAULT_LANGUAGES, DEFAULT_LIFESTYLES, DEFAULT_TOOLS, activeStorySchema, storyInputSchema, storyUpdateSchema, type StoryInput, type StoryRole, type StoryUpdate } from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { wikiLanguageNames } from './wiki';
import { validate } from '../lib/validate';
import { badRequest, notFound } from '../lib/errors';
import { notifyUsers } from '../lib/notifications';
import { requireAdmin, requireAuth, requireEditor } from '../middleware/auth';
import { toUserDto } from '../lib/users';
import { roleFromMembership, visibleStoryWhere } from '../lib/stories';
import { buildStoryDtos, storyInclude } from './board';

/**
 * Geschichten-Verwaltung (Verwaltung → Geschichten): Admin und Moderatoren legen Geschichten an und vergeben
 * Rollen (Spieler / Dungeon Master). Diese Rollen bestimmen, was jemand auf Infotafel und Kampf sieht.
 * Außerdem: Auswahl der aktiven Geschichte für die Geschichten-Ansicht (für alle Benutzer).
 */
export const storiesRouter = Router();
storiesRouter.use(requireAuth);

/** Alle Mitglieder aus den Eingabeformen zusammenführen (members hat Vorrang vor memberIds/dmIds) */
function normalizeMembers(input: Pick<StoryInput, 'members' | 'memberIds' | 'dmIds'> | Pick<StoryUpdate, 'members' | 'memberIds' | 'dmIds'>): Map<string, StoryRole> | null {
  if (!input.members && !input.memberIds && !input.dmIds) return null;
  const map = new Map<string, StoryRole>();
  for (const id of input.memberIds ?? []) map.set(id, 'player');
  for (const id of input.dmIds ?? []) map.set(id, 'dm');
  for (const m of input.members ?? []) map.set(m.userId, m.role);
  return map;
}

async function setMembers(tx: Prisma.TransactionClient, storyId: string, members: Map<string, StoryRole>) {
  const existing = await tx.user.findMany({ where: { id: { in: [...members.keys()] } }, select: { id: true } });
  const valid = existing.map((u) => u.id);
  await tx.storyMember.deleteMany({ where: { storyId, userId: { notIn: valid } } });
  for (const id of valid) {
    const role = members.get(id)!;
    await tx.storyMember.upsert({ where: { storyId_userId: { storyId, userId: id } }, create: { storyId, userId: id, role }, update: { role } });
  }
}

async function dto(user: Express.Request['user'], id: string) {
  const s = await prisma.story.findUniqueOrThrow({ where: { id }, include: storyInclude });
  return (await buildStoryDtos(user!, [s]))[0];
}

/** Verwaltung: alle Geschichten mit Mitgliedern und Rollen */
storiesRouter.get('/', requireEditor, async (req, res) => {
  const stories = await prisma.story.findMany({ orderBy: [{ archived: 'asc' }, { name: 'asc' }], include: storyInclude });
  res.json({ stories: await buildStoryDtos(req.user!, stories) });
});

/** Benutzerliste zur Auswahl der Mitglieder */
storiesRouter.get('/users', requireEditor, async (_req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, username: true, role: true }, orderBy: { username: 'asc' } });
  res.json({ users });
});

storiesRouter.post('/', requireEditor, async (req, res) => {
  const input = validate(storyInputSchema, req.body);
  const members = normalizeMembers(input) ?? new Map<string, StoryRole>();
  // Ein Moderator, der eine Geschichte anlegt, wird (sofern nicht anders angegeben) ihr Dungeon Master
  if (req.user!.role !== 'admin' && !members.has(req.user!.id)) members.set(req.user!.id, 'dm');
  // Neue Geschichten starten mit den Sprachen aus dem Wiki (der DM kann sie danach anpassen)
  const wikiLangs = await wikiLanguageNames();
  const story = await prisma.$transaction(async (tx) => {
    // Neue Geschichten erhalten die Standard-Lebensstile (anpassbar unter Verwaltung → Geschichten)
    const s = await tx.story.create({ data: { name: input.name, description: input.description, lifestyles: JSON.stringify(input.lifestyles ?? DEFAULT_LIFESTYLES), languages: JSON.stringify(input.languages ?? (wikiLangs.length ? wikiLangs : DEFAULT_LANGUAGES)), tools: JSON.stringify(input.tools ?? DEFAULT_TOOLS) } });
    await setMembers(tx, s.id, members);
    return s;
  });
  res.status(201).json({ story: await dto(req.user, story.id) });
});

storiesRouter.patch('/:id', requireEditor, async (req, res) => {
  const id = String(req.params.id);
  const story = await prisma.story.findUnique({ where: { id }, include: { members: true } });
  if (!story) throw notFound();
  const input = validate(storyUpdateSchema, req.body);
  const members = normalizeMembers(input);
  const me = req.user!;
  const before = story.members.find((m) => m.userId === me.id)?.role ?? null;
  await prisma.$transaction(async (tx) => {
    await tx.story.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.archived !== undefined ? { archived: input.archived } : {}),
        ...(input.lifestyles !== undefined ? { lifestyles: JSON.stringify(input.lifestyles) } : {}),
        ...(input.languages !== undefined ? { languages: JSON.stringify(input.languages) } : {}),
        ...(input.tools !== undefined ? { tools: JSON.stringify(input.tools) } : {}),
      },
    });
    if (members) await setMembers(tx, id, members);
  });
  // Admin gibt seine Spielerrolle auf (Wechsel zu DM oder ausgetragen) -> er sieht wieder alles: DMs informieren
  if (me.role === 'admin' && members && before === 'player' && members.get(me.id) !== 'player') {
    const dms = [...members.entries()].filter(([uid, role]) => role === 'dm' && uid !== me.id).map(([uid]) => uid);
    await notifyUsers(dms, 'admin_story_role_changed', { admin: me.username, story: input.name ?? story.name, link: `/board/${id}` });
  }
  res.json({ story: await dto(req.user, id) });
});

/** Geschichte samt Beiträgen und Kämpfen endgültig löschen – nur Admin */
storiesRouter.delete('/:id', requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  if (!(await prisma.story.findUnique({ where: { id } }))) throw notFound();
  await prisma.story.delete({ where: { id } });
  res.status(204).end();
});

// ---------------------------------------------------------------- Geschichten-Ansicht

/** Geschichten, auf die der Benutzer umschalten kann, inkl. eigener Rolle */
storiesRouter.get('/mine', async (req, res) => {
  const stories = await prisma.story.findMany({
    where: { archived: false, ...visibleStoryWhere(req.user!) },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, members: { where: { userId: req.user!.id }, select: { role: true } } },
  });
  res.json({ stories: stories.map((s) => ({ id: s.id, name: s.name, role: roleFromMembership(req.user!, s.members[0]?.role) })) });
});

/** Aktive Geschichte setzen (null = Allgemein) */
storiesRouter.put('/active', async (req, res) => {
  const { storyId } = validate(activeStorySchema, req.body);
  if (storyId) {
    const visible = await prisma.story.findFirst({ where: { id: storyId, archived: false, ...visibleStoryWhere(req.user!) }, select: { id: true } });
    if (!visible) throw badRequest('story_not_found', 'Story not found');
  }
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { activeStoryId: storyId } });
  res.json({ user: toUserDto(user) });
});

