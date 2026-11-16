import { Router } from 'express';
import type { Character, User } from '@prisma/client';
import {
  characterSheetSchema,
  createCharacterSchema,
  isEditorRole,
  updateCharacterSchema,
  type CharacterDto,
  type CharacterSheet,
  type CharacterSummaryDto,
} from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { forbidden, notFound } from '../lib/errors';
import { requireAuth, requireEditor } from '../middleware/auth';

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

function toSummary(c: Character, owner?: Pick<User, 'id' | 'username'>): CharacterSummaryDto {
  return {
    id: c.id,
    name: c.name,
    classLevel: c.classLevel,
    race: c.race,
    level: c.level,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    ...(owner ? { owner: { id: owner.id, username: owner.username } } : {}),
  };
}

const summarySelect = { id: true, name: true, classLevel: true, race: true, level: true, createdAt: true, updatedAt: true, userId: true } as const;

/** Eigene Charaktere */
charactersRouter.get('/', async (req, res) => {
  const list = await prisma.character.findMany({
    where: { userId: req.user!.id },
    select: summarySelect,
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ characters: list.map((c) => toSummary(c as Character)) });
});

/** Alle Charaktere (Admin/DM) */
charactersRouter.get('/all', requireEditor, async (_req, res) => {
  const list = await prisma.character.findMany({
    select: { ...summarySelect, user: { select: { id: true, username: true } } },
    orderBy: [{ user: { username: 'asc' } }, { name: 'asc' }],
  });
  res.json({ characters: list.map((c) => toSummary(c as unknown as Character, c.user)) });
});

charactersRouter.post('/', async (req, res) => {
  const { name } = validate(createCharacterSchema, req.body ?? {});
  const count = await prisma.character.count({ where: { userId: req.user!.id } });
  if (count >= MAX_PER_USER) throw forbidden('too_many_characters', 'Character limit reached');
  const sheet = characterSheetSchema.parse({ identity: { name: name ?? '', playerName: req.user!.username } });
  const c = await prisma.character.create({
    data: { userId: req.user!.id, ...summaryFields(sheet), data: JSON.stringify(sheet) },
  });
  const body: CharacterDto = { ...toSummary(c), data: sheet, canEdit: true };
  res.status(201).json({ character: body });
});

async function loadReadable(id: string, user: User) {
  const c = await prisma.character.findUnique({ where: { id }, include: { user: { select: { id: true, username: true } } } });
  // Fremde Bögen gibt es für normale Benutzer „nicht“ (404 statt 403, verrät keine IDs)
  if (!c || (c.userId !== user.id && !isEditorRole(user.role))) throw notFound('character_not_found', 'Character not found');
  return c;
}

charactersRouter.get('/:id', async (req, res) => {
  const c = await loadReadable(String(req.params.id), req.user!);
  const body: CharacterDto = { ...toSummary(c, c.user), data: parseSheet(c.data), canEdit: c.userId === req.user!.id };
  res.json({ character: body });
});

charactersRouter.put('/:id', async (req, res) => {
  const c = await loadReadable(String(req.params.id), req.user!);
  if (c.userId !== req.user!.id) throw forbidden('read_only', 'Only the owner can edit this character');
  const { data } = validate(updateCharacterSchema, req.body);
  const updated = await prisma.character.update({
    where: { id: c.id },
    data: { ...summaryFields(data), data: JSON.stringify(data) },
  });
  const body: CharacterDto = { ...toSummary(updated), data, canEdit: true };
  res.json({ character: body });
});

charactersRouter.post('/:id/duplicate', async (req, res) => {
  const c = await loadReadable(String(req.params.id), req.user!);
  if (c.userId !== req.user!.id) throw forbidden('read_only', 'Only the owner can duplicate this character');
  const count = await prisma.character.count({ where: { userId: req.user!.id } });
  if (count >= MAX_PER_USER) throw forbidden('too_many_characters', 'Character limit reached');
  const sheet = parseSheet(c.data);
  sheet.identity.name = sheet.identity.name ? `${sheet.identity.name} (Kopie)` : '';
  const copy = await prisma.character.create({
    data: { userId: req.user!.id, ...summaryFields(sheet), data: JSON.stringify(sheet) },
  });
  res.status(201).json({ character: { ...toSummary(copy), data: sheet, canEdit: true } satisfies CharacterDto });
});

charactersRouter.delete('/:id', async (req, res) => {
  const c = await loadReadable(String(req.params.id), req.user!);
  if (c.userId !== req.user!.id) throw forbidden('read_only', 'Only the owner can delete this character');
  await prisma.character.delete({ where: { id: c.id } });
  res.status(204).end();
});
