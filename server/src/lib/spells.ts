import type { Prisma, Spell, SpellClassLink, SpellTranslation } from '@prisma/client';
import {
  LOCALES,
  spellInputSchema,
  type Locale,
  type SpellDto,
  type SpellInput,
  type SpellQuery,
  type SpellTranslationDto,
  type School,
  type SpellClass,
  type CastingTime,
  type DamageType,
} from '@zauberbuch/shared';
import { prisma } from './prisma';

export type SpellWithRelations = Spell & {
  translations: SpellTranslation[];
  classes: SpellClassLink[];
};

export const spellInclude = {
  translations: true,
  classes: true,
} satisfies Prisma.SpellInclude;

const normalize = (s: string) => s.toLocaleLowerCase('de-DE').normalize('NFC');

/** Sprachübergreifender Suchtext: Namen + Beschreibungen beider Sprachen + slug. */
export function buildSearchText(input: SpellInput): string {
  const parts: string[] = [input.slug.replace(/-/g, ' ')];
  for (const locale of LOCALES) {
    const t = input.translations[locale];
    if (!t) continue;
    parts.push(t.name, t.description);
    if (t.higherLevels) parts.push(t.higherLevels);
  }
  return normalize(parts.join('\n'));
}

function sortNames(input: SpellInput) {
  const de = input.translations.de?.name ?? input.translations.en?.name ?? input.slug;
  const en = input.translations.en?.name ?? input.translations.de?.name ?? input.slug;
  return { sortNameDe: normalize(de), sortNameEn: normalize(en) };
}

function spellData(input: SpellInput) {
  return {
    slug: input.slug,
    level: input.level,
    school: input.school,
    castingTime: input.castingTime,
    range: input.range,
    verbal: input.components.verbal,
    somatic: input.components.somatic,
    material: input.components.material,
    concentration: input.concentration,
    ritual: input.ritual,
    duration: input.duration,
    source: input.source,
    isHomebrew: input.isHomebrew,
    damageDice: input.damageDice ?? null,
    damageType: input.damageDice ? (input.damageType ?? null) : null,
    searchText: buildSearchText(input),
    ...sortNames(input),
  };
}

const emptyToNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

function translationRows(input: SpellInput) {
  return LOCALES.flatMap((locale) => {
    const t = input.translations[locale];
    if (!t) return [];
    return [
      {
        locale,
        name: t.name,
        materialDescription: emptyToNull(t.materialDescription),
        castingTimeText: emptyToNull(t.castingTimeText),
        rangeText: emptyToNull(t.rangeText),
        durationText: emptyToNull(t.durationText),
        description: t.description,
        higherLevels: emptyToNull(t.higherLevels),
      },
    ];
  });
}

export async function createSpell(input: SpellInput, tx: Prisma.TransactionClient = prisma) {
  return tx.spell.create({
    data: {
      ...spellData(input),
      translations: { create: translationRows(input) },
      classes: { create: [...new Set(input.classes)].map((className) => ({ className })) },
    },
    include: spellInclude,
  });
}

export async function updateSpell(
  id: string,
  input: SpellInput,
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.spellTranslation.deleteMany({ where: { spellId: id } });
  await tx.spellClassLink.deleteMany({ where: { spellId: id } });
  return tx.spell.update({
    where: { id },
    data: {
      ...spellData(input),
      translations: { create: translationRows(input) },
      classes: { create: [...new Set(input.classes)].map((className) => ({ className })) },
    },
    include: spellInclude,
  });
}

function translationDto(t: SpellTranslation, full: boolean): SpellTranslationDto {
  const dto: SpellTranslationDto = {
    name: t.name,
    materialDescription: t.materialDescription,
    castingTimeText: t.castingTimeText,
    rangeText: t.rangeText,
    durationText: t.durationText,
  };
  if (full) {
    dto.description = t.description;
    dto.higherLevels = t.higherLevels;
  }
  return dto;
}

export function toSpellDto(spell: SpellWithRelations, opts: { full?: boolean; isFavorite?: boolean } = {}): SpellDto {
  const translations: SpellDto['translations'] = {};
  for (const t of spell.translations) {
    if ((LOCALES as readonly string[]).includes(t.locale)) {
      translations[t.locale as Locale] = translationDto(t, opts.full ?? false);
    }
  }
  return {
    id: spell.id,
    slug: spell.slug,
    level: spell.level,
    school: spell.school as School,
    castingTime: spell.castingTime as CastingTime,
    range: spell.range,
    components: { verbal: spell.verbal, somatic: spell.somatic, material: spell.material },
    concentration: spell.concentration,
    ritual: spell.ritual,
    duration: spell.duration,
    classes: spell.classes.map((c) => c.className as SpellClass).sort(),
    source: spell.source,
    isHomebrew: spell.isHomebrew,
    damage: spell.damageDice && spell.damageType ? { dice: spell.damageDice, type: spell.damageType as DamageType } : null,
    translations,
    isFavorite: opts.isFavorite ?? false,
    createdAt: spell.createdAt.toISOString(),
    updatedAt: spell.updatedAt.toISOString(),
  };
}

/** Wandelt einen gespeicherten Zauber in das Import-/Exportformat (= SpellInput) um. */
export function toSpellInput(spell: SpellWithRelations): SpellInput {
  const translations: SpellInput['translations'] = {};
  for (const t of spell.translations) {
    if (t.locale !== 'de' && t.locale !== 'en') continue;
    translations[t.locale] = {
      name: t.name,
      materialDescription: t.materialDescription,
      castingTimeText: t.castingTimeText,
      rangeText: t.rangeText,
      durationText: t.durationText,
      description: t.description,
      higherLevels: t.higherLevels,
    };
  }
  return {
    slug: spell.slug,
    level: spell.level,
    school: spell.school as School,
    castingTime: spell.castingTime as CastingTime,
    range: spell.range,
    components: { verbal: spell.verbal, somatic: spell.somatic, material: spell.material },
    concentration: spell.concentration,
    ritual: spell.ritual,
    duration: spell.duration,
    classes: spell.classes.map((c) => c.className as SpellClass).sort(),
    source: spell.source,
    isHomebrew: spell.isHomebrew,
    damageDice: spell.damageDice,
    damageType: spell.damageType as DamageType | null,
    translations,
  };
}

export function buildSpellWhere(q: SpellQuery, userId?: string): Prisma.SpellWhereInput {
  const and: Prisma.SpellWhereInput[] = [];
  const terms = normalize(q.query).split(/\s+/).filter(Boolean).slice(0, 10);
  for (const term of terms) and.push({ searchText: { contains: term } });
  if (q.level.length) and.push({ level: { in: q.level } });
  if (q.school.length) and.push({ school: { in: q.school } });
  if (q.class.length) and.push({ classes: { some: { className: { in: q.class } } } });
  if (q.castingTime.length) and.push({ castingTime: { in: q.castingTime } });
  if (q.damageType.length) and.push({ damageType: { in: q.damageType } });
  if (q.concentration !== undefined) and.push({ concentration: q.concentration });
  if (q.ritual !== undefined) and.push({ ritual: q.ritual });
  if (q.verbal !== undefined) and.push({ verbal: q.verbal });
  if (q.somatic !== undefined) and.push({ somatic: q.somatic });
  if (q.material !== undefined) and.push({ material: q.material });
  if (q.homebrew !== undefined) and.push({ isHomebrew: q.homebrew });
  if (q.source) and.push({ source: q.source });
  if (q.favorites && userId) and.push({ favorites: { some: { userId } } });
  return and.length ? { AND: and } : {};
}

export function buildSpellOrderBy(q: SpellQuery, lang: Locale): Prisma.SpellOrderByWithRelationInput[] {
  const nameField = lang === 'en' ? 'sortNameEn' : 'sortNameDe';
  const dir = q.order;
  switch (q.sort) {
    case 'level':
      return [{ level: dir }, { [nameField]: 'asc' }];
    case 'school':
      return [{ school: dir }, { level: 'asc' }, { [nameField]: 'asc' }];
    default:
      return [{ [nameField]: dir }];
  }
}

export function parseSpellInput(raw: unknown) {
  return spellInputSchema.safeParse(raw);
}
