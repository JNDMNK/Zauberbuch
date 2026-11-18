import { z } from 'zod';

/**
 * Kampfhilfe: Der Dungeon Master führt pro Geschichte Kämpfe mit Spielercharakteren (Werte live und nur lesend
 * aus den Charakterbögen) und selbst angelegten Monstern. Mitspieler sehen dieselbe Ansicht nur lesend.
 */

export const CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
  'exhaustion',
  'concentrating',
] as const;
export type Condition = (typeof CONDITIONS)[number];

/** Grober Zustand für verdeckte Monster (und für die Farbe des Lebensbalkens) */
export type HealthStatus = 'unharmed' | 'injured' | 'bloodied' | 'down';

export function healthStatus(current: number, max: number): HealthStatus {
  if (current <= 0) return 'down';
  if (max <= 0 || current >= max) return 'unharmed';
  return current * 2 <= max ? 'bloodied' : 'injured';
}

export const MAX_COMBATANTS = 60;

const initiative = z.number().int().min(-20).max(99).nullable();
const conditions = z.array(z.enum(CONDITIONS)).max(CONDITIONS.length);

export const encounterInputSchema = z.object({
  storyId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(100),
});

export const encounterUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    round: z.number().int().min(1).max(9999).optional(),
    turnCombatantId: z.string().max(64).nullable().optional(),
    ended: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update' });

export const addCharactersSchema = z.object({
  characterIds: z.array(z.string().min(1).max(64)).min(1).max(MAX_COMBATANTS),
});

export const addMonsterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  count: z.number().int().min(1).max(20).optional().default(1),
  ac: z.number().int().min(0).max(50).nullable().optional().default(null),
  hpMax: z.number().int().min(0).max(9999),
  initiative: initiative.optional().default(null),
  hideStats: z.boolean().optional().default(true),
  /** Verbündeter NSC statt Monster */
  allied: z.boolean().optional().default(false),
});
export type AddMonsterInput = z.input<typeof addMonsterSchema>;

/** Für Spieler-Teilnehmer sind nur Initiative und Zustände änderbar */
export const combatantUpdateSchema = z
  .object({
    initiative: initiative.optional(),
    conditions: conditions.optional(),
    name: z.string().trim().min(1).max(80).optional(),
    ac: z.number().int().min(0).max(50).nullable().optional(),
    hpMax: z.number().int().min(0).max(9999).optional(),
    hpCurrent: z.number().int().min(0).max(9999).optional(),
    hideStats: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update' });
export type CombatantUpdate = z.input<typeof combatantUpdateSchema>;

/** Schaden (negativ) oder Heilung (positiv) für Monster */
export const hpDeltaSchema = z.object({ delta: z.number().int().min(-9999).max(9999) });

/** Spielermodus der Kampfhilfe für Admins (wird im Konto gespeichert) */
export const playerModeSchema = z.object({ asPlayer: z.boolean() });

export const turnSchema = z.object({ direction: z.union([z.literal(1), z.literal(-1)]) });

export interface CombatantDto {
  id: string;
  /** ally = verbündeter NSC (wird wie ein Monster vom DM gepflegt) */
  kind: 'character' | 'monster' | 'ally';
  name: string;
  initiative: number | null;
  /** RK als Text (Charakterbogen erlaubt z. B. „16+1“); null = verborgen oder unbekannt */
  ac: string | null;
  hpCurrent: number | null;
  hpMax: number | null;
  hpTemp: number | null;
  status: HealthStatus;
  /** Monster: Werte sind für Spieler verborgen (Spieler erhalten dann keine Zahlen) */
  hideStats: boolean;
  conditions: Condition[];
  /** Spielercharakter: Besitzer und Link zum Bogen (wenn der Betrachter ihn öffnen darf) */
  owner: string | null;
  characterId: string | null;
}

export interface EncounterSummaryDto {
  id: string;
  storyId: string;
  storyName: string;
  name: string;
  round: number;
  ended: boolean;
  combatantCount: number;
  updatedAt: string;
}

export interface EncounterDto extends EncounterSummaryDto {
  turnCombatantId: string | null;
  combatants: CombatantDto[];
  canManage: boolean;
}

/**
 * Zugreihenfolge: höchste Initiative zuerst, ohne Initiative ans Ende, bei Gleichstand alphabetisch.
 * (Gleiche Reihenfolge wie die Sortierung „Initiative“ in der Ansicht.)
 */
export function compareByInitiative(a: Pick<CombatantDto, 'initiative' | 'name'>, b: Pick<CombatantDto, 'initiative' | 'name'>) {
  const ai = a.initiative ?? Number.NEGATIVE_INFINITY;
  const bi = b.initiative ?? Number.NEGATIVE_INFINITY;
  if (ai !== bi) return bi - ai;
  return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' });
}

export function compareByName(a: Pick<CombatantDto, 'name'>, b: Pick<CombatantDto, 'name'>) {
  return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' });
}
