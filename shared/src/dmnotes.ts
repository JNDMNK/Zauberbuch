import { z } from 'zod';

/**
 * DM-Notizen je Geschichte (Infotafel → Reiter „DM-Notizen“): nur die Dungeon Master der Geschichte sehen sie.
 * Ein Kampagnenbuch aus Abschnitten im Kapitelbaum – mit Typ, Status, Schlagwörtern, Querverweisen, Bildern,
 * Zufallstabellen, Begegnungen (→ Kampf vorbereiten), Sitzungsprotokollen und Freigabe an die Spieler.
 */
export const MAX_DM_NOTE_BODY = 50000;

export const DM_NOTE_KINDS = ['chapter', 'scene', 'encounter', 'place', 'npc', 'faction', 'item', 'clue', 'lore', 'session', 'table'] as const;
export type DmNoteKind = (typeof DM_NOTE_KINDS)[number];
export const DM_NOTE_STATUSES = ['none', 'prepared', 'active', 'done', 'discarded'] as const;
export type DmNoteStatus = (typeof DM_NOTE_STATUSES)[number];

const idList = z.array(z.string().min(1).max(64)).max(50);

export const dmNoteMonsterSchema = z.object({
  templateId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(80),
  count: z.number().int().min(1).max(20),
});
export type DmNoteMonster = z.infer<typeof dmNoteMonsterSchema>;

export const dmNoteSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().max(MAX_DM_NOTE_BODY).optional().default(''),
  parentId: z.string().min(1).max(64).nullable().optional(),
  kind: z.enum(DM_NOTE_KINDS).optional(),
  status: z.enum(DM_NOTE_STATUSES).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  pinned: z.boolean().optional(),
  gameDate: z.string().trim().max(80).optional(),
  sessionDate: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  xp: z.number().int().min(0).max(1_000_000).nullable().optional(),
  tableRows: z.array(z.string().trim().min(1).max(300)).max(100).optional(),
  monsters: z.array(dmNoteMonsterSchema).max(20).optional(),
  characterIds: idList.optional(),
});
export type DmNoteInput = z.input<typeof dmNoteSchema>;

/** Reihenfolge (und Einordnung) setzen: Geschwister in der gewünschten Reihenfolge unter parentId */
export const dmNoteOrderSchema = z.object({ ids: z.array(z.string().min(1).max(64)).max(500), parentId: z.string().min(1).max(64).nullable().optional() });

/** Freigeben: als Beitrag auf die Infotafel oder als Direktnachricht an einzelne Spieler (geheime Stellen entfernt) */
export const dmNoteShareSchema = z.discriminatedUnion('to', [z.object({ to: z.literal('board') }), z.object({ to: z.literal('chat'), userIds: z.array(z.string().min(1).max(64)).min(1).max(50) })]);
export type DmNoteShareInput = z.infer<typeof dmNoteShareSchema>;

export const dmNoteImageSchema = z.object({
  image: z
    .string()
    .max(1_500_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'avatar_invalid'),
});

export interface DmNoteDto {
  id: string;
  title: string;
  body: string;
  position: number;
  updatedAt: string;
  /** Wer zuletzt geändert hat */
  updatedBy: string | null;
  parentId: string | null;
  kind: DmNoteKind;
  status: DmNoteStatus;
  tags: string[];
  pinned: boolean;
  gameDate: string;
  sessionDate: string;
  xp: number | null;
  tableRows: string[];
  monsters: DmNoteMonster[];
  characterIds: string[];
  sharedAt: string | null;
  sharedInfo: string;
}

export interface DmNoteVersionDto {
  id: string;
  title: string;
  body: string;
  updatedBy: string | null;
  createdAt: string;
}

/** Geheime Stellen (`:::geheim … :::`) für die Freigabe entfernen */
export function stripDmSecrets(body: string): string {
  return body
    .replace(/^:::\s*(geheim|secret)\s*$[\s\S]*?^:::\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Zeile einer Zufallstabelle: optionaler Bereich „3–5:“ bzw. „7:“ */
export function parseTableRow(row: string): { from: number | null; to: number | null; text: string } {
  const m = row.match(/^\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*[:.)]\s*(.*)$/);
  if (!m) return { from: null, to: null, text: row.trim() };
  const from = Number(m[1]);
  return { from, to: m[2] ? Number(m[2]) : from, text: m[3].trim() };
}

/**
 * Würfel für eine Zufallstabelle: mit Bereichen der höchste Wert, sonst die Anzahl der Einträge.
 * Ergebnis: Würfelseiten und Funktion, die zu einem Wurf den Eintrag liefert.
 */
export function tableDie(rows: string[]): { sides: number; pick: (roll: number) => number } {
  const parsed = rows.map(parseTableRow);
  const ranged = parsed.length > 0 && parsed.every((p) => p.from !== null);
  if (!ranged) return { sides: Math.max(1, rows.length), pick: (roll) => roll - 1 };
  const sides = Math.max(...parsed.map((p) => p.to!));
  return { sides, pick: (roll) => parsed.findIndex((p) => roll >= p.from! && roll <= p.to!) };
}
