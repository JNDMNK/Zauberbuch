import { z } from 'zod';

/** Charakterbogen (angelehnt an den D&D-5e-Charakterbogen v2.7). Wird als JSON-Dokument gespeichert. */

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];

/** Fertigkeiten mit zugehörigem Attribut (Reihenfolge = alphabetisch nach deutschem Namen, wie im Bogen) */
export const SKILLS = [
  ['acrobatics', 'dex'],
  ['arcana', 'int'],
  ['athletics', 'str'],
  ['performance', 'cha'],
  ['intimidation', 'cha'],
  ['sleightOfHand', 'dex'],
  ['history', 'int'],
  ['medicine', 'wis'],
  ['stealth', 'dex'],
  ['animalHandling', 'wis'],
  ['insight', 'wis'],
  ['investigation', 'int'],
  ['nature', 'int'],
  ['religion', 'int'],
  ['deception', 'cha'],
  ['survival', 'wis'],
  ['persuasion', 'cha'],
  ['perception', 'wis'],
] as const satisfies readonly (readonly [string, Ability])[];
export type SkillKey = (typeof SKILLS)[number][0];
export const SKILL_KEYS = SKILLS.map(([k]) => k) as SkillKey[];

const text = (max = 200) => z.string().max(max).catch('').default('');
const longText = () => z.string().max(20000).catch('').default('');
const int = (min: number, max: number, def: number) => z.coerce.number().int().min(min).max(max).catch(def).default(def);
const num = (min: number, max: number, def: number) => z.coerce.number().min(min).max(max).catch(def).default(def);
const bool = () => z.boolean().catch(false).default(false);
/** Bilder als Data-URL (clientseitig verkleinert), max. ~1,5 MB */
const image = () =>
  z
    .string()
    .max(1_500_000)
    .refine((v) => v === '' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v), 'image_invalid')
    .catch('')
    .default('');


/** 0 = keine Übung, 1 = geübt, 2 = Expertise */
const proficiencyLevel = () => z.union([z.literal(0), z.literal(1), z.literal(2)]).catch(0).default(0);

export const attackSchema = z.object({
  name: text(100),
  ability: z.enum([...ABILITIES, 'none']).catch('none').default('none'),
  proficient: bool(),
  bonus: int(-20, 20, 0),
  range: text(50),
  damage: text(50),
  damageType: text(50),
  description: text(500),
});

export const itemSchema = z.object({
  name: text(150),
  qty: num(0, 100000, 1),
  weight: num(0, 100000, 0),
});

export const sheetSpellSchema = z.object({
  level: int(0, 9, 0),
  name: text(150),
  prepared: bool(),
  /** Verknüpfung zur Zauberbibliothek (slug), falls vorhanden */
  slug: z.string().max(120).nullable().catch(null).default(null),
});

export const characterSheetSchema = z.object({
  version: z.literal(1).catch(1).default(1),
  identity: z
    .object({
      name: text(100),
      classLevel: text(100),
      level: int(1, 20, 1),
      background: text(100),
      race: text(100),
      playerName: text(100),
      xp: int(0, 10_000_000, 0),
      xpNext: int(0, 10_000_000, 300),
      alignment: text(50),
      faith: text(100),
      age: text(30),
      size: text(30),
      height: text(30),
      weight: text(30),
      gender: text(50),
      eyes: text(50),
      hair: text(50),
      skin: text(50),
    })
    .default({}),
  abilities: z
    .object({ str: int(1, 30, 10), dex: int(1, 30, 10), con: int(1, 30, 10), int: int(1, 30, 10), wis: int(1, 30, 10), cha: int(1, 30, 10) })
    .default({}),
  savingThrows: z.object({ str: bool(), dex: bool(), con: bool(), int: bool(), wis: bool(), cha: bool() }).default({}),
  skills: z
    .object({
      acrobatics: proficiencyLevel(), arcana: proficiencyLevel(), athletics: proficiencyLevel(), performance: proficiencyLevel(),
      intimidation: proficiencyLevel(), sleightOfHand: proficiencyLevel(), history: proficiencyLevel(), medicine: proficiencyLevel(),
      stealth: proficiencyLevel(), animalHandling: proficiencyLevel(), insight: proficiencyLevel(), investigation: proficiencyLevel(),
      nature: proficiencyLevel(), religion: proficiencyLevel(), deception: proficiencyLevel(), survival: proficiencyLevel(),
      persuasion: proficiencyLevel(), perception: proficiencyLevel(),
    })
    .default({}),
  inspiration: bool(),
  /** leer = aus der Stufe berechnet */
  proficiencyBonusOverride: z.coerce.number().int().min(0).max(10).nullable().catch(null).default(null),
  combat: z
    .object({
      ac: text(20),
      initiativeBonus: int(-20, 20, 0),
      speed: text(30),
      hpMax: int(0, 9999, 0),
      hpCurrent: int(-9999, 9999, 0),
      hpTemp: int(0, 9999, 0),
      hitDiceTotal: text(30),
      hitDiceCurrent: text(30),
      deathSuccesses: int(0, 3, 0),
      deathFailures: int(0, 3, 0),
    })
    .default({}),
  personality: z
    .object({ traits: longText(), ideals: longText(), bonds: longText(), flaws: longText() })
    .default({}),
  attacks: z.array(attackSchema).max(50).catch([]).default([]),
  proficiencies: z
    .object({
      armor: z.object({ light: bool(), medium: bool(), heavy: bool(), shields: bool() }).default({}),
      weapons: z.object({ simple: bool(), martial: bool(), other: bool() }).default({}),
      otherWeapons: text(500),
      languages: longText(),
      tools: longText(),
    })
    .default({}),
  features: z
    .object({
      classFeatures: longText(),
      racialTraits: longText(),
      senses: longText(),
      enemies: longText(),
      moreFeatures: longText(),
      allies: longText(),
      appearance: longText(),
      backstory: longText(),
      development: longText(),
    })
    .default({}),
  lifestyle: z.object({ name: text(50), dailyCost: text(30) }).default({}),
  inventory: z.array(itemSchema).max(300).catch([]).default([]),
  extraEquipment: z.array(itemSchema).max(300).catch([]).default([]),
  attunedItems: z.array(text(150)).max(3).catch([]).default([]),
  coins: z.object({ cp: int(0, 10_000_000, 0), sp: int(0, 10_000_000, 0), ep: int(0, 10_000_000, 0), gp: int(0, 10_000_000, 0), pp: int(0, 10_000_000, 0) }).default({}),
  spellcasting: z
    .object({
      className: text(100),
      ability: z.enum([...ABILITIES, 'none']).catch('none').default('none'),
      slots: z
        .array(z.object({ total: int(0, 20, 0), used: int(0, 20, 0) }))
        .length(9)
        .catch(Array.from({ length: 9 }, () => ({ total: 0, used: 0 })))
        .default(Array.from({ length: 9 }, () => ({ total: 0, used: 0 }))),
      spells: z.array(sheetSpellSchema).max(300).catch([]).default([]),
    })
    .default({}),
  portrait: image(),
  symbol: image(),
  symbolName: text(100),
});

export type CharacterSheet = z.infer<typeof characterSheetSchema>;
export type SheetAttack = z.infer<typeof attackSchema>;
export type SheetItem = z.infer<typeof itemSchema>;
export type SheetSpell = z.infer<typeof sheetSpellSchema>;

/** Leerer Bogen mit allen Standardwerten */
export const emptyCharacterSheet = (): CharacterSheet => characterSheetSchema.parse({});

export const createCharacterSchema = z.object({
  name: z.string().trim().max(100).optional(),
});

/** Strenge Prüfung für PUT: Objekt muss parsebar sein; unbekannte Felder werden verworfen. */
export const updateCharacterSchema = z.object({ data: characterSheetSchema });

export interface CharacterSummaryDto {
  id: string;
  name: string;
  classLevel: string;
  race: string;
  level: number;
  updatedAt: string;
  createdAt: string;
  owner?: { id: string; username: string };
}

export interface CharacterDto extends CharacterSummaryDto {
  data: CharacterSheet;
  canEdit: boolean;
}

// ---------------------------------------------------------------- Berechnungen

export const abilityModifier = (score: number) => Math.floor((score - 10) / 2);

export const proficiencyBonusForLevel = (level: number) => Math.ceil(Math.max(1, Math.min(20, level)) / 4) + 1;

export function proficiencyBonus(sheet: CharacterSheet): number {
  return sheet.proficiencyBonusOverride ?? proficiencyBonusForLevel(sheet.identity.level);
}

export const formatModifier = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

export function savingThrowBonus(sheet: CharacterSheet, ability: Ability): number {
  return abilityModifier(sheet.abilities[ability]) + (sheet.savingThrows[ability] ? proficiencyBonus(sheet) : 0);
}

export function skillBonus(sheet: CharacterSheet, skill: SkillKey): number {
  const ability = SKILLS.find(([k]) => k === skill)![1];
  return abilityModifier(sheet.abilities[ability]) + sheet.skills[skill] * proficiencyBonus(sheet);
}

export const passivePerception = (sheet: CharacterSheet) => 10 + skillBonus(sheet, 'perception');

export const initiative = (sheet: CharacterSheet) => abilityModifier(sheet.abilities.dex) + sheet.combat.initiativeBonus;

export function attackBonus(sheet: CharacterSheet, attack: SheetAttack): number {
  const mod = attack.ability === 'none' ? 0 : abilityModifier(sheet.abilities[attack.ability]);
  return mod + (attack.proficient ? proficiencyBonus(sheet) : 0) + attack.bonus;
}

export function spellSaveDc(sheet: CharacterSheet): number | null {
  const a = sheet.spellcasting.ability;
  return a === 'none' ? null : 8 + proficiencyBonus(sheet) + abilityModifier(sheet.abilities[a]);
}

export function spellAttackBonus(sheet: CharacterSheet): number | null {
  const a = sheet.spellcasting.ability;
  return a === 'none' ? null : proficiencyBonus(sheet) + abilityModifier(sheet.abilities[a]);
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Sprungweiten in Metern (wie im Bogen: 1 Fuß = 0,3 m) */
export function jumps(sheet: CharacterSheet) {
  const str = sheet.abilities.str;
  const strMod = abilityModifier(str);
  const high = Math.max(0, (strMod + 3) * 0.3);
  const long = str * 0.3;
  return {
    highStanding: round(high / 2),
    highRunning: round(high),
    longStanding: round(long / 2),
    longRunning: round(long),
  };
}

/** Gewicht der Münzen: 50 Münzen = 1 lb */
export const coinWeight = (sheet: CharacterSheet) =>
  (sheet.coins.cp + sheet.coins.sp + sheet.coins.ep + sheet.coins.gp + sheet.coins.pp) / 50;

export const itemsWeight = (items: SheetItem[]) => round(items.reduce((s, i) => s + i.qty * i.weight, 0));

export function carrying(sheet: CharacterSheet) {
  const str = sheet.abilities.str;
  const total = round(itemsWeight(sheet.inventory) + itemsWeight(sheet.extraEquipment) + coinWeight(sheet));
  return {
    total,
    encumberedFrom: str * 5 + 1,
    encumberedTo: str * 10,
    heavyFrom: str * 10 + 1,
    heavyTo: str * 15,
    maxPushDrag: str * 30,
    state: total > str * 10 ? 'heavy' : total > str * 5 ? 'encumbered' : 'normal',
  } as const;
}

// ---------------------------------------------------------------- Export / Import (nur Admin)

export const CHARACTER_EXPORT_FORMAT = 'zauberbuch-characters';

export interface CharacterExportEntry {
  /** Benutzername des Besitzers */
  owner: string;
  name: string;
  createdAt?: string;
  data: CharacterSheet;
}

export interface CharacterExportFile {
  format: typeof CHARACTER_EXPORT_FORMAT;
  version: 1;
  exportedAt: string;
  characters: CharacterExportEntry[];
}

export const characterImportSchema = z.object({
  characters: z.array(z.unknown()).min(1).max(2000),
  /** Ziel für Bögen, deren Besitzer es nicht (mehr) gibt; null = solche Bögen überspringen */
  fallbackOwnerId: z.string().min(1).max(100).nullable().optional().default(null),
  duplicates: z.enum(['skip', 'create']).optional().default('skip'),
});

export type CharacterImportStatus = 'new' | 'duplicate' | 'no_owner' | 'invalid';

export interface CharacterImportPreviewItem {
  index: number;
  name: string;
  owner: string | null;
  targetUser: string | null;
  status: CharacterImportStatus;
}

export interface CharacterImportPreview {
  items: CharacterImportPreviewItem[];
  summary: Record<CharacterImportStatus, number> & { total: number };
}

export interface CharacterImportResult {
  created: number;
  skipped: number;
  invalid: number;
}
