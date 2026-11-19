import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MONSTER_ABILITIES, abilityModifier, challengeInfo, type DamageType, type MonsterFeature, type MonsterStats } from '@zauberbuch/shared';
import { Markdown } from '../Markdown';
import { DamageValue } from '../DamageValue';

export interface StatBlockEntry {
  name: string;
  ac: number | null;
  hp: number | string | null;
  attack: string;
  description: string;
  damageDice: string | null;
  damageType: DamageType | null;
  stats: MonsterStats;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

/** „Klein, Humanoide (Goblinoide), neutral böse“ */
export function useMonsterSubtitle() {
  const { t } = useTranslation();
  return (s: MonsterStats) => {
    const head = [s.size ? t(`bestiary.sizes.${s.size}`) : '', s.type].filter(Boolean).join(', ');
    return [head, s.alignment].filter(Boolean).join(', ');
  };
}

/** Roter Trennstrich wie im Monsterhandbuch */
function Rule() {
  return <div className="my-2 h-[3px] bg-gradient-to-r from-[#922610] to-transparent dark:from-[#e0735a]" aria-hidden />;
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="leading-snug">
      <span className="font-semibold text-[#7a200d] dark:text-[#f0a08c]">{label}</span> {children}
    </p>
  );
}

function Features({ title, list }: { title: string; list: MonsterFeature[] }) {
  if (list.length === 0) return null;
  return (
    <section className="mt-3">
      <h4 className="border-b border-[#922610]/60 pb-0.5 font-display text-xl text-[#7a200d] dark:border-[#e0735a]/60 dark:text-[#f0a08c]">{title}</h4>
      <div className="mt-2 space-y-2">
        {list.map((f, i) => (
          <Markdown key={i} className="!space-y-1 break-words">
            {f.name ? `***${f.name.replace(/\*/g, '')}.*** ${f.text}` : f.text}
          </Markdown>
        ))}
      </div>
    </section>
  );
}

/** Vollständiger Werteblock eines Monsters (Anzeige) */
export function StatBlock({ entry }: { entry: StatBlockEntry }) {
  const { t, i18n } = useTranslation();
  const subtitle = useMonsterSubtitle();
  const s = entry.stats;
  const ch = s.cr ? challengeInfo(s.cr) : null;
  const hasAbilities = MONSTER_ABILITIES.some((a) => s.abilities[a] !== null);
  const details: [string, string][] = (
    [
      ['saves', s.saves],
      ['skills', s.skills],
      ['vulnerabilities', s.vulnerabilities],
      ['resistances', s.resistances],
      ['immunities', s.immunities],
      ['conditionImmunities', s.conditionImmunities],
      ['senses', s.senses],
      ['languages', s.languages],
    ] as [string, string][]
  ).filter(([, v]) => v);
  const hasRight = Boolean(s.cr || s.traits.length || s.actions.length || s.bonusActions.length || s.reactions.length || s.legendaryActions.length || entry.attack || entry.damageDice);

  return (
    <div className="space-y-4">
      <article className="rounded-md border-y-4 border-[#c9ad6a] bg-[#fbf3dc] p-4 text-[15px] text-ink shadow-inner dark:border-[#6b5a33] dark:bg-[#26211b] dark:text-parchment-100 sm:p-5">
        <div className={`grid gap-x-8 ${hasRight ? 'lg:grid-cols-2' : ''}`}>
          <div>
            <h3 className="font-display text-3xl font-bold leading-tight text-[#7a200d] dark:text-[#f0a08c]">{entry.name}</h3>
            {subtitle(s) && <p className="italic">{subtitle(s)}</p>}
            <Rule />
            <Line label={t('combat.ac')}>
              {entry.ac ?? '?'}
              {s.acNote && ` (${s.acNote})`}
            </Line>
            <Line label={t('combat.hp')}>
              {entry.hp ?? '?'}
              {s.hitDice && ` (${s.hitDice})`}
            </Line>
            {s.speed && <Line label={t('bestiary.stats.speed')}>{s.speed}</Line>}
            {hasAbilities && (
              <>
                <Rule />
                <dl className="grid grid-cols-6 gap-1 text-center">
                  {MONSTER_ABILITIES.map((a) => {
                    const v = s.abilities[a];
                    return (
                      <div key={a}>
                        <dt className="font-display text-sm font-bold uppercase text-[#7a200d] dark:text-[#f0a08c]">{t(`sheet.abilityShort.${a}`)}</dt>
                        <dd className="tabular-nums">{v === null ? '—' : `${v} (${signed(abilityModifier(v))})`}</dd>
                      </div>
                    );
                  })}
                </dl>
              </>
            )}
            {details.length > 0 && (
              <>
                <Rule />
                <div className="space-y-0.5">
                  {details.map(([k, v]) => (
                    <Line key={k} label={t(`bestiary.stats.${k}`)}>
                      {v}
                    </Line>
                  ))}
                </div>
              </>
            )}
          </div>
          {hasRight && (
            <div className="mt-3 lg:mt-0">
              {s.cr && (
                <>
                  <div className="flex flex-wrap gap-x-8 gap-y-1">
                    <Line label={t('bestiary.stats.cr')}>
                      {s.cr}
                      {ch && ` (${ch.xp.toLocaleString(i18n.language)} ${t('bestiary.stats.xp')})`}
                    </Line>
                    {ch && <Line label={t('bestiary.stats.proficiency')}>+{ch.proficiency}</Line>}
                  </div>
                  <Rule />
                </>
              )}
              <Features title={t('bestiary.stats.traits')} list={s.traits} />
              <Features title={t('bestiary.stats.actions')} list={s.actions} />
              <Features title={t('bestiary.stats.bonusActions')} list={s.bonusActions} />
              <Features title={t('bestiary.stats.reactions')} list={s.reactions} />
              <Features title={t('bestiary.stats.legendaryActions')} list={s.legendaryActions} />
              {(entry.attack || (entry.damageDice && entry.damageType)) && (
                <section className="mt-3">
                  <h4 className="border-b border-[#922610]/60 pb-0.5 font-display text-xl text-[#7a200d] dark:border-[#e0735a]/60 dark:text-[#f0a08c]">{t('bestiary.combatAttack')}</h4>
                  {entry.attack && <p className="mt-2 whitespace-pre-wrap break-words">{entry.attack}</p>}
                  {entry.damageDice && entry.damageType && (
                    <div className="mt-1">
                      <DamageValue damage={{ dice: entry.damageDice, type: entry.damageType }} />
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </article>
      {entry.description && (
        <section>
          <h4 className="font-display text-lg font-bold">{t('bestiary.description')}</h4>
          <Markdown className="mt-1 break-words">{entry.description}</Markdown>
        </section>
      )}
      {(s.tags || s.habitat || s.source) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {s.tags && <Chips label={t('bestiary.stats.tags')} value={s.tags} />}
          {s.habitat && <Chips label={t('bestiary.stats.habitat')} value={s.habitat} />}
          {s.source && <span className="ml-auto italic text-parchment-700 dark:text-parchment-400">{s.source}</span>}
        </div>
      )}
    </div>
  );
}

function Chips({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-parchment-700 dark:text-parchment-400">{label}:</span>
      {value
        .split(/[,;]/)
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => (
          <span key={v} className="rounded border border-parchment-400 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide dark:border-night-700">
            {v}
          </span>
        ))}
    </span>
  );
}
