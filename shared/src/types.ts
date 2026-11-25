import type { CastingTime, DamageType, Locale, Role, School, SpellClass } from './enums';

export interface SpellTranslationDto {
  name: string;
  materialDescription: string | null;
  castingTimeText: string | null;
  rangeText: string | null;
  durationText: string | null;
  description?: string;
  higherLevels?: string | null;
}

export interface SpellDto {
  id: string;
  slug: string;
  level: number;
  school: School;
  castingTime: CastingTime;
  range: string;
  components: { verbal: boolean; somatic: boolean; material: boolean };
  concentration: boolean;
  ritual: boolean;
  duration: string;
  classes: SpellClass[];
  /** Eigene Wiki-Klassen (IDs) */
  wikiClasses: string[];
  source: string;
  isHomebrew: boolean;
  /** Schaden/Heilung, z. B. { dice: "8d6", type: "fire" } – null, wenn nicht vorhanden */
  damage: { dice: string; type: DamageType } | null;
  translations: Partial<Record<Locale, SpellTranslationDto>>;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedSpells {
  items: SpellDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UserDto {
  id: string;
  username: string;
  email: string | null;
  role: Role;
  /** Zusatzrecht: Zauber anlegen/bearbeiten/duplizieren */
  canEditSpells: boolean;
  /** Admin: Kampfhilfe im Spielermodus */
  combatAsPlayer: boolean;
  /** Geschichten-Ansicht: aktive Geschichte (null = Allgemein) */
  activeStoryId: string | null;
  language: Locale;
  createdAt: string;
  /** Profilbild (Bild-URL mit Versionsangabe) oder null */
  avatarUrl: string | null;
}

/** URL des Profilbilds; die Versionsangabe sorgt dafür, dass Browser ein neues Bild sofort laden */
export const avatarUrlFor = (userId: string, updatedAt: Date | string | null | undefined) =>
  updatedAt ? `/api/avatars/${userId}?v=${new Date(updatedAt).getTime()}` : null;

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface AppConfigDto {
  defaultLanguage: Locale;
  version: string;
}

export interface ImportPreviewItem {
  index: number;
  slug: string | null;
  name: string | null;
  status: 'new' | 'duplicate' | 'invalid';
  errors?: string[];
}

export interface ImportPreviewResult {
  items: ImportPreviewItem[];
  summary: { total: number; new: number; duplicate: number; invalid: number };
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
}

export interface SpellbookOwnerDto {
  id: string;
  username: string;
  role: Role;
  spellCount: number;
}

export interface UserExportEntry {
  username: string;
  email: string | null;
  role: Role;
  canEditSpells: boolean;
  language: Locale;
  passwordHash?: string;
  favorites: string[];
  createdAt: string;
}

export interface UserExportFile {
  format: 'zauberbuch-users';
  version: 1;
  exportedAt: string;
  includesPasswords: boolean;
  users: UserExportEntry[];
}

export type UserImportStatus = 'new' | 'exists' | 'update' | 'self' | 'no_password' | 'conflict' | 'invalid';

export interface UserImportPreviewItem {
  index: number;
  username: string | null;
  role: Role | null;
  favorites: number;
  status: UserImportStatus;
  errors?: string[];
}

export interface UserImportPreview {
  items: UserImportPreviewItem[];
  summary: Record<UserImportStatus, number> & { total: number };
}

export interface UserImportResult {
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
  favoritesLinked: number;
  favoritesMissing: number;
}

/** Benachrichtigung in der App; Text wird im Client aus type + data gebildet */
export interface NotificationDto {
  id: string;
  type: string;
  data: Record<string, string>;
  createdAt: string;
  readAt: string | null;
}
