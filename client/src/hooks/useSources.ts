import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localized, type SourceDto } from '@zauberbuch/shared';
import { api } from '../lib/api';

/** Quellen werden app-weit einmal geladen und geteilt; nach Änderungen in der Verwaltung neu laden */
let cache: SourceDto[] | null = null;
let pending: Promise<SourceDto[]> | null = null;
const listeners = new Set<(l: SourceDto[]) => void>();

function fetchSources() {
  pending ??= api
    .sourceList()
    .then((r) => {
      cache = r.sources;
      listeners.forEach((fn) => fn(r.sources));
      return r.sources;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function reloadSources() {
  return fetchSources();
}

export function useSources() {
  const [list, setList] = useState<SourceDto[] | null>(cache);
  useEffect(() => {
    listeners.add(setList);
    if (!cache) fetchSources().catch(() => setList([]));
    return () => {
      listeners.delete(setList);
    };
  }, []);
  const { i18n } = useTranslation();
  const byId = (id: string | null | undefined) => (id ? (list?.find((s) => s.id === id) ?? null) : null);
  /** Anzeige in der gewählten Sprache (gespeichert und verglichen wird weiterhin der deutsche Name) */
  const label = (s: Pick<SourceDto, 'name' | 'nameEn'>) => localized(s.name, s.nameEn, i18n.language);
  const abbr = (s: Pick<SourceDto, 'abbreviation' | 'abbreviationEn'>) => localized(s.abbreviation, s.abbreviationEn, i18n.language);
  return { sources: list ?? [], loaded: list !== null, byId, label, abbr };
}
