import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@zauberbuch/shared';

/**
 * DE/EN-Umschalter für Texte, die es in beiden Sprachen geben kann (wie bei den Zaubern).
 * `missing`: Sprache ohne Inhalt – wird markiert; leere englische Felder zeigen später die deutsche Fassung.
 */
export function LangTabs({ value, onChange, missing = {}, hint = true }: { value: Locale; onChange: (l: Locale) => void; missing?: Partial<Record<Locale, boolean>>; hint?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label={t('admin.translations')} className="flex overflow-hidden rounded-lg border border-parchment-400 dark:border-night-700">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={value === l}
            onClick={() => onChange(l)}
            className={`flex items-center gap-2 px-3 py-1 font-display text-sm font-bold ${value === l ? 'bg-parchment-800 text-parchment-50 dark:bg-parchment-300 dark:text-ink' : 'hover:bg-parchment-200 dark:hover:bg-night-700'}`}
          >
            {l.toUpperCase()}
            {missing[l] && <span className="text-[10px] font-normal italic opacity-75">{t('admin.translationMissing')}</span>}
          </button>
        ))}
      </div>
      {hint && value === 'en' && <span className="text-xs italic text-parchment-700 dark:text-parchment-400">{t('content.enHint')}</span>}
    </div>
  );
}
