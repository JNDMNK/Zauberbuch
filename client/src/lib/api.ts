import type {
  AddMonsterInput,
  CharacterSettingsDto,
  CharacterSettingsInput,
  BestiaryEntryDto,
  BestiaryEntryInput,
  MonsterTemplateDto,
  MonsterTemplateInput,
  NotificationDto,
  CombatantUpdate,
  EncounterDto,
  EncounterSummaryDto,
  AppConfigDto,
  BoardCommentDto,
  BoardImportResult,
  BoardPostDto,
  BoardPostsPage,
  BoardUnreadDto,
  DeletedBoardPostDto,
  PostInput,
  StoryDto,
  StoryInput,
  StoryRole,
  StoryUpdate,
  CharacterDto,
  CharacterImportPreview,
  CharacterImportResult,
  CharacterSheet,
  CharacterSummaryDto,
  ImportPreviewResult,
  ImportResult,
  Locale,
  PaginatedSpells,
  Role,
  SpellDto,
  SpellbookOwnerDto,
  UserImportPreview,
  UserImportResult,
  SpellInput,
  UserDto,
} from '@zauberbuch/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-Requested-With'] = 'zauberbuch';
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'Network error');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? 'unknown', e?.message ?? res.statusText, e?.details);
  }
  return data as T;
}

export interface SpellNameDto {
  slug: string;
  level: number;
  de: string | null;
  en: string | null;
}

/** Speichern beim Verlassen der Seite (keepalive überlebt das Schließen des Tabs) */
export function saveCharacterKeepalive(id: string, data: CharacterSheet) {
  return fetch(`/api/characters/${id}`, {
    method: 'PUT',
    keepalive: true,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'zauberbuch' },
    body: JSON.stringify({ data }),
  }).catch(() => undefined);
}

export interface AdminUserDto extends UserDto {
  favoriteCount: number;
}

export const api = {
  config: () => request<AppConfigDto>('GET', '/api/config'),

  me: () => request<{ user: UserDto | null }>('GET', '/api/auth/me'),
  login: (identifier: string, password: string) =>
    request<{ user: UserDto }>('POST', '/api/auth/login', { identifier, password }),
  logout: () => request<void>('POST', '/api/auth/logout'),
  updateMe: (language: Locale) => request<{ user: UserDto }>('PATCH', '/api/auth/me', { language }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ user: UserDto }>('POST', '/api/auth/password', { currentPassword, newPassword }),

  spells: (params: URLSearchParams, signal?: AbortSignal) =>
    request<PaginatedSpells>('GET', `/api/spells?${params.toString()}`, undefined, signal),
  spell: (slug: string, signal?: AbortSignal) =>
    request<{ spell: SpellDto }>('GET', `/api/spells/${encodeURIComponent(slug)}`, undefined, signal),
  sources: () => request<{ sources: string[] }>('GET', '/api/spells/sources'),
  createSpell: (input: SpellInput) => request<{ spell: SpellDto }>('POST', '/api/spells', input),
  updateSpell: (id: string, input: SpellInput) => request<{ spell: SpellDto }>('PUT', `/api/spells/${id}`, input),
  duplicateSpell: (id: string) => request<{ spell: SpellDto }>('POST', `/api/spells/${id}/duplicate`),
  deleteSpell: (id: string) => request<void>('DELETE', `/api/spells/${id}`),
  importPreview: (spells: unknown[]) =>
    request<ImportPreviewResult>('POST', '/api/spells/import/preview', { spells }),
  importSpells: (spells: unknown[], mode: 'skip' | 'overwrite') =>
    request<ImportResult>('POST', '/api/spells/import', { spells, mode }),

  favorites: () => request<{ spellIds: string[] }>('GET', '/api/favorites'),
  addFavorite: (spellId: string) => request<unknown>('POST', '/api/favorites', { spellId }),
  removeFavorite: (spellId: string) => request<void>('DELETE', `/api/favorites/${encodeURIComponent(spellId)}`),

  users: () => request<{ users: AdminUserDto[] }>('GET', '/api/users'),
  createUser: (data: { username: string; email: string; password: string; role: Role; canEditSpells?: boolean }) =>
    request<{ user: AdminUserDto }>('POST', '/api/users', data),
  updateUser: (id: string, data: { role?: Role; password?: string; canEditSpells?: boolean }) =>
    request<{ user: UserDto }>('PATCH', `/api/users/${id}`, data),
  deleteUser: (id: string) => request<void>('DELETE', `/api/users/${id}`),
  userImportPreview: (users: unknown[], mode: 'skip' | 'update', defaultPassword: string | null) =>
    request<UserImportPreview>('POST', '/api/users/import/preview', { users, mode, defaultPassword }),
  importUsers: (users: unknown[], mode: 'skip' | 'update', defaultPassword: string | null) =>
    request<UserImportResult>('POST', '/api/users/import', { users, mode, defaultPassword }),

  spellbooks: () => request<{ owners: SpellbookOwnerDto[] }>('GET', '/api/spellbooks'),

  spellNames: () => request<{ spells: SpellNameDto[] }>('GET', '/api/spells/names'),

  characters: () => request<{ characters: CharacterSummaryDto[]; shared: CharacterSummaryDto[] }>('GET', '/api/characters'),
  characterSettings: (id: string) => request<{ settings: CharacterSettingsDto }>('GET', `/api/characters/${id}/settings`),
  saveCharacterSettings: (id: string, input: CharacterSettingsInput) => request<{ settings: CharacterSettingsDto }>('PUT', `/api/characters/${id}/settings`, input),
  allCharacters: () => request<{ characters: CharacterSummaryDto[] }>('GET', '/api/characters/all'),
  character: (id: string) => request<{ character: CharacterDto }>('GET', `/api/characters/${id}`),
  createCharacter: (name?: string) => request<{ character: CharacterDto }>('POST', '/api/characters', { name }),
  saveCharacter: (id: string, data: CharacterSheet) => request<{ character: CharacterDto }>('PUT', `/api/characters/${id}`, { data }),
  duplicateCharacter: (id: string) => request<{ character: CharacterDto }>('POST', `/api/characters/${id}/duplicate`),
  deleteCharacter: (id: string) => request<void>('DELETE', `/api/characters/${id}`),
  characterImportPreview: (characters: unknown[], fallbackOwnerId: string | null) =>
    request<CharacterImportPreview>('POST', '/api/characters/import/preview', { characters, fallbackOwnerId }),
  importCharacters: (characters: unknown[], fallbackOwnerId: string | null, duplicates: 'skip' | 'create') =>
    request<CharacterImportResult>('POST', '/api/characters/import', { characters, fallbackOwnerId, duplicates }),

  // Infotafel
  stories: (archived = false) => request<{ stories: StoryDto[] }>('GET', `/api/board/stories${archived ? '?archived=true' : ''}`),
  // Geschichten-Verwaltung (Admin/Moderator) und Geschichten-Ansicht
  manageStories: () => request<{ stories: StoryDto[] }>('GET', '/api/stories'),
  storyUsers: () => request<{ users: { id: string; username: string; role: Role }[] }>('GET', '/api/stories/users'),
  createStory: (input: StoryInput) => request<{ story: StoryDto }>('POST', '/api/stories', input),
  updateStory: (id: string, input: StoryUpdate) => request<{ story: StoryDto }>('PATCH', `/api/stories/${id}`, input),
  deleteStory: (id: string) => request<void>('DELETE', `/api/stories/${id}`),
  myStories: () => request<{ stories: { id: string; name: string; role: StoryRole | null }[] }>('GET', '/api/stories/mine'),
  setActiveStory: (storyId: string | null) => request<{ user: UserDto }>('PUT', '/api/stories/active', { storyId }),
  markStoryRead: (id: string) => request<void>('POST', `/api/board/stories/${id}/read`),
  boardUnread: () => request<BoardUnreadDto>('GET', '/api/board/unread'),
  boardPosts: (storyId: string, params: URLSearchParams, signal?: AbortSignal) =>
    request<BoardPostsPage>('GET', `/api/board/stories/${storyId}/posts?${params.toString()}`, undefined, signal),
  createPost: (storyId: string, input: PostInput) => request<{ post: BoardPostDto }>('POST', `/api/board/stories/${storyId}/posts`, input),
  updatePost: (id: string, input: PostInput) => request<{ post: BoardPostDto }>('PATCH', `/api/board/posts/${id}`, input),
  pinPost: (id: string, pinned: boolean) => request<{ post: BoardPostDto }>('POST', `/api/board/posts/${id}/pin`, { pinned }),
  deletePost: (id: string) => request<void>('DELETE', `/api/board/posts/${id}`),
  deletedPosts: (storyId?: string) => request<{ posts: DeletedBoardPostDto[] }>('GET', `/api/board/deleted${storyId ? `?storyId=${storyId}` : ''}`),
  restorePost: (id: string) => request<{ post: BoardPostDto }>('POST', `/api/board/posts/${id}/restore`),
  purgePost: (id: string) => request<void>('DELETE', `/api/board/posts/${id}/permanent`),
  createComment: (postId: string, body: string) => request<{ comment: BoardCommentDto }>('POST', `/api/board/posts/${postId}/comments`, { body }),
  updateComment: (id: string, body: string) => request<{ comment: BoardCommentDto }>('PATCH', `/api/board/comments/${id}`, { body }),
  deleteComment: (id: string) => request<void>('DELETE', `/api/board/comments/${id}`),
  importBoard: (file: unknown) => request<BoardImportResult>('POST', '/api/board/import', file),

  // Kampfhilfe
  encounters: () => request<{ encounters: EncounterSummaryDto[] }>('GET', '/api/combat/encounters'),
  combatActive: () => request<{ count: number }>('GET', '/api/combat/active'),
  encounter: (id: string, signal?: AbortSignal) => request<{ encounter: EncounterDto }>('GET', `/api/combat/encounters/${id}`, undefined, signal),
  combatCandidates: (id: string) => request<{ characters: CharacterSummaryDto[] }>('GET', `/api/combat/encounters/${id}/candidates`),
  createEncounter: (storyId: string, name: string) => request<{ encounter: EncounterDto }>('POST', '/api/combat/encounters', { storyId, name }),
  updateEncounter: (id: string, data: { name?: string; round?: number; turnCombatantId?: string | null; ended?: boolean }) =>
    request<{ encounter: EncounterDto }>('PATCH', `/api/combat/encounters/${id}`, data),
  deleteEncounter: (id: string) => request<void>('DELETE', `/api/combat/encounters/${id}`),
  encounterTurn: (id: string, direction: 1 | -1) => request<{ encounter: EncounterDto }>('POST', `/api/combat/encounters/${id}/turn`, { direction }),
  addCombatCharacters: (id: string, characterIds: string[]) =>
    request<{ encounter: EncounterDto }>('POST', `/api/combat/encounters/${id}/characters`, { characterIds }),
  addMonster: (id: string, input: AddMonsterInput) => request<{ encounter: EncounterDto }>('POST', `/api/combat/encounters/${id}/monsters`, input),
  updateCombatant: (id: string, data: CombatantUpdate) => request<{ encounter: EncounterDto }>('PATCH', `/api/combat/combatants/${id}`, data),
  combatantHp: (id: string, delta: number) => request<{ encounter: EncounterDto }>('POST', `/api/combat/combatants/${id}/hp`, { delta }),
  removeCombatant: (id: string) => request<{ encounter: EncounterDto }>('DELETE', `/api/combat/combatants/${id}`),

  // Monster-Datenbanken
  monsterTemplates: () => request<{ templates: MonsterTemplateDto[] }>('GET', '/api/bestiary/dm'),
  createMonsterTemplate: (input: MonsterTemplateInput) => request<{ template: MonsterTemplateDto }>('POST', '/api/bestiary/dm', input),
  updateMonsterTemplate: (id: string, input: MonsterTemplateInput) => request<{ template: MonsterTemplateDto }>('PUT', `/api/bestiary/dm/${id}`, input),
  deleteMonsterTemplate: (id: string) => request<void>('DELETE', `/api/bestiary/dm/${id}`),
  bestiary: (storyId: string) => request<{ entries: BestiaryEntryDto[]; canWrite: boolean }>('GET', `/api/bestiary/stories/${storyId}`),
  createBestiaryEntry: (storyId: string, input: BestiaryEntryInput) => request<{ entry: BestiaryEntryDto }>('POST', `/api/bestiary/stories/${storyId}`, input),
  updateBestiaryEntry: (id: string, input: BestiaryEntryInput) => request<{ entry: BestiaryEntryDto }>('PUT', `/api/bestiary/entries/${id}`, input),
  deleteBestiaryEntry: (id: string) => request<void>('DELETE', `/api/bestiary/entries/${id}`),

  // Benachrichtigungen
  notifications: () => request<{ notifications: NotificationDto[]; unread: number }>('GET', '/api/notifications'),
  markNotificationsRead: () => request<void>('POST', '/api/notifications/read', {}),
  clearNotifications: () => request<void>('DELETE', '/api/notifications'),
};
