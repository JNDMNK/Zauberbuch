import { z } from 'zod';

/**
 * Wiki (für alle angemeldeten Benutzer lesbar, bearbeitbar von Admin und Moderator).
 * Rubriken nach dem SRD 5.1: Völker (Rassen) und Klassen. Die Detailfelder liegen je Rubrik als JSON vor.
 */
export const WIKI_KINDS = ['race', 'class'] as const;
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
    .array(z.object({ name: z.string().trim().max(120).default(''), description: md(5000), features: levelFeatures }))
    .max(30)
    .catch([])
    .default([])
    .transform((l) => l.filter((s) => s.name)),
});
export const classDataSchema = classObject.catch(() => classObject.parse({})).default({});
export type WikiClassData = z.output<typeof classDataSchema>;

export const wikiEntrySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('race'), name: z.string().trim().min(1).max(120), summary: text(500), description: md(), data: raceDataSchema }),
  z.object({ kind: z.literal('class'), name: z.string().trim().min(1).max(120), summary: text(500), description: md(), data: classDataSchema }),
]);
export type WikiEntryInput = z.input<typeof wikiEntrySchema>;

interface WikiBase {
  id: string;
  name: string;
  summary: string;
  description: string;
  updatedAt: string;
  updatedBy: string | null;
}
export type WikiEntryDto = (WikiBase & { kind: 'race'; data: WikiRaceData }) | (WikiBase & { kind: 'class'; data: WikiClassData });
