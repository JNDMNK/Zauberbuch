import { z } from 'zod';

/** Quellen (Bücher), app-weit auswählbar; Admin und Moderator pflegen sie in der Verwaltung */
export const sourceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  abbreviation: z.string().trim().max(12).optional().default(''),
});
export type SourceInput = z.input<typeof sourceSchema>;

export interface SourceDto {
  id: string;
  name: string;
  abbreviation: string;
  /** Verwendungen: Wiki-Einträge, Gegenstände und Zauber (über den Namen) */
  usage: { wiki: number; catalog: number; spells: number; monsters: number; magicItems: number };
}

/** Feld „Quelle“ in Formularen (Wiki, Gegenstände): id oder null */
export const sourceIdSchema = z.string().min(1).max(64).nullable().optional().default(null);
