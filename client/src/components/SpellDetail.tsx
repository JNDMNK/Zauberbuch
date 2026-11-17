import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2 } from 'lucide-react';
import type { SpellDto } from '@zauberbuch/shared';
import { asLocale, resolveText } from '../lib/spellText';
import { SCHOOL_COLORS } from '../lib/schools';
import { castingTimeLabel, durationLabel, levelSchoolLabel, rangeLabel } from '../lib/spellDisplay';
import { ComponentIcons } from './ComponentIcons';
import { FavoriteButton } from './FavoriteButton';
import { Markdown } from './Markdown';
import { SpellBadges } from './SpellBadges';
import { useToast } from '../context/ToastContext';
import { DamageValue } from './DamageValue';

interface Props {
  spell: SpellDto;
  headingId?: string;
  actions?: React.ReactNode;
}

export function SpellDetail({ spell, headingId, actions }: Props) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { t: text, isFallback, locale } = resolveText(spell, asLocale(i18n.language));
  const style = { '--accent': SCHOOL_COLORS[spell.school] } as CSSProperties;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/spells/${spell.slug}`);
      toast.success(t('spell.linkCopied'));
    } catch {
      // Zwischenablage nicht verfügbar (z. B. ohne HTTPS)
    }
  };

  // „Konzentration, “ nur voranstellen, wenn der Text es nicht schon enthält (z. B. importierte Buchtexte)
  const durationWithConcentration = () => {
    const d = durationLabel(spell, text);
    if (!spell.concentration || /^(konzentration|concentration)/i.test(d.trim())) return d;
    return `${t('spell.concentration')}, ${d}`;
  };

  const stats = [
    { label: t('spell.castingTime'), value: castingTimeLabel(t, spell, text) },
    { label: t('spell.range'), value: rangeLabel(spell, text) },
    { label: t('spell.duration'), value: durationWithConcentration() },
  ];

  return (
    <article className="spell-card !h-auto hover:!translate-y-0 hover:!shadow-card" style={style}>
      <header className="flex items-start gap-3 px-5 pb-2 pt-6 sm:px-8">
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            {text.name}
          </h2>
          <p className="accent-text mt-1 text-lg font-semibold italic">
            {levelSchoolLabel(t, spell)}
            {spell.ritual ? ` (${t('spell.ritual')})` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          <button type="button" className="btn-icon" onClick={copyLink} title={t('spell.copyLink')} aria-label={t('spell.copyLink')}>
            <Link2 className="h-5 w-5" />
          </button>
          <FavoriteButton spellId={spell.id} size="lg" />
        </div>
      </header>

      <div className="px-5 sm:px-8">
        <SpellBadges spell={spell} fallbackLocale={isFallback ? locale : null} />
        {isFallback && (
          <p className="mt-2 text-sm italic text-parchment-700 dark:text-parchment-400">
            {t('spell.fallbackHint', { lang: t(`langAdj.${locale}`) })}
          </p>
        )}

        <div className="divider-ornament" aria-hidden>
          ✦
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="font-display text-xs font-bold uppercase tracking-wider text-parchment-700 dark:text-parchment-400">{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
          {spell.damage && (
            <div>
              <dt className="font-display text-xs font-bold uppercase tracking-wider text-parchment-700 dark:text-parchment-400">
                {spell.damage.type === 'healing' ? t('spell.healing') : t('spell.damage')}
              </dt>
              <dd>
                <DamageValue damage={spell.damage} srLabel={false} />
              </dd>
            </div>
          )}
          <div>
            <dt className="font-display text-xs font-bold uppercase tracking-wider text-parchment-700 dark:text-parchment-400">
              {t('spell.components')}
            </dt>
            <dd className="mt-0.5">
              <ComponentIcons components={spell.components} size="md" />
            </dd>
          </div>
        </dl>

        {spell.components.material && text.materialDescription && (
          <p className="mt-3 text-[15px] italic">
            <span className="font-display text-xs font-bold not-italic uppercase tracking-wider text-parchment-700 dark:text-parchment-400">
              {t('spell.material')}:
            </span>{' '}
            {text.materialDescription}
          </p>
        )}

        <div className="divider-ornament" aria-hidden>
          ✦
        </div>

        {text.description && <Markdown className="text-[17px]">{text.description}</Markdown>}

        {text.higherLevels && (
          <section className="mt-5">
            <h3 className="accent-text font-display text-base font-bold">{t('spell.higherLevels')}</h3>
            <Markdown className="mt-1 text-[17px]">{text.higherLevels}</Markdown>
          </section>
        )}
      </div>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-parchment-300/70 px-5 py-4 text-sm sm:px-8 dark:border-night-700">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-display text-xs font-bold uppercase tracking-wider text-parchment-700 dark:text-parchment-400">
            {t('spell.classes')}:
          </span>
          {spell.classes.length ? (
            spell.classes.map((c) => (
              <span key={c} className="rounded-full border border-parchment-400 px-2 py-0.5 text-sm dark:border-night-700">
                {t(`class.${c}`)}
              </span>
            ))
          ) : (
            <span>–</span>
          )}
        </div>
        <span className="text-parchment-700 dark:text-parchment-400">
          {t('spell.source')}: {spell.source}
        </span>
      </footer>
    </article>
  );
}
