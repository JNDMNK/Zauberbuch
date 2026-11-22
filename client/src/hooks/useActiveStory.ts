import { useCallback, useEffect, useState } from 'react';
import { sourceAllowed } from '@zauberbuch/shared';
import { api, type MyStoryDto } from '../lib/api';
import { useAuth } from '../context/AuthContext';

// Gemeinsamer Zwischenspeicher, damit nicht jede Seite die Geschichten neu lädt
let cache: { userId: string; stories: MyStoryDto[] } | null = null;
let pending: Promise<MyStoryDto[]> | null = null;
const listeners = new Set<() => void>();

function load(userId: string, force = false): Promise<MyStoryDto[]> {
  if (!force && cache?.userId === userId) return Promise.resolve(cache.stories);
  if (!force && pending) return pending;
  pending = api
    .myStories()
    .then((r) => {
      cache = { userId, stories: r.stories };
      listeners.forEach((l) => l());
      return r.stories;
    })
    .finally(() => (pending = null));
  return pending;
}

/** Geschichten des Benutzers neu laden (z. B. nach Änderungen in der Verwaltung) */
export function reloadMyStories() {
  if (cache) void load(cache.userId, true);
}

/**
 * Aktive Geschichte der Geschichten-Ansicht mit ihren Quellen. `allowed(sourceId)` prüft Einträge gegen die Quellen
 * (ohne Geschichte bzw. ohne Einschränkung immer true); `toGeneral()` wechselt in die allgemeine Ansicht.
 */
export function useActiveStory() {
  const { user, setUser } = useAuth();
  const [stories, setStories] = useState<MyStoryDto[] | null>(cache && user && cache.userId === user.id ? cache.stories : null);
  useEffect(() => {
    if (!user) return;
    const update = () => cache?.userId === user.id && setStories(cache.stories);
    listeners.add(update);
    load(user.id).then(
      () => update(),
      () => setStories([]),
    );
    return () => void listeners.delete(update);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const story = (user?.activeStoryId && stories?.find((s) => s.id === user.activeStoryId)) || null;
  const restricted = !!story?.sources;
  const allowed = useCallback((sourceId: string | null | undefined) => sourceAllowed(story?.sources, sourceId), [story?.sources]);
  const toGeneral = useCallback(async () => {
    const r = await api.setActiveStory(null);
    setUser(r.user);
  }, [setUser]);
  return { story, stories, restricted, allowed, toGeneral, loading: !!user?.activeStoryId && stories === null };
}
