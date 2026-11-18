import { z } from 'zod';

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
};

/** DM-Vorlage: LP sind Pflicht (werden im Kampf als LP-Maximum übernommen) */
export const monsterTemplateSchema = z.object({ ...base, hp: z.number().int().min(0).max(9999) });
export type MonsterTemplateInput = z.input<typeof monsterTemplateSchema>;

/** Spieler-Eintrag: RK und LP sind optional (Spieler kennen sie oft nicht) */
export const bestiaryEntrySchema = z.object({ ...base, hp: z.number().int().min(0).max(9999).nullable().optional().default(null) });
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
  createdBy: BestiaryUserRef | null;
  updatedBy: BestiaryUserRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonsterTemplateDto extends EntryBase {
  hp: number;
}

export interface BestiaryEntryDto extends EntryBase {
  hp: number | null;
  storyId: string;
}
