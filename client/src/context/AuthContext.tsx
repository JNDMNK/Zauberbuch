import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { isEditorRole, type AppConfigDto, type Locale, type UserDto } from '@zauberbuch/shared';
import { api } from '../lib/api';
import { storedLanguage, storeLanguage } from '../i18n';
import { asLocale } from '../lib/spellText';

interface AuthApi {
  user: UserDto | null;
  config: AppConfigDto | null;
  loading: boolean;
  isAdmin: boolean;
  /** Admin oder Dungeon Master */
  isEditor: boolean;
  language: Locale;
  login: (identifier: string, password: string) => Promise<UserDto>;
  logout: () => Promise<void>;
  setUser: (user: UserDto) => void;
  setLanguage: (lang: Locale) => void;
  favoriteIds: Set<string>;
  isFavorite: (spellId: string) => boolean;
  /** Optimistisches Umschalten; bei Fehler wird zurückgesetzt und der Fehler geworfen. */
  toggleFavorite: (spellId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [user, setUserState] = useState<UserDto | null>(null);
  const [config, setConfig] = useState<AppConfigDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const pending = useRef(new Set<string>());

  const loadFavorites = useCallback(async () => {
    try {
      const { spellIds } = await api.favorites();
      setFavoriteIds(new Set(spellIds));
    } catch {
      setFavoriteIds(new Set());
    }
  }, []);

  const applyUser = useCallback(
    (u: UserDto | null) => {
      setUserState(u);
      if (u) {
        void i18n.changeLanguage(u.language);
        void loadFavorites();
      } else {
        setFavoriteIds(new Set());
      }
    },
    [i18n, loadFavorites],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, me] = await Promise.all([api.config(), api.me()]);
        if (cancelled) return;
        setConfig(cfg);
        if (me.user) applyUser(me.user);
        else if (!storedLanguage()) void i18n.changeLanguage(cfg.defaultLanguage);
      } catch {
        // Server nicht erreichbar – App bleibt im Gastmodus nutzbar
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyUser, i18n]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const { user: u } = await api.login(identifier, password);
      applyUser(u);
      return u;
    },
    [applyUser],
  );

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    applyUser(null);
  }, [applyUser]);

  const setLanguage = useCallback(
    (lang: Locale) => {
      void i18n.changeLanguage(lang);
      storeLanguage(lang);
      if (user) {
        setUserState({ ...user, language: lang });
        api.updateMe(lang).catch(() => undefined);
      }
    },
    [i18n, user],
  );

  const toggleFavorite = useCallback(async (spellId: string) => {
    if (pending.current.has(spellId)) return favoriteIds.has(spellId);
    const wasFavorite = favoriteIds.has(spellId);
    const update = (fav: boolean) =>
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (fav) next.add(spellId);
        else next.delete(spellId);
        return next;
      });
    update(!wasFavorite);
    pending.current.add(spellId);
    try {
      if (wasFavorite) await api.removeFavorite(spellId);
      else await api.addFavorite(spellId);
      return !wasFavorite;
    } catch (err) {
      update(wasFavorite);
      throw err;
    } finally {
      pending.current.delete(spellId);
    }
  }, [favoriteIds]);

  const value = useMemo<AuthApi>(
    () => ({
      user,
      config,
      loading,
      isAdmin: user?.role === 'admin',
      isEditor: isEditorRole(user?.role),
      language: asLocale(i18n.language),
      login,
      logout,
      setUser: setUserState,
      setLanguage,
      favoriteIds,
      isFavorite: (id) => favoriteIds.has(id),
      toggleFavorite,
    }),
    [user, config, loading, i18n.language, login, logout, setLanguage, favoriteIds, toggleFavorite],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
