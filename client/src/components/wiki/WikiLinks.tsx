import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { localized, type CatalogItemDto, type WikiEntryDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../Modal';
import { CatalogCard } from '../catalog/CatalogCard';
import { WikiDetail } from './WikiDetail';

/** Ziel eines automatischen Querverweises */
export interface LinkTarget {
  key: string;
  kind: 'entry' | 'item' | 'spell';
  id: string;
  name: string;
}

export type LinkPart = string | { target: LinkTarget; text: string };

interface LinkData {
  entries: WikiEntryDto[];
  /** gespeicherte Einträge (deutsche und englische Namen zum Nachschlagen) */
  raw: WikiEntryDto[];
  rawItems: CatalogItemDto[];
  items: CatalogItemDto[];
  targets: Map<string, LinkTarget>;
  byName: Map<string, LinkTarget>;
  regex: RegExp | null;
}

interface LinkCtx {
  data: LinkData | null;
  ensure: () => void;
  invalidate: () => void;
  open: (target: LinkTarget) => void;
}

const Ctx = createContext<LinkCtx | null>(null);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lower = (s: string) => s.toLocaleLowerCase('de');
/** Kategorien der Gegenstands-Datenbank, die verlinkt werden (Abenteuerausrüstung wie „Seil“ oder „Buch“ wäre zu allgemein) */
const LINKED_CATEGORIES = new Set(['armor', 'weapon', 'tool']);

function buildData(rawEntries: WikiEntryDto[], rawItems: CatalogItemDto[], spells: { slug: string; name: string }[], lang: string): LinkData {
  // Anzeige in der gewählten Sprache; verlinkt werden deutsche und englische Namen
  const entries = rawEntries.map((e) => (lang === 'en' ? { ...e, name: localized(e.name, e.nameEn, lang), summary: localized(e.summary, e.summaryEn, lang), description: localized(e.description, e.descriptionEn, lang) } : e));
  const items = rawItems.map((i) => (lang === 'en' ? { ...i, name: localized(i.name, i.nameEn, lang), description: localized(i.description, i.descriptionEn, lang) } : i));
  const targets = new Map<string, LinkTarget>();
  const byName = new Map<string, LinkTarget>();
  const alias = (name: string | undefined, t: LinkTarget) => {
    const n = lower((name ?? '').trim());
    // Wiki-Einträge haben Vorrang vor Gegenständen, diese vor Zaubern (gleiche Reihenfolge wie beim Hinzufügen)
    if (n.length >= 3 && !byName.has(n)) byName.set(n, t);
  };
  const add = (t: LinkTarget, other?: string) => {
    targets.set(t.key, t);
    alias(t.name, t);
    alias(other, t);
  };
  rawEntries.forEach((e, k) => add({ key: `e-${e.id}`, kind: 'entry', id: e.id, name: entries[k].name }, lang === 'en' ? e.name : e.nameEn));
  rawItems.forEach((i, k) => {
    if (!i.hidden && LINKED_CATEGORIES.has(i.category)) add({ key: `i-${i.id}`, kind: 'item', id: i.id, name: items[k].name }, lang === 'en' ? i.name : i.nameEn);
  });
  for (const s of spells) add({ key: `s-${s.slug}`, kind: 'spell', id: s.slug, name: s.name });
  const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(escapeRe);
  // Ganze Wörter; deutsche Endungen (Genitiv, Plural, Adjektivendungen wie „vergifteten“) sind erlaubt
  const regex = names.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${names.join('|')})(?:e|en|er|es|em|n|s)?(?![\\p{L}\\p{N}])`, 'giu') : null;
  return { entries, raw: rawEntries, rawItems, items, targets, byName, regex };
}

/** Zerlegt einen Text in Text- und Verweis-Teile. Jedes Ziel wird nur beim ersten Vorkommen verlinkt (`seen`). */
export function splitLinks(text: string, data: LinkData, seen: Set<string>, selfKey?: string): LinkPart[] {
  if (!data.regex || !text) return [text];
  const parts: LinkPart[] = [];
  let last = 0;
  for (const m of text.matchAll(data.regex)) {
    const target = data.byName.get(lower(m[1]));
    if (!target || target.key === selfKey || seen.has(target.key)) continue;
    // Kurze Namen (z. B. Götter wie „Ra“ oder „Tyr“) nur bei exakter Schreibweise
    if (target.name.length < 5 && m[1] !== target.name) continue;
    seen.add(target.key);
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ target, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Stellt die Daten für Querverweise bereit und zeigt verlinkte Einträge in einem Dialog an */
export function WikiLinkProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<LinkData | null>(null);
  const [shown, setShown] = useState<LinkTarget | null>(null);
  const loading = useRef(false);
  const wanted = useRef(false);
  const lang = i18n.language.startsWith('en') ? 'en' : 'de';

  const load = useCallback(() => {
    if (loading.current || !user) return;
    loading.current = true;
    Promise.all([api.wiki(), api.catalog(), api.spellNames()])
      .then(([w, c, s]) =>
        setData(
          buildData(
            w.entries,
            c.items,
            s.spells.flatMap((x) => ((x[lang] ?? x.de ?? x.en) ? [{ slug: x.slug, name: (x[lang] ?? x.de ?? x.en)! }] : [])),
            lang,
          ),
        ),
      )
      .catch(() => undefined)
      .finally(() => (loading.current = false));
  }, [user, lang]);

  const ensure = useCallback(() => {
    wanted.current = true;
    if (!data) load();
  }, [data, load]);
  // Sprache gewechselt: Zaubernamen neu laden
  useEffect(() => {
    if (wanted.current) load();
  }, [load]);

  const open = useCallback(
    (target: LinkTarget) => {
      if (target.kind === 'spell') {
        const background = (location.state as { background?: Location } | null)?.background ?? location;
        setShown(null);
        navigate(`/spells/${target.id}`, { state: { background } });
      } else setShown(target);
    },
    [location, navigate],
  );

  const value = useMemo<LinkCtx>(() => ({ data, ensure, invalidate: () => (data ? load() : undefined), open }), [data, ensure, load, open]);
  const entry = shown?.kind === 'entry' ? data?.entries.find((e) => e.id === shown.id) : undefined;
  const item = shown?.kind === 'item' ? data?.items.find((i) => i.id === shown.id) : undefined;

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal open={!!(entry || item)} title={entry?.name ?? item?.name ?? ''} onClose={() => setShown(null)} size={entry ? 'max-w-3xl' : 'max-w-2xl'}>
        {entry && data && (
          <WikiDetail
            key={entry.id}
            entry={entry}
            findEntry={(k, name) => {
              const r = data.raw.find((x) => x.kind === k && (lower(x.name) === lower(name) || (x.nameEn && lower(x.nameEn) === lower(name))));
              return r ? data.entries.find((x) => x.id === r.id) : undefined;
            }}
            onOpen={(id) => setShown(data.targets.get(`e-${id}`) ?? null)}
          />
        )}
        {item && <CatalogCard item={item} />}
      </Modal>
    </Ctx.Provider>
  );
}

/**
 * Überschreibt innerhalb eines Bereichs, wie Verweise geöffnet werden (z. B. im Wiki über die Adresszeile).
 * `onOpen` gibt true zurück, wenn es den Verweis selbst behandelt hat.
 */
export function WikiLinkScope({ onOpen, children }: { onOpen: (target: LinkTarget) => boolean; children: ReactNode }) {
  const parent = useContext(Ctx);
  const value = useMemo<LinkCtx | null>(() => parent && { ...parent, open: (t) => (onOpen(t) ? undefined : parent.open(t)) }, [parent, onOpen]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Zugriff auf die Querverweise; lädt die Daten beim ersten Gebrauch. `enabled=false` schaltet sie ab. */
export function useWikiLinks(enabled = true) {
  const ctx = useContext(Ctx);
  useEffect(() => {
    if (enabled) ctx?.ensure();
  }, [enabled, ctx]);
  return enabled && ctx?.data ? { data: ctx.data, open: ctx.open } : null;
}

/** Nach Änderungen am Wiki die Verweisdaten neu laden */
export function useInvalidateWikiLinks() {
  const ctx = useContext(Ctx);
  return useCallback(() => ctx?.invalidate(), [ctx]);
}

/** Knopf, der wie ein Link aussieht und den Verweis öffnet */
export function WikiLinkButton({ target, children, onOpen }: { target: LinkTarget; children: ReactNode; onOpen: (t: LinkTarget) => void }) {
  return (
    <button
      type="button"
      className="wiki-link"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(target);
      }}
    >
      {children}
    </button>
  );
}

/** Reiner Text mit automatischen Verweisen (für Felder ohne Markdown) */
export function LinkedText({ text, selfKey }: { text: string; selfKey?: string }) {
  const links = useWikiLinks();
  if (!links) return <>{text}</>;
  return (
    <>
      {splitLinks(text, links.data, new Set(), selfKey).map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : (
          <WikiLinkButton key={i} target={p.target} onOpen={links.open}>
            {p.text}
          </WikiLinkButton>
        ),
      )}
    </>
  );
}

/**
 * Anzeige gespeicherter deutscher Namen (Sprachen, Götter, Werkzeuge, Völker, Klassen …) in der gewählten Sprache.
 * Gespeichert und verglichen wird weiterhin der deutsche Name; ohne englische Fassung bleibt er stehen.
 */
export function useContentLabels() {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const linker = useWikiLinks(en);
  return useMemo(() => {
    const map = new Map<string, string>();
    if (en && linker) {
      for (const e of linker.data.raw) if (e.nameEn) map.set(`${e.kind}:${lower(e.name)}`, e.nameEn);
      for (const i of linker.data.rawItems) if (i.nameEn) map.set(`item:${lower(i.name)}`, i.nameEn);
    }
    const get = (prefix: string) => (name: string) => (name ? (map.get(`${prefix}:${lower(name.trim())}`) ?? name) : name);
    return { language: get('language'), god: get('god'), item: get('item'), race: get('race'), cls: get('class'), background: get('background'), feat: get('feat') };
  }, [en, linker]);
}
