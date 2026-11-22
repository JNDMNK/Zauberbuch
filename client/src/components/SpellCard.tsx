import { memo, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SourceNameBadge } from './sources/SourceFields';
import { Clock, Crosshair, Hourglass } from 'lucide-react';
import type { SpellDto } from '@zauberbuch/shared';
import { asLocale, resolveText } from '../lib/spellText';
import { SCHOOL_COLORS } from '../lib/schools';
import { castingTimeLabel, durationLabel, levelSchoolLabel, rangeLabel } from '../lib/spellDisplay';
import { ComponentIcons } from './ComponentIcons';
import { FavoriteButton } from './FavoriteButton';
import { SpellBadges } from './SpellBadges';
import { DamageValue } from './DamageValue';

interface Props {
  spell: SpellDto;
  onFavoriteChange?: (spell: SpellDto, isFavorite: boolean) => void;
}

function SpellCardImpl({ spell, onFavoriteChange }: Props) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { t: text, isFallback, locale } = resolveText(spell, asLocale(i18n.language));
  const style = { '--accent': SCHOOL_COLORS[spell.school] } as CSSProperties;

  const rows = [
    { Icon: Clock, label: t('spell.castingTime'), value: castingTimeLabel(t, spell, text) },
    { Icon: Crosshair, label: t('spell.range'), value: rangeLabel(spell, text) },
    { Icon: Hourglass, label: t('spell.duration'), value: durationLabel(spell, text) },
  ];

  return (
    <article className="spell-card group" style={style}>
      <div className="flex items-start gap-2 px-4 pb-1 pt-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-tight">
            <Link
              to={`/spells/${spell.slug}`}
              state={{ background: location }}
              className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
            >
              {text.name}
            </Link>
          </h3>
          <p className="accent-text mt-0.5 text-sm font-semibold italic">{levelSchoolLabel(t, spell)}</p>
        </div>
        <div className="-mr-1 -mt-1 flex items-center">
          {spell.level > 0 && (
            <span
              className="accent-text mr-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 font-display text-sm font-bold"
              style={{ borderColor: 'var(--accent)' }}
              aria-hidden
            >
              {spell.level}
            </span>
          )}
          <FavoriteButton spellId={spell.id} onChange={(fav) => onFavoriteChange?.(spell, fav)} />
        </div>
      </div>
      <div className="divider-ornament px-4 text-xs" aria-hidden>
        ✦
      </div>
      <dl className="flex-1 space-y-1 px-4 text-[15px]">
        {rows.map(({ Icon, label, value }) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="flex shrink-0 items-center gap-1 text-parchment-700 dark:text-parchment-400" title={label}>
              <Icon className="h-3.5 w-3.5 translate-y-0.5" aria-hidden />
              <span className="sr-only">{label}</span>
            </dt>
            <dd className="line-clamp-2 min-w-0">{value}</dd>
          </div>
        ))}
        {spell.damage && (
          <div className="flex items-baseline gap-2 pt-0.5">
            <dt className="sr-only">{spell.damage.type === 'healing' ? t('spell.healing') : t('spell.damage')}</dt>
            <dd className="min-w-0">
              <DamageValue damage={spell.damage} srLabel={false} />
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-parchment-300/70 px-4 py-3 dark:border-night-700">
        <ComponentIcons components={spell.components} />
        <SourceNameBadge name={spell.source} />
        <SpellBadges spell={spell} fallbackLocale={isFallback ? locale : null} />
      </div>
    </article>
  );
}

export const SpellCard = memo(SpellCardImpl);
