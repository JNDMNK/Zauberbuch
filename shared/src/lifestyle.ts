import { z } from 'zod';

/** Lebensstil mit täglichen Kosten (z. B. „Einfach“ – „1 GM“) */
export interface Lifestyle {
  name: string;
  cost: string;
}

/** Standardwerte wie im Charakterbogen-PDF (Spielerhandbuch) – für neue Geschichten und Bögen ohne Geschichte */
export const DEFAULT_LIFESTYLES: Lifestyle[] = [
  { name: 'Jämmerlich', cost: '—' },
  { name: 'Ärmlich', cost: '1 SM' },
  { name: 'Schlecht', cost: '2 SM' },
  { name: 'Einfach', cost: '1 GM' },
  { name: 'Komfortabel', cost: '2 GM' },
  { name: 'Wohlhabend', cost: '4 GM' },
  { name: 'Edel', cost: '10 GM min.' },
];

export const lifestylesSchema = z
  .array(z.object({ name: z.string().trim().min(1).max(50), cost: z.string().trim().max(30) }))
  .min(1)
  .max(20)
  .refine((list) => new Set(list.map((l) => l.name.toLocaleLowerCase('de'))).size === list.length, 'lifestyle_duplicate');

/** Gespeicherte Tabelle lesen; leer oder ungültig = Standardwerte */
export function parseLifestyles(raw: string | null | undefined): Lifestyle[] {
  if (!raw) return DEFAULT_LIFESTYLES;
  try {
    const parsed = lifestylesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_LIFESTYLES;
  } catch {
    return DEFAULT_LIFESTYLES;
  }
}

/** Kosten zu einem Lebensstil (Groß-/Kleinschreibung egal); null = nicht in der Tabelle */
export function lifestyleCost(list: Lifestyle[], name: string): string | null {
  const key = name.trim().toLocaleLowerCase('de');
  return list.find((l) => l.name.toLocaleLowerCase('de') === key)?.cost ?? null;
}

// ---------------------------------------------------------------- Übung und Sprachen

/** Standard-Sprachen wie im Charakterbogen-PDF */
export const DEFAULT_LANGUAGES: string[] = [
  'Gemeinsprache',
  'Zwergisch',
  'Elfisch',
  'Riesisch',
  'Gnomisch',
  'Halblingisch',
  'Orkisch',
  'Abyssisch',
  'Celestisch',
  'Tiefensprache',
  'Drakonisch',
  'Infernalisch',
  'Urtümlich',
  'Sylvanisch',
  'Gemeinsprache der Unterreiche',
];

/** Standard-Werkzeuge & andere wie im Charakterbogen-PDF */
export const DEFAULT_TOOLS: string[] = [
  'Fälscherausrüstung',
  'Alchemistenlabor',
  'Brauereivorräte',
  'Glasbläserwerkzeuge',
  'Holzschnitzwerkzeuge',
  'Juwelierwerkzeuge',
  'Kalligraphiewerkzeuge',
  'Kochutensilien',
  'Ledererwerkzeuge',
  'Malutensilien',
  'Maurerwerkzeuge',
  'Schmiedewerkzeuge',
  'Schreinerwerkzeuge',
  'Schusterwerkzeuge',
  'Töpferwerkzeuge',
  'Tüftlerwerkzeuge',
  'Weberwerkzeuge',
  'Dudelsack',
  'Flöte',
  'Gambe',
  'Hackbrett',
  'Horn',
  'Laute',
  'Leier',
  'Panflöte',
  'Schalmei',
  'Trommel',
  'Drachenschach-Spielsatz',
  'Satz Spielkarten',
  'Satz Würfel',
  'Drei-Drachen-Kartensatz',
  'Diebeswerkzeug',
  'Giftmischerausrüstung',
  'Kräuterkundeausrüstung',
  'Navigationswerkzeuge',
  'Verkleidungsausrüstung',
];

/** Auswahlliste (z. B. Sprachen): eindeutige, nicht leere Einträge */
export const optionListSchema = z
  .array(z.string().trim().min(1).max(60))
  .min(1)
  .max(150)
  .refine((list) => new Set(list.map((l) => l.toLocaleLowerCase('de'))).size === list.length, 'option_duplicate');

/** Gespeicherte Liste lesen; leer oder ungültig = Standardwerte */
export function parseOptionList(raw: string | null | undefined, defaults: string[]): string[] {
  if (!raw) return defaults;
  try {
    const parsed = optionListSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : defaults;
  } catch {
    return defaults;
  }
}

/** Listen einer Geschichte (bzw. Standardwerte), wie sie Bogen und Verwaltung erhalten */
export interface StoryOptionLists {
  lifestyles: Lifestyle[];
  languages: string[];
  tools: string[];
}

export function storyOptionLists(story: { lifestyles?: string | null; languages?: string | null; tools?: string | null } | null | undefined): StoryOptionLists {
  return {
    lifestyles: parseLifestyles(story?.lifestyles),
    languages: parseOptionList(story?.languages, DEFAULT_LANGUAGES),
    tools: parseOptionList(story?.tools, DEFAULT_TOOLS),
  };
}
