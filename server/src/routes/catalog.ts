import { Router, type Request } from 'express';
import type { CatalogItem, Prisma } from '@prisma/client';
import { catalogItemSchema, type CatalogCategory, type CatalogItemDto, type CatalogOrigin, type DamageType } from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { badRequest, notFound } from '../lib/errors';
import { requireAuth, requireEditor } from '../middleware/auth';
import { CATALOG_SEED } from '../lib/catalogSeed';
import { logger } from '../lib/logger';

/**
 * Gegenstands-Katalog (Rüstung, Waffen, Gegenstände).
 * - Standard-Datenbank: storyId = null, bearbeiten Admin und Moderator.
 * - Geschichte: erbt den Standard live; Anpassungen (baseId gesetzt) überdecken bzw. blenden Standard-Einträge aus,
 *   eigene Einträge (baseId = null) kommen hinzu. Verwaltung über „Geschichte bearbeiten“ (Admin/Moderator).
 * - Lesen (wirksame Liste): alle angemeldeten Benutzer – der Charakterbogen nutzt die Liste seiner Geschichte.
 */
export const catalogRouter = Router();
catalogRouter.use(requireAuth);

function toDto(i: CatalogItem, origin: CatalogOrigin, extra: Partial<CatalogItemDto> = {}): CatalogItemDto {
  return {
    id: i.id,
    category: i.category as CatalogCategory,
    name: i.name,
    description: i.description,
    weight: i.weight,
    value: i.value,
    ac: i.ac,
    strength: i.strength,
    damage: i.damageDice && i.damageType ? { dice: i.damageDice, type: i.damageType as DamageType } : null,
    origin,
    baseId: i.baseId,
    ...extra,
  };
}

const sortByName = (a: CatalogItemDto, b: CatalogItemDto) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });

/** Wirksame Liste einer Geschichte (bzw. Standard); includeHidden für die Verwaltung */
export async function effectiveCatalog(storyId: string | null, includeHidden = false): Promise<CatalogItemDto[]> {
  const standard = await prisma.catalogItem.findMany({ where: { storyId: null } });
  if (!storyId) return standard.map((i) => toDto(i, 'standard')).sort(sortByName);
  const rows = await prisma.catalogItem.findMany({ where: { storyId } });
  const byBase = new Map(rows.filter((r) => r.baseId).map((r) => [r.baseId!, r]));
  const result: CatalogItemDto[] = [];
  for (const s of standard) {
    const o = byBase.get(s.id);
    if (!o) result.push(toDto(s, 'standard'));
    else if (o.hidden) {
      if (includeHidden) result.push(toDto(s, 'standard', { hidden: true }));
    } else result.push({ ...toDto(o, 'override'), id: o.id });
  }
  for (const r of rows.filter((x) => !x.baseId)) result.push(toDto(r, 'story'));
  return result.sort(sortByName);
}

function data(input: ReturnType<typeof catalogItemSchema.parse>) {
  return {
    category: input.category,
    name: input.name,
    description: input.description,
    weight: input.weight,
    value: input.value,
    ac: input.category === 'armor' ? input.ac : '',
    strength: input.category === 'armor' ? input.strength : null,
    damageDice: input.category === 'armor' ? null : input.damageDice,
    damageType: input.category === 'armor' ? null : input.damageType,
  };
}

/** Grundausstattung anlegen, wenn die Standard-Datenbank leer ist */
export async function seedCatalog(force = false) {
  const count = await prisma.catalogItem.count({ where: { storyId: null } });
  if (count > 0 && !force) return 0;
  await prisma.catalogItem.createMany({ data: CATALOG_SEED.map((i) => ({ ...i, storyId: null })) });
  logger.info(`${CATALOG_SEED.length} Standard-Gegenstände angelegt.`);
  return CATALOG_SEED.length;
}

// ---------------------------------------------------------------- Lesen

/** Wirksame Liste: ohne storyId die Standard-Datenbank */
catalogRouter.get('/', async (req, res) => {
  const storyId = typeof req.query.storyId === 'string' && req.query.storyId ? req.query.storyId : null;
  if (storyId && !(await prisma.story.findUnique({ where: { id: storyId }, select: { id: true } }))) throw notFound();
  res.json({ items: await effectiveCatalog(storyId) });
});

// ---------------------------------------------------------------- Standard-Datenbank (Admin/Moderator)

catalogRouter.post('/standard', requireEditor, async (req, res) => {
  const input = validate(catalogItemSchema, req.body);
  const item = await prisma.catalogItem.create({ data: { ...data(input), storyId: null } });
  res.status(201).json({ item: toDto(item, 'standard') });
});

async function loadRow(id: string) {
  const row = await prisma.catalogItem.findUnique({ where: { id } });
  if (!row) throw notFound();
  return row;
}

/** Eintrag ändern: Standard-Eintrag, eigener Eintrag einer Geschichte oder Anpassung */
catalogRouter.put('/:id', requireEditor, async (req, res) => {
  const row = await loadRow(String(req.params.id));
  if (row.hidden) throw badRequest('catalog_hidden', 'Hidden entries cannot be edited');
  const input = validate(catalogItemSchema, req.body);
  const item = await prisma.catalogItem.update({ where: { id: row.id }, data: data(input) });
  res.json({ item: toDto(item, row.storyId ? (row.baseId ? 'override' : 'story') : 'standard') });
});

/** Löschen: Standard-Eintrag (inkl. aller Anpassungen), eigener Eintrag oder Anpassung (= zurück zum Standard) */
catalogRouter.delete('/:id', requireEditor, async (req, res) => {
  const row = await loadRow(String(req.params.id));
  await prisma.catalogItem.delete({ where: { id: row.id } });
  res.status(204).end();
});

// ---------------------------------------------------------------- Geschichte (Admin/Moderator)

async function requireStory(req: Request) {
  const story = await prisma.story.findUnique({ where: { id: String(req.params.storyId) }, select: { id: true } });
  if (!story) throw notFound();
  return story.id;
}

async function requireStandard(id: string) {
  const base = await prisma.catalogItem.findUnique({ where: { id } });
  if (!base || base.storyId !== null) throw badRequest('catalog_not_standard', 'Not a standard entry');
  return base;
}

/** Verwaltungsansicht inkl. ausgeblendeter Standard-Einträge */
catalogRouter.get('/stories/:storyId', requireEditor, async (req, res) => {
  const storyId = await requireStory(req);
  res.json({ items: await effectiveCatalog(storyId, true) });
});

/** Eigener Eintrag der Geschichte */
catalogRouter.post('/stories/:storyId', requireEditor, async (req, res) => {
  const storyId = await requireStory(req);
  const input = validate(catalogItemSchema, req.body);
  const item = await prisma.catalogItem.create({ data: { ...data(input), storyId } });
  res.status(201).json({ item: toDto(item, 'story') });
});

/** Standard-Eintrag für diese Geschichte anpassen (legt die Anpassung an oder aktualisiert sie) */
catalogRouter.put('/stories/:storyId/override/:baseId', requireEditor, async (req, res) => {
  const storyId = await requireStory(req);
  const base = await requireStandard(String(req.params.baseId));
  const input = validate(catalogItemSchema, { ...req.body, category: base.category });
  const where: Prisma.CatalogItemWhereUniqueInput = { storyId_baseId: { storyId, baseId: base.id } };
  const item = await prisma.catalogItem.upsert({ where, create: { ...data(input), storyId, baseId: base.id }, update: { ...data(input), hidden: false } });
  res.json({ item: toDto(item, 'override') });
});

/** Standard-Eintrag in dieser Geschichte ausblenden */
catalogRouter.post('/stories/:storyId/hide/:baseId', requireEditor, async (req, res) => {
  const storyId = await requireStory(req);
  const base = await requireStandard(String(req.params.baseId));
  const { id: _id, createdAt: _c, updatedAt: _u, storyId: _s, baseId: _b, ...copy } = base;
  await prisma.catalogItem.upsert({
    where: { storyId_baseId: { storyId, baseId: base.id } },
    create: { ...copy, storyId, baseId: base.id, hidden: true },
    update: { hidden: true },
  });
  res.status(204).end();
});

/** Anpassung/Ausblendung entfernen – der Standard-Eintrag gilt wieder */
catalogRouter.delete('/stories/:storyId/override/:baseId', requireEditor, async (req, res) => {
  const storyId = await requireStory(req);
  await prisma.catalogItem.deleteMany({ where: { storyId, baseId: String(req.params.baseId) } });
  res.status(204).end();
});
