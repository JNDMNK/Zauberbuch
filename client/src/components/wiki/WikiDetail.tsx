import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { WikiEntryDto, WikiLevelFeature, WikiTrait } from '@zauberbuch/shared';
import { Markdown } from '../Markdown';
import { SourceBadge } from '../sources/SourceFields';

/** Zeile „Bezeichnung: Wert“ (leere Werte werden ausgelassen) */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  if (children === '' || children === null || children === undefined) return null;
  return (
    <p className="leading-snug">
      <span className="font-semibold text-parchment-900 dark:text-parchment-200">{label}:</span> {children}
    </p>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="border-b border-parchment-400/70 pb-1 font-display text-xl font-bold dark:border-night-700">{title}</h3>
      {children}
    </section>
  );
}

function Traits({ list }: { list: WikiTrait[] }) {
  return (
    <div className="space-y-2">
      {list.map((f, i) => (
        <Markdown key={i} className="!space-y-1 break-words">
          {f.name ? `***${f.name.replace(/\*/g, '')}.*** ${f.text}` : f.text}
        </Markdown>
      ))}
    </div>
  );
}

function LevelFeatures({ list }: { list: WikiLevelFeature[] }) {
  const { t } = useTranslation();
  return (
    <ol className="space-y-2">
      {list.map((f, i) => (
        <li key={i} className="flex gap-3">
          <span
            className="mt-0.5 flex h-7 min-w-[2.75rem] shrink-0 items-center justify-center rounded-full border border-parchment-500 px-2 font-display text-xs font-bold tabular-nums dark:border-night-700"
            title={t('wiki.level')}
          >
            {t('wiki.levelShort', { n: f.level })}
          </span>
          <Markdown className="!space-y-1 min-w-0 flex-1 break-words">{f.name ? `**${f.name.replace(/\*/g, '')}.** ${f.text}` : f.text}</Markdown>
        </li>
      ))}
    </ol>
  );
}

/** Vollständige Ansicht eines Wiki-Eintrags (Volk oder Klasse) */
export function WikiDetail({ entry }: { entry: WikiEntryDto }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="space-y-5">
      <SourceBadge sourceId={entry.sourceId} full className="!text-sm" />
      {entry.summary && <p className="text-lg italic">{entry.summary}</p>}
      {entry.description && <Markdown className="break-words">{entry.description}</Markdown>}

      {entry.kind === 'race' ? (
        <>
          <Section title={t('wiki.race.traitsTitle')}>
            <div className="space-y-1">
              <Fact label={t('wiki.race.abilityIncrease')}>{entry.data.abilityIncrease}</Fact>
              <Fact label={t('wiki.race.age')}>{entry.data.age}</Fact>
              <Fact label={t('wiki.race.alignment')}>{entry.data.alignment}</Fact>
              <Fact label={t('wiki.race.size')}>{entry.data.size}</Fact>
              <Fact label={t('wiki.race.speed')}>{entry.data.speed}</Fact>
              <Fact label={t('wiki.race.languages')}>{entry.data.languages}</Fact>
            </div>
            {entry.data.traits.length > 0 && <Traits list={entry.data.traits} />}
          </Section>
          {entry.data.subraces.length > 0 && (
            <Section title={t('wiki.race.subraces')}>
              {entry.data.subraces.map((s, i) => (
                <div key={i} className="space-y-2 rounded-lg bg-parchment-200/40 p-3 dark:bg-night-900/40">
                  <h4 className="font-display text-lg font-bold">{s.name}</h4>
                  <Fact label={t('wiki.race.abilityIncrease')}>{s.abilityIncrease}</Fact>
                  {s.description && <Markdown className="break-words">{s.description}</Markdown>}
                  {s.traits.length > 0 && <Traits list={s.traits} />}
                </div>
              ))}
            </Section>
          )}
        </>
      ) : entry.kind === 'class' ? (
        <>
          <Section title={t('wiki.class.hitPoints')}>
            <div className="space-y-1">
              <Fact label={t('wiki.class.hitDie')}>{entry.data.hitDie ? `1${entry.data.hitDie.replace('d', 'W')}` : ''}</Fact>
              <Fact label={t('wiki.class.hpFirst')}>{entry.data.hpFirst}</Fact>
              <Fact label={t('wiki.class.hpHigher')}>{entry.data.hpHigher}</Fact>
              <Fact label={t('wiki.class.primaryAbility')}>{entry.data.primaryAbility}</Fact>
            </div>
          </Section>
          <Section title={t('wiki.class.proficiencies')}>
            <div className="space-y-1">
              <Fact label={t('wiki.class.armor')}>{entry.data.armor}</Fact>
              <Fact label={t('wiki.class.weapons')}>{entry.data.weapons}</Fact>
              <Fact label={t('wiki.class.tools')}>{entry.data.tools}</Fact>
              <Fact label={t('wiki.class.saves')}>{entry.data.saves}</Fact>
              <Fact label={t('wiki.class.skills')}>{entry.data.skills}</Fact>
            </div>
          </Section>
          {entry.data.equipment && (
            <Section title={t('wiki.class.equipment')}>
              <Markdown className="break-words">{entry.data.equipment}</Markdown>
            </Section>
          )}
          {entry.data.spellcasting && (
            <Section title={t('wiki.class.spellcasting')}>
              <Markdown className="break-words">{entry.data.spellcasting}</Markdown>
            </Section>
          )}
          {entry.data.features.length > 0 && (
            <Section title={t('wiki.class.features')}>
              <LevelFeatures list={entry.data.features} />
            </Section>
          )}
          {entry.data.subclasses.length > 0 && (
            <Section title={entry.data.subclassTitle || t('wiki.class.subclasses')}>
              {entry.data.subclasses.map((s, i) => (
                <div key={i} className="space-y-2 rounded-lg bg-parchment-200/40 p-3 dark:bg-night-900/40">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h4 className="font-display text-lg font-bold">{s.name}</h4>
                    <SourceBadge sourceId={s.sourceId} full />
                  </div>
                  {s.description && <Markdown className="break-words">{s.description}</Markdown>}
                  {s.features.length > 0 && <LevelFeatures list={s.features} />}
                </div>
              ))}
            </Section>
          )}
        </>
      ) : entry.kind === 'feat' ? (
        <Section title={t('wiki.feat.title')}>
          <div className="space-y-1">
            <Fact label={t('wiki.feat.prerequisite')}>{entry.data.prerequisite || t('wiki.feat.none')}</Fact>
            <Fact label={t('wiki.race.abilityIncrease')}>{entry.data.abilityIncrease}</Fact>
            {entry.data.repeatable && <Fact label={t('wiki.feat.repeatable')}>{t('wiki.feat.repeatableText')}</Fact>}
          </div>
          {entry.data.benefits && <Markdown className="break-words">{entry.data.benefits}</Markdown>}
        </Section>
      ) : (
        <>
          <Section title={t('wiki.background.proficiencies')}>
            <div className="space-y-1">
              <Fact label={t('wiki.background.skills')}>{entry.data.skills}</Fact>
              <Fact label={t('wiki.background.tools')}>{entry.data.tools}</Fact>
              <Fact label={t('wiki.background.languages')}>{entry.data.languages}</Fact>
            </div>
          </Section>
          {entry.data.equipment && (
            <Section title={t('wiki.class.equipment')}>
              <Markdown className="break-words">{entry.data.equipment}</Markdown>
            </Section>
          )}
          {(entry.data.feature.name || entry.data.feature.text) && (
            <Section title={`${t('wiki.background.feature')}: ${entry.data.feature.name}`}>
              <Markdown className="break-words">{entry.data.feature.text}</Markdown>
            </Section>
          )}
          {(['personalityTraits', 'ideals', 'bonds', 'flaws'] as const).some((k) => entry.data[k].length > 0) && (
            <Section title={t('wiki.background.characteristics')}>
              <div className="grid gap-4 md:grid-cols-2">
                {(
                  [
                    ['personalityTraits', 8],
                    ['ideals', 6],
                    ['bonds', 6],
                    ['flaws', 6],
                  ] as const
                ).map(([k]) =>
                  entry.data[k].length === 0 ? null : (
                    <div key={k}>
                      <h4 className="font-display font-bold">{t(`wiki.background.${k}`)}</h4>
                      <table className="mt-1 w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-parchment-700 dark:text-parchment-400">
                            <th className="w-10 pb-1 font-semibold">{`W${entry.data[k].length}`}</th>
                            <th className="pb-1 font-semibold">{t(`wiki.background.${k}One`)}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.data[k].map((line, i) => (
                            <tr key={i} className="border-t border-parchment-300/70 align-top dark:border-night-700">
                              <td className="py-1 font-semibold tabular-nums">{i + 1}</td>
                              <td className="py-1">
                                <Markdown className="!space-y-0">{line}</Markdown>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ),
                )}
              </div>
            </Section>
          )}
        </>
      )}
      <p className="text-xs text-parchment-700 dark:text-parchment-400">
        {entry.updatedBy ? t('wiki.updated', { date: new Date(entry.updatedAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }), user: entry.updatedBy }) : t('wiki.srdNote')}
      </p>
    </div>
  );
}
