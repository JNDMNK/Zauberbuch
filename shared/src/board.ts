import { z } from 'zod';
import { lifestylesSchema, optionListSchema, type Lifestyle, godListSchema } from './lifestyle';

/**
 * Infotafel: Pro Geschichte (Story) eine gemeinsame Tafel, auf der Mitspieler wichtige Infos
 * zum Spiel festhalten. Geschichten verwalten Admin und Dungeon Master.
 */

export const BOARD_CATEGORIES = ['general', 'dates', 'places', 'npcs', 'quests', 'items', 'lore'] as const;
export type BoardCategory = (typeof BOARD_CATEGORIES)[number];

/** Gelöschte Beiträge kann der Admin so lange wiederherstellen, danach werden sie endgültig entfernt. */
export const BOARD_RESTORE_DAYS = 90;
export const MAX_POST_LENGTH = 10_000;
export const MAX_COMMENT_LENGTH = 2_000;
export const BOARD_PAGE_SIZE = 20;

/** Rolle eines Benutzers in einer Geschichte – steuert Infotafel und Kampf */
export const STORY_ROLES = ['player', 'dm'] as const;
export type StoryRole = (typeof STORY_ROLES)[number];

const memberIds = z.array(z.string().min(1).max(64)).max(1000);
const members = z.array(z.object({ userId: z.string().min(1).max(64), role: z.enum(STORY_ROLES) })).max(1000);

/**
 * Geschichte anlegen/bearbeiten (Verwaltung: Admin und Moderatoren).
 * `members` mit Rollen; `memberIds` (Spieler) und `dmIds` (Dungeon Master) als Kurzform.
 */
export const storyInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional().default(''),
  members: members.optional(),
  memberIds: memberIds.optional(),
  dmIds: memberIds.optional(),
  /** Lebensstile mit täglichen Kosten; ohne Angabe = Standardwerte */
  lifestyles: lifestylesSchema.optional(),
  /** Auswahllisten für Sprachen bzw. Werkzeuge & andere; ohne Angabe = Standardwerte */
  languages: optionListSchema.optional(),
  tools: optionListSchema.optional(),
  /** Götter der Geschichte (Auswahl aus dem Wiki und eigene); ohne Angabe = alle aus dem Wiki */
  gods: godListSchema.optional(),
});
export type StoryInput = z.input<typeof storyInputSchema>;

export const storyUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(1000).optional(),
    archived: z.boolean().optional(),
    members: members.optional(),
    memberIds: memberIds.optional(),
    dmIds: memberIds.optional(),
    lifestyles: lifestylesSchema.optional(),
    languages: optionListSchema.optional(),
    tools: optionListSchema.optional(),
    gods: godListSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update' });
export type StoryUpdate = z.input<typeof storyUpdateSchema>;

/** Aktive Geschichte für die Geschichten-Ansicht (null = Allgemein) */
export const activeStorySchema = z.object({ storyId: z.string().min(1).max(64).nullable() });

export const postInputSchema = z.object({
  title: z.string().trim().max(150).optional().default(''),
  body: z.string().trim().min(1).max(MAX_POST_LENGTH),
  category: z.enum(BOARD_CATEGORIES).optional().default('general'),
});
export type PostInput = z.input<typeof postInputSchema>;

export const commentInputSchema = z.object({
  body: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
});

export const pinSchema = z.object({ pinned: z.boolean() });

export const postQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  category: z.enum(BOARD_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
});

export interface BoardUserRef {
  id: string;
  username: string;
}

export interface StoryMemberDto extends BoardUserRef {
  role: StoryRole;
}

export interface StoryDto {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  members: StoryMemberDto[];
  /** Eigene Rolle in dieser Geschichte (Admin ohne Spielerrolle = dm) */
  myRole: StoryRole | null;
  /** Lebensstile mit täglichen Kosten für die Charakterbögen dieser Geschichte */
  lifestyles: Lifestyle[];
  /** Auswahllisten für Sprachen und Werkzeuge & andere */
  languages: string[];
  tools: string[];
  gods: string[];
  postCount: number;
  unread: number;
}

export interface BoardCommentDto {
  id: string;
  body: string;
  /** null = Benutzer wurde gelöscht */
  author: BoardUserRef | null;
  createdAt: string;
  editedAt: string | null;
  canEdit: boolean;
}

export interface BoardPostDto {
  id: string;
  storyId: string;
  title: string;
  body: string;
  category: BoardCategory;
  pinned: boolean;
  author: BoardUserRef | null;
  createdAt: string;
  editedAt: string | null;
  editedBy: BoardUserRef | null;
  comments: BoardCommentDto[];
  canEdit: boolean;
}

export interface BoardPostsPage {
  posts: BoardPostDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DeletedBoardPostDto extends BoardPostDto {
  storyName: string;
  deletedAt: string;
  deletedBy: BoardUserRef | null;
  /** Ab diesem Zeitpunkt wird der Beitrag endgültig entfernt */
  purgeAt: string;
}

export interface BoardUnreadDto {
  total: number;
  stories: Record<string, number>;
}

// ---- Export / Import (Admin) ----

export const BOARD_EXPORT_FORMAT = 'zauberbuch-board';

export interface BoardExportComment {
  author: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

export interface BoardExportPost {
  title: string;
  body: string;
  category: BoardCategory;
  pinned: boolean;
  author: string | null;
  createdAt: string;
  editedAt: string | null;
  comments: BoardExportComment[];
}

export interface BoardExportStory {
  name: string;
  description: string;
  archived: boolean;
  /** Benutzernamen der Spieler */
  members: string[];
  /** Benutzernamen der Dungeon Master */
  dms?: string[];
  /** Lebensstile mit täglichen Kosten */
  lifestyles?: Lifestyle[];
  languages?: string[];
  tools?: string[];
  gods?: string[];
  posts: BoardExportPost[];
}

export interface BoardExportFile {
  format: typeof BOARD_EXPORT_FORMAT;
  version: 1;
  exportedAt: string;
  stories: BoardExportStory[];
}

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((s) => new Date(s))
  .refine((d) => !Number.isNaN(d.getTime()), 'Invalid date');

const importComment = z.object({
  author: z.string().max(100).nullable().optional().default(null),
  body: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
  createdAt: isoDate,
  editedAt: isoDate.nullable().optional().default(null),
});

const importPost = z.object({
  title: z.string().trim().max(150).optional().default(''),
  body: z.string().trim().min(1).max(MAX_POST_LENGTH),
  category: z.enum(BOARD_CATEGORIES).catch('general').default('general'),
  pinned: z.boolean().optional().default(false),
  author: z.string().max(100).nullable().optional().default(null),
  createdAt: isoDate,
  editedAt: isoDate.nullable().optional().default(null),
  comments: z.array(importComment).max(5000).optional().default([]),
});

export const boardImportSchema = z.object({
  format: z.literal(BOARD_EXPORT_FORMAT),
  version: z.literal(1),
  stories: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        description: z.string().trim().max(1000).optional().default(''),
        archived: z.boolean().optional().default(false),
        members: z.array(z.string().max(100)).max(1000).optional().default([]),
        dms: z.array(z.string().max(100)).max(1000).optional().default([]),
        lifestyles: lifestylesSchema.optional(),
        languages: optionListSchema.optional(),
        tools: optionListSchema.optional(),
        gods: godListSchema.optional(),
        posts: z.array(importPost).max(20_000).optional().default([]),
      }),
    )
    .max(500),
});

export interface BoardImportResult {
  storiesCreated: number;
  storiesMerged: number;
  postsCreated: number;
  postsSkipped: number;
  commentsCreated: number;
  unknownUsers: string[];
}

/** Suchtext: klein geschrieben, damit die Suche auch bei Umlauten groß/klein ignoriert */
export const boardSearchText = (title: string, body: string) => `${title}\n${body}`.toLocaleLowerCase('de');
