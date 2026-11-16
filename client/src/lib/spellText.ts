import type { Locale, SpellDto, SpellTranslationDto } from '@zauberbuch/shared';

export interface ResolvedText {
  t: SpellTranslationDto;
  /** Sprache, in der der Text tatsächlich vorliegt */
  locale: Locale;
  isFallback: boolean;
}

/** Wählt die Übersetzung in der gewünschten Sprache, sonst die andere Sprache. */
export function resolveText(spell: SpellDto, lang: Locale): ResolvedText {
  const other: Locale = lang === 'de' ? 'en' : 'de';
  const own = spell.translations[lang];
  if (own) return { t: own, locale: lang, isFallback: false };
  const fallback = spell.translations[other];
  if (fallback) return { t: fallback, locale: other, isFallback: true };
  return {
    t: { name: spell.slug, materialDescription: null, castingTimeText: null, rangeText: null, durationText: null },
    locale: lang,
    isFallback: true,
  };
}

export function asLocale(lng: string | undefined): Locale {
  return lng?.startsWith('en') ? 'en' : 'de';
}
