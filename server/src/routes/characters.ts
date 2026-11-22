import express, { Router } from 'express';
import type { Character, User } from '@prisma/client';
import {
  CHARACTER_EXPORT_FORMAT,
  MAX_ATTACKS,
  characterImportSchema,
  characterSheetSchema,
  createCharacterSchema,
  type CharacterExportFile,
  type CharacterImportPreview,
  type CharacterImportPreviewItem,
  type CharacterImportResult,
  isEditorRole,
  updateCharacterSchema,
  type CharacterDto,
  type CharacterSheet,
  type CharacterSummaryDto,
  type CharacterSettingsDto,
  characterSettingsSchema,
  parseLifestyles,
  storyOptionLists,
  lifestyleCost,
} from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { wikiGodNames, wikiLanguageNames } from './wiki';
import { validate } from '../lib/validate';
import { notifyUsers } from '../lib/notifications';
import { z } from 'zod';

const milestoneSchema = z.object({ level: z.number().int().min(2).max(20).nullable() });
import { badRequest, forbidden, notFound } from '../lib/errors';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { dmStoryIds, storyRole, visibleStoryWhere } from '../lib/stories';

/**
 * Charakterbögen: Jeder Benutzer verwaltet beliebig viele eigene Charaktere.
 * Admin und Dungeon Master dürfen alle Bögen lesen (nicht bearbeiten).
 */
export const charactersRouter = Router();

charactersRouter.use(requireAuth);

const MAX_PER_USER = 50;

function parseSheet(raw: string): CharacterSheet {
  try {
    return characterSheetSchema.parse(JSON.parse(raw));
  } catch {
    return characterSheetSchema.parse({});
  }
}

function summaryFields(sheet: CharacterSheet) {
  return {
    name: sheet.identity.name,
    classLevel: sheet.identity.classLevel,
    race: sheet.identity.race,
    level: sheet.identity.level,
  };
}

type WithStory = { story?: { id: string; name: string } | null };

function toSummary(c: Character & WithStory, owner?: Pick<User, 'id' | 'username'>): CharacterSummaryDto {
  return {
    id: c.id,
    name: c.name,
    classLevel: c.classLevel,
    race: c.race,
    level: c.level,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    ...(owner ? { owner: { id: owner.id, username: owner.username } } : {}),
    story: c.story ? { id: c.story.id, name: c.story.name } : null,
  };
}

const summarySelect = { id: true, name: true, classLevel: true, race: true, level: true, createdAt: true, updatedAt: true, userId: true, storyId: true, story: { select: { id: true, name: true } } } as const;

/** Eigene Charaktere und Bögen, bei denen man Mitbearbeiter ist */
charactersRouter.get('/', async (req, res) => {
  const [list, shared] = await Promise.all([
    prisma.character.findMany({ where: { userId: req.user!.id }, select: summarySelect, orderBy: { updatedAt: 'desc' } }),
    prisma.character.findMany({
      where: { editors: { some: { userId: req.user!.id } } },
      select: { ...summarySelect, user: { select: { id: true, username: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);
  res.json({
    characters: list.map((c) => toSummary(c as unknown as Character & WithStory)),
    shared: shared.map((c) => toSummary(c as unknown as Character & WithStory, c.user)),
  });
});

/** Fremde Bögen: Admin/Moderator alle, Dungeon Master einer Geschichte die Bögen ihrer Geschichten */
charactersRouter.get('/all', async (req, res) => {
  const where = isEditorRole(req.user!.role) ? {} : { storyId: { in: await dmStoryIds(req.user!) } };
  const list = await prisma.character.findMany({
    where,
    select: { ...summarySelect, user: { select: { id: true, username: true } } },
    orderBy: [{ user: { username: 'asc' } }, { name: 'asc' }],
  });
  res.json({ characters: list.map((c) => toSummary(c as unknown as Character & WithStory, c.user)) });
});

// ---------------------------------------------------------------- Export / Import (nur Admin)

charactersRouter.get('/export', requireAdmin, async (_req, res) => {
  const list = await prisma.character.findMany({
    include: { user: { select: { username: true } }, story: { select: { name: true } }, editors: { include: { user: { select: { username: true } } } } },
    orderBy: [{ user: { username: 'asc' } }, { name: 'asc' }],
  });
  const body: CharacterExportFile = {
    format: CHARACTER_EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    characters: list.map((c) => ({
      owner: c.user.username,
      name: c.name,
      createdAt: c.createdAt.toISOString(),
      data: parseSheet(c.data),
      story: c.story?.name ?? null,
      editors: c.editors.map((e) => e.user.username),
    })),
  };
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="zauberbuch-charaktere-${date}.json"`);
  res.json(body);
});

const largeJson = express.json({ limit: '100mb' });

interface AnalyzedEntry {
  item: CharacterImportPreviewItem;
  sheet?: CharacterSheet;
  userId?: string;
  storyName?: string | null;
  editorNames?: string[];
}

async function analyzeImport(raw: unknown[], fallbackOwnerId: string | null): Promise<AnalyzedEntry[]> {
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  const byName = new Map(users.map((u) => [u.username.toLowerCase(), u]));
  const fallback = fallbackOwnerId ? users.find((u) => u.id === fallbackOwnerId) ?? null : null;
  const existing = await prisma.character.findMany({ select: { userId: true, name: true } });
  const taken = new Set(existing.map((c) => `${c.userId}\u0000${c.name.trim().toLowerCase()}`));

  return raw.map((entry, index) => {
    const e = (entry && typeof entry === 'object' ? entry : null) as { owner?: unknown; name?: unknown; data?: unknown; story?: unknown; editors?: unknown } | null;
    const ownerName = typeof e?.owner === 'string' ? e.owner : null;
    if (!e || !e.data || typeof e.data !== 'object' || Array.isArray(e.data)) {
      return { item: { index, name: typeof e?.name === 'string' ? e.name : '', owner: ownerName, targetUser: null, status: 'invalid' } };
    }
    const sheet = characterSheetSchema.parse(e.data);
    const name = sheet.identity.name;
    const target = (ownerName && byName.get(ownerName.toLowerCase())) || fallback;
    if (!target) {
      return { item: { index, name, owner: ownerName, targetUser: null, status: 'no_owner' }, sheet };
    }
    const key = `${target.id}\u0000${name.trim().toLowerCase()}`;
    const status = taken.has(key) ? 'duplicate' : 'new';
    taken.add(key); // Dubletten innerhalb der Datei ebenfalls erkennen
    return {
      item: { index, name, owner: ownerName, targetUser: target.username, status },
      sheet,
      userId: target.id,
      storyName: typeof e.story === 'string' ? e.story : null,
      editorNames: Array.isArray(e.editors) ? e.editors.filter((x): x is string => typeof x === 'string').slice(0, 50) : [],
    };
  });
}

charactersRouter.post('/import/preview', requireAdmin, largeJson, async (req, res) => {
  const { characters, fallbackOwnerId } = validate(characterImportSchema, req.body);
  const analyzed = await analyzeImport(characters, fallbackOwnerId);
  const items = analyzed.map((a) => a.item);
  const count = (s: CharacterImportPreviewItem['status']) => items.filter((i) => i.status === s).length;
  const body: CharacterImportPreview = {
    items,
    summary: { total: items.length, new: count('new'), duplicate: count('duplicate'), no_owner: count('no_owner'), invalid: count('invalid') },
  };
  res.json(body);
});

charactersRouter.post('/import', requireAdmin, largeJson, async (req, res) => {
  const { characters, fallbackOwnerId, duplicates } = validate(characterImportSchema, req.body);
  const analyzed = await analyzeImport(characters, fallbackOwnerId);
  const result: CharacterImportResult = { created: 0, skipped: 0, invalid: 0 };
  const toCreate = analyzed.filter((a) => {
    if (a.item.status === 'invalid') {
      result.invalid++;
      return false;
    }
    if (a.item.status === 'no_owner' || (a.item.status === 'duplicate' && duplicates === 'skip')) {
      result.skipped++;
      return false;
    }
    return true;
  });
  const stories = await prisma.story.findMany({ select: { id: true, name: true } });
  const storyByName = new Map(stories.map((s) => [s.name.toLowerCase(), s.id]));
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  const userByName = new Map(users.map((u) => [u.username.toLowerCase(), u.id]));
  await prisma.$transaction(async (tx) => {
    for (const a of toCreate) {
      const storyId = a.storyName ? storyByName.get(a.storyName.toLowerCase()) ?? null : null;
      const editorIds = [...new Set((a.editorNames ?? []).map((n) => userByName.get(n.toLowerCase())).filter((id): id is string => !!id && id !== a.userId))];
      await tx.character.create({
        data: { userId: a.userId!, ...summaryFields(a.sheet!), data: JSON.stringify(a.sheet), storyId, editors: { create: editorIds.map((userId) => ({ userId })) } },
      });
    }
  });
  result.created = toCreate.length;
  res.json(result);
});

charactersRouter.post('/', async (req, res) => {
  const { name, storyId } = validate(createCharacterSchema, req.body ?? {});
  const count = await prisma.character.count({ where: { userId: req.user!.id } });
  if (count >= MAX_PER_USER) throw forbidden('too_many_characters', 'Character limit reached');
  // Nur Geschichten, die der Benutzer sieht (Mitglied bzw. Admin) und die nicht archiviert sind
  const story = storyId ? await prisma.story.findFirst({ where: { id: storyId, archived: false, ...visibleStoryWhere(req.user!) } }) : null;
  if (storyId && !story) throw badRequest('story_not_found', 'Story not found');
  const sheet = characterSheetSchema.parse({ identity: { name: name ?? '', playerName: req.user!.username } });
  const c = await prisma.character.create({
    data: { userId: req.user!.id, storyId: story?.id ?? null, ...summaryFields(sheet), data: JSON.stringify(sheet) },
  });
  const body: CharacterDto = {
    ...toSummary({ ...c, story: story ? { id: story.id, name: story.name } : null }),
    data: sheet,
    canEdit: true,
    canManageSettings: true,
    isOwner: true,
    isStoryDm: story ? (await storyRole(req.user!, story.id)) === 'dm' : false,
    milestoneLevel: null,
    ...storyOptionLists(story, { languages: await wikiLanguageNames(), gods: await wikiGodNames() }),
  };
  res.status(201).json({ character: body });
});

async function loadReadable(id: string, user: User) {
  const c = await prisma.character.findUnique({
    where: { id },
    include: { user: { select: { id: true, username: true } }, story: { select: { id: true, name: true, lifestyles: true, languages: true, tools: true, gods: true, sources: true } }, editors: { select: { userId: true } } },
  });
  const isOwner = !!c && c.userId === user.id;
  const isCoEditor = !!c && c.editors.some((e) => e.userId === user.id);
  // Dungeon Master der zugeordneten Geschichte: lesen und Einstellungen ändern
  const isStoryDm = !!c?.storyId && (await storyRole(user, c.storyId)) === 'dm';
  const privileged = isEditorRole(user.role) || isStoryDm;
  // Fremde Bögen gibt es für normale Benutzer „nicht“ (404 statt 403, verrät keine IDs)
  if (!c || (!isOwner && !isCoEditor && !privileged)) throw notFound('character_not_found', 'Character not found');
  return { ...c, isOwner, isStoryDm, canEdit: isOwner || isCoEditor, canManageSettings: isOwner || privileged, wikiLanguages: await wikiLanguageNames(), wikiGods: await wikiGodNames() };
}

function toDto(c: Awaited<ReturnType<typeof loadReadable>>, data: CharacterSheet, updated?: Character): CharacterDto {
  return {
    ...toSummary({ ...(updated ?? c), story: c.story ? { id: c.story.id, name: c.story.name } : null }, c.user),
    data,
    canEdit: c.canEdit,
    canManageSettings: c.canManageSettings,
    isOwner: c.isOwner,
    isStoryDm: c.isStoryDm,
    milestoneLevel: (updated ?? c).milestoneLevel,
    ...storyOptionLists(c.story, { languages: c.wikiLanguages, gods: c.wikiGods }),
  };
}

/**
 * Meilenstein-Aufstieg freigeben (Dungeon Master der Geschichte des Bogens): { level } = Zielstufe (aktuelle Stufe + 1
 * bis 20) bzw. null zum Zurücknehmen. Der Besitzer wird benachrichtigt und führt den Aufstieg im Bogen selbst durch.
 */
charactersRouter.put('/:id/milestone', async (req, res) => {
  const c = await loadReadable(String(req.params.id), req.user!);
  if (!c.isStoryDm) throw forbidden('not_story_dm', 'Only the Dungeon Master of the story can grant a milestone level');
  const { level } = validate(milestoneSchema, req.body);
  const current = parseSheet(c.data).identity.level;
  if (level !== null && (level <= current || level > 20)) throw badRequest('milestone_invalid', 'Level must be above the current level');
  const updated = await prisma.character.update({ where: { id: c.id }, data: { milestoneLevel: level } });
  if (level !== null && c.userId !== req.user!.id) {
    await notifyUsers([c.userId], 'milestone_granted', { dm: req.user!.username, character: c.name || '—', level: String(level), link: `/characters/${c.id}` });
  }
  res.json({ character: toDto(c, parseSheet(c.data), updated) });
});

charactersRouter.get('/:id', async (req, res) => {
  const c = await loadReadable(String(req.params.id), req.user!);
  res.json({ character: toDto(c, parseSheet(c.data)) });
});

charactersRouter.put('/:id', async (req, res) => {
  const c = await loadReadable(String(req.params.id), req.user!);
  if (!c.canEdit) throw forbidden('read_only', 'Only the owner and co-editors can edit this character');
  const { data } = validate(updateCharacterSchema, req.body);
  // Höchstens MAX_ATTACKS Angriffe – Bögen, die schon mehr haben, behalten sie, dürfen aber nicht weiter wachsen
  if (data.attacks.length > MAX_ATTACKS) {
    const stored = parseSheet(c.data).attacks.length;
    if (data.attacks.length > Math.max(MAX_ATTACKS, stored)) {
      throw badRequest('too_many_attacks', `At most ${MAX_ATTACKS} attacks allowed`);
    }
  }
  // Tägliche Kosten kommen aus der Lebensstil-Tabelle (Geschichte bzw. Standardwerte)
  const cost = data.lifestyle.name ? lifestyleCost(parseLifestyles(c.story?.lifestyles), data.lifestyle.name) : null;
  if (cost !== null) data.lifestyle.dailyCost = cost;
  const updated = await prisma.character.update({
    where: { id: c.id },
    // Freigegebener Meilenstein ist erledigt, sobald die Stufe erreicht ist
    data: { ...summaryFields(data), data: JSON.stringify(data), ...(c.milestoneLevel !== null && data.identity.level >= c.milestoneLevel ? { milestoneLevel: null } : {}) },
  });
  res.json({ character: toDto(c, data, updated) });
});

charactersRouter.post('/:id/duplicate', async (req, res) => {
  const c = await loadReadable(String(req.params.id), req.user!);
  if (c.userId !== req.user!.id) throw forbidden('read_only', 'Only the owner can duplicate this character');
  const count = await prisma.character.count({ where: { userId: req.user!.id } });
  if (count >= MAX_PER_USER) throw forbidden('too_many_characters', 'Character limit reached');
  const sheet = parseSheet(c.data);
  sheet.identity.name = sheet.identity.name ? `${sheet.identity.name} (Kopie)` : '';
  const copy = await prisma.character.create({
    data: { userId: req.user!.id, ...summaryFields(sheet), data: JSON.stringify(sheet), storyId: c.storyId },
    include: { story: { select: { id: true, name: true, lifestyles: true, languages: true, tools: true, gods: true } } },
  });
  res.status(201).json({
    character: {
      ...toSummary({ ...copy, story: copy.story ? { id: copy.story.id, name: copy.story.name } : null }),
      data: sheet,
      canEdit: true,
      canManageSettings: true,
      isOwner: true,
      isStoryDm: copy.storyId ? (await storyRole(req.user!, copy.storyId)) === 'dm' : false,
      milestoneLevel: null,
      ...storyOptionLists(copy.story, { languages: await wikiLanguageNames(), gods: await wikiGodNames() }),
    } satisfies CharacterDto,
  });
});

charactersRouter.delete('/:id', async (req, res) => {
  const c = await loadReadable(String(req.params.id), req.user!);
  if (c.userId !== req.user!.id) throw forbidden('read_only', 'Only the owner can delete this character');
  await prisma.character.delete({ where: { id: c.id } });
  res.status(204).end();
});

// ---------------------------------------------------------------- Einstellungen (Besitzer, DM, Admin)

async function settingsDto(characterId: string, ownerId: string): Promise<CharacterSettingsDto> {
  const [c, stories, users] = await Promise.all([
    prisma.character.findUniqueOrThrow({ where: { id: characterId }, include: { editors: { include: { user: { select: { id: true, username: true } } } } } }),
    prisma.story.findMany({ where: { archived: false }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { id: { not: ownerId } }, select: { id: true, username: true }, orderBy: { username: 'asc' } }),
  ]);
  return {
    storyId: c.storyId,
    editors: c.editors.map((e) => ({ id: e.user.id, username: e.user.username })).sort((a, b) => a.username.localeCompare(b.username)),
    options: { stories, users },
  };
}

charactersRouter.get('/:id/settings', async (req, res) => {
  const c = await loadReadable(String(req.params.id), req.user!);
  if (!c.canManageSettings) throw forbidden();
  res.json({ settings: await settingsDto(c.id, c.userId) });
});

/**
 * Mitbearbeiter und Geschichte setzen. Wird eine Geschichte zugeordnet, wird der Besitzer automatisch Mitspieler
 * (beim Entfernen der Zuordnung bleibt die Mitgliedschaft bestehen – der DM verwaltet sie auf der Infotafel).
 */
charactersRouter.put('/:id/settings', async (req, res) => {
  const c = await loadReadable(String(req.params.id), req.user!);
  if (!c.canManageSettings) throw forbidden();
  const input = validate(characterSettingsSchema, req.body);
  if (input.storyId) {
    const story = await prisma.story.findUnique({ where: { id: input.storyId } });
    if (!story || (story.archived && story.id !== c.storyId)) throw badRequest('story_not_found', 'Story not found');
  }
  const editorIds = [...new Set(input.editorIds)].filter((id) => id !== c.userId);
  const valid = await prisma.user.findMany({ where: { id: { in: editorIds } }, select: { id: true } });
  await prisma.$transaction(async (tx) => {
    await tx.character.update({ where: { id: c.id }, data: { storyId: input.storyId } });
    await tx.characterEditor.deleteMany({ where: { characterId: c.id } });
    if (valid.length) await tx.characterEditor.createMany({ data: valid.map((u) => ({ characterId: c.id, userId: u.id })) });
    if (input.storyId) {
      await tx.storyMember.upsert({
        where: { storyId_userId: { storyId: input.storyId, userId: c.userId } },
        create: { storyId: input.storyId, userId: c.userId },
        update: {},
      });
    }
  });
  res.json({ settings: await settingsDto(c.id, c.userId) });
});
