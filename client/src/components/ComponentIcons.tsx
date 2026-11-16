import { useTranslation } from 'react-i18next';
import { Hand, MessageCircle, Gem } from 'lucide-react';
import type { SpellDto } from '@zauberbuch/shared';

/** V/S/M-Komponenten als Icons mit Kürzel. */
export function ComponentIcons({ components, size = 'sm' }: { components: SpellDto['components']; size?: 'sm' | 'md' }) {
  const { t } = useTranslation();
  const items = [
    { key: 'verbal', short: t('component.V'), Icon: MessageCircle, active: components.verbal },
    { key: 'somatic', short: t('component.S'), Icon: Hand, active: components.somatic },
    { key: 'material', short: t('component.M'), Icon: Gem, active: components.material },
  ];
  const iconCls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <span className="inline-flex items-center gap-1.5">
      {items.map(({ key, short, Icon, active }) => (
        <span
          key={key}
          title={t(`component.${key}`)}
          aria-label={`${t(`component.${key}`)}: ${active ? t('common.yes') : t('common.no')}`}
          className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-display text-[11px] font-bold ${
            active
              ? 'border-parchment-600 bg-parchment-200/70 text-ink dark:border-parchment-500 dark:bg-night-700 dark:text-parchment-100'
              : 'border-dashed border-parchment-400/60 text-parchment-400 line-through dark:border-night-700 dark:text-parchment-800'
          }`}
        >
          <Icon className={iconCls} aria-hidden />
          {short}
        </span>
      ))}
    </span>
  );
}
