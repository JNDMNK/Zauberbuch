import { z } from 'zod';
import { DAMAGE_TYPES, type DamageType } from './enums';
import { damageDiceSchema } from './schemas';

/**
 * Monster-Datenbanken:
 * - DM-Datenbank (Vorlagen für Kämpfe), gemeinsam für alle Dungeon Master und Admins
 * - Spieler-Datenbank je Geschichte: gemeinsames Notizbuch der Mitspieler, DM/Admin nur lesend
 */

/** Größenkategorien eines Monsters */
export const MONSTER_SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;
export type MonsterSize = (typeof MONSTER_SIZES)[number];
export const MONSTER_ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type MonsterAbility = (typeof MONSTER_ABILITIES)[number];

const statText = (max: number) => z.string().trim().max(max).catch('').default('');
const score = z.number().int().min(1).max(30).nullable().catch(null).default(null);
/** Merkmal / Aktion: Name + Text (Markdown); leere Einträge fallen weg */
const featureSchema = z.object({ name: z.string().trim().max(100).default(''), text: z.string().trim().max(3000).default('') });
const features = z
  .array(featureSchema)
  .max(40)
  .catch([])
  .default([])
  .transform((l) => l.filter((f) => f.name || f.text));
export type MonsterFeature = z.infer<typeof featureSchema>;

/**
 * Vollständiger Werteblock (wie im Monsterhandbuch). Alles optional; ungültige Einzelwerte werden verworfen statt
 * den ganzen Eintrag abzulehnen. Gespeichert als JSON.
 */
const statsObject = z.object({
  size: z.enum(MONSTER_SIZES).nullable().catch(null).default(null),
  /** Typ inkl. Untertyp, z. B. „Humanoide (Goblinoide)“ */
  type: statText(80),
  alignment: statText(60),
  /** Zusatz zur RK, z. B. „Lederrüstung, Schild“ */
  acNote: statText(100),
  /** Trefferwürfel der LP, z. B. „2W6“ */
  hitDice: statText(40),
  speed: statText(150),
  abilities: z.object({ str: score, dex: score, con: score, int: score, wis: score, cha: score }).catch({ str: null, dex: null, con: null, int: null, wis: null, cha: null }).default({}),
  saves: statText(300),
  skills: statText(300),
  vulnerabilities: statText(300),
  resistances: statText(300),
  immunities: statText(300),
  conditionImmunities: statText(300),
  senses: statText(300),
  languages: statText(300),
  /** Herausforderungsgrad, z. B. „1/4“ oder „5“ */
  cr: statText(10),
  traits: features,
  actions: features,
  bonusActions: features,
  reactions: features,
  legendaryActions: features,
  habitat: statText(200),
  tags: statText(200),
  source: statText(100),
});
export const monsterStatsSchema = statsObject.catch(() => statsObject.parse({})).default({});
export type MonsterStats = z.output<typeof monsterStatsSchema>;
export type MonsterStatsInput = z.input<typeof monsterStatsSchema>;

const CR_XP: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};
/** EP und Übungsbonus zum Herausforderungsgrad (null bei unbekanntem Wert) */
export function challengeInfo(cr: string): { xp: number; proficiency: number } | null {
  const key = cr.trim().replace(/\s+/g, '').replace('½', '1/2').replace('¼', '1/4').replace('⅛', '1/8');
  const xp = CR_XP[key];
  if (xp === undefined) return null;
  const n = key.includes('/') ? 0 : Number(key);
  return { xp, proficiency: n < 5 ? 2 : Math.min(9, 2 + Math.floor((n - 1) / 4)) };
}

export const MAX_ATTACK_LENGTH = 1000;
export const MAX_MONSTER_DESCRIPTION = 5000;

const base = {
  name: z.string().trim().min(1).max(80),
  ac: z.number().int().min(0).max(50).nullable().optional().default(null),
  attack: z.string().trim().max(MAX_ATTACK_LENGTH).optional().default(''),
  description: z.string().trim().max(MAX_MONSTER_DESCRIPTION).optional().default(''),
  /** Schaden wie bei Zaubern: Würfelausdruck + Schadensart (beide oder keiner) */
  damageDice: damageDiceSchema.optional().nullable().default(null),
  damageType: z.enum(DAMAGE_TYPES).optional().nullable().default(null),
  /** Vollständiger Werteblock */
  stats: monsterStatsSchema,
};

/** Würfel und Schadensart nur gemeinsam (gleiche Regel wie bei Zaubern) */
function checkDamage(v: { damageDice?: string | null; damageType?: string | null }, ctx: z.RefinementCtx) {
  if (v.damageDice && !v.damageType) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['damageType'], message: 'damage_type_required' });
  if (v.damageType && !v.damageDice) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['damageDice'], message: 'damage_dice_required' });
}

/** LP-Angabe der Spieler: Zahl oder Bereich, z. B. „58“, „10-15“ (Gedankenstrich wird zu „-“) */
export const HP_RANGE_RE = /^\d{1,4}(?:-\d{1,4})?$/;
export const hpRangeSchema = z
  .string()
  .trim()
  .max(20)
  .transform((v) => v.replace(/\s+/g, '').replace(/[–—]/g, '-'))
  .refine((v) => v === '' || HP_RANGE_RE.test(v), 'hp_range_invalid')
  .refine((v) => {
    const [a, b] = v.split('-').map(Number);
    return b === undefined || a <= b;
  }, 'hp_range_invalid')
  .transform((v) => (v === '' ? null : v));

/** DM-Vorlage: LP sind Pflicht (werden im Kampf als LP-Maximum übernommen) */
export const monsterTemplateSchema = z.object({ ...base, hp: z.number().int().min(0).max(9999) }).superRefine(checkDamage);
export type MonsterTemplateInput = z.input<typeof monsterTemplateSchema>;

/** Spieler-Eintrag: RK optional, LP als Zahl oder Bereich (z. B. „10-15“) */
export const bestiaryEntrySchema = z.object({ ...base, hp: hpRangeSchema.optional().nullable().default(null) }).superRefine(checkDamage);
export type BestiaryEntryInput = z.input<typeof bestiaryEntrySchema>;

export interface BestiaryUserRef {
  id: string;
  username: string;
}

interface EntryBase {
  id: string;
  name: string;
  ac: number | null;
  attack: string;
  description: string;
  damageDice: string | null;
  damageType: DamageType | null;
  stats: MonsterStats;
  createdBy: BestiaryUserRef | null;
  updatedBy: BestiaryUserRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonsterTemplateDto extends EntryBase {
  hp: number;
}

export interface BestiaryEntryDto extends EntryBase {
  /** Zahl oder Bereich als Text, z. B. „10-15“ */
  hp: string | null;
  storyId: string;
}
