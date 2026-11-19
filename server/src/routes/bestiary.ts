import { Router, type Request } from 'express';
import type { BestiaryEntry, MonsterTemplate, Prisma, User } from '@prisma/client';
import {
  bestiaryEntrySchema,
  monsterTemplateSchema,
  type BestiaryEntryDto,
  type DamageType,
  type BestiaryUserRef,
  type MonsterTemplateDto,
} from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { forbidden, notFound } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { isDmAnywhere, storyRole } from '../lib/stories';

/**
 * Monster-Datenbanken.
 * - /dm: Vorlagen – gemeinsam für alle, die in einer Geschichte Dungeon Master sind (und den Admin).
 * - /stories/:storyId: Spieler-Datenbank je Geschichte – Spieler der Geschichte lesen und bearbeiten,
 *   Dungeon Master der Geschichte (und der Admin ohne Spielerrolle) nur lesen.
 */
export const bestiaryRouter = Router();
bestiaryRouter.use(requireAuth);

const refSelect = { select: { id: true, username: true } } as const;
const include = { createdBy: refSelect, updatedBy: refSelect } satisfies Prisma.MonsterTemplateInclude;
type WithRefs<T> = T & { createdBy: Pick<User, 'id' | 'username'> | null; updatedBy: Pick<User, 'id' | 'username'> | null };
const ref = (u: Pick<User, 'id' | 'username'> | null): BestiaryUserRef | null => (u ? { id: u.id, username: u.username } : null);

function common(e: WithRefs<MonsterTemplate | BestiaryEntry>) {
  return {
    id: e.id,
    name: e.name,
    ac: e.ac,
    attack: e.attack,
    description: e.description,
    damageDice: e.damageDice,
    damageType: (e.damageType as DamageType | null) ?? null,
    createdBy: ref(e.createdBy),
    updatedBy: ref(e.updatedBy),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}
const toTemplateDto = (t: WithRefs<MonsterTemplate>): MonsterTemplateDto => ({ ...common(t), hp: t.hp });
const toEntryDto = (e: WithRefs<BestiaryEntry>): BestiaryEntryDto => ({ ...common(e), hp: e.hp, storyId: e.storyId });

const search = (q: unknown): Prisma.StringFilter | undefined => (typeof q === 'string' && q.trim() ? { contains: q.trim() } : undefined);

// ---------------------------------------------------------------- DM-Datenbank

bestiaryRouter.get('/dm', requireStoryDm, async (req, res) => {
  const name = search(req.query.q);
  const list = await prisma.monsterTemplate.findMany({ where: name ? { name } : {}, include, orderBy: { name: 'asc' } });
  res.json({ templates: list.map(toTemplateDto) });
});

bestiaryRouter.post('/dm', requireStoryDm, async (req, res) => {
  const input = validate(monsterTemplateSchema, req.body);
  const t = await prisma.monsterTemplate.create({ data: { ...input, createdById: req.user!.id, updatedById: req.user!.id }, include });
  res.status(201).json({ template: toTemplateDto(t) });
});

bestiaryRouter.put('/dm/:id', requireStoryDm, async (req, res) => {
  const id = String(req.params.id);
  if (!(await prisma.monsterTemplate.findUnique({ where: { id } }))) throw notFound();
  const input = validate(monsterTemplateSchema, req.body);
  const t = await prisma.monsterTemplate.update({ where: { id }, data: { ...input, updatedById: req.user!.id }, include });
  res.json({ template: toTemplateDto(t) });
});

bestiaryRouter.delete('/dm/:id', requireStoryDm, async (req, res) => {
  const id = String(req.params.id);
  if (!(await prisma.monsterTemplate.findUnique({ where: { id } }))) throw notFound();
  await prisma.monsterTemplate.delete({ where: { id } });
  res.status(204).end();
});

// ---------------------------------------------------------------- Spieler-Datenbank je Geschichte

/** Zugriff auf die Spieler-Datenbank einer Geschichte; ohne Leserecht 404 */
async function storyAccess(req: Request, storyId: string) {
  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story) throw notFound();
  // Rolle in der Geschichte: Spieler lesen und schreiben, Dungeon Master (und Admin ohne Spielerrolle) nur lesen
  const role = await storyRole(req.user!, storyId);
  if (!role) throw notFound();
  return { story, canWrite: role === 'player' };
}

/** DM-Datenbank: wer in irgendeiner Geschichte Dungeon Master ist (Admin immer) */
async function requireStoryDm(req: Request, _res: unknown, next: (err?: unknown) => void) {
  try {
    if (!(await isDmAnywhere(req.user!))) return next(forbidden());
    next();
  } catch (err) {
    next(err);
  }
}

bestiaryRouter.get('/stories/:storyId', async (req, res) => {
  const { story, canWrite } = await storyAccess(req, String(req.params.storyId));
  const name = search(req.query.q);
  const list = await prisma.bestiaryEntry.findMany({ where: { storyId: story.id, ...(name ? { name } : {}) }, include, orderBy: { name: 'asc' } });
  res.json({ entries: list.map(toEntryDto), canWrite });
});

bestiaryRouter.post('/stories/:storyId', async (req, res) => {
  const { story, canWrite } = await storyAccess(req, String(req.params.storyId));
  if (!canWrite) throw forbidden();
  const input = validate(bestiaryEntrySchema, req.body);
  const e = await prisma.bestiaryEntry.create({ data: { ...input, storyId: story.id, createdById: req.user!.id, updatedById: req.user!.id }, include });
  res.status(201).json({ entry: toEntryDto(e) });
});

async function loadEntry(req: Request, id: string) {
  const entry = await prisma.bestiaryEntry.findUnique({ where: { id } });
  if (!entry) throw notFound();
  const { canWrite } = await storyAccess(req, entry.storyId);
  if (!canWrite) throw forbidden();
  return entry;
}

bestiaryRouter.put('/entries/:id', async (req, res) => {
  const entry = await loadEntry(req, String(req.params.id));
  const input = validate(bestiaryEntrySchema, req.body);
  const e = await prisma.bestiaryEntry.update({ where: { id: entry.id }, data: { ...input, updatedById: req.user!.id }, include });
  res.json({ entry: toEntryDto(e) });
});

bestiaryRouter.delete('/entries/:id', async (req, res) => {
  const entry = await loadEntry(req, String(req.params.id));
  await prisma.bestiaryEntry.delete({ where: { id: entry.id } });
  res.status(204).end();
});
