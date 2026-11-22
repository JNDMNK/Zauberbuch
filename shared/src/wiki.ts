import { z } from 'zod';
import { sourceIdSchema } from './sources';
import { ABILITIES, type Ability } from './character';
import { CONDITIONS } from './combat';

/**
 * Wiki (für alle angemeldeten Benutzer lesbar, bearbeitbar von Admin und Moderator).
 * Rubriken nach dem SRD 5.1: Völker (Rassen) und Klassen. Die Detailfelder liegen je Rubrik als JSON vor.
 */
export const WIKI_KINDS = ['race', 'class', 'feat', 'background', 'language', 'god', 'rule'] as const;
export type WikiKind = (typeof WIKI_KINDS)[number];

const text = (max: number) => z.string().trim().max(max).catch('').default('');
const md = (max = 10000) => z.string().trim().max(max).catch('').default('');

/** Merkmal: Name + Text (Markdown) */
const traitSchema = z.object({ name: z.string().trim().max(120).default(''), text: z.string().trim().max(5000).default('') });
const traits = z
  .array(traitSchema)
  .max(60)
  .catch([])
  .default([])
  .transform((l) => l.filter((f) => f.name || f.text));
export type WikiTrait = z.infer<typeof traitSchema>;

/** Klassenmerkmal mit Stufe */
const levelFeatureSchema = z.object({
  level: z.number().int().min(1).max(20).catch(1).default(1),
  name: z.string().trim().max(120).default(''),
  text: z.string().trim().max(5000).default(''),
});
const levelFeatures = z
  .array(levelFeatureSchema)
  .max(120)
  .catch([])
  .default([])
  .transform((l) => l.filter((f) => f.name || f.text).sort((a, b) => a.level - b.level));
export type WikiLevelFeature = z.infer<typeof levelFeatureSchema>;

/** Volk (Rasse) nach SRD: Attributswerterhöhung, Alter, Gesinnung, Größe, Bewegungsrate, Sprachen, Merkmale, Unterrassen */
const raceObject = z.object({
  abilityIncrease: text(200),
  age: text(1000),
  alignment: text(1000),
  size: text(1000),
  speed: text(200),
  languages: text(1000),
  traits,
  subraces: z
    .array(z.object({ name: z.string().trim().max(120).default(''), abilityIncrease: text(200), description: md(5000), traits }))
    .max(20)
    .catch([])
    .default([])
    .transform((l) => l.filter((s) => s.name)),
});
export const raceDataSchema = raceObject.catch(() => raceObject.parse({})).default({});
export type WikiRaceData = z.output<typeof raceDataSchema>;

export const HIT_DICE = ['d6', 'd8', 'd10', 'd12'] as const;

/** Klasse nach SRD: Trefferpunkte, Übung, Ausrüstung, Zauberwirken, Klassenmerkmale je Stufe, Unterklassen */
const classObject = z.object({
  hitDie: z.enum(HIT_DICE).nullable().catch(null).default(null),
  primaryAbility: text(100),
  hpFirst: text(200),
  hpHigher: text(300),
  armor: text(300),
  weapons: text(300),
  tools: text(300),
  saves: text(200),
  skills: text(500),
  equipment: md(3000),
  spellcasting: md(5000),
  /** Bezeichnung der Unterklassen, z. B. „Arkane Tradition“ */
  subclassTitle: text(80),
  features: levelFeatures,
  subclasses: z
    .array(
      z.object({
        name: z.string().trim().max(120).default(''),
        /** Quelle der Unterklasse (kann von der Klasse abweichen, z. B. Tashas Kessel) */
        sourceId: z.string().min(1).max(64).nullable().catch(null).default(null),
        description: md(5000),
        features: levelFeatures,
      }),
    )
    .max(30)
    .catch([])
    .default([])
    .transform((l) => l.filter((s) => s.name)),
});
export const classDataSchema = classObject.catch(() => classObject.parse({})).default({});
export type WikiClassData = z.output<typeof classDataSchema>;

/** Liste einfacher Texte (z. B. Persönlichkeitsmerkmale); leere Zeilen fallen weg */
const lines = (max: number) =>
  z
    .array(z.string().trim().max(500))
    .max(max)
    .catch([])
    .default([])
    .transform((l) => l.filter(Boolean));

/** Talent nach SRD: Voraussetzung, optionale Attributswerterhöhung, Vorteile */
/** Talent-Kategorien (aktuelle Regeln) */
export const FEAT_CATEGORIES = ['origin', 'general', 'fightingStyle', 'epicBoon'] as const;
export type FeatCategory = (typeof FEAT_CATEGORIES)[number];

const featObject = z.object({
  /** Kategorie: Herkunftstalent, Allgemeines Talent, Kampfstil-Talent, Epische Gabe */
  category: z.enum(FEAT_CATEGORIES).nullable().catch(null).default(null),
  prerequisite: text(300),
  /** z. B. „Stärke oder Geschicklichkeit +1“ (bei Halbtalenten) */
  abilityIncrease: text(200),
  /** Vorteile als Markdown (meist eine Liste) */
  benefits: md(5000),
  /** Kann mehrfach gewählt werden */
  repeatable: z.boolean().catch(false).default(false),
});
export const featDataSchema = featObject.catch(() => featObject.parse({})).default({});
export type WikiFeatData = z.output<typeof featDataSchema>;

/** Hintergrund nach SRD: Übung, Sprachen, Ausrüstung, Merkmal, vorgeschlagene Charakterzüge */
const backgroundObject = z.object({
  /** Attributswerte, aus denen die Erhöhungen verteilt werden (meist drei) */
  abilityScores: z
    .array(z.string())
    .max(12)
    .catch([])
    .default([])
    .transform((l) => [...new Set(l.filter((a): a is Ability => (ABILITIES as readonly string[]).includes(a)))]),
  /** Herkunftstalent (Name; verlinkt, wenn es im Wiki steht) */
  feat: text(120),
  skills: text(300),
  tools: text(300),
  languages: text(300),
  equipment: md(2000),
  feature: z
    .object({ name: z.string().trim().max(120).default(''), text: md(5000) })
    .catch({ name: '', text: '' })
    .default({}),
  personalityTraits: lines(20),
  ideals: lines(20),
  bonds: lines(20),
  flaws: lines(20),
});
export const backgroundDataSchema = backgroundObject.catch(() => backgroundObject.parse({})).default({});
export type WikiBackgroundData = z.output<typeof backgroundDataSchema>;

/** Sprache nach SRD: Art, typische Sprecher, Schrift */
export const LANGUAGE_TYPES = ['standard', 'exotic'] as const;
const languageObject = z.object({
  type: z.enum(LANGUAGE_TYPES).nullable().catch(null).default(null),
  speakers: text(300),
  script: text(100),
});
export const languageDataSchema = languageObject.catch(() => languageObject.parse({})).default({});
export type WikiLanguageData = z.output<typeof languageDataSchema>;

/** Gesinnungen (Kürzel wie im SRD) */
export const ALIGNMENTS = ['LG', 'NG', 'CG', 'LN', 'N', 'CN', 'LE', 'NE', 'CE'] as const;
/** Gottheit nach SRD: Pantheon, Gesinnung, empfohlene Domänen, Symbol */
const godObject = z.object({
  pantheon: text(100),
  alignment: z.enum(ALIGNMENTS).nullable().catch(null).default(null),
  domains: text(200),
  symbol: text(200),
});
export const godDataSchema = godObject.catch(() => godObject.parse({})).default({});
export type WikiGodData = z.output<typeof godDataSchema>;

/** Regel nach SRD (Zustände, Kampf, Abenteuer, Rasten, Zauberwirken); `condition` verknüpft einen Zustand im Kampf */
export const RULE_CATEGORIES = ['basics', 'condition', 'combat', 'adventuring', 'resting', 'spellcasting'] as const;
const ruleObject = z.object({
  category: z.enum(RULE_CATEGORIES).nullable().catch(null).default(null),
  condition: z.enum(CONDITIONS).nullable().catch(null).default(null),
});
export const ruleDataSchema = ruleObject.catch(() => ruleObject.parse({})).default({});
export type WikiRuleData = z.output<typeof ruleDataSchema>;

export const wikiEntrySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('race'), name: z.string().trim().min(1).max(120), summary: text(500), description: md(), sourceId: sourceIdSchema, data: raceDataSchema }),
  z.object({ kind: z.literal('class'), name: z.string().trim().min(1).max(120), summary: text(500), description: md(), sourceId: sourceIdSchema, data: classDataSchema }),
  z.object({ kind: z.literal('feat'), name: z.string().trim().min(1).max(120), summary: text(500), description: md(), sourceId: sourceIdSchema, data: featDataSchema }),
  z.object({ kind: z.literal('background'), name: z.string().trim().min(1).max(120), summary: text(500), description: md(), sourceId: sourceIdSchema, data: backgroundDataSchema }),
  z.object({ kind: z.literal('language'), name: z.string().trim().min(1).max(60), summary: text(500), description: md(), sourceId: sourceIdSchema, data: languageDataSchema }),
  z.object({ kind: z.literal('rule'), name: z.string().trim().min(1).max(120), summary: text(500), description: md(), sourceId: sourceIdSchema, data: ruleDataSchema }),
  z.object({ kind: z.literal('god'), name: z.string().trim().min(1).max(100), summary: text(500), description: md(), sourceId: sourceIdSchema, data: godDataSchema }),
]);
export type WikiEntryInput = z.input<typeof wikiEntrySchema>;

interface WikiBase {
  id: string;
  name: string;
  summary: string;
  description: string;
  /** Quelle (Buch) */
  sourceId: string | null;
  updatedAt: string;
  updatedBy: string | null;
}
export type WikiEntryDto =
  | (WikiBase & { kind: 'race'; data: WikiRaceData })
  | (WikiBase & { kind: 'class'; data: WikiClassData })
  | (WikiBase & { kind: 'feat'; data: WikiFeatData })
  | (WikiBase & { kind: 'background'; data: WikiBackgroundData })
  | (WikiBase & { kind: 'language'; data: WikiLanguageData })
  | (WikiBase & { kind: 'god'; data: WikiGodData })
  | (WikiBase & { kind: 'rule'; data: WikiRuleData });
