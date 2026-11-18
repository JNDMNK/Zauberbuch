import { z } from 'zod';
import { DAMAGE_TYPES, type DamageType } from './enums';
import { damageDiceSchema } from './schemas';

/**
 * Monster-Datenbanken:
 * - DM-Datenbank (Vorlagen für Kämpfe), gemeinsam für alle Dungeon Master und Admins
 * - Spieler-Datenbank je Geschichte: gemeinsames Notizbuch der Mitspieler, DM/Admin nur lesend
 */

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
