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
