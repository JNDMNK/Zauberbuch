import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpellDto } from '@zauberbuch/shared';
import { api } from '../lib/api';
import { filtersToApiParams, type SpellFilters } from '../lib/filters';

const PAGE_SIZE = 24;

interface State {
  items: SpellDto[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: unknown;
}

/** Serverseitige Suche mit Infinite Scroll (Seiten werden angehängt). */
export function useSpellSearch(
  filters: SpellFilters,
  opts: { lang: string; favoritesOnly?: boolean; ownerId?: string; enabled?: boolean; /** nur Zauber aus den Quellen dieser Geschichte */ storyId?: string },
) {
  const [state, setState] = useState<State>({ items: [], total: 0, page: 0, totalPages: 1, loading: true, error: null });
  const abortRef = useRef<AbortController | null>(null);
  const key = JSON.stringify([filters, opts.lang, opts.favoritesOnly, opts.ownerId, opts.storyId]);
  const enabled = opts.enabled !== false;

  const fetchPage = useCallback(
    async (page: number, replace: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const params = filtersToApiParams(filters, {
          lang: opts.lang,
          page,
          pageSize: PAGE_SIZE,
          favoritesOnly: opts.favoritesOnly,
          ownerId: opts.ownerId,
        });
        if (opts.storyId) params.set('story', opts.storyId);
        const res = await api.spells(params, controller.signal);
        setState((s) => ({
          items: replace ? res.items : [...s.items, ...res.items.filter((i) => !s.items.some((e) => e.id === i.id))],
          total: res.total,
          page: res.page,
          totalPages: res.totalPages,
          loading: false,
          error: null,
        }));
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState((s) => ({ ...s, loading: false, error: err }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    if (!enabled) return;
    void fetchPage(1, true);
    return () => abortRef.current?.abort();
  }, [fetchPage, key, enabled]);

  const hasMore = state.page < state.totalPages;
  const loadMore = useCallback(() => {
    if (!state.loading && hasMore && !state.error) void fetchPage(state.page + 1, false);
  }, [state.loading, state.page, state.error, hasMore, fetchPage]);

  const retry = useCallback(() => {
    if (state.items.length === 0) void fetchPage(1, true);
    else void fetchPage(state.page + 1, false);
  }, [fetchPage, state.page, state.items.length]);

  const removeItem = useCallback((id: string) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id), total: Math.max(0, s.total - 1) }));
  }, []);

  return { ...state, hasMore, loadMore, retry, removeItem, pageSize: PAGE_SIZE };
}
