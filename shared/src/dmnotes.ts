import { z } from 'zod';

/**
 * DM-Notizen je Geschichte (Infotafel → Reiter „DM-Notizen“): nur die Dungeon Master der Geschichte sehen sie.
 * Abschnitte (z. B. „Dorf A“) mit formatiertem Text, frei sortierbar.
 */
export const MAX_DM_NOTE_BODY = 20000;

export const dmNoteSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().max(MAX_DM_NOTE_BODY).optional().default(''),
});
export type DmNoteInput = z.input<typeof dmNoteSchema>;

export const dmNoteOrderSchema = z.object({ ids: z.array(z.string().min(1).max(64)).max(500) });

export interface DmNoteDto {
  id: string;
  title: string;
  body: string;
  position: number;
  updatedAt: string;
  /** Wer zuletzt geändert hat */
  updatedBy: string | null;
}
