export const SCHOOLS = [
  'abjuration',
  'conjuration',
  'divination',
  'evocation',
  'illusion',
  'necromancy',
  'transmutation',
  'enchantment',
] as const;
export type School = (typeof SCHOOLS)[number];

export const CLASSES = [
  'bard',
  'druid',
  'warlock',
  'cleric',
  'wizard',
  'paladin',
  'ranger',
  'sorcerer',
  'artificer',
] as const;
export type SpellClass = (typeof CLASSES)[number];

/** Kategorien der Zauberzeit (für den Filter). Der Anzeigetext steht in castingTimeText. */
export const CASTING_TIMES = ['action', 'bonus_action', 'reaction', 'longer'] as const;
export type CastingTime = (typeof CASTING_TIMES)[number];

export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const ROLES = ['admin', 'user'] as const;
export type Role = (typeof ROLES)[number];

export const SORT_FIELDS = ['name', 'level', 'school'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Schadensarten (5e) plus "healing" für Heilzauber. */
export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
  'healing',
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];
