import { Router } from 'express';
import type { WikiEntry } from '@prisma/client';
import { classDataSchema, raceDataSchema, WIKI_KINDS, wikiEntrySchema, type WikiEntryDto, type WikiKind } from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { notFound } from '../lib/errors';
import { logger } from '../lib/logger';
import { requireAuth, requireEditor } from '../middleware/auth';
import { WIKI_SEED } from '../lib/wikiSeed';
import { phbSourceId, validSourceId } from './sources';

/**
 * Wiki: Völker und Klassen (SRD). Lesen: alle angemeldeten Benutzer; anlegen/bearbeiten/löschen: Admin und Moderator.
 */
export const wikiRouter = Router();
wikiRouter.use(requireAuth);

function parseData(kind: WikiKind, raw: string) {
  let json: unknown = {};
  try {
    json = JSON.parse(raw);
  } catch {
    /* leerer Datensatz */
  }
  return kind === 'race' ? raceDataSchema.parse(json) : classDataSchema.parse(json);
}

function toDto(e: WikiEntry): WikiEntryDto {
  const kind = (WIKI_KINDS as readonly string[]).includes(e.kind) ? (e.kind as WikiKind) : 'race';
  const base = { id: e.id, name: e.name, summary: e.summary, description: e.description, sourceId: e.sourceId, updatedAt: e.updatedAt.toISOString(), updatedBy: e.updatedBy };
  return kind === 'race' ? { ...base, kind, data: raceDataSchema.parse(parseData(kind, e.data)) } : { ...base, kind, data: classDataSchema.parse(parseData(kind, e.data)) };
}

/** Grundausstattung anlegen, wenn das Wiki leer ist */
export async function seedWiki() {
  if ((await prisma.wikiEntry.count()) > 0) return 0;
  const sourceId = await phbSourceId();
  for (const raw of WIKI_SEED) {
    const e = wikiEntrySchema.parse(raw);
    const data = e.kind === 'class' ? { ...e.data, subclasses: e.data.subclasses.map((s) => ({ ...s, sourceId: s.sourceId ?? sourceId })) } : e.data;
    await prisma.wikiEntry.create({ data: { kind: e.kind, name: e.name, summary: e.summary, description: e.description, sourceId, data: JSON.stringify(data) } });
  }
  logger.info(`${WIKI_SEED.length} Wiki-Einträge (SRD) angelegt.`);
  return WIKI_SEED.length;
}

/**
 * Unveränderte SRD-Klassen (nie bearbeitet): Unterklassen ohne Quelle übernehmen die Quelle der Klasse.
 * Läuft beim Start und ist idempotent.
 */
export async function backfillSubclassSources() {
  const rows = await prisma.wikiEntry.findMany({ where: { kind: 'class', updatedBy: null, sourceId: { not: null } } });
  let n = 0;
  for (const r of rows) {
    const data = classDataSchema.parse(parseData('class', r.data));
    if (!data.subclasses.some((s) => !s.sourceId)) continue;
    const next = { ...data, subclasses: data.subclasses.map((s) => ({ ...s, sourceId: s.sourceId ?? r.sourceId })) };
    await prisma.wikiEntry.update({ where: { id: r.id }, data: { data: JSON.stringify(next) } });
    n++;
  }
  return n;
}

/** Unbekannte Quellen bei Unterklassen verwerfen */
async function cleanSubclassSources<T extends { kind: string; data: unknown }>(e: T): Promise<T> {
  if (e.kind !== 'class') return e;
  const data = e.data as { subclasses: { sourceId: string | null }[] };
  const subclasses = await Promise.all(data.subclasses.map(async (s) => ({ ...s, sourceId: await validSourceId(s.sourceId) })));
  return { ...e, data: { ...data, subclasses } };
}

wikiRouter.get('/', async (_req, res) => {
  const list = await prisma.wikiEntry.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
  res.json({ entries: list.map(toDto) });
});

wikiRouter.post('/', requireEditor, async (req, res) => {
  const e = await cleanSubclassSources(validate(wikiEntrySchema, req.body));
  const row = await prisma.wikiEntry.create({
    data: { kind: e.kind, name: e.name, summary: e.summary, description: e.description, sourceId: await validSourceId(e.sourceId), data: JSON.stringify(e.data), updatedBy: req.user!.username },
  });
  res.status(201).json({ entry: toDto(row) });
});

wikiRouter.put('/:id', requireEditor, async (req, res) => {
  const existing = await prisma.wikiEntry.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound();
  const e = await cleanSubclassSources(validate(wikiEntrySchema, req.body));
  const row = await prisma.wikiEntry.update({
    where: { id: existing.id },
    data: { kind: e.kind, name: e.name, summary: e.summary, description: e.description, sourceId: await validSourceId(e.sourceId), data: JSON.stringify(e.data), updatedBy: req.user!.username },
  });
  res.json({ entry: toDto(row) });
});

wikiRouter.delete('/:id', requireEditor, async (req, res) => {
  const existing = await prisma.wikiEntry.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound();
  await prisma.wikiEntry.delete({ where: { id: existing.id } });
  res.status(204).end();
});
