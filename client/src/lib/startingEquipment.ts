import type { CatalogItemDto } from '@zauberbuch/shared';

/**
 * Startausrüstung aus den Wiki-Texten von Klasse und Hintergrund, z. B.
 * „- (a) eine leichte Armbrust mit 20 Bolzen oder (b) eine einfache Waffe“ oder „- Lederrüstung, zwei Dolche und Diebeswerkzeug“.
 * Jede Zeile wird zu einer festen Gruppe oder einer Auswahl; jede Option besteht aus Teilen (Gegenstand mit Anzahl,
 * Platzhalter wie „eine einfache Waffe“ oder Münzen).
 */

export type Placeholder = 'simple' | 'simpleMelee' | 'martial' | 'martialMelee' | 'instrument' | 'artisan' | 'any';

export interface EquipmentPart {
  /** Originaltext des Teils */
  text: string;
  qty: number;
  /** Eintrag der Gegenstands-Datenbank (verknüpft) */
  item: CatalogItemDto | null;
  /** Name, wenn kein Eintrag gefunden wurde (z. B. „Entdeckerausrüstung“, „heiliges Symbol“) */
  name: string;
  /** frei wählbarer Gegenstand einer Art */
  placeholder: Placeholder | null;
  /** Inhalt eines Ausrüstungspakets (SRD), z. B. Entdeckerausrüstung */
  pack: { name: string; qty: number }[] | null;
  /** Münzen, z. B. 15 GM */
  coins: { gp?: number; sp?: number; cp?: number; ep?: number; pp?: number } | null;
}

export interface EquipmentOption {
  label: string;
  parts: EquipmentPart[];
}

export interface EquipmentLine {
  /** Herkunft (Klasse oder Hintergrund) */
  source: string;
  text: string;
  options: EquipmentOption[];
}

const NUMBER_WORDS: Record<string, number> = {
  ein: 1,
  eine: 1,
  einen: 1,
  einem: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  zehn: 10,
  zwanzig: 20,
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  ten: 10,
  twenty: 20,
};
const COIN: Record<string, keyof NonNullable<EquipmentPart['coins']>> = { gm: 'gp', gp: 'gp', sm: 'sp', sp: 'sp', km: 'cp', cp: 'cp', em: 'ep', ep: 'ep', pm: 'pp', pp: 'pp' };
const lower = (s: string) => s.toLocaleLowerCase('de');
/** Bekannte andere Namen bzw. Kurzformen → Name in der Gegenstands-Datenbank */
const ALIASES: Record<string, string> = { handaxt: 'beil', holzschild: 'schild', pfeil: 'pfeile (20)', pfeile: 'pfeile (20)', pfeilen: 'pfeile (20)', bolzen: 'bolzen (20)' };
/** Munition wird in der Datenbank im Bündel zu 20 geführt */
const BUNDLES: Record<string, number> = { 'pfeile (20)': 20, 'bolzen (20)': 20 };

/** Inhalt der Ausrüstungspakete nach SRD 5.1 (Namen wie in der Gegenstands-Datenbank, sonst als Text) */
export const PACKS: Record<string, { name: string; qty: number }[]> = {
  einbrecherausrüstung: [
    { name: 'Rucksack', qty: 1 },
    { name: 'Kugellager (Beutel mit 1000)', qty: 1 },
    { name: 'Schnur (3 m)', qty: 1 },
    { name: 'Glocke', qty: 1 },
    { name: 'Kerze', qty: 5 },
    { name: 'Brechstange', qty: 1 },
    { name: 'Hammer', qty: 1 },
    { name: 'Kletterhaken', qty: 10 },
    { name: 'Laterne (Kapuze)', qty: 1 },
    { name: 'Öl (Flasche)', qty: 2 },
    { name: 'Rationen (1 Tag)', qty: 5 },
    { name: 'Zunderkästchen', qty: 1 },
    { name: 'Wasserschlauch', qty: 1 },
    { name: 'Seil (Hanf, 15 m)', qty: 1 },
  ],
  diplomatenausrüstung: [
    { name: 'Truhe', qty: 1 },
    { name: 'Schriftrollenbehälter', qty: 2 },
    { name: 'Feine Kleidung', qty: 1 },
    { name: 'Tinte und Feder', qty: 1 },
    { name: 'Lampe', qty: 1 },
    { name: 'Öl (Flasche)', qty: 2 },
    { name: 'Papier (1 Blatt)', qty: 5 },
    { name: 'Parfüm (Phiole)', qty: 1 },
    { name: 'Siegelwachs', qty: 1 },
    { name: 'Seife', qty: 1 },
  ],
  gewölbeausrüstung: [
    { name: 'Rucksack', qty: 1 },
    { name: 'Brechstange', qty: 1 },
    { name: 'Hammer', qty: 1 },
    { name: 'Kletterhaken', qty: 10 },
    { name: 'Fackel', qty: 10 },
    { name: 'Zunderkästchen', qty: 1 },
    { name: 'Rationen (1 Tag)', qty: 10 },
    { name: 'Wasserschlauch', qty: 1 },
    { name: 'Seil (Hanf, 15 m)', qty: 1 },
  ],
  unterhaltungsausrüstung: [
    { name: 'Rucksack', qty: 1 },
    { name: 'Schlafsack', qty: 1 },
    { name: 'Kostüm', qty: 2 },
    { name: 'Kerze', qty: 5 },
    { name: 'Rationen (1 Tag)', qty: 5 },
    { name: 'Wasserschlauch', qty: 1 },
    { name: 'Verkleidungsausrüstung', qty: 1 },
  ],
  entdeckerausrüstung: [
    { name: 'Rucksack', qty: 1 },
    { name: 'Schlafsack', qty: 1 },
    { name: 'Essgeschirr', qty: 1 },
    { name: 'Zunderkästchen', qty: 1 },
    { name: 'Fackel', qty: 10 },
    { name: 'Rationen (1 Tag)', qty: 10 },
    { name: 'Wasserschlauch', qty: 1 },
    { name: 'Seil (Hanf, 15 m)', qty: 1 },
  ],
  priesterausrüstung: [
    { name: 'Rucksack', qty: 1 },
    { name: 'Decke', qty: 1 },
    { name: 'Kerze', qty: 10 },
    { name: 'Zunderkästchen', qty: 1 },
    { name: 'Almosenkasten', qty: 1 },
    { name: 'Räucherwerk (Block)', qty: 2 },
    { name: 'Weihrauchfass', qty: 1 },
    { name: 'Gewänder', qty: 1 },
    { name: 'Rationen (1 Tag)', qty: 2 },
    { name: 'Wasserschlauch', qty: 1 },
  ],
  gelehrtenausrüstung: [
    { name: 'Rucksack', qty: 1 },
    { name: 'Buch (Wissen)', qty: 1 },
    { name: 'Tinte und Feder', qty: 1 },
    { name: 'Pergament (1 Blatt)', qty: 10 },
    { name: 'Kleines Messer', qty: 1 },
    { name: 'Sandbeutel (klein)', qty: 1 },
  ],
};

const norm = (s: string) =>
  lower(s)
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Mögliche Grundformen eines (deutschen) Plurals: „Handäxte“ → „handaxt“, „Kurzschwerter“ → „kurzschwert“ */
function singulars(word: string): string[] {
  const w = lower(word);
  const out = new Set([w]);
  for (const [end, repl] of [
    ['äxte', 'axt'],
    ['schwerter', 'schwert'],
    ['bögen', 'bogen'],
    ['hämmer', 'hammer'],
    ['stäbe', 'stab'],
    ['en', ''],
    ['er', ''],
    ['e', ''],
    ['n', ''],
    ['s', ''],
  ] as const) {
    if (w.endsWith(end) && w.length - end.length >= 3) out.add(w.slice(0, -end.length) + repl);
  }
  return [...out];
}

function placeholderOf(text: string): Placeholder | null {
  const t = lower(text);
  if (/musikinstrument|instrument/.test(t)) return 'instrument';
  if (/handwerkszeug|handwerker/.test(t)) return 'artisan';
  const melee = /nahkampf/.test(t);
  if (/kriegswaffe|martial/.test(t)) return melee ? 'martialMelee' : 'martial';
  if (/einfache\w*\s+(nahkampf)?waffe|simple/.test(t)) return melee ? 'simpleMelee' : 'simple';
  if (/beliebige\w* waffe|\bwaffen?\b/.test(t)) return 'any';
  return null;
}

/** Ob ein Datenbank-Eintrag zu einem Platzhalter passt */
export function matchesPlaceholder(item: CatalogItemDto, p: Placeholder): boolean {
  const d = lower(item.description);
  if (p === 'instrument') return item.category === 'tool' && item.toolType === 'instrument';
  if (p === 'artisan') return item.category === 'tool' && item.toolType === 'artisan';
  if (item.category !== 'weapon') return false;
  const simple = d.includes('einfache') || d.includes('simple');
  const melee = d.includes('nahkampf') || d.includes('melee');
  if (p === 'simple') return simple;
  if (p === 'simpleMelee') return simple && melee;
  if (p === 'martial') return !simple;
  if (p === 'martialMelee') return !simple && melee;
  return true;
}

function parsePart(raw: string, catalog: CatalogItemDto[]): EquipmentPart {
  const text = raw
    .replace(/\s*\((?:bei übung|if proficient)[^)]*\)/gi, '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();
  const coin = /(\d+)\s*(gm|gp|sm|sp|km|cp|em|ep|pm|pp)\b/i.exec(text);
  if (coin) return { text: raw.trim(), qty: 1, item: null, name: '', placeholder: null, pack: null, coins: { [COIN[lower(coin[2])]]: Number(coin[1]) } };
  const words = text.split(/\s+/).filter(Boolean);
  let qty = 1;
  if (words.length > 1 && /^\d+$/.test(words[0])) qty = Number(words.shift());
  else if (words.length > 1 && NUMBER_WORDS[lower(words[0])] !== undefined) qty = NUMBER_WORDS[lower(words.shift()!)];
  const rest = words.join(' ');
  const placeholder = placeholderOf(rest);
  // Datenbank: ganzer Ausdruck, sonst Adjektiv + Nomen bzw. Nomen allein, jeweils mit Pluralformen und Aliasen
  const byName = new Map(catalog.map((c) => [norm(c.name), c]));
  const candidates: string[] = [];
  const last = words[words.length - 1] ?? '';
  const head = words.slice(0, -1).join(' ');
  for (const s of singulars(last)) {
    candidates.push(norm(`${head} ${s}`), s, ALIASES[s] ?? '');
    for (const adj of singulars(words[words.length - 2] ?? '')) if (words.length >= 2) candidates.push(norm(`${adj} ${s}`));
  }
  let item: CatalogItemDto | null = null;
  for (const c of candidates) {
    if (!c) continue;
    const direct = byName.get(c) ?? catalog.find((x) => lower(x.name) === c) ?? null;
    if (direct) {
      item = direct;
      break;
    }
  }
  if (item && placeholder && !BUNDLES[lower(item.name)]) return { text: raw.trim(), qty, item: null, name: '', placeholder, pack: null, coins: null };
  if (item && BUNDLES[lower(item.name)]) qty = Math.max(1, Math.round(qty / BUNDLES[lower(item.name)]));
  if (!item && placeholder) return { text: raw.trim(), qty, item: null, name: '', placeholder, pack: null, coins: null };
  const name = item ? item.name : rest.replace(/^(ein|eine|einen|einem)\s+/i, '').replace(/^./, (c) => c.toUpperCase());
  return { text: raw.trim(), qty, item, name, placeholder: null, pack: item ? null : (PACKS[lower(name)] ?? null), coins: null };
}

/** Teile einer Option: „Lederrüstung, Langbogen und 20 Pfeile“, „eine leichte Armbrust mit 20 Bolzen“, „Ein Beutel mit 15 GM“ */
function parseOption(text: string, catalog: CatalogItemDto[]): EquipmentOption {
  const label = text.replace(/\s*\((?:bei übung|if proficient)[^)]*\)/gi, '').trim();
  const pieces = label
    .split(/,\s*|\s+und\s+|\s+and\s+|\s+mit\s+|\s+with\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return { label, parts: pieces.map((p) => parsePart(p, catalog)) };
}

/** Zerlegt einen Ausrüstungstext in Zeilen mit Optionen */
export function parseEquipment(text: string, source: string, catalog: CatalogItemDto[]): EquipmentLine[] {
  const lines = text
    .split('\n')
    .map((l) =>
      l
        .replace(/^\s*[-*•]\s*/, '')
        .replace(/\*\*?/g, '')
        .trim(),
    )
    .filter(Boolean);
  return lines.map((line) => {
    let options: string[];
    if (/\([a-e]\)/i.test(line)) {
      options = line
        .split(/\s*\([a-e]\)\s*/i)
        .map((s) => s.replace(/(,|\s+oder|\s+or)\s*$/i, '').trim())
        .filter(Boolean);
    } else {
      options = /\s+oder\s+|\s+or\s+/i.test(line) && !/\(/.test(line) ? line.split(/\s+oder\s+|\s+or\s+/i) : [line];
    }
    // „eine Diplomaten- oder (b) eine Unterhaltungsausrüstung“ → Diplomatenausrüstung
    const tail = /(ausrüstung|werkzeug|pack)$/i.exec(options[options.length - 1] ?? '')?.[1] ?? '';
    options = options.map((o) => (o.endsWith('-') && tail ? o.slice(0, -1) + tail : o));
    return { source, text: line, options: options.map((o) => parseOption(o, catalog)) };
  });
}
