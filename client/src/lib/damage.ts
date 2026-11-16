import type { TFunction } from 'i18next';
import type { DamageType, Locale } from '@zauberbuch/shared';

/**
 * Formatiert einen gespeicherten Würfelausdruck ("1d4+mod") sprachabhängig:
 * DE "1W4 + Mod.", EN "1d4 + mod".
 */
export function formatDice(dice: string, lang: Locale, t: TFunction): string {
  return dice
    .split(/(?=[+-])/)
    .map((part, i) => {
      const sign = /^[+-]/.test(part) ? part[0] : '';
      const term = sign ? part.slice(1) : part;
      const shown = term === 'mod' ? t('damage.mod') : lang === 'de' ? term.replace(/d/g, 'W') : term;
      return i === 0 ? `${sign === '-' ? '-' : ''}${shown}` : ` ${sign} ${shown}`;
    })
    .join('');
}

export const isHealing = (type: DamageType) => type === 'healing';

/** Textfarbe je Schadensart (Tailwind-Klassen, hell/dunkel). */
export const DAMAGE_COLORS: Record<DamageType, string> = {
  acid: 'text-lime-700 dark:text-lime-400',
  bludgeoning: 'text-stone-700 dark:text-stone-300',
  cold: 'text-sky-700 dark:text-sky-300',
  fire: 'text-orange-700 dark:text-orange-400',
  force: 'text-violet-700 dark:text-violet-300',
  lightning: 'text-yellow-700 dark:text-yellow-300',
  necrotic: 'text-emerald-900 dark:text-emerald-300',
  piercing: 'text-stone-700 dark:text-stone-300',
  poison: 'text-green-700 dark:text-green-400',
  psychic: 'text-pink-700 dark:text-pink-300',
  radiant: 'text-amber-600 dark:text-amber-300',
  slashing: 'text-stone-700 dark:text-stone-300',
  thunder: 'text-indigo-700 dark:text-indigo-300',
  healing: 'text-emerald-700 dark:text-emerald-400',
};
