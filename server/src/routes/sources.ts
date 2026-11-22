import { Router } from 'express';
import { sourceSchema, type SourceDto } from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { conflict, notFound } from '../lib/errors';
import { requireAuth, requireEditor } from '../middleware/auth';

/**
 * Quellen (Bücher): app-weit auswählbar. Lesen: alle angemeldeten Benutzer; pflegen: Admin und Moderator.
 * Zauber und Monster speichern die Quelle als Text (Name) – beim Umbenennen werden sie mitgezogen.
 */
export const sourcesRouter = Router();
sourcesRouter.use(requireAuth);

/** Gültige Quellen-id oder null (unbekannte ids werden verworfen) */
export async function validSourceId(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  return (await prisma.source.findUnique({ where: { id }, select: { id: true } }))?.id ?? null;
}

/** id der Quelle „Spielerhandbuch“ (für die SRD-Grundausstattung), falls vorhanden */
export async function phbSourceId(): Promise<string | null> {
  return (await prisma.source.findFirst({ where: { OR: [{ id: 'src_phb' }, { name: 'Spielerhandbuch' }] }, select: { id: true } }))?.id ?? null;
}

/** Quelle im Monster-Werteblock (JSON, Feld „source“) lesen */
function monsterSource(stats: string): string {
  try {
    const v = (JSON.parse(stats) as { source?: unknown }).source;
    return typeof v === 'string' ? v : '';
  } catch {
    return '';
  }
}

/** Monster (DM- und Spieler-Datenbanken), deren Werteblock die Quelle mit diesem Namen nennt */
async function monstersWithSource(name: string) {
  const like = { contains: JSON.stringify(name).slice(1, -1) };
  const [templates, entries] = await Promise.all([
    prisma.monsterTemplate.findMany({ where: { stats: like }, select: { id: true, stats: true } }),
    prisma.bestiaryEntry.findMany({ where: { stats: like }, select: { id: true, stats: true } }),
  ]);
  return { templates: templates.filter((r) => monsterSource(r.stats) === name), entries: entries.filter((r) => monsterSource(r.stats) === name) };
}

async function list(): Promise<SourceDto[]> {
  const rows = await prisma.source.findMany({ include: { _count: { select: { wikiEntries: true, catalogItems: true, magicItems: true } } }, orderBy: { name: 'asc' } });
  const spells = await prisma.spell.groupBy({ by: ['source'], _count: { _all: true } });
  const bySource = new Map(spells.map((s) => [s.source, s._count._all]));
  const monsters = new Map<string, number>();
  for (const m of [...(await prisma.monsterTemplate.findMany({ select: { stats: true } })), ...(await prisma.bestiaryEntry.findMany({ select: { stats: true } }))]) {
    const src = monsterSource(m.stats);
    if (src) monsters.set(src, (monsters.get(src) ?? 0) + 1);
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    abbreviation: r.abbreviation,
    usage: { wiki: r._count.wikiEntries, catalog: r._count.catalogItems, spells: bySource.get(r.name) ?? 0, monsters: monsters.get(r.name) ?? 0, magicItems: r._count.magicItems },
  }));
}

sourcesRouter.get('/', async (_req, res) => {
  res.json({ sources: await list() });
});

sourcesRouter.post('/', requireEditor, async (req, res) => {
  const input = validate(sourceSchema, req.body);
  if (await prisma.source.findUnique({ where: { name: input.name } })) throw conflict('source_exists', 'Source already exists');
  const s = await prisma.source.create({ data: input });
  res.status(201).json({ source: (await list()).find((x) => x.id === s.id) });
});

sourcesRouter.put('/:id', requireEditor, async (req, res) => {
  const existing = await prisma.source.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound();
  const input = validate(sourceSchema, req.body);
  const clash = await prisma.source.findUnique({ where: { name: input.name } });
  if (clash && clash.id !== existing.id) throw conflict('source_exists', 'Source already exists');
  await prisma.$transaction([
    prisma.source.update({ where: { id: existing.id }, data: input }),
    // Zauber verweisen über den Namen auf die Quelle
    ...(input.name !== existing.name ? [prisma.spell.updateMany({ where: { source: existing.name }, data: { source: input.name } })] : []),
  ]);
  // Monster-Werteblöcke verweisen ebenfalls über den Namen
  if (input.name !== existing.name) {
    const rename = (stats: string) => JSON.stringify({ ...(JSON.parse(stats) as object), source: input.name });
    const { templates, entries } = await monstersWithSource(existing.name);
    for (const r of templates) await prisma.monsterTemplate.update({ where: { id: r.id }, data: { stats: rename(r.stats) } });
    for (const r of entries) await prisma.bestiaryEntry.update({ where: { id: r.id }, data: { stats: rename(r.stats) } });
  }
  res.json({ source: (await list()).find((x) => x.id === existing.id) });
});

/** Löschen: Wiki-Einträge und Gegenstände verlieren die Quelle, Zauber behalten ihren Text */
sourcesRouter.delete('/:id', requireEditor, async (req, res) => {
  const existing = await prisma.source.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound();
  await prisma.source.delete({ where: { id: existing.id } });
  res.status(204).end();
});
