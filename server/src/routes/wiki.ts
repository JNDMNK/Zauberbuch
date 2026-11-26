import { Router } from 'express';
import type { WikiEntry } from '@prisma/client';
import { backgroundDataSchema, classDataSchema, featDataSchema, godDataSchema, languageDataSchema, raceDataSchema, ruleDataSchema, WIKI_KINDS, wikiEntrySchema, type WikiEntryDto, type WikiKind } from '@zauberbuch/shared';
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

function parseData(raw: string): unknown {
  let json: unknown = {};
  try {
    json = JSON.parse(raw);
  } catch {
    /* leerer Datensatz */
  }
  return json;
}

function toDto(e: WikiEntry): WikiEntryDto {
  const kind = (WIKI_KINDS as readonly string[]).includes(e.kind) ? (e.kind as WikiKind) : 'race';
  const base = { id: e.id, name: e.name, summary: e.summary, description: e.description, nameEn: e.nameEn, summaryEn: e.summaryEn, descriptionEn: e.descriptionEn, sourceId: e.sourceId, updatedAt: e.updatedAt.toISOString(), updatedBy: e.updatedBy };
  const json = parseData(e.data);
  switch (kind) {
    case 'class':
      return { ...base, kind, data: classDataSchema.parse(json) };
    case 'feat':
      return { ...base, kind, data: featDataSchema.parse(json) };
    case 'background':
      return { ...base, kind, data: backgroundDataSchema.parse(json) };
    case 'language':
      return { ...base, kind, data: languageDataSchema.parse(json) };
    case 'god':
      return { ...base, kind, data: godDataSchema.parse(json) };
    case 'rule':
      return { ...base, kind, data: ruleDataSchema.parse(json) };
    default:
      return { ...base, kind: 'race', data: raceDataSchema.parse(json) };
  }
}

/** Grundausstattung je Rubrik anlegen, solange eine Rubrik noch leer ist (z. B. neue Rubriken nach einem Update) */
export async function seedWiki() {
  const counts = await prisma.wikiEntry.groupBy({ by: ['kind'], _count: { _all: true } });
  const filled = new Set(counts.filter((c) => c._count._all > 0).map((c) => c.kind));
  const todo = WIKI_SEED.filter((e) => !filled.has(e.kind));
  if (todo.length === 0) return 0;
  const sourceId = await phbSourceId();
  for (const raw of todo) {
    const e = wikiEntrySchema.parse(raw);
    const data = e.kind === 'class' ? { ...e.data, subclasses: e.data.subclasses.map((s) => ({ ...s, sourceId: s.sourceId ?? sourceId })) } : e.data;
    await prisma.wikiEntry.create({ data: { kind: e.kind, name: e.name, summary: e.summary, description: e.description, sourceId, data: JSON.stringify(data) } });
  }
  logger.info(`${todo.length} Wiki-Einträge (SRD) angelegt.`);
  return todo.length;
}

/**
 * Unveränderte SRD-Klassen (nie bearbeitet): Unterklassen ohne Quelle übernehmen die Quelle der Klasse.
 * Läuft beim Start und ist idempotent.
 */
export async function backfillSubclassSources() {
  const rows = await prisma.wikiEntry.findMany({ where: { kind: 'class', updatedBy: null, sourceId: { not: null } } });
  let n = 0;
  for (const r of rows) {
    const data = classDataSchema.parse(parseData(r.data));
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

/**
 * Unveränderte SRD-Hintergründe: neue Felder (Attributswerte, Talent) aus der Grundausstattung nachtragen.
 * Läuft beim Start und ist idempotent.
 */
export async function backfillBackgroundFields() {
  let n = 0;
  // Talente: Kategorie
  for (const r of await prisma.wikiEntry.findMany({ where: { kind: 'feat', updatedBy: null } })) {
    const seed = WIKI_SEED.find((e) => e.kind === 'feat' && e.name === r.name);
    if (!seed || seed.kind !== 'feat') continue;
    const data = featDataSchema.parse(parseData(r.data));
    const s = featDataSchema.parse(seed.data);
    if (data.category || !s.category) continue;
    await prisma.wikiEntry.update({ where: { id: r.id }, data: { data: JSON.stringify({ ...data, category: s.category }) } });
    n++;
  }
  const rows = await prisma.wikiEntry.findMany({ where: { kind: 'background', updatedBy: null } });
  for (const r of rows) {
    const seed = WIKI_SEED.find((e) => e.kind === 'background' && e.name === r.name);
    if (!seed || seed.kind !== 'background') continue;
    const data = backgroundDataSchema.parse(parseData(r.data));
    const s = backgroundDataSchema.parse(seed.data);
    if ((data.abilityScores.length > 0 || s.abilityScores.length === 0) && (data.feat || !s.feat)) continue;
    const next = { ...data, abilityScores: data.abilityScores.length ? data.abilityScores : s.abilityScores, feat: data.feat || s.feat };
    await prisma.wikiEntry.update({ where: { id: r.id }, data: { data: JSON.stringify(next) } });
    n++;
  }
  return n;
}

/** Standard-Sprachen = Sprachen im Wiki (alphabetisch); ohne Wiki-Sprachen die eingebaute Liste */
export async function wikiLanguageNames(): Promise<string[]> {
  const rows = await prisma.wikiEntry.findMany({ where: { kind: 'language' }, select: { name: true } });
  return rows.map((r) => r.name).sort((a, b) => a.localeCompare(b, 'de'));
}

/** Standard-Götter = alle Götter im Wiki (alphabetisch) */
export async function wikiGodNames(): Promise<string[]> {
  const rows = await prisma.wikiEntry.findMany({ where: { kind: 'god' }, select: { name: true } });
  return rows.map((r) => r.name).sort((a, b) => a.localeCompare(b, 'de'));
}

wikiRouter.get('/', async (_req, res) => {
  const list = await prisma.wikiEntry.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
  res.json({ entries: list.map(toDto) });
});

wikiRouter.post('/', requireEditor, async (req, res) => {
  const e = await cleanSubclassSources(validate(wikiEntrySchema, req.body));
  const row = await prisma.wikiEntry.create({
    data: { kind: e.kind, name: e.name, summary: e.summary, description: e.description, nameEn: e.nameEn, summaryEn: e.summaryEn, descriptionEn: e.descriptionEn, sourceId: await validSourceId(e.sourceId), data: JSON.stringify(e.data), updatedBy: req.user!.username },
  });
  res.status(201).json({ entry: toDto(row) });
});

wikiRouter.put('/:id', requireEditor, async (req, res) => {
  const existing = await prisma.wikiEntry.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound();
  const e = await cleanSubclassSources(validate(wikiEntrySchema, req.body));
  const row = await prisma.wikiEntry.update({
    where: { id: existing.id },
    data: { kind: e.kind, name: e.name, summary: e.summary, description: e.description, nameEn: e.nameEn, summaryEn: e.summaryEn, descriptionEn: e.descriptionEn, sourceId: await validSourceId(e.sourceId), data: JSON.stringify(e.data), updatedBy: req.user!.username },
  });
  res.json({ entry: toDto(row) });
});

wikiRouter.delete('/:id', requireEditor, async (req, res) => {
  const existing = await prisma.wikiEntry.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound();
  await prisma.wikiEntry.delete({ where: { id: existing.id } });
  res.status(204).end();
});
