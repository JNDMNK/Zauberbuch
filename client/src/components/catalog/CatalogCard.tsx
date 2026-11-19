import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, Dumbbell, Package, Shield, Swords, Weight } from 'lucide-react';
import type { CatalogCategory, CatalogItemDto } from '@zauberbuch/shared';
import { DamageValue } from '../DamageValue';

export const CATEGORY_ICON: Record<CatalogCategory, typeof Shield> = { armor: Shield, weapon: Swords, gear: Package };
const CATEGORY_BORDER: Record<CatalogCategory, string> = {
  armor: '!border-t-sky-600 dark:!border-t-sky-400',
  weapon: '!border-t-red-700 dark:!border-t-red-400',
  gear: '!border-t-amber-600 dark:!border-t-amber-400',
};

/** Karte eines Eintrags der Gegenstands-Datenbank (Rüstung, Waffe, Gegenstand) */
export function CatalogCard({ item, actions, badge, dimmed = false }: { item: CatalogItemDto; actions?: ReactNode; badge?: ReactNode; dimmed?: boolean }) {
  const { t, i18n } = useTranslation();
  const Icon = CATEGORY_ICON[item.category];
  return (
    <article className={`parchment flex h-full flex-col gap-2 border-t-4 p-4 ${CATEGORY_BORDER[item.category]} ${dimmed ? 'opacity-55' : ''}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-1 h-5 w-5 shrink-0 text-parchment-700 dark:text-parchment-400" aria-label={t(`catalog.categories.${item.category}`)} />
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-display text-lg font-bold">{item.name}</h3>
          {badge}
        </div>
        {actions && <div className="flex shrink-0 gap-1">{actions}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {item.damage && <DamageValue damage={item.damage} />}
        {item.category === 'armor' && item.ac && (
          <span className="inline-flex items-center gap-1">
            <Shield className="h-4 w-4 text-sky-700 dark:text-sky-300" aria-hidden />
            <span className="sheet-label !inline">{t('combat.acShort')}</span> <strong>{item.ac}</strong>
          </span>
        )}
        {item.category === 'armor' && item.strength && (
          <span className="inline-flex items-center gap-1" title={t('catalog.strength')}>
            <Dumbbell className="h-4 w-4 text-rose-700 dark:text-rose-300" aria-hidden />
            <span className="sheet-label !inline">{t('sheet.abilityShort.str')}</span> <strong>{item.strength}</strong>
          </span>
        )}
        {item.value && (
          <span className="inline-flex items-center gap-1 tabular-nums" title={t('items.value')}>
            <Coins className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
            <span className="sr-only">{t('items.value')}:</span>
            {item.value}
          </span>
        )}
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Weight className="h-4 w-4 text-parchment-700 dark:text-parchment-400" aria-hidden />
          {item.weight.toLocaleString(i18n.language)} lb
        </span>
      </div>
      {item.description && <p className="whitespace-pre-wrap break-words text-sm">{item.description}</p>}
    </article>
  );
}
