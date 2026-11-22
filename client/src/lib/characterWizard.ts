import {
  ABILITIES,
  SKILL_KEYS,
  abilityModifier,
  characterSheetSchema,
  type Ability,
  type CatalogItemDto,
  type CharacterSheet,
  type SheetItem,
  type SkillKey,
  type SpellClass,
  type WikiEntryDto,
} from '@zauberbuch/shared';

/**
 * Logik des Assistenten für neue Charaktere: liest die (deutschen) Texte der Wiki-Einträge zu Volk, Klasse und
 * Hintergrund aus und befüllt daraus einen Charakterbogen der Stufe 1.
 */

export type RaceEntry = Extract<WikiEntryDto, { kind: 'race' }>;
export type ClassEntry = Extract<WikiEntryDto, { kind: 'class' }>;
export type BackgroundEntry = Extract<WikiEntryDto, { kind: 'background' }>;

/** Namen (deutsch + englisch) zum Erkennen in Texten */
export type NameMap<K extends string> = Record<K, string[]>;

const NUMBER_WORDS: Record<string, number> = { ein: 1, eine: 1, einen: 1, einem: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, one: 1, two: 2, three: 3, four: 4, five: 5 };
const lower = (s: string) => s.toLocaleLowerCase('de');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordNumber = (w: string | undefined) => (w ? (NUMBER_WORDS[lower(w)] ?? (Number.parseInt(w, 10) || 0)) : 0);

/** Findet alle bekannten Namen in einem Text (Reihenfolge wie in `map`) */
export function findNames<K extends string>(text: string, map: NameMap<K>): K[] {
  const t = lower(text);
  return (Object.keys(map) as K[]).filter((k) => map[k].some((n) => new RegExp(`(?<![\\p{L}])${escapeRe(lower(n))}(?![\\p{L}])`, 'u').test(t)));
}

/** Attributswerterhöhung eines Volkes: „Konstitution +2“, „Alle Attributswerte +1“, „zwei weitere Attributswerte deiner Wahl +1“ */
export function parseAbilityIncrease(text: string, abilities: NameMap<Ability>) {
  const fixed: Partial<Record<Ability, number>> = {};
  for (const a of ABILITIES) {
    for (const n of abilities[a]) {
      const m = new RegExp(`${escapeRe(n)}\\s*\\+\\s*(\\d)`, 'iu').exec(text);
      if (m) fixed[a] = Number(m[1]);
    }
  }
  const all = /alle attributswerte\s*\+\s*(\d)|all ability scores\s*\+\s*(\d)/i.exec(text);
  if (all) for (const a of ABILITIES) fixed[a] = Number(all[1] ?? all[2]);
  const choose = /(\p{L}+)\s+(?:weitere\s+|other\s+)?(?:attributswerte?|ability scores?)[^+]*?(?:deiner wahl|of your choice)\s*\+\s*(\d)/iu.exec(text);
  return { fixed, choose: choose ? { count: wordNumber(choose[1]) || 1, amount: Number(choose[2]) } : null };
}

/** Fertigkeiten: „Zwei aus A, B und C“, „Drei beliebige Fertigkeiten“ oder eine feste Liste „A, B“ */
export function parseSkills(text: string, skills: NameMap<SkillKey>): { fixed: SkillKey[]; choose: { count: number; options: SkillKey[] } | null } {
  if (!text.trim()) return { fixed: [], choose: null };
  const any = /^(\p{L}+)\s+(?:beliebige|any)/iu.exec(text.trim());
  if (any) return { fixed: [], choose: { count: wordNumber(any[1]) || 1, options: [...SKILL_KEYS] } };
  const from = /^(\p{L}+)\s+(?:aus|from|of)\b/iu.exec(text.trim());
  if (from) return { fixed: [], choose: { count: wordNumber(from[1]) || 1, options: findNames(text, skills) } };
  return { fixed: findNames(text, skills), choose: null };
}

/** Anzahl frei wählbarer Einträge: „eine weitere Sprache deiner Wahl“, „Zwei Sprachen deiner Wahl“, „Drei Musikinstrumente deiner Wahl“ */
export function choiceCount(text: string): number {
  let n = 0;
  for (const m of text.matchAll(/(\p{L}+)\s+(?:weitere\s+)?[\p{L}-]+\s+(?:oder\s+(?:ein|eine)\s+[\p{L}-]+\s+)?(?:deiner wahl|of your choice)/giu)) n += wordNumber(m[1]) || 1;
  return n;
}

/** Werkzeug-Art einer freien Wahl („Musikinstrument“, „Handwerkszeug“, „Spiel“) – null = beliebig */
export function toolChoiceType(text: string): CatalogItemDto['toolType'] | null {
  const t = lower(text);
  const instrument = /musikinstrument|instrument/.test(t);
  const artisan = /handwerk|artisan/.test(t);
  if (instrument && !artisan) return 'instrument';
  if (artisan && !instrument) return 'artisan';
  if (/spiel|gaming/.test(t) && !instrument && !artisan) return 'gaming';
  return null;
}

/** Standardreihe und Punktekauf nach SRD */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
export const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_BUDGET = 27;
export const pointBuySpent = (scores: Record<Ability, number>) => ABILITIES.reduce((s, a) => s + (POINT_BUY_COST[scores[a]] ?? 99), 0);

/** 4W6 würfeln, niedrigsten Würfel streichen */
export function roll4d6(): number {
  const d = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => a - b);
  return d[1] + d[2] + d[3];
}

/** Zauberattribut und Zauberplätze auf Stufe 1 (Paladin/Waldläufer zaubern erst ab Stufe 2) */
export const SPELLCASTING: Record<SpellClass, { ability: Ability; slots: number }> = {
  bard: { ability: 'cha', slots: 2 },
  cleric: { ability: 'wis', slots: 2 },
  druid: { ability: 'wis', slots: 2 },
  sorcerer: { ability: 'cha', slots: 2 },
  wizard: { ability: 'int', slots: 2 },
  warlock: { ability: 'cha', slots: 1 },
  artificer: { ability: 'int', slots: 2 },
  paladin: { ability: 'cha', slots: 0 },
  ranger: { ability: 'wis', slots: 0 },
};

/** Niedrigste Stufe, auf der eine Unterklasse gewählt wird (aus den Merkmalen der Unterklassen) */
export function subclassLevel(cls: ClassEntry): number | null {
  const levels = cls.data.subclasses.flatMap((s) => s.features.map((f) => f.level));
  return levels.length ? Math.min(...levels) : null;
}

const plain = (s: string) => s.replace(/\*\*?|__?/g, '').trim();
const featureLines = (list: { name: string; text: string }[]) => list.map((f) => (f.name ? `${plain(f.name)}: ${plain(f.text)}` : plain(f.text))).join('\n\n');
const pick = <T>(list: T[]) => (list.length ? list[Math.floor(Math.random() * list.length)] : undefined);

export interface WizardResult {
  name: string;
  playerName: string;
  race: RaceEntry | null;
  subrace: string;
  cls: ClassEntry | null;
  subclass: string;
  spellClass: SpellClass | null;
  background: BackgroundEntry | null;
  /** Endgültige Attributswerte (inkl. Erhöhungen) */
  abilities: Record<Ability, number>;
  skills: SkillKey[];
  languages: string[];
  tools: string[];
  rollPersonality: boolean;
  /** Startausrüstung als Inventar (null = nur als Text unter „Weitere Merkmale“) */
  inventory: SheetItem[] | null;
  coins: Partial<CharacterSheet['coins']>;
  /** Namen zum Erkennen in Texten */
  abilityNames: NameMap<Ability>;
}

/** Erzeugt den Charakterbogen aus den Entscheidungen im Assistenten */
export function buildSheet(r: WizardResult): CharacterSheet {
  const sheet = characterSheetSchema.parse({});
  const { race, cls, background: bg } = r;
  const sub = race?.data.subraces.find((s) => s.name === r.subrace) ?? null;
  const subclass = cls?.data.subclasses.find((s) => s.name === r.subclass) ?? null;
  const con = abilityModifier(r.abilities.con);
  const dex = abilityModifier(r.abilities.dex);

  sheet.identity.name = r.name.trim();
  sheet.identity.playerName = r.playerName;
  sheet.identity.level = 1;
  sheet.identity.xpNext = 300;
  sheet.identity.race = race ? (sub ? `${race.name} (${sub.name})` : race.name) : '';
  sheet.identity.classLevel = cls ? `${cls.name}${subclass ? ` (${subclass.name})` : ''} 1` : '';
  sheet.identity.background = bg?.name ?? '';
  sheet.identity.size = race
    ? race.data.size
        .split(/\s+[–-]\s+/)[0]
        .trim()
        .slice(0, 30)
    : '';
  sheet.abilities = { ...r.abilities };

  if (cls) {
    for (const a of findNames(cls.data.saves, r.abilityNames)) sheet.savingThrows[a] = true;
    const die = Number.parseInt((cls.data.hitDie ?? '').replace(/\D/g, ''), 10) || 8;
    sheet.combat.hpMax = Math.max(1, die + con);
    sheet.combat.hpCurrent = sheet.combat.hpMax;
    sheet.combat.hitDiceTotal = `1W${die}`;
    sheet.combat.hitDiceCurrent = `1W${die}`;
    const armor = lower(cls.data.armor);
    const all = /alle rüstungen|all armor/.test(armor);
    sheet.proficiencies.armor = {
      light: all || /leichte|light/.test(armor),
      medium: all || /mittelschwere|medium/.test(armor),
      heavy: all || /(?<![\p{L}])(schwere|heavy)/u.test(armor),
      shields: /schild|shield/.test(armor),
    };
    const weapons = cls.data.weapons
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);
    const other = weapons.filter((w) => !/einfache waffen|simple weapons|kriegswaffen|martial weapons/i.test(w));
    sheet.proficiencies.weapons = {
      simple: weapons.some((w) => /einfache waffen|simple weapons/i.test(w)),
      martial: weapons.some((w) => /kriegswaffen|martial weapons/i.test(w)),
      other: other.length > 0,
    };
    sheet.proficiencies.otherWeapons = other.join(', ').slice(0, 500);
    sheet.features.classFeatures = featureLines([...cls.data.features.filter((f) => f.level <= 1), ...(subclass?.features.filter((f) => f.level <= 1) ?? [])]);
  }
  for (const s of r.skills) sheet.skills[s] = 1;
  sheet.combat.ac = String(10 + dex);
  sheet.combat.speed = race ? race.data.speed.split(';')[0].trim().slice(0, 30) : '';
  sheet.proficiencies.languages = [...new Set(r.languages.filter(Boolean))].join('\n');
  sheet.proficiencies.tools = [...new Set(r.tools.filter(Boolean))].join('\n');
  if (race) sheet.features.racialTraits = featureLines([...race.data.traits, ...(sub?.traits ?? [])]);

  if (bg) {
    const more: string[] = [];
    if (bg.data.feature.name || bg.data.feature.text) more.push(featureLines([bg.data.feature]));
    if (bg.data.feat) more.push(`Talent: ${bg.data.feat}`);
    sheet.features.moreFeatures = more.join('\n\n');
    if (r.rollPersonality) {
      sheet.personality = { traits: pick(bg.data.personalityTraits) ?? '', ideals: pick(bg.data.ideals) ?? '', bonds: pick(bg.data.bonds) ?? '', flaws: pick(bg.data.flaws) ?? '' };
    }
  }
  const equipment = [cls?.data.equipment ? `${cls.name}:\n${plain(cls.data.equipment)}` : '', bg?.data.equipment ? `${bg.name}:\n${plain(bg.data.equipment)}` : ''].filter(Boolean);
  if (r.inventory) {
    sheet.inventory = r.inventory.slice(0, 300);
    for (const [k, v] of Object.entries(r.coins)) sheet.coins[k as keyof CharacterSheet['coins']] += v ?? 0;
  } else if (equipment.length) sheet.features.moreFeatures = [sheet.features.moreFeatures, `Startausrüstung –\n${equipment.join('\n\n')}`].filter(Boolean).join('\n\n');

  if (cls && r.spellClass) {
    const sc = SPELLCASTING[r.spellClass];
    sheet.spellcasting.className = cls.name;
    sheet.spellcasting.ability = sc.ability;
    sheet.spellcasting.slots[0] = { total: sc.slots, used: 0 };
  }
  return characterSheetSchema.parse(sheet);
}
