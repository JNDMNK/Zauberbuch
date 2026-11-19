import { z } from 'zod';

/**
 * Magische Gegenstände je Geschichte: Admin, Moderator und die Dungeon Master der Geschichte legen sie an und geben
 * sie Charakterbögen (auch mehreren). Spieler sehen sie im Bogen und können sie weitergeben oder zurückgeben.
 */
export const MAX_ITEM_DESCRIPTION = 5000;

export const magicItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(MAX_ITEM_DESCRIPTION).optional().default(''),
  /** Gewicht in lb (zählt zur Last der Besitzer) */
  weight: z.number().min(0).max(9999).optional().default(0),
  /** Wert als Freitext, z. B. „200 GM“ */
  value: z.string().trim().max(40).optional().default(''),
  holderIds: z.array(z.string().min(1).max(64)).max(50).optional().default([]),
});
export type MagicItemInput = z.input<typeof magicItemSchema>;

/** Weitergeben: an einen anderen Charakterbogen der Geschichte oder (null) an den DM zurück */
export const itemTransferSchema = z.object({
  fromCharacterId: z.string().min(1).max(64),
  toCharacterId: z.string().min(1).max(64).nullable(),
});

export interface ItemCharacterRef {
  id: string;
  name: string;
  owner: string;
}

export interface MagicItemDto {
  id: string;
  storyId: string;
  name: string;
  description: string;
  /** Gewicht in lb */
  weight: number;
  /** Wert, z. B. „200 GM“ (leer = unbekannt) */
  value: string;
  holders: ItemCharacterRef[];
  createdAt: string;
  updatedAt: string;
}

/** Gegenstände eines Charakterbogens inkl. möglicher Empfänger zum Weitergeben */
export interface CharacterItemsDto {
  items: MagicItemDto[];
  /** Betrachter darf die Gegenstände dieses Bogens weitergeben (Besitzer oder Mitbearbeiter) */
  canTransfer: boolean;
  /** Andere Charakterbögen der Geschichte (für „Weitergeben“) */
  targets: ItemCharacterRef[];
}

/** Geschichten, deren Gegenstände der Benutzer verwalten darf */
export interface ItemStoryDto {
  id: string;
  name: string;
  archived: boolean;
  itemCount: number;
}
