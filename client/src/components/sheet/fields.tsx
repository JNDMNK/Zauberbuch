import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, CircleDot, Disc } from 'lucide-react';
import { getIn, useSheet, type Path } from './SheetContext';

/** Kasten im Stil des Papierbogens: Inhalt oben, Beschriftung klein unten */
export function Box({ label, children, className = '', labelTop = false }: { label?: ReactNode; children: ReactNode; className?: string; labelTop?: boolean }) {
  return (
    <section className={`sheet-box flex flex-col ${className}`}>
      {label && labelTop && <h3 className="sheet-label mb-1">{label}</h3>}
      {children}
      {label && !labelTop && <h3 className="sheet-label mt-auto pt-1 text-center">{label}</h3>}
    </section>
  );
}

interface FieldProps {
  path: Path;
  label?: ReactNode;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  align?: 'left' | 'center';
}

/** Textfeld mit Beschriftung darunter (wie im Bogen) */
export function TF({ path, label, className = '', inputClassName = '', placeholder, align = 'left', maxLength = 200 }: FieldProps & { maxLength?: number }) {
  const { sheet, set } = useSheet();
  const id = useId();
  return (
    <div className={className}>
      <input
        id={id}
        className={`sheet-input ${align === 'center' ? 'text-center' : ''} ${inputClassName}`}
        value={String(getIn(sheet, path) ?? '')}
        onChange={(e) => set(path, e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {label && (
        <label htmlFor={id} className="sheet-label">
          {label}
        </label>
      )}
    </div>
  );
}

/** Zahlenfeld; leere Eingabe wird als 0 gespeichert */
export function NF({ path, label, className = '', inputClassName = '', min, max, step = 1, align = 'center' }: FieldProps & { min?: number; max?: number; step?: number }) {
  const { sheet, set } = useSheet();
  const id = useId();
  const value = getIn(sheet, path) as number | null | undefined;
  return (
    <div className={className}>
      <input
        id={id}
        type="number"
        inputMode={step === 1 ? 'numeric' : 'decimal'}
        className={`sheet-input ${align === 'center' ? 'text-center' : ''} ${inputClassName}`}
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const raw = e.target.value;
          let n = raw === '' ? 0 : Number(raw);
          if (Number.isNaN(n)) return;
          if (min !== undefined) n = Math.max(min, n);
          if (max !== undefined) n = Math.min(max, n);
          set(path, n);
        }}
      />
      {label && (
        <label htmlFor={id} className="sheet-label">
          {label}
        </label>
      )}
    </div>
  );
}

/** Mehrzeiliges Feld, wächst nicht automatisch – Höhe über rows */
export function TA({ path, label, rows = 5, className = '', placeholder }: FieldProps & { rows?: number }) {
  const { sheet, set } = useSheet();
  const id = useId();
  return (
    <div className={`flex h-full flex-col ${className}`}>
      <textarea
        id={id}
        rows={rows}
        className="sheet-textarea flex-1 print:hidden"
        value={String(getIn(sheet, path) ?? '')}
        onChange={(e) => set(path, e.target.value)}
        placeholder={placeholder}
        maxLength={20000}
      />
      {/* Druck: Textarea würde abschneiden, daher Text vollständig als Block */}
      <div className="sheet-textarea hidden flex-1 whitespace-pre-wrap break-words print:block" aria-hidden="true" style={{ minHeight: `${rows * 1.5}em` }}>
        {String(getIn(sheet, path) ?? '')}
      </div>
      {label && (
        <label htmlFor={id} className="sheet-label mt-1 text-center">
          {label}
        </label>
      )}
    </div>
  );
}

export function CheckField({ path, label, className = '' }: { path: Path; label: ReactNode; className?: string }) {
  const { sheet, set } = useSheet();
  return (
    <label className={`inline-flex cursor-pointer items-center gap-1.5 text-sm ${className}`}>
      <input
        type="checkbox"
        checked={Boolean(getIn(sheet, path))}
        onChange={(e) => set(path, e.target.checked)}
        className="h-4 w-4 accent-parchment-800 dark:accent-parchment-300"
      />
      {label}
    </label>
  );
}

/** Übungs-Kreis: ○ nicht geübt, ● geübt, ◉ Expertise (bei allowExpertise) */
export function ProfToggle({ path, allowExpertise = true, label }: { path: Path; allowExpertise?: boolean; label: string }) {
  const { t } = useTranslation();
  const { sheet, set, readOnly } = useSheet();
  const raw = getIn(sheet, path);
  const level = typeof raw === 'boolean' ? (raw ? 1 : 0) : Number(raw ?? 0);
  const next = () => {
    if (typeof raw === 'boolean') set(path, !raw);
    else set(path, allowExpertise ? (level + 1) % 3 : level ? 0 : 1);
  };
  const Icon = level === 2 ? Disc : level === 1 ? CircleDot : Circle;
  return (
    <button
      type="button"
      onClick={next}
      disabled={readOnly}
      className={`shrink-0 rounded-full disabled:cursor-default ${level ? 'text-parchment-900 dark:text-parchment-100' : 'text-parchment-500 dark:text-parchment-700'}`}
      title={`${label}: ${t(`sheet.profLevel.${level}`)}${allowExpertise ? ` · ${t('sheet.profHint')}` : ''}`}
      aria-label={`${label}: ${t(`sheet.profLevel.${level}`)}`}
      aria-pressed={level > 0}
    >
      <Icon className="h-4 w-4" strokeWidth={level === 1 ? 3 : 2} fill={level === 2 ? 'currentColor' : 'none'} />
    </button>
  );
}

/** Berechneter Wert (nur Anzeige) */
export function Computed({ value, className = '' }: { value: ReactNode; className?: string }) {
  const { t } = useTranslation();
  return (
    <output className={`tabular-nums ${className}`} title={t('sheet.computed')}>
      {value}
    </output>
  );
}
