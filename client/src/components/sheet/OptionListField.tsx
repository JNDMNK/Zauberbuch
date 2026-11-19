import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { getIn, useSheet, type Path } from './SheetContext';

/**
 * Liste aus Auswahlfeldern (z. B. Sprachen): eine Auswahl je Eintrag, „+“ fügt eine weitere hinzu.
 * Gespeichert wird wie bisher ein Text mit einem Eintrag je Zeile; frühere freie Einträge, die nicht in der
 * Auswahlliste stehen, bleiben erhalten und wählbar.
 */
export function OptionListField({ path, label, options }: { path: Path; label: string; options: string[] }) {
  const { t } = useTranslation();
  const { sheet, set, readOnly } = useSheet();
  const id = useId();
  const values = String(getIn(sheet, path) ?? '')
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);
  // Neue, noch leere Zeilen (erst beim Auswählen gespeichert)
  const [pending, setPending] = useState(0);
  const save = (list: string[]) => set(path, list.join('\n'));

  const rows: (string | null)[] = [...values, ...Array.from({ length: pending }, () => null)];
  // Beim Leeren Bogen eine Zeile zum Auswählen anzeigen
  if (rows.length === 0 && !readOnly) rows.push(null);

  const change = (index: number, value: string) => {
    if (index < values.length) {
      // vorhandener Eintrag: ersetzen oder (bei „–“) entfernen
      save(value ? values.map((v, i) => (i === index ? value : v)) : values.filter((_, i) => i !== index));
    } else if (value) {
      save([...values, value]);
      setPending((p) => Math.max(0, p - 1));
    }
  };

  const remove = (index: number) => {
    if (index < values.length) save(values.filter((_, i) => i !== index));
    else setPending((p) => Math.max(0, p - 1));
  };

  return (
    <div className="flex h-full flex-col" role="group" aria-labelledby={`${id}-label`}>
      <ul className="flex-1 space-y-1.5">
        {rows.map((value, i) => {
          const chosen = new Set(values.filter((_, j) => j !== i).map((v) => v.toLocaleLowerCase('de')));
          const known = value === null || options.some((o) => o.toLocaleLowerCase('de') === value.toLocaleLowerCase('de'));
          return (
            <li key={i} className="flex items-center gap-1">
              <select
                className="sheet-input min-w-0 flex-1 !py-0.5 text-sm"
                value={value ?? ''}
                disabled={readOnly}
                onChange={(e) => change(i, e.target.value)}
                aria-label={`${label} ${i + 1}`}
              >
                <option value="">–</option>
                {options.map((o) => (
                  <option key={o} value={o} disabled={chosen.has(o.toLocaleLowerCase('de'))}>
                    {o}
                  </option>
                ))}
                {!known && value && <option value={value}>{value}</option>}
              </select>
              {!readOnly && (value !== null || rows.length > 1) && (
                <button type="button" className="btn-icon h-7 w-7 shrink-0 text-red-700 print:hidden dark:text-red-400" onClick={() => remove(i)} title={t('sheet.remove')} aria-label={`${t('sheet.remove')}: ${value ?? label}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {!readOnly && (
        <button type="button" className="btn-ghost mt-1 self-start !px-2 !py-0.5 text-xs print:hidden" onClick={() => setPending((p) => p + 1)} aria-label={`${t('sheet.addEntry')}: ${label}`}>
          <Plus className="h-3.5 w-3.5" />
          {t('sheet.addEntry')}
        </button>
      )}
      <span id={`${id}-label`} className="sheet-label mt-1 text-center">
        {label}
      </span>
    </div>
  );
}
