import {
  CASTING_TIMES,
  CLASSES,
  DAMAGE_TYPES,
  SCHOOLS,
  SORT_FIELDS,
  type CastingTime,
  type DamageType,
  type School,
  type SortField,
  type SpellClass,
} from '@zauberbuch/shared';

/** Drei Zustände für boolesche Filter: undefined = egal */
export type Tri = boolean | undefined;

export interface SpellFilters {
  q: string;
  level: number[];
  school: School[];
  class: SpellClass[];
  castingTime: CastingTime[];
  damageType: DamageType[];
  concentration: Tri;
  ritual: Tri;
  verbal: Tri;
  somatic: Tri;
  material: Tri;
  homebrew: Tri;
  source: string;
  favorites: boolean;
  sort: SortField;
  order: 'asc' | 'desc';
}

const csv = <T extends string>(value: string | null, allowed: readonly T[]): T[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is T => (allowed as readonly string[]).includes(s));

const tri = (value: string | null): Tri => (value === 'true' ? true : value === 'false' ? false : undefined);

export function parseFilters(sp: URLSearchParams): SpellFilters {
  const sort = sp.get('sort');
  return {
    q: sp.get('q') ?? '',
    level: (sp.get('level') ?? '')
      .split(',')
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 9),
    school: csv(sp.get('school'), SCHOOLS),
    class: csv(sp.get('class'), CLASSES),
    castingTime: csv(sp.get('castingTime'), CASTING_TIMES),
    damageType: csv(sp.get('damageType'), DAMAGE_TYPES),
    concentration: tri(sp.get('concentration')),
    ritual: tri(sp.get('ritual')),
    verbal: tri(sp.get('verbal')),
    somatic: tri(sp.get('somatic')),
    material: tri(sp.get('material')),
    homebrew: tri(sp.get('homebrew')),
    source: sp.get('source') ?? '',
    favorites: sp.get('favorites') === 'true',
    sort: (SORT_FIELDS as readonly string[]).includes(sort ?? '') ? (sort as SortField) : 'name',
    order: sp.get('order') === 'desc' ? 'desc' : 'asc',
  };
}

/** Serialisiert Filter in URL-Parameter (nur nicht-leere Werte, damit Links kurz bleiben). */
export function filtersToParams(f: SpellFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set('q', f.q.trim());
  if (f.level.length) sp.set('level', [...f.level].sort((a, b) => a - b).join(','));
  if (f.school.length) sp.set('school', f.school.join(','));
  if (f.class.length) sp.set('class', f.class.join(','));
  if (f.castingTime.length) sp.set('castingTime', f.castingTime.join(','));
  if (f.damageType.length) sp.set('damageType', f.damageType.join(','));
  for (const key of ['concentration', 'ritual', 'verbal', 'somatic', 'material', 'homebrew'] as const) {
    if (f[key] !== undefined) sp.set(key, String(f[key]));
  }
  if (f.source) sp.set('source', f.source);
  if (f.favorites) sp.set('favorites', 'true');
  if (f.sort !== 'name') sp.set('sort', f.sort);
  if (f.order !== 'asc') sp.set('order', f.order);
  return sp;
}

/** Wandelt UI-Filter in API-Parameter für GET /api/spells um. */
export function filtersToApiParams(f: SpellFilters, opts: { lang: string; page: number; pageSize: number; favoritesOnly?: boolean }) {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set('query', f.q.trim());
  if (f.level.length) sp.set('level', f.level.join(','));
  if (f.school.length) sp.set('school', f.school.join(','));
  if (f.class.length) sp.set('class', f.class.join(','));
  if (f.castingTime.length) sp.set('castingTime', f.castingTime.join(','));
  if (f.damageType.length) sp.set('damageType', f.damageType.join(','));
  for (const key of ['concentration', 'ritual', 'verbal', 'somatic', 'material', 'homebrew'] as const) {
    if (f[key] !== undefined) sp.set(key, String(f[key]));
  }
  if (f.source) sp.set('source', f.source);
  if (f.favorites || opts.favoritesOnly) sp.set('favorites', 'true');
  sp.set('sort', f.sort);
  sp.set('order', f.order);
  sp.set('lang', opts.lang);
  sp.set('page', String(opts.page));
  sp.set('pageSize', String(opts.pageSize));
  return sp;
}

export function countActiveFilters(f: SpellFilters, opts: { ignoreFavorites?: boolean } = {}): number {
  let n = f.level.length + f.school.length + f.class.length + f.castingTime.length + f.damageType.length;
  for (const key of ['concentration', 'ritual', 'verbal', 'somatic', 'material', 'homebrew'] as const) {
    if (f[key] !== undefined) n++;
  }
  if (f.source) n++;
  if (f.favorites && !opts.ignoreFavorites) n++;
  return n;
}

export function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
