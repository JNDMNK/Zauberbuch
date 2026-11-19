import { z } from 'zod';
import { DAMAGE_TYPES, type DamageType } from './enums';
import { damageDiceSchema } from './schemas';

/**
 * Gegenstands-Katalog: Rüstung, Waffen und Gegenstände. Standard-Datenbank (Admin/Moderator) und Anpassungen je
 * Geschichte; der Charakterbogen übernimmt Einträge ins Inventar (Text, Gewicht, Verlinkung auf die Karte).
 */
export const CATALOG_CATEGORIES = ['armor', 'weapon', 'gear'] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export const catalogItemSchema = z
  .object({
    category: z.enum(CATALOG_CATEGORIES),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(2000).optional().default(''),
    weight: z.number().min(0).max(99999).optional().default(0),
    /** Wert als Freitext, z. B. „5 GM“ */
    value: z.string().trim().max(40).optional().default(''),
    /** Rüstung: Rüstungsklasse als Text („11 + GES“, „+2“) */
    ac: z.string().trim().max(40).optional().default(''),
    /** Waffen: Schaden; Gegenstände: Schaden oder Heilung (z. B. Heiltrank) */
    damageDice: damageDiceSchema.optional().nullable().default(null),
    damageType: z.enum(DAMAGE_TYPES).optional().nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (v.damageDice && !v.damageType) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['damageType'], message: 'damage_type_required' });
    if (v.damageType && !v.damageDice) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['damageDice'], message: 'damage_dice_required' });
  });
export type CatalogItemInput = z.input<typeof catalogItemSchema>;

/** Herkunft eines Eintrags in einer Geschichte */
export type CatalogOrigin = 'standard' | 'override' | 'story';

export interface CatalogItemDto {
  id: string;
  category: CatalogCategory;
  name: string;
  description: string;
  weight: number;
  /** Wert, z. B. „5 GM“ */
  value: string;
  ac: string;
  damage: { dice: string; type: DamageType } | null;
  origin: CatalogOrigin;
  /** Bei Anpassungen: der Standard-Eintrag, der überdeckt wird */
  baseId: string | null;
  /** Nur in der Verwaltung einer Geschichte: Standard-Eintrag ausgeblendet */
  hidden?: boolean;
}

/** Text für das Inventar: „Name · Schaden/RK · Beschreibung“ (max. 150 Zeichen) */
export function catalogInventoryText(item: Pick<CatalogItemDto, 'name' | 'description' | 'ac' | 'damage'>, formatDamage: (d: { dice: string; type: DamageType }) => string): string {
  const parts = [item.name];
  if (item.damage) parts.push(formatDamage(item.damage));
  if (item.ac) parts.push(`RK ${item.ac}`);
  if (item.description) parts.push(item.description);
  const text = parts.join(' · ');
  return text.length > 150 ? `${text.slice(0, 149)}…` : text;
}
