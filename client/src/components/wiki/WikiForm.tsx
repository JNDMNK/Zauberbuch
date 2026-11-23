import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Save, Trash2 } from 'lucide-react';
import { slotsFor } from '../../lib/levelUp';
import {
  ABILITIES,
  ALIGNMENTS,
  FEAT_CATEGORIES,
  godDataSchema,
  CASTER_TYPES,
  CLASSES,
  type CasterType,
  ruleDataSchema,
  RULE_CATEGORIES,
  CONDITIONS,
  type WikiRuleData,
  type WikiGodData,
  LANGUAGE_TYPES,
  languageDataSchema,
  type WikiLanguageData,
  HIT_DICE,
  backgroundDataSchema,
  classDataSchema,
  featDataSchema,
  raceDataSchema,
  type WikiBackgroundData,
  type WikiFeatData,
  type WikiClassData,
  type WikiEntryDto,
  type WikiEntryInput,
  type WikiKind,
  type WikiLevelFeature,
  type WikiRaceData,
  type WikiTrait,
} from '@zauberbuch/shared';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../Modal';
import { MarkdownEditor } from '../MarkdownEditor';
import { Spinner } from '../ui';
import { SourceSelect } from '../sources/SourceFields';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-parchment-400/60 p-3 dark:border-night-700">
      <legend className="px-1 font-display text-sm font-bold uppercase tracking-wide text-parchment-800 dark:text-parchment-300">{title}</legend>
      <div className="space-y-3">{children}</div>
    </fieldset>
  );
}

function TextInput({ id, label, value, onChange, max = 300, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; max?: number; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} className="input" value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function TextArea({ id, label, value, onChange, max = 1000, rows = 2 }: { id: string; label: string; value: string; onChange: (v: string) => void; max?: number; rows?: number }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <textarea id={id} className="input" rows={rows} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Liste „Name + Text“ (Merkmale) */
function TraitList({ prefix, list, onChange }: { prefix: string; list: WikiTrait[]; onChange: (l: WikiTrait[]) => void }) {
  const { t } = useTranslation();
  const upd = (i: number, p: Partial<WikiTrait>) => onChange(list.map((f, j) => (j === i ? { ...f, ...p } : f)));
  return (
    <div className="space-y-2">
      {list.map((f, i) => (
        <div key={i} className="space-y-1.5 rounded-md bg-parchment-200/40 p-2 dark:bg-night-900/40">
          <div className="flex items-center gap-2">
            <input
              className="input font-semibold"
              value={f.name}
              maxLength={120}
              onChange={(e) => upd(i, { name: e.target.value })}
              placeholder={t('wiki.form.traitName')}
              aria-label={`${prefix} ${i + 1}: ${t('wiki.form.traitName')}`}
            />
            <button
              type="button"
              className="btn-icon shrink-0 text-red-700 dark:text-red-400"
              onClick={() => onChange(list.filter((_, j) => j !== i))}
              title={t('common.delete')}
              aria-label={`${t('common.delete')}: ${f.name || `${prefix} ${i + 1}`}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <textarea
            className="input"
            rows={3}
            value={f.text}
            maxLength={5000}
            onChange={(e) => upd(i, { text: e.target.value })}
            placeholder={t('wiki.form.traitText')}
            aria-label={`${prefix} ${i + 1}: ${t('wiki.form.traitText')}`}
          />
        </div>
      ))}
      <button type="button" className="btn-ghost !px-2 !py-1 text-sm" onClick={() => onChange([...list, { name: '', text: '' }])}>
        <Plus className="h-4 w-4" />
        {t('wiki.form.addTrait')}
      </button>
    </div>
  );
}

/** Liste „Stufe + Name + Text“ (Klassenmerkmale) */
function FeatureList({ prefix, list, onChange }: { prefix: string; list: WikiLevelFeature[]; onChange: (l: WikiLevelFeature[]) => void }) {
  const { t } = useTranslation();
  const upd = (i: number, p: Partial<WikiLevelFeature>) => onChange(list.map((f, j) => (j === i ? { ...f, ...p } : f)));
  return (
    <div className="space-y-2">
      {list.map((f, i) => (
        <div key={i} className="space-y-1.5 rounded-md bg-parchment-200/40 p-2 dark:bg-night-900/40">
          <div className="flex items-center gap-2">
            <input
              className="input w-20 shrink-0 text-center"
              inputMode="numeric"
              value={f.level}
              maxLength={2}
              onChange={(e) => upd(i, { level: Math.max(1, Math.min(20, Number(e.target.value.replace(/\D/g, '')) || 1)) })}
              aria-label={`${prefix} ${i + 1}: ${t('wiki.level')}`}
              title={t('wiki.level')}
            />
            <input
              className="input font-semibold"
              value={f.name}
              maxLength={120}
              onChange={(e) => upd(i, { name: e.target.value })}
              placeholder={t('wiki.form.featureName')}
              aria-label={`${prefix} ${i + 1}: ${t('wiki.form.featureName')}`}
            />
            <button
              type="button"
              className="btn-icon shrink-0 text-red-700 dark:text-red-400"
              onClick={() => onChange(list.filter((_, j) => j !== i))}
              title={t('common.delete')}
              aria-label={`${t('common.delete')}: ${f.name || `${prefix} ${i + 1}`}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <textarea
            className="input"
            rows={2}
            value={f.text}
            maxLength={5000}
            onChange={(e) => upd(i, { text: e.target.value })}
            placeholder={t('wiki.form.traitText')}
            aria-label={`${prefix} ${i + 1}: ${t('wiki.form.traitText')}`}
          />
        </div>
      ))}
      <button type="button" className="btn-ghost !px-2 !py-1 text-sm" onClick={() => onChange([...list, { level: list.at(-1)?.level ?? 1, name: '', text: '' }])}>
        <Plus className="h-4 w-4" />
        {t('wiki.form.addFeature')}
      </button>
    </div>
  );
}

function RaceFields({ d, set }: { d: WikiRaceData; set: (d: WikiRaceData) => void }) {
  const { t } = useTranslation();
  const f = <K extends keyof WikiRaceData>(k: K, v: WikiRaceData[K]) => set({ ...d, [k]: v });
  return (
    <>
      <Group title={t('wiki.race.traitsTitle')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput id="w-ai" label={t('wiki.race.abilityIncrease')} value={d.abilityIncrease} onChange={(v) => f('abilityIncrease', v)} max={200} placeholder="Konstitution +2" />
          <TextInput id="w-speed" label={t('wiki.race.speed')} value={d.speed} onChange={(v) => f('speed', v)} max={200} placeholder="9 m" />
        </div>
        <TextArea id="w-age" label={t('wiki.race.age')} value={d.age} onChange={(v) => f('age', v)} />
        <TextArea id="w-al" label={t('wiki.race.alignment')} value={d.alignment} onChange={(v) => f('alignment', v)} />
        <TextArea id="w-size" label={t('wiki.race.size')} value={d.size} onChange={(v) => f('size', v)} />
        <TextInput id="w-lang" label={t('wiki.race.languages')} value={d.languages} onChange={(v) => f('languages', v)} max={1000} />
      </Group>
      <Group title={t('wiki.race.traits')}>
        <TraitList prefix={t('wiki.race.traits')} list={d.traits} onChange={(l) => f('traits', l)} />
      </Group>
      <Group title={t('wiki.race.subraces')}>
        {d.subraces.map((s, i) => {
          const upd = (p: Partial<WikiRaceData['subraces'][number]>) =>
            f(
              'subraces',
              d.subraces.map((x, j) => (j === i ? { ...x, ...p } : x)),
            );
          return (
            <div key={i} className="space-y-2 rounded-lg border border-parchment-400/60 p-3 dark:border-night-700">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <TextInput id={`w-sr-${i}`} label={t('wiki.race.subraceName')} value={s.name} onChange={(v) => upd({ name: v })} max={120} />
                </div>
                <button
                  type="button"
                  className="btn-icon text-red-700 dark:text-red-400"
                  onClick={() =>
                    f(
                      'subraces',
                      d.subraces.filter((_, j) => j !== i),
                    )
                  }
                  title={t('common.delete')}
                  aria-label={`${t('common.delete')}: ${s.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <TextInput id={`w-sr-ai-${i}`} label={t('wiki.race.abilityIncrease')} value={s.abilityIncrease} onChange={(v) => upd({ abilityIncrease: v })} max={200} />
              <TextArea id={`w-sr-d-${i}`} label={t('wiki.description')} value={s.description} onChange={(v) => upd({ description: v })} max={5000} />
              <TraitList prefix={`${s.name || t('wiki.race.subraceName')} – ${t('wiki.race.traits')}`} list={s.traits} onChange={(l) => upd({ traits: l })} />
            </div>
          );
        })}
        <button type="button" className="btn-ghost !px-2 !py-1 text-sm" onClick={() => f('subraces', [...d.subraces, { name: '', abilityIncrease: '', description: '', traits: [] }])}>
          <Plus className="h-4 w-4" />
          {t('wiki.form.addSubrace')}
        </button>
      </Group>
    </>
  );
}

/** Zauberwirken einer Klasse: Art (oder eigene Tabelle), Zauberattribut, genutzte Zauberlisten */
function CastingFields({ d, set }: { d: WikiClassData; set: (d: WikiClassData) => void }) {
  const { t } = useTranslation();
  const f = <K extends keyof WikiClassData>(k: K, v: WikiClassData[K]) => set({ ...d, [k]: v });
  const table = Array.from({ length: 20 }, (_, i) => Array.from({ length: 9 }, (_, g) => d.slotTable[i]?.[g] ?? 0));
  const fill = (type: Exclude<CasterType, 'custom' | 'none'>) =>
    f(
      'slotTable',
      Array.from({ length: 20 }, (_, i) => slotsFor(type, i + 1)),
    );
  const setCell = (lvl: number, grade: number, v: number) =>
    f(
      'slotTable',
      table.map((r, i) => (i === lvl ? r.map((x, g) => (g === grade ? v : x)) : r)),
    );
  return (
    <Group title={t('wiki.class.castingGroup')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="w-caster" className="label">
            {t('wiki.class.casterType')}
          </label>
          <select
            id="w-caster"
            className="input"
            value={d.casterType ?? ''}
            onChange={(e) => {
              const v = (e.target.value || null) as WikiClassData['casterType'];
              // Eigene Tabelle: mit einer Vorlage beginnen, wenn noch leer
              set({ ...d, casterType: v, slotTable: v === 'custom' && d.slotTable.length === 0 ? Array.from({ length: 20 }, (_, i) => slotsFor('full', i + 1)) : d.slotTable });
            }}
          >
            <option value="">{t('wiki.class.casterTypes.auto')}</option>
            {CASTER_TYPES.map((c) => (
              <option key={c} value={c}>
                {t(`wiki.class.casterTypes.${c}`)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">{t('wiki.class.castingHint')}</p>
        </div>
        <div>
          <label htmlFor="w-cability" className="label">
            {t('wiki.class.castingAbility')}
          </label>
          <select id="w-cability" className="input" value={d.castingAbility ?? ''} onChange={(e) => f('castingAbility', (e.target.value || null) as WikiClassData['castingAbility'])}>
            <option value="">{t('wiki.class.castingAuto')}</option>
            {ABILITIES.map((a) => (
              <option key={a} value={a}>
                {t(`sheet.ability.${a}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <span className="label">{t('wiki.class.spellLists')}</span>
        <div className="flex flex-wrap gap-1.5">
          {CLASSES.map((c) => (
            <label key={c} className="chip-check">
              <input type="checkbox" checked={d.spellLists.includes(c)} onChange={(e) => f('spellLists', e.target.checked ? [...d.spellLists, c] : d.spellLists.filter((x) => x !== c))} />
              {t(`class.${c}`)}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">{t('wiki.class.spellListsHint')}</p>
      </div>
      {d.casterType === 'custom' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="label !mb-0">{t('wiki.class.slotTable')}</span>
            <span className="ml-2 text-xs text-parchment-700 dark:text-parchment-400">{t('wiki.class.fillFrom')}</span>
            {(['full', 'half', 'halfEarly', 'third', 'pact'] as const).map((type) => (
              <button key={type} type="button" className="btn-ghost !px-2 !py-0.5 text-xs" onClick={() => fill(type)}>
                {t(`wiki.class.casterTypes.${type}`)}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="text-center text-sm">
              <thead>
                <tr className="text-xs text-parchment-700 dark:text-parchment-400">
                  <th className="px-1 py-1 text-left">{t('wiki.level')}</th>
                  {Array.from({ length: 9 }, (_, g) => (
                    <th key={g} className="px-0.5 py-1">
                      {g + 1}.
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.map((r, i) => (
                  <tr key={i}>
                    <td className="px-1 text-left font-semibold tabular-nums">{i + 1}</td>
                    {r.map((v, g) => (
                      <td key={g} className="px-0.5 py-0.5">
                        <input
                          className="input !w-10 !px-1 !py-0.5 text-center tabular-nums"
                          inputMode="numeric"
                          value={v || ''}
                          placeholder="0"
                          aria-label={`${t('wiki.level')} ${i + 1}, ${t('spell.levelOrdinal', { level: g + 1 })}`}
                          onChange={(e) => setCell(i, g, Math.min(9, Number(e.target.value.replace(/\D/g, '')) || 0))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Group>
  );
}

function ClassFields({ d, set }: { d: WikiClassData; set: (d: WikiClassData) => void }) {
  const { t } = useTranslation();
  const f = <K extends keyof WikiClassData>(k: K, v: WikiClassData[K]) => set({ ...d, [k]: v });
  return (
    <>
      <Group title={t('wiki.class.hitPoints')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="w-hd" className="label">
              {t('wiki.class.hitDie')}
            </label>
            <select id="w-hd" className="input" value={d.hitDie ?? ''} onChange={(e) => f('hitDie', (e.target.value || null) as WikiClassData['hitDie'])}>
              <option value="">—</option>
              {HIT_DICE.map((h) => (
                <option key={h} value={h}>
                  1{h.replace('d', 'W')}
                </option>
              ))}
            </select>
          </div>
          <TextInput id="w-pa" label={t('wiki.class.primaryAbility')} value={d.primaryAbility} onChange={(v) => f('primaryAbility', v)} max={100} />
          <TextInput id="w-hp1" label={t('wiki.class.hpFirst')} value={d.hpFirst} onChange={(v) => f('hpFirst', v)} max={200} />
          <TextInput id="w-hpn" label={t('wiki.class.hpHigher')} value={d.hpHigher} onChange={(v) => f('hpHigher', v)} />
        </div>
      </Group>
      <Group title={t('wiki.class.proficiencies')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput id="w-armor" label={t('wiki.class.armor')} value={d.armor} onChange={(v) => f('armor', v)} />
          <TextInput id="w-weapons" label={t('wiki.class.weapons')} value={d.weapons} onChange={(v) => f('weapons', v)} />
          <TextInput id="w-tools" label={t('wiki.class.tools')} value={d.tools} onChange={(v) => f('tools', v)} />
          <TextInput id="w-saves" label={t('wiki.class.saves')} value={d.saves} onChange={(v) => f('saves', v)} max={200} />
        </div>
        <TextArea id="w-skills" label={t('wiki.class.skills')} value={d.skills} onChange={(v) => f('skills', v)} max={500} />
      </Group>
      <Group title={t('wiki.class.equipment')}>
        <MarkdownEditor id="w-equip" value={d.equipment} onChange={(v) => f('equipment', v.slice(0, 3000))} rows={4} />
        <p className="text-xs text-parchment-700 dark:text-parchment-400">{t('wiki.equipmentHint')}</p>
      </Group>
      <Group title={t('wiki.class.spellcasting')}>
        <MarkdownEditor id="w-spell" value={d.spellcasting} onChange={(v) => f('spellcasting', v.slice(0, 5000))} rows={4} />
      </Group>
      <CastingFields d={d} set={set} />
      <Group title={t('wiki.class.features')}>
        <FeatureList prefix={t('wiki.class.features')} list={d.features} onChange={(l) => f('features', l)} />
      </Group>
      <Group title={t('wiki.class.subclasses')}>
        <TextInput id="w-sct" label={t('wiki.class.subclassTitle')} value={d.subclassTitle} onChange={(v) => f('subclassTitle', v)} max={80} placeholder={t('wiki.class.subclassTitlePlaceholder')} />
        {d.subclasses.map((s, i) => {
          const upd = (p: Partial<WikiClassData['subclasses'][number]>) =>
            f(
              'subclasses',
              d.subclasses.map((x, j) => (j === i ? { ...x, ...p } : x)),
            );
          return (
            <div key={i} className="space-y-2 rounded-lg border border-parchment-400/60 p-3 dark:border-night-700">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <TextInput id={`w-sc-${i}`} label={t('wiki.class.subclassName')} value={s.name} onChange={(v) => upd({ name: v })} max={120} />
                </div>
                <button
                  type="button"
                  className="btn-icon text-red-700 dark:text-red-400"
                  onClick={() =>
                    f(
                      'subclasses',
                      d.subclasses.filter((_, j) => j !== i),
                    )
                  }
                  title={t('common.delete')}
                  aria-label={`${t('common.delete')}: ${s.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <SourceSelect id={`w-sc-src-${i}`} value={s.sourceId} onChange={(v) => upd({ sourceId: v })} />
              <TextArea id={`w-sc-d-${i}`} label={t('wiki.description')} value={s.description} onChange={(v) => upd({ description: v })} max={5000} />
              <FeatureList prefix={`${s.name || t('wiki.class.subclassName')} – ${t('wiki.class.features')}`} list={s.features} onChange={(l) => upd({ features: l })} />
            </div>
          );
        })}
        <button type="button" className="btn-ghost !px-2 !py-1 text-sm" onClick={() => f('subclasses', [...d.subclasses, { name: '', sourceId: null, description: '', features: [] }])}>
          <Plus className="h-4 w-4" />
          {t('wiki.form.addSubclass')}
        </button>
      </Group>
    </>
  );
}

function FeatFields({ d, set }: { d: WikiFeatData; set: (d: WikiFeatData) => void }) {
  const { t } = useTranslation();
  const f = <K extends keyof WikiFeatData>(k: K, v: WikiFeatData[K]) => set({ ...d, [k]: v });
  return (
    <Group title={t('wiki.feat.title')}>
      <div>
        <label htmlFor="w-fcat" className="label">
          {t('wiki.feat.category')}
        </label>
        <select id="w-fcat" className="input sm:max-w-xs" value={d.category ?? ''} onChange={(e) => f('category', (e.target.value || null) as WikiFeatData['category'])}>
          <option value="">—</option>
          {FEAT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`wiki.feat.categories.${c}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextInput id="w-pre" label={t('wiki.feat.prerequisite')} value={d.prerequisite} onChange={(v) => f('prerequisite', v)} placeholder={t('wiki.feat.prerequisitePlaceholder')} />
        <TextInput id="w-fai" label={t('wiki.race.abilityIncrease')} value={d.abilityIncrease} onChange={(v) => f('abilityIncrease', v)} max={200} placeholder={t('wiki.feat.abilityPlaceholder')} />
      </div>
      <label className="chip-check">
        <input type="checkbox" checked={d.repeatable} onChange={(e) => f('repeatable', e.target.checked)} />
        {t('wiki.feat.repeatableText')}
      </label>
      <div>
        <label htmlFor="w-benefits" className="label">
          {t('wiki.feat.benefits')}
        </label>
        <MarkdownEditor id="w-benefits" value={d.benefits} onChange={(v) => f('benefits', v.slice(0, 5000))} rows={6} />
      </div>
    </Group>
  );
}

/** Mehrzeiliges Feld: eine Zeile = ein Eintrag (z. B. Persönlichkeitsmerkmale) */
function LinesInput({ id, label, value, onChange, hint }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void; hint: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <textarea id={id} className="input" rows={Math.max(3, value.length + 1)} value={value.join('\n')} onChange={(e) => onChange(e.target.value.split('\n').slice(0, 20))} />
      <p className="mt-0.5 text-xs text-parchment-700 dark:text-parchment-400">{hint}</p>
    </div>
  );
}

function BackgroundFields({ d, set, featNames }: { d: WikiBackgroundData; set: (d: WikiBackgroundData) => void; featNames: string[] }) {
  const { t } = useTranslation();
  const f = <K extends keyof WikiBackgroundData>(k: K, v: WikiBackgroundData[K]) => set({ ...d, [k]: v });
  return (
    <>
      <Group title={t('wiki.background.abilityAndFeat')}>
        <fieldset>
          <legend className="label">{t('wiki.background.abilityScores')}</legend>
          <div className="flex flex-wrap gap-2">
            {ABILITIES.map((a) => (
              <label key={a} className="chip-check">
                <input
                  type="checkbox"
                  checked={d.abilityScores.includes(a)}
                  onChange={(e) => f('abilityScores', e.target.checked ? ABILITIES.filter((x) => x === a || d.abilityScores.includes(x)) : d.abilityScores.filter((x) => x !== a))}
                />
                {t(`sheet.ability.${a}`)}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">{t('wiki.background.abilityScoresHint')}</p>
        </fieldset>
        <div>
          <label htmlFor="w-bfeat" className="label">
            {t('wiki.background.feat')}
          </label>
          <input id="w-bfeat" className="input" value={d.feat} maxLength={120} list="w-bfeat-list" onChange={(e) => f('feat', e.target.value)} placeholder={t('wiki.background.featPlaceholder')} />
          <datalist id="w-bfeat-list">
            {featNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
      </Group>
      <Group title={t('wiki.background.proficiencies')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextInput id="w-bskills" label={t('wiki.background.skills')} value={d.skills} onChange={(v) => f('skills', v)} placeholder="Motiv erkennen, Religion" />
          <TextInput id="w-btools" label={t('wiki.background.tools')} value={d.tools} onChange={(v) => f('tools', v)} />
          <TextInput id="w-blang" label={t('wiki.background.languages')} value={d.languages} onChange={(v) => f('languages', v)} />
        </div>
      </Group>
      <Group title={t('wiki.class.equipment')}>
        <MarkdownEditor id="w-bequip" value={d.equipment} onChange={(v) => f('equipment', v.slice(0, 2000))} rows={4} />
        <p className="text-xs text-parchment-700 dark:text-parchment-400">{t('wiki.equipmentHint')}</p>
      </Group>
      <Group title={t('wiki.background.feature')}>
        <TextInput id="w-bfname" label={t('wiki.name')} value={d.feature.name} onChange={(v) => f('feature', { ...d.feature, name: v })} max={120} />
        <TextArea id="w-bftext" label={t('wiki.description')} value={d.feature.text} onChange={(v) => f('feature', { ...d.feature, text: v })} max={5000} rows={5} />
      </Group>
      <Group title={t('wiki.background.characteristics')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(['personalityTraits', 'ideals', 'bonds', 'flaws'] as const).map((k) => (
            <LinesInput key={k} id={`w-b-${k}`} label={t(`wiki.background.${k}`)} value={d[k]} onChange={(v) => f(k, v)} hint={t('wiki.background.linesHint')} />
          ))}
        </div>
      </Group>
    </>
  );
}

function GodFields({ d, set, pantheons }: { d: WikiGodData; set: (d: WikiGodData) => void; pantheons: string[] }) {
  const { t } = useTranslation();
  const f = <K extends keyof WikiGodData>(k: K, v: WikiGodData[K]) => set({ ...d, [k]: v });
  return (
    <Group title={t('wiki.god.title')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="w-gpan" className="label">
            {t('wiki.god.pantheon')}
          </label>
          <input id="w-gpan" className="input" value={d.pantheon} maxLength={100} list="w-gpan-list" onChange={(e) => f('pantheon', e.target.value)} placeholder={t('wiki.god.pantheonPlaceholder')} />
          <datalist id="w-gpan-list">
            {pantheons.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="w-galign" className="label">
            {t('wiki.god.alignment')}
          </label>
          <select id="w-galign" className="input" value={d.alignment ?? ''} onChange={(e) => f('alignment', (e.target.value || null) as WikiGodData['alignment'])}>
            <option value="">—</option>
            {ALIGNMENTS.map((a) => (
              <option key={a} value={a}>
                {t(`wiki.god.alignments.${a}`)}
              </option>
            ))}
          </select>
        </div>
        <TextInput id="w-gdom" label={t('wiki.god.domains')} value={d.domains} onChange={(v) => f('domains', v)} max={200} placeholder={t('wiki.god.domainsPlaceholder')} />
        <TextInput id="w-gsym" label={t('wiki.god.symbol')} value={d.symbol} onChange={(v) => f('symbol', v)} max={200} />
      </div>
    </Group>
  );
}

function LanguageFields({ d, set }: { d: WikiLanguageData; set: (d: WikiLanguageData) => void }) {
  const { t } = useTranslation();
  const f = <K extends keyof WikiLanguageData>(k: K, v: WikiLanguageData[K]) => set({ ...d, [k]: v });
  return (
    <Group title={t('wiki.language.title')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="w-ltype" className="label">
            {t('wiki.language.type')}
          </label>
          <select id="w-ltype" className="input" value={d.type ?? ''} onChange={(e) => f('type', (e.target.value || null) as WikiLanguageData['type'])}>
            <option value="">—</option>
            {LANGUAGE_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(`wiki.language.types.${x}`)}
              </option>
            ))}
          </select>
        </div>
        <TextInput id="w-lspeakers" label={t('wiki.language.speakers')} value={d.speakers} onChange={(v) => f('speakers', v)} placeholder={t('wiki.language.speakersPlaceholder')} />
        <TextInput id="w-lscript" label={t('wiki.language.script')} value={d.script} onChange={(v) => f('script', v)} max={100} placeholder={t('wiki.language.scriptPlaceholder')} />
      </div>
    </Group>
  );
}

function RuleFields({ d, set }: { d: WikiRuleData; set: (d: WikiRuleData) => void }) {
  const { t } = useTranslation();
  return (
    <Group title={t('wiki.rule.title')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="w-rcat" className="label">
            {t('wiki.rule.category')}
          </label>
          <select id="w-rcat" className="input" value={d.category ?? ''} onChange={(e) => set({ ...d, category: (e.target.value || null) as WikiRuleData['category'] })}>
            <option value="">—</option>
            {RULE_CATEGORIES.map((x) => (
              <option key={x} value={x}>
                {t(`wiki.rule.categories.${x}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="w-rcond" className="label">
            {t('wiki.rule.condition')}
          </label>
          <select id="w-rcond" className="input" value={d.condition ?? ''} onChange={(e) => set({ ...d, condition: (e.target.value || null) as WikiRuleData['condition'] })}>
            <option value="">{t('wiki.rule.noCondition')}</option>
            {CONDITIONS.map((x) => (
              <option key={x} value={x}>
                {t(`combat.conditions.${x}`)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">{t('wiki.rule.conditionHint')}</p>
        </div>
      </div>
    </Group>
  );
}

/** Wiki-Eintrag anlegen oder bearbeiten (Admin/Moderator) */
export function WikiForm({
  open,
  kind,
  entry,
  featNames = [],
  pantheons = [],
  onClose,
  onSave,
}: {
  open: boolean;
  kind: WikiKind;
  entry: WikiEntryDto | null;
  /** Talente aus dem Wiki (Vorschläge beim Hintergrund) */
  featNames?: string[];
  /** Vorhandene Pantheons (Vorschläge bei Göttern) */
  pantheons?: string[];
  onClose: () => void;
  onSave: (input: WikiEntryInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const k = entry?.kind ?? kind;
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [race, setRace] = useState<WikiRaceData>(() => raceDataSchema.parse({}));
  const [cls, setCls] = useState<WikiClassData>(() => classDataSchema.parse({}));
  const [feat, setFeat] = useState<WikiFeatData>(() => featDataSchema.parse({}));
  const [bg, setBg] = useState<WikiBackgroundData>(() => backgroundDataSchema.parse({}));
  const [lang, setLang] = useState<WikiLanguageData>(() => languageDataSchema.parse({}));
  const [god, setGod] = useState<WikiGodData>(() => godDataSchema.parse({}));
  const [rule, setRule] = useState<WikiRuleData>(() => ruleDataSchema.parse({}));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(entry?.name ?? '');
    setSummary(entry?.summary ?? '');
    setDescription(entry?.description ?? '');
    setSourceId(entry?.sourceId ?? null);
    setRace(entry?.kind === 'race' ? entry.data : raceDataSchema.parse({}));
    setCls(entry?.kind === 'class' ? entry.data : classDataSchema.parse({}));
    setFeat(entry?.kind === 'feat' ? entry.data : featDataSchema.parse({}));
    setBg(entry?.kind === 'background' ? entry.data : backgroundDataSchema.parse({}));
    setLang(entry?.kind === 'language' ? entry.data : languageDataSchema.parse({}));
    setGod(entry?.kind === 'god' ? entry.data : godDataSchema.parse({}));
    setRule(entry?.kind === 'rule' ? entry.data : ruleDataSchema.parse({}));
  }, [open, entry]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const base = { name: name.trim(), summary: summary.trim(), description, sourceId };
      await onSave(
        k === 'race'
          ? { kind: 'race', ...base, data: race }
          : k === 'class'
            ? { kind: 'class', ...base, data: cls }
            : k === 'feat'
              ? { kind: 'feat', ...base, data: feat }
              : k === 'language'
                ? { kind: 'language', ...base, data: lang }
                : k === 'god'
                  ? { kind: 'god', ...base, data: god }
                  : k === 'rule'
                    ? { kind: 'rule', ...base, data: rule }
                    : {
                        kind: 'background',
                        ...base,
                        data: { ...bg, personalityTraits: bg.personalityTraits.filter(Boolean), ideals: bg.ideals.filter(Boolean), bonds: bg.bonds.filter(Boolean), flaws: bg.flaws.filter(Boolean) },
                      },
      );
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={entry ? t('wiki.edit', { name: entry.name }) : t(`wiki.new.${k}`)} onClose={onClose} size="max-w-4xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="w-name" className="label">
              {t('wiki.name')}
            </label>
            <input id="w-name" className="input" value={name} maxLength={120} required autoFocus onChange={(e) => setName(e.target.value)} />
          </div>
          <TextInput id="w-summary" label={t('wiki.summary')} value={summary} onChange={setSummary} max={500} placeholder={t('wiki.summaryPlaceholder')} />
          <SourceSelect id="w-source" value={sourceId} onChange={setSourceId} />
        </div>
        <div>
          <label htmlFor="w-desc" className="label">
            {t('wiki.description')}
          </label>
          <MarkdownEditor id="w-desc" value={description} onChange={(v) => setDescription(v.slice(0, 10000))} rows={4} />
        </div>
        {k === 'race' ? (
          <RaceFields d={race} set={setRace} />
        ) : k === 'class' ? (
          <ClassFields d={cls} set={setCls} />
        ) : k === 'feat' ? (
          <FeatFields d={feat} set={setFeat} />
        ) : k === 'language' ? (
          <LanguageFields d={lang} set={setLang} />
        ) : k === 'god' ? (
          <GodFields d={god} set={setGod} pantheons={pantheons} />
        ) : k === 'rule' ? (
          <RuleFields d={rule} set={setRule} />
        ) : (
          <BackgroundFields d={bg} set={setBg} featNames={featNames} />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
