import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { CASTING_TIMES, CLASSES, LEVELS, SCHOOLS } from '@zauberbuch/shared';
import { countActiveFilters, toggleInList, type SpellFilters, type Tri } from '../lib/filters';
import { SCHOOL_COLORS } from '../lib/schools';

interface Props {
  filters: SpellFilters;
  onChange: (next: SpellFilters) => void;
  sources: string[];
  showFavoritesToggle: boolean;
  favoritesPage: boolean;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="label mb-2">{title}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: ReactNode; color?: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={active ? 'chip-on' : 'chip-off'}>
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
      {children}
    </button>
  );
}

/** Drei-Zustands-Chip: egal → erforderlich → ausgeschlossen → egal */
function TriChip({ value, onChange, children }: { value: Tri; onChange: (v: Tri) => void; children: ReactNode }) {
  const { t } = useTranslation();
  const next: Tri = value === undefined ? true : value === true ? false : undefined;
  const state = value === true ? t('filter.required') : value === false ? t('filter.excluded') : t('common.any');
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      className={value === true ? 'chip-on' : value === false ? 'chip-no' : 'chip-off'}
      title={t('filter.triHint')}
      aria-label={`${typeof children === 'string' ? children : ''}: ${state}`}
    >
      {value === true ? '✓ ' : value === false ? '✗ ' : ''}
      {children}
    </button>
  );
}

export function FilterPanel({ filters, onChange, sources, showFavoritesToggle, favoritesPage }: Props) {
  const { t } = useTranslation();
  const set = <K extends keyof SpellFilters>(key: K, value: SpellFilters[K]) => onChange({ ...filters, [key]: value });
  const active = countActiveFilters(filters, { ignoreFavorites: favoritesPage });

  const reset = () =>
    onChange({
      ...filters,
      level: [],
      school: [],
      class: [],
      castingTime: [],
      concentration: undefined,
      ritual: undefined,
      verbal: undefined,
      somatic: undefined,
      material: undefined,
      homebrew: undefined,
      source: '',
      favorites: false,
    });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">{t('filter.title')}</h2>
        {active > 0 && (
          <button type="button" onClick={reset} className="btn-ghost !px-2 !py-1 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            {t('filter.reset')}
          </button>
        )}
      </div>

      {showFavoritesToggle && !favoritesPage && (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={filters.favorites}
            onChange={(e) => set('favorites', e.target.checked)}
            className="h-4 w-4 accent-red-600"
          />
          <span>{t('filter.favoritesOnly')}</span>
        </label>
      )}

      <Section title={t('filter.level')}>
        {LEVELS.map((lvl) => (
          <Chip key={lvl} active={filters.level.includes(lvl)} onClick={() => set('level', toggleInList(filters.level, lvl))}>
            {lvl === 0 ? t('spell.cantrip') : lvl}
          </Chip>
        ))}
      </Section>

      <Section title={t('filter.school')}>
        {[...SCHOOLS]
          .sort((a, b) => t(`school.${a}`).localeCompare(t(`school.${b}`)))
          .map((s) => (
            <Chip key={s} active={filters.school.includes(s)} onClick={() => set('school', toggleInList(filters.school, s))} color={SCHOOL_COLORS[s]}>
              {t(`school.${s}`)}
            </Chip>
          ))}
      </Section>

      <Section title={t('filter.class')}>
        {[...CLASSES]
          .sort((a, b) => t(`class.${a}`).localeCompare(t(`class.${b}`)))
          .map((c) => (
            <Chip key={c} active={filters.class.includes(c)} onClick={() => set('class', toggleInList(filters.class, c))}>
              {t(`class.${c}`)}
            </Chip>
          ))}
      </Section>

      <Section title={t('filter.castingTime')}>
        {CASTING_TIMES.map((ct) => (
          <Chip key={ct} active={filters.castingTime.includes(ct)} onClick={() => set('castingTime', toggleInList(filters.castingTime, ct))}>
            {t(`castingTime.${ct}`)}
          </Chip>
        ))}
      </Section>

      <Section title={t('filter.components')}>
        <TriChip value={filters.verbal} onChange={(v) => set('verbal', v)}>
          {t('component.verbal')}
        </TriChip>
        <TriChip value={filters.somatic} onChange={(v) => set('somatic', v)}>
          {t('component.somatic')}
        </TriChip>
        <TriChip value={filters.material} onChange={(v) => set('material', v)}>
          {t('component.material')}
        </TriChip>
      </Section>

      <Section title={t('filter.properties')}>
        <TriChip value={filters.concentration} onChange={(v) => set('concentration', v)}>
          {t('spell.concentration')}
        </TriChip>
        <TriChip value={filters.ritual} onChange={(v) => set('ritual', v)}>
          {t('spell.ritual')}
        </TriChip>
      </Section>

      <fieldset className="space-y-2">
        <legend className="label mb-2">{t('filter.source')}</legend>
        <select
          className="input"
          value={filters.homebrew === undefined ? '' : String(filters.homebrew)}
          onChange={(e) => set('homebrew', e.target.value === '' ? undefined : e.target.value === 'true')}
          aria-label={t('spell.homebrew')}
        >
          <option value="">{t('common.any')}</option>
          <option value="true">{t('filter.homebrewOnly')}</option>
          <option value="false">{t('filter.officialOnly')}</option>
        </select>
        {sources.length > 1 && (
          <select className="input" value={filters.source} onChange={(e) => set('source', e.target.value)} aria-label={t('filter.source')}>
            <option value="">
              {t('filter.source')}: {t('common.any')}
            </option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </fieldset>
    </div>
  );
}
