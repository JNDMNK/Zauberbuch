import type {
  AppConfigDto,
  ImportPreviewResult,
  ImportResult,
  Locale,
  PaginatedSpells,
  Role,
  SpellDto,
  SpellbookOwnerDto,
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
  createUser: (data: { username: string; email: string; password: string; role: Role }) =>
    request<{ user: AdminUserDto }>('POST', '/api/users', data),
  updateUser: (id: string, data: { role?: Role; password?: string }) =>
    request<{ user: UserDto }>('PATCH', `/api/users/${id}`, data),
  deleteUser: (id: string) => request<void>('DELETE', `/api/users/${id}`),

  spellbooks: () => request<{ owners: SpellbookOwnerDto[] }>('GET', '/api/spellbooks'),
};
