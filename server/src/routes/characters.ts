import express, { Router } from 'express';
import type { Character, User } from '@prisma/client';
import {
  CHARACTER_EXPORT_FORMAT,
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
} from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { forbidden, notFound } from '../lib/errors';
import { requireAdmin, requireAuth, requireEditor } from '../middleware/auth';

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

// ---------------------------------------------------------------- Export / Import (nur Admin)

charactersRouter.get('/export', requireAdmin, async (_req, res) => {
  const list = await prisma.character.findMany({
    include: { user: { select: { username: true } } },
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
}

async function analyzeImport(raw: unknown[], fallbackOwnerId: string | null): Promise<AnalyzedEntry[]> {
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  const byName = new Map(users.map((u) => [u.username.toLowerCase(), u]));
  const fallback = fallbackOwnerId ? users.find((u) => u.id === fallbackOwnerId) ?? null : null;
  const existing = await prisma.character.findMany({ select: { userId: true, name: true } });
  const taken = new Set(existing.map((c) => `${c.userId}\u0000${c.name.trim().toLowerCase()}`));

  return raw.map((entry, index) => {
    const e = (entry && typeof entry === 'object' ? entry : null) as { owner?: unknown; name?: unknown; data?: unknown } | null;
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
    return { item: { index, name, owner: ownerName, targetUser: target.username, status }, sheet, userId: target.id };
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
  await prisma.$transaction(
    toCreate.map((a) =>
      prisma.character.create({
        data: { userId: a.userId!, ...summaryFields(a.sheet!), data: JSON.stringify(a.sheet) },
      }),
    ),
  );
  result.created = toCreate.length;
  res.json(result);
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
