import { useTranslation } from 'react-i18next';
import { SourceNameSelect } from '../sources/SourceFields';
import { Plus, Trash2 } from 'lucide-react';
import { MONSTER_ABILITIES, MONSTER_SIZES, abilityModifier, challengeInfo, type MonsterFeature, type MonsterStats } from '@zauberbuch/shared';

type FeatureKey = 'traits' | 'actions' | 'bonusActions' | 'reactions' | 'legendaryActions';
type TextKey = 'type' | 'alignment' | 'acNote' | 'hitDice' | 'speed' | 'saves' | 'skills' | 'vulnerabilities' | 'resistances' | 'immunities' | 'conditionImmunities' | 'senses' | 'languages' | 'cr' | 'habitat' | 'tags' | 'source';

/** Ein Abschnitt des Formulars */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-parchment-400/60 p-3 dark:border-night-700">
      <legend className="px-1 font-display text-sm font-bold uppercase tracking-wide text-parchment-800 dark:text-parchment-300">{title}</legend>
      <div className="space-y-3">{children}</div>
    </fieldset>
  );
}

/**
 * Formularteile für den vollständigen Werteblock (Größe, Typ, Attribute, Sinne, Merkmale, Aktionen …).
 * `top` enthält die Grundwerte (RK/LP) des Eintrags, damit sie im passenden Abschnitt stehen.
 */
export function StatBlockForm({ value, onChange, top }: { value: MonsterStats; onChange: (v: MonsterStats) => void; top?: React.ReactNode }) {
  const { t } = useTranslation();
  const set = <K extends keyof MonsterStats>(k: K, v: MonsterStats[K]) => onChange({ ...value, [k]: v });
  const text = (k: TextKey, max: number, placeholder?: string, wide = false) => (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={`st-${k}`} className="label">
        {t(`bestiary.stats.${k}`)}
      </label>
      <input id={`st-${k}`} className="input" value={value[k]} maxLength={max} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} />
    </div>
  );
  const ch = value.cr ? challengeInfo(value.cr) : null;

  return (
    <div className="space-y-4">
      <Group title={t('bestiary.stats.groupBasics')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="st-size" className="label">
              {t('bestiary.stats.size')}
            </label>
            <select id="st-size" className="input" value={value.size ?? ''} onChange={(e) => set('size', (e.target.value || null) as MonsterStats['size'])}>
              <option value="">—</option>
              {MONSTER_SIZES.map((s) => (
                <option key={s} value={s}>
                  {t(`bestiary.sizes.${s}`)}
                </option>
              ))}
            </select>
          </div>
          {text('type', 80, t('bestiary.stats.typePlaceholder'))}
          {text('alignment', 60, t('bestiary.stats.alignmentPlaceholder'))}
        </div>
        {top}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {text('acNote', 100, t('bestiary.stats.acNotePlaceholder'))}
          {text('hitDice', 40, '2W6')}
          {text('speed', 150, t('bestiary.stats.speedPlaceholder'))}
        </div>
      </Group>

      <Group title={t('bestiary.stats.groupAbilities')}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {MONSTER_ABILITIES.map((a) => {
            const v = value.abilities[a];
            return (
              <div key={a} className="text-center">
                <label htmlFor={`st-ab-${a}`} className="label !text-center">
                  {t(`sheet.abilityShort.${a}`)}
                </label>
                <input
                  id={`st-ab-${a}`}
                  className="input text-center"
                  inputMode="numeric"
                  value={v ?? ''}
                  maxLength={2}
                  onChange={(e) => {
                    const n = e.target.value.replace(/\D/g, '');
                    set('abilities', { ...value.abilities, [a]: n === '' ? null : Math.min(30, Math.max(1, Number(n))) });
                  }}
                  placeholder="10"
                />
                <span className="text-xs tabular-nums text-parchment-700 dark:text-parchment-400">{v === null ? ' ' : (abilityModifier(v) >= 0 ? '+' : '') + abilityModifier(v)}</span>
              </div>
            );
          })}
        </div>
      </Group>

      <Group title={t('bestiary.stats.groupDetails')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {text('saves', 300, t('bestiary.stats.savesPlaceholder'))}
          {text('skills', 300, t('bestiary.stats.skillsPlaceholder'))}
          {text('vulnerabilities', 300)}
          {text('resistances', 300)}
          {text('immunities', 300)}
          {text('conditionImmunities', 300)}
          {text('senses', 300, t('bestiary.stats.sensesPlaceholder'))}
          {text('languages', 300, t('bestiary.stats.languagesPlaceholder'))}
        </div>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
          {text('cr', 10, '1/4')}
          <p className="pb-2 text-sm text-parchment-700 dark:text-parchment-400 sm:col-span-2">
            {ch ? t('bestiary.stats.crInfo', { xp: ch.xp.toLocaleString('de'), pb: ch.proficiency }) : value.cr ? t('bestiary.stats.crUnknown') : t('bestiary.stats.crHint')}
          </p>
        </div>
      </Group>

      {(['traits', 'actions', 'bonusActions', 'reactions', 'legendaryActions'] as FeatureKey[]).map((k) => (
        <FeatureList key={k} id={k} title={t(`bestiary.stats.${k}`)} list={value[k]} onChange={(l) => set(k, l)} />
      ))}

      <Group title={t('bestiary.stats.groupMeta')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {text('tags', 200, t('bestiary.stats.tagsPlaceholder'))}
          {text('habitat', 200, t('bestiary.stats.habitatPlaceholder'))}
          <div>
            <label htmlFor="st-source" className="label">
              {t('bestiary.stats.source')}
            </label>
            <SourceNameSelect id="st-source" value={value.source} onChange={(v) => set('source', v)} extra={['Homebrew']} />
          </div>
        </div>
      </Group>
    </div>
  );
}

function FeatureList({ id, title, list, onChange }: { id: string; title: string; list: MonsterFeature[]; onChange: (l: MonsterFeature[]) => void }) {
  const { t } = useTranslation();
  const update = (i: number, patch: Partial<MonsterFeature>) => onChange(list.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <Group title={title}>
      {list.length === 0 && <p className="text-sm italic text-parchment-700 dark:text-parchment-400">{t('bestiary.stats.noFeatures')}</p>}
      {list.map((f, i) => (
        <div key={i} className="space-y-1.5 rounded-md bg-parchment-200/40 p-2 dark:bg-night-900/40">
          <div className="flex items-center gap-2">
            <input
              className="input font-semibold"
              value={f.name}
              maxLength={100}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder={t('bestiary.stats.featureName')}
              aria-label={`${title} ${i + 1}: ${t('bestiary.stats.featureName')}`}
            />
            <button type="button" className="btn-icon shrink-0 text-red-700 dark:text-red-400" onClick={() => onChange(list.filter((_, j) => j !== i))} title={t('common.delete')} aria-label={`${t('common.delete')}: ${f.name || `${title} ${i + 1}`}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <textarea
            className="input min-h-[3.5rem]"
            rows={3}
            value={f.text}
            maxLength={3000}
            onChange={(e) => update(i, { text: e.target.value })}
            placeholder={id === 'actions' ? t('bestiary.stats.actionPlaceholder') : t('bestiary.stats.featureText')}
            aria-label={`${title} ${i + 1}: ${t('bestiary.stats.featureText')}`}
          />
        </div>
      ))}
      <button type="button" className="btn-ghost !px-2 !py-1 text-sm" onClick={() => onChange([...list, { name: '', text: '' }])}>
        <Plus className="h-4 w-4" />
        {t('bestiary.stats.addFeature', { what: title })}
      </button>
    </Group>
  );
}
