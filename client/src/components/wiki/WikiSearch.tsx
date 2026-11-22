import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import type { CatalogItemDto, WikiEntryDto } from '@zauberbuch/shared';

/** Ein Treffer der globalen Wiki-Suche: Wiki-Eintrag oder Eintrag der Gegenstands-Datenbank */
export interface WikiHit {
  type: 'entry' | 'item';
  id: string;
  /** Bereich (Wiki-Art oder Katalog-Kategorie) */
  area: string;
  name: string;
  /** Textausschnitt, wenn der Treffer nicht im Namen liegt */
  snippet: string;
  rank: number;
}

const norm = (s: string) => s.toLocaleLowerCase('de');

/** Ausschnitt rund um die Fundstelle (Markdown-Zeichen entfernt) */
function snippetAround(text: string, needle: string) {
  const plain = text.replace(/[#*_>`|]/g, '').replace(/\s+/g, ' ');
  const i = norm(plain).indexOf(needle);
  if (i < 0) return '';
  const start = Math.max(0, i - 40);
  return (start > 0 ? '… ' : '') + plain.slice(start, i + needle.length + 60).trim() + (i + needle.length + 60 < plain.length ? ' …' : '');
}

/** Hebt die Fundstelle hervor */
function Highlight({ text, needle }: { text: string; needle: string }) {
  const i = norm(text).indexOf(needle);
  if (!needle || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-parchment-300 px-0 font-semibold text-ink dark:bg-parchment-700 dark:text-parchment-50">{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}

/** Durchsucht Wiki-Einträge und die Gegenstands-Datenbank (Name vor Kurzbeschreibung vor Beschreibung/Werten) */
export function searchWiki(entries: WikiEntryDto[], items: CatalogItemDto[], query: string): WikiHit[] {
  const needle = norm(query.trim());
  if (needle.length < 2) return [];
  const hits: WikiHit[] = [];
  const add = (type: WikiHit['type'], id: string, area: string, name: string, texts: string[]) => {
    const n = norm(name);
    if (n.includes(needle)) return hits.push({ type, id, area, name, snippet: '', rank: n.startsWith(needle) ? 0 : 1 });
    for (const [i, text] of texts.entries()) {
      if (text && norm(text).includes(needle)) return hits.push({ type, id, area, name, snippet: snippetAround(text, needle), rank: 2 + i });
    }
  };
  for (const e of entries)
    add('entry', e.id, e.kind, e.name, [
      e.summary,
      e.description,
      Object.values(e.data as Record<string, unknown>)
        .filter((v) => typeof v === 'string')
        .join(' · '),
    ]);
  for (const i of items) if (!i.hidden) add('item', i.id, i.category, i.name, [i.description]);
  return hits.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'de'));
}

/**
 * Suchfeld über das ganze Wiki mit Trefferliste nach Bereichen gruppiert.
 * Pfeiltasten wählen, Enter öffnet, Escape schließt.
 */
export function WikiSearch({
  entries,
  items,
  areas,
  areaLabel,
  areaIcon,
  onPick,
}: {
  entries: WikiEntryDto[];
  items: CatalogItemDto[];
  /** Reihenfolge der Bereiche in der Trefferliste */
  areas: readonly string[];
  areaLabel: (area: string) => string;
  areaIcon: (area: string) => ReactNode;
  onPick: (hit: WikiHit) => void;
}) {
  const { t } = useTranslation();
  const listId = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const needle = norm(q.trim());

  const all = useMemo(() => searchWiki(entries, items, q), [entries, items, q]);
  // Nach Bereich gruppiert (höchstens 8 je Bereich), die Reihenfolge der Bereiche folgt der Navigation
  const groups = useMemo(
    () =>
      areas
        .map((area) => {
          const list = all.filter((h) => h.area === area);
          return { area, total: list.length, hits: list.slice(0, 8) };
        })
        .filter((g) => g.total > 0),
    [all, areas],
  );
  const flat = groups.flatMap((g) => g.hits);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  const pick = (h: WikiHit) => {
    setOpen(false);
    onPick(h);
  };
  const showList = open && needle.length >= 2;

  return (
    <div ref={box} className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-parchment-700 dark:text-parchment-400" aria-hidden />
      <input
        type="search"
        className="input !py-3 !pl-11 text-base"
        value={q}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          else if (e.key === 'ArrowDown') (e.preventDefault(), setOpen(true), setActive((a) => Math.min(a + 1, flat.length - 1)));
          else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
          else if (e.key === 'Enter' && showList && flat[active]) (e.preventDefault(), pick(flat[active]));
        }}
        placeholder={t('wiki.globalSearch')}
        aria-label={t('wiki.globalSearch')}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && flat[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
      />
      {showList && (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-[min(28rem,70vh)] overflow-y-auto rounded-lg border border-parchment-400 bg-parchment-50 p-1.5 shadow-cardhover dark:border-night-700 dark:bg-night-800"
        >
          {groups.length === 0 ? (
            <p className="px-3 py-4 text-center italic text-parchment-700 dark:text-parchment-400">{t('wiki.noHits')}</p>
          ) : (
            groups.map((g) => (
              <div key={g.area} role="group" aria-label={areaLabel(g.area)}>
                <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-2 font-display text-xs font-bold uppercase tracking-wider text-parchment-600 dark:text-parchment-400">
                  {areaIcon(g.area)}
                  {areaLabel(g.area)} · {g.total}
                  {g.total > g.hits.length && <span className="font-serif font-normal normal-case tracking-normal">({t('wiki.moreHits', { count: g.total - g.hits.length })})</span>}
                </p>
                {g.hits.map((h) => {
                  const i = flat.indexOf(h);
                  return (
                    <div
                      key={h.type + h.id}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(h)}
                      onMouseMove={() => setActive(i)}
                      className={`flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-1.5 ${i === active ? 'bg-parchment-200 dark:bg-night-700' : ''}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block break-words">
                          <Highlight text={h.name} needle={needle} />
                        </span>
                        {h.snippet && (
                          <span className="block break-words text-sm italic text-parchment-700 dark:text-parchment-400">
                            <Highlight text={h.snippet} needle={needle} />
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 pt-0.5 text-xs text-parchment-700 dark:text-parchment-400">{areaLabel(h.area)}</span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
