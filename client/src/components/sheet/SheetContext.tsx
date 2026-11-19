import { createContext, useContext } from 'react';
import type { CharacterItemsDto, CharacterSheet, Lifestyle } from '@zauberbuch/shared';

export type Path = readonly (string | number)[];

export interface SheetCtx {
  sheet: CharacterSheet;
  set: (path: Path, value: unknown) => void;
  readOnly: boolean;
  /** Lebensstile mit täglichen Kosten (Geschichte des Bogens bzw. Standardwerte) */
  lifestyles: Lifestyle[];
  /** Auswahllisten für Sprachen und Werkzeuge & andere */
  languages: string[];
  tools: string[];
  /** Magische Gegenstände des Bogens (null = lädt) */
  items: { data: CharacterItemsDto | null; reload: () => void };
}

export const SheetContext = createContext<SheetCtx | null>(null);

export function useSheet(): SheetCtx {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error('useSheet must be used within SheetContext');
  return ctx;
}

export function getIn(obj: unknown, path: Path): unknown {
  return path.reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string | number, unknown>)[k]), obj);
}

/** Unveränderliches Setzen eines Werts über einen Pfad */
export function setIn<T>(obj: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const current = (obj as Record<string | number, unknown>)[head];
  const next = setIn(current, rest, value);
  if (Array.isArray(obj)) {
    const copy = [...obj];
    copy[head as number] = next;
    return copy as T;
  }
  return { ...(obj as object), [head]: next } as T;
}
