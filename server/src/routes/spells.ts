import { Router } from 'express';
import {
  spellImportSchema,
  spellInputSchema,
  spellQuerySchema,
  type ImportPreviewItem,
  type ImportPreviewResult,
  type ImportResult,
  type Locale,
  type PaginatedSpells,
  type SpellInput,
} from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { conflict, forbidden, notFound } from '../lib/errors';
import { requireAdmin, requireAuth, requireEditor, requireSpellWriter } from '../middleware/auth';
import {
  buildSpellOrderBy,
  buildSpellWhere,
  createSpell,
  spellInclude,
  toSpellDto,
  toSpellInput,
  updateSpell,
  storySpellWhere,
} from '../lib/spells';
import { config } from '../config';
import { isEditorRole } from '@zauberbuch/shared';

export const spellsRouter = Router();

// Ohne Anmeldung sind keine Zauberdaten sichtbar
spellsRouter.use(requireAuth);

async function favoriteIdsFor(userId: string | undefined, spellIds: string[]): Promise<Set<string>> {
  if (!userId || spellIds.length === 0) return new Set();
  const favs = await prisma.favorite.findMany({
    where: { userId, spellId: { in: spellIds } },
    select: { spellId: true },
  });
  return new Set(favs.map((f) => f.spellId));
}

spellsRouter.get('/', async (req, res) => {
  const q = validate(spellQuerySchema, req.query);
  if (q.owner && !isEditorRole(req.user!.role)) throw forbidden();
  const lang: Locale = q.lang ?? (req.user?.language as Locale | undefined) ?? config.defaultLanguage;
  const storyWhere = await storySpellWhere(q.story);
  const base = buildSpellWhere(q, req.user?.id);
  const where = storyWhere ? { AND: [base, storyWhere] } : base;
  const [total, spells] = await prisma.$transaction([
    prisma.spell.count({ where }),
    prisma.spell.findMany({
      where,
      include: spellInclude,
      orderBy: buildSpellOrderBy(q, lang),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  const favIds = await favoriteIdsFor(req.user?.id, spells.map((s) => s.id));
  const body: PaginatedSpells = {
    items: spells.map((s) => toSpellDto(s, { isFavorite: favIds.has(s.id) })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
  res.json(body);
});

/** Alle Zaubernamen (für Autovervollständigung im Charakterbogen) */
spellsRouter.get('/names', async (req, res) => {
  // ?story=… : nur Zauber aus den Quellen dieser Geschichte (Charakterbogen einer Geschichte)
  const storyWhere = await storySpellWhere(typeof req.query.story === 'string' && req.query.story ? req.query.story.slice(0, 64) : undefined);
  const spells = await prisma.spell.findMany({
    where: storyWhere ?? {},
    select: { slug: true, level: true, translations: { select: { locale: true, name: true } } },
    orderBy: { sortNameDe: 'asc' },
  });
  res.json({
    spells: spells.map((s) => ({
      slug: s.slug,
      level: s.level,
      de: s.translations.find((t) => t.locale === 'de')?.name ?? null,
      en: s.translations.find((t) => t.locale === 'en')?.name ?? null,
    })),
  });
});

spellsRouter.get('/sources', async (_req, res) => {
  const rows = await prisma.spell.findMany({
    distinct: ['source'],
    select: { source: true },
    orderBy: { source: 'asc' },
  });
  res.json({ sources: rows.map((r) => r.source) });
});

spellsRouter.get('/export', requireAdmin, async (_req, res) => {
  const spells = await prisma.spell.findMany({ include: spellInclude, orderBy: { slug: 'asc' } });
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="zauberbuch-export-${date}.json"`);
  res.json({
    format: 'zauberbuch-spells',
    version: 1,
    exportedAt: new Date().toISOString(),
    spells: spells.map(toSpellInput),
  });
});

function analyzeImport(rawSpells: unknown[], existingSlugs: Set<string>) {
  const seenInFile = new Set<string>();
  const valid: { index: number; input: SpellInput; duplicate: boolean }[] = [];
  const items: ImportPreviewItem[] = rawSpells.map((raw, index) => {
    const result = spellInputSchema.safeParse(raw);
    const r = (raw ?? {}) as { slug?: unknown; translations?: { de?: { name?: unknown }; en?: { name?: unknown } } };
    const slug = typeof r.slug === 'string' ? r.slug : null;
    const nameRaw = r.translations?.de?.name ?? r.translations?.en?.name;
    const name = typeof nameRaw === 'string' ? nameRaw : null;
    if (!result.success) {
      return {
        index,
        slug,
        name,
        status: 'invalid',
        errors: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
      };
    }
    if (seenInFile.has(result.data.slug)) {
      return { index, slug, name, status: 'invalid', errors: ['slug: duplicate_in_file'] };
    }
    seenInFile.add(result.data.slug);
    const duplicate = existingSlugs.has(result.data.slug);
    valid.push({ index, input: result.data, duplicate });
    return { index, slug, name, status: duplicate ? 'duplicate' : 'new' };
  });
  const summary = {
    total: items.length,
    new: items.filter((i) => i.status === 'new').length,
    duplicate: items.filter((i) => i.status === 'duplicate').length,
    invalid: items.filter((i) => i.status === 'invalid').length,
  };
  return { items, summary, valid };
}

async function existingSlugSet(): Promise<Set<string>> {
  const rows = await prisma.spell.findMany({ select: { slug: true } });
  return new Set(rows.map((r) => r.slug));
}

spellsRouter.post('/import/preview', requireAdmin, async (req, res) => {
  const { spells } = validate(spellImportSchema, req.body);
  const { items, summary } = analyzeImport(spells, await existingSlugSet());
  const body: ImportPreviewResult = { items, summary };
  res.json(body);
});

spellsRouter.post('/import', requireAdmin, async (req, res) => {
  const { spells, mode } = validate(spellImportSchema, req.body);
  const { valid, summary } = analyzeImport(spells, await existingSlugSet());
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, invalid: summary.invalid };
  await prisma.$transaction(
    async (tx) => {
      for (const { input, duplicate } of valid) {
        if (!duplicate) {
          await createSpell(input, tx);
          result.created++;
        } else if (mode === 'overwrite') {
          const existing = await tx.spell.findUniqueOrThrow({ where: { slug: input.slug } });
          await updateSpell(existing.id, input, tx);
          result.updated++;
        } else {
          result.skipped++;
        }
      }
    },
    { timeout: 120_000 },
  );
  res.json(result);
});

spellsRouter.get('/:slug', async (req, res) => {
  const spell = await prisma.spell.findUnique({
    where: { slug: String(req.params.slug) },
    include: spellInclude,
  });
  if (!spell) throw notFound('spell_not_found', 'Spell not found');
  const favIds = await favoriteIdsFor(req.user?.id, [spell.id]);
  res.json({ spell: toSpellDto(spell, { full: true, isFavorite: favIds.has(spell.id) }) });
});

spellsRouter.post('/', requireSpellWriter, async (req, res) => {
  const input = validate(spellInputSchema, req.body);
  if (await prisma.spell.findUnique({ where: { slug: input.slug } })) {
    throw conflict('slug_taken', 'A spell with this slug already exists');
  }
  const spell = await createSpell(input);
  res.status(201).json({ spell: toSpellDto(spell, { full: true }) });
});

spellsRouter.put('/:id', requireSpellWriter, async (req, res) => {
  const input = validate(spellInputSchema, req.body);
  const existing = await prisma.spell.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound('spell_not_found', 'Spell not found');
  if (input.slug !== existing.slug && (await prisma.spell.findUnique({ where: { slug: input.slug } }))) {
    throw conflict('slug_taken', 'A spell with this slug already exists');
  }
  const spell = await prisma.$transaction((tx) => updateSpell(existing.id, input, tx));
  res.json({ spell: toSpellDto(spell, { full: true }) });
});

spellsRouter.post('/:id/duplicate', requireSpellWriter, async (req, res) => {
  const existing = await prisma.spell.findUnique({ where: { id: String(req.params.id) }, include: spellInclude });
  if (!existing) throw notFound('spell_not_found', 'Spell not found');
  const input = toSpellInput(existing);
  let slug = `${existing.slug}-copy`;
  for (let i = 2; await prisma.spell.findUnique({ where: { slug } }); i++) {
    slug = `${existing.slug}-copy-${i}`;
  }
  input.slug = slug;
  for (const locale of ['de', 'en'] as const) {
    const t = input.translations[locale];
    if (t) t.name = `${t.name} (${locale === 'de' ? 'Kopie' : 'Copy'})`;
  }
  const spell = await createSpell(input);
  res.status(201).json({ spell: toSpellDto(spell, { full: true }) });
});

spellsRouter.delete('/:id', requireEditor, async (req, res) => {
  const existing = await prisma.spell.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw notFound('spell_not_found', 'Spell not found');
  await prisma.spell.delete({ where: { id: existing.id } });
  res.status(204).end();
});
