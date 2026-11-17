import type { BoardCategory } from '@zauberbuch/shared';

export const CATEGORY_CLS: Record<BoardCategory, string> = {
  general: 'bg-parchment-200 text-parchment-900 dark:bg-night-700 dark:text-parchment-200',
  dates: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  places: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  npcs: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  quests: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  items: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  lore: 'bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-200',
};

export function formatDateTime(iso: string, lang: string) {
  return new Date(iso).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
}
