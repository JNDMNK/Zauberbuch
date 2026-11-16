import type { CastingTime, Locale, Role, School, SpellClass } from './enums';

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
  source: string;
  isHomebrew: boolean;
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
  language: Locale;
  createdAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface AppConfigDto {
  allowRegistration: boolean;
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
