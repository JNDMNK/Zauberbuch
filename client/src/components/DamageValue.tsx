import { useTranslation } from 'react-i18next';
import { HeartPulse, Swords } from 'lucide-react';
import type { SpellDto } from '@zauberbuch/shared';
import { DAMAGE_COLORS, formatDice, isHealing } from '../lib/damage';
import { asLocale } from '../lib/spellText';

/** Schaden/Heilung, z. B. „8W6 Feuer“ (DE) bzw. „8d6 Fire“ (EN). */
export function DamageValue({
  damage,
  showIcon = true,
  srLabel = true,
}: {
  damage: NonNullable<SpellDto['damage']>;
  showIcon?: boolean;
  /** false, wenn ein umgebendes <dt> die Beschriftung schon liefert */
  srLabel?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const healing = isHealing(damage.type);
  const Icon = healing ? HeartPulse : Swords;
  const label = healing ? t('spell.healing') : t('spell.damage');
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      {showIcon && <Icon className={`h-3.5 w-3.5 shrink-0 ${DAMAGE_COLORS[damage.type]}`} aria-hidden />}
      {srLabel && <span className="sr-only">{label}: </span>}
      <span className="font-semibold tabular-nums">{formatDice(damage.dice, asLocale(i18n.language), t)}</span>
      {!healing && <span className={DAMAGE_COLORS[damage.type]}>{t(`damageType.${damage.type}`)}</span>}
      {healing && <span className={DAMAGE_COLORS.healing}>{t('damageType.healing')}</span>}
    </span>
  );
}
