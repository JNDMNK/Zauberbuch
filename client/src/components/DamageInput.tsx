import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DAMAGE_TYPES, damageDiceSchema, type DamageType } from '@zauberbuch/shared';
import { DamageValue } from './DamageValue';

export interface DamageState {
  dice: string;
  type: DamageType | '';
}

/** Prüft die Eingabe wie beim Zauber-Formular; liefert Fehlercode oder den normalisierten Schaden */
export function checkDamage(d: DamageState): { error: string | null; value: { dice: string; type: DamageType } | null } {
  const parsed = damageDiceSchema.safeParse(d.dice);
  if (!parsed.success) return { error: 'damage_dice_invalid', value: null };
  const dice = parsed.data;
  if (dice && !d.type) return { error: 'damage_type_required', value: null };
  if (!dice && d.type) return { error: 'damage_dice_required', value: null };
  return { error: null, value: dice && d.type ? { dice, type: d.type } : null };
}

/** Würfel + Schadensart mit Live-Vorschau – gleiches Design wie bei den Zaubern */
export function DamageInput({ value, onChange, compact = false }: { value: DamageState; onChange: (v: DamageState) => void; compact?: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  const { error, value: preview } = checkDamage(value);
  // Fehler erst zeigen, wenn etwas eingegeben wurde
  const showError: string | null = error && (value.dice.trim() !== '' || value.type !== '') ? error : null;
  const types = [...DAMAGE_TYPES].sort((a, b) => (a === 'healing' ? 1 : b === 'healing' ? -1 : t(`damageType.${a}`).localeCompare(t(`damageType.${b}`))));
  return (
    <div>
      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <div>
          <label htmlFor={`${id}-dice`} className={compact ? 'text-xs' : 'label'}>
            {t('bestiary.damageDice')}
          </label>
          <input
            id={`${id}-dice`}
            className={`input font-mono ${compact ? '!py-1 text-sm' : ''} ${showError === 'damage_dice_invalid' || showError === 'damage_dice_required' ? 'input-error' : ''}`}
            value={value.dice}
            maxLength={60}
            autoComplete="off"
            placeholder="1d6+2"
            onChange={(e) => onChange({ ...value, dice: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor={`${id}-type`} className={compact ? 'text-xs' : 'label'}>
            {t('admin.damageType')}
          </label>
          <select
            id={`${id}-type`}
            className={`input ${compact ? '!py-1 text-sm' : ''} ${showError === 'damage_type_required' ? 'input-error' : ''}`}
            value={value.type}
            onChange={(e) => onChange({ ...value, type: e.target.value as DamageType | '' })}
          >
            <option value="">{t('admin.noDamage')}</option>
            {types.map((d) => (
              <option key={d} value={d}>
                {t(`damageType.${d}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!compact && (
        <div className="mt-2 flex items-center gap-2 whitespace-nowrap text-sm" aria-live="polite">
          <span className="text-xs text-parchment-700 dark:text-parchment-400">{t('admin.damagePreview')}:</span>
          {preview ? <DamageValue damage={preview} /> : <span className="text-parchment-600">–</span>}
        </div>
      )}
      {showError ? (
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">{t(`errors.${error}`)}</p>
      ) : (
        !compact && <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">{t('bestiary.damageHint')}</p>
      )}
    </div>
  );
}
