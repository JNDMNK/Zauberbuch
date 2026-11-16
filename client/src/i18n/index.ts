import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Locale } from '@zauberbuch/shared';
import de from './locales/de.json';
import en from './locales/en.json';

export const LANG_STORAGE_KEY = 'zb-language';

/** Gespeicherte Gast-Sprache (localStorage) oder null. */
export function storedLanguage(): Locale | null {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'de' || stored === 'en') return stored;
  } catch {
    // localStorage nicht verfügbar
  }
  return null;
}

export function storeLanguage(lang: Locale): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignorieren
  }
}

function initialLanguage(): Locale {
  return storedLanguage() ?? (navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'de');
}

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: 'de',
  supportedLngs: ['de', 'en'],
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.language;

export default i18n;
