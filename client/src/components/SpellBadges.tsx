import { useTranslation } from 'react-i18next';
import { Brain, Flame, BookOpen, Languages } from 'lucide-react';
import type { Locale, SpellDto } from '@zauberbuch/shared';

export function SpellBadges({ spell, fallbackLocale }: { spell: SpellDto; fallbackLocale?: Locale | null }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {spell.concentration && (
        <span className="badge bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" title={t('spell.concentration')}>
          <Brain className="h-3 w-3" aria-hidden />
          {t('spell.concentration')}
        </span>
      )}
      {spell.ritual && (
        <span className="badge bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" title={t('spell.ritual')}>
          <BookOpen className="h-3 w-3" aria-hidden />
          {t('spell.ritual')}
        </span>
      )}
      {spell.isHomebrew && (
        <span className="badge bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200" title={t('spell.homebrew')}>
          <Flame className="h-3 w-3" aria-hidden />
          {t('spell.homebrew')}
        </span>
      )}
      {fallbackLocale && (
        <span
          className="badge border border-parchment-500/60 text-parchment-800 dark:border-parchment-700 dark:text-parchment-300"
          title={t('spell.fallbackHint', { lang: t(`langAdj.${fallbackLocale}`) })}
        >
          <Languages className="h-3 w-3" aria-hidden />
          {t('spell.fallbackBadge', { lang: fallbackLocale.toUpperCase() })}
        </span>
      )}
    </div>
  );
}
