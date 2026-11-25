import { z } from 'zod';
import type { StoryRole } from './board';

/** Gewürfelter Wurf, wie ihn der Würfelbecher in den Chat schickt */
export const chatDiceSchema = z.object({
  expression: z.string().trim().min(1).max(120),
  total: z.number().int().min(-1000).max(100000),
  modifier: z.number().int().min(-100).max(100).default(0),
  mode: z.enum(['normal', 'advantage', 'disadvantage']).default('normal'),
  dice: z
    .array(z.object({ sides: z.number().int().min(2).max(100), value: z.number().int().min(1).max(100), dropped: z.number().int().min(1).max(100).optional() }))
    .min(1)
    .max(200),
});
export type ChatDice = z.infer<typeof chatDiceSchema>;

export const chatMessageInputSchema = z
  .object({
    body: z.string().max(4000).optional().default(''),
    /** „Als Charakter sprechen“: eigener Charakter dieser Geschichte */
    characterId: z.string().min(1).max(64).nullable().optional().default(null),
    dice: chatDiceSchema.nullable().optional().default(null),
  })
  .refine((v) => v.body.trim().length > 0 || v.dice, { message: 'message_empty' });
export type ChatMessageInput = z.input<typeof chatMessageInputSchema>;

export const chatEditSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export interface ChatMessageDto {
  id: string;
  senderId: string;
  /** Benutzername des Absenders (für Gruppen) */
  senderName: string;
  /** Zweiergespräch: Empfänger; Gruppe: null */
  recipientId: string | null;
  groupId: string | null;
  /** Name des Charakters, als der gesprochen wurde ('' = als Benutzer) */
  characterId: string | null;
  characterName: string;
  kind: 'text' | 'dice';
  body: string;
  dice: ChatDice | null;
  edited: boolean;
  deleted: boolean;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Gesprächspartner in einer Geschichte (alle anderen Mitglieder) mit letzter Nachricht und Ungelesenen */
export interface ChatContactDto {
  userId: string;
  username: string;
  role: StoryRole | null;
  unread: number;
  last: { body: string; at: string; mine: boolean } | null;
}

/** Chatgruppe – nur für ihre Mitglieder sichtbar */
export interface ChatGroupDto {
  id: string;
  name: string;
  /** Ersteller verwaltet die Gruppe (null = Ersteller gelöscht/ausgetreten → ältestes Mitglied) */
  createdById: string | null;
  canManage: boolean;
  members: { userId: string; username: string; role: StoryRole | null }[];
  unread: number;
  last: { body: string; at: string; mine: boolean; sender: string } | null;
}

export const chatGroupInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  /** weitere Mitglieder (Ersteller ist immer dabei) */
  memberIds: z.array(z.string().min(1).max(64)).max(100).default([]),
});
export type ChatGroupInput = z.input<typeof chatGroupInputSchema>;

export interface ChatStoryDto {
  storyId: string;
  archived: boolean;
  contacts: ChatContactDto[];
  /** Gruppen dieser Geschichte, in denen ich Mitglied bin */
  groups: ChatGroupDto[];
  /** Eigene Charaktere dieser Geschichte („als Charakter sprechen“) */
  myCharacters: { id: string; name: string }[];
  /** Gespeicherte Wahl „Schreiben als“ in dieser Geschichte (null = als Benutzer) */
  speakAs: string | null;
  /** Bilder je Mitglied (inkl. mir): Profilbild und Charakter mit Porträt in dieser Geschichte */
  people: Record<string, { avatarUrl: string | null; characterId: string | null }>;
}

export const chatSpeakAsSchema = z.object({ characterId: z.string().min(1).max(64).nullable() });

/** Profilbild setzen (Data-URL, im Browser verkleinert) oder entfernen (null) */
export const avatarSchema = z.object({
  avatar: z
    .string()
    .max(400_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'avatar_invalid')
    .nullable(),
});
