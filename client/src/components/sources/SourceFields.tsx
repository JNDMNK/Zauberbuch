import { useTranslation } from 'react-i18next';
import { BookMarked } from 'lucide-react';
import { useSources } from '../../hooks/useSources';

/** Auswahl der Quelle (Buch) aus der app-weiten Quellen-Liste */
export function SourceSelect({ id, value, onChange }: { id: string; value: string | null; onChange: (v: string | null) => void }) {
  const { t } = useTranslation();
  const { sources, label, abbr } = useSources();
  return (
    <div>
      <label htmlFor={id} className="label">
        {t('sources.source')}
      </label>
      <select id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t('sources.none')}</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {label(s)}
            {abbr(s) ? ` (${abbr(s)})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Filter nach Quelle (leer = alle) */
export function SourceFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const { sources, label } = useSources();
  if (sources.length === 0) return null;
  return (
    <select className="input !w-auto" value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('sources.filter')}>
      <option value="">
        {t('sources.source')}: {t('common.any')}
      </option>
      {sources.map((s) => (
        <option key={s.id} value={s.id}>
          {label(s)}
        </option>
      ))}
      <option value="none">{t('sources.withoutSource')}</option>
    </select>
  );
}

/** Kleines Quellen-Abzeichen (Kürzel, voller Name als Tooltip) */
export function SourceBadge({ sourceId, full = false, className = '' }: { sourceId: string | null; full?: boolean; className?: string }) {
  const { t } = useTranslation();
  const { byId, label, abbr } = useSources();
  const s = byId(sourceId);
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs italic text-parchment-700 dark:text-parchment-400 ${className}`} title={`${t('sources.source')}: ${label(s)}`}>
      <BookMarked className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{t('sources.source')}:</span>
      {full || !abbr(s) ? label(s) : abbr(s)}
    </span>
  );
}

/** Passt ein Eintrag zum Quellenfilter? */
export const matchesSource = (filter: string, sourceId: string | null) => !filter || (filter === 'none' ? !sourceId : sourceId === filter);

/** Quelle, die als Name gespeichert ist (Zauber, Monster): verknüpft, wenn sie in der Quellen-Liste steht */
export function SourceNameBadge({ name, full = false, className = '' }: { name: string; full?: boolean; className?: string }) {
  const { t } = useTranslation();
  const { sources, label, abbr } = useSources();
  if (!name) return null;
  const s = sources.find((x) => x.name.toLocaleLowerCase('de') === name.trim().toLocaleLowerCase('de'));
  return (
    <span className={`inline-flex items-center gap-1 text-xs italic text-parchment-700 dark:text-parchment-400 ${className}`} title={`${t('sources.source')}: ${s ? label(s) : name}`}>
      <BookMarked className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{t('sources.source')}:</span>
      {s && !full && abbr(s) ? abbr(s) : s ? label(s) : name}
    </span>
  );
}

/**
 * Auswahl einer Quelle, die als Name gespeichert wird (Zauber, Monster). Werte außerhalb der Liste (z. B. „Homebrew“
 * oder ältere Einträge) bleiben wählbar.
 */
export function SourceNameSelect({ id, value, onChange, extra = [], allowEmpty = true, invalid = false }: { id: string; value: string; onChange: (v: string) => void; extra?: string[]; allowEmpty?: boolean; invalid?: boolean }) {
  const { t } = useTranslation();
  const { sources, label, abbr } = useSources();
  const names = sources.map((s) => s.name);
  const all = [...names, ...extra.filter((e) => !names.includes(e))];
  const known = !value || all.some((n) => n.toLocaleLowerCase('de') === value.toLocaleLowerCase('de'));
  return (
    <select id={id} className={`input ${invalid ? 'input-error' : ''}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">{t('sources.none')}</option>}
      {sources.map((s) => (
        <option key={s.id} value={s.name}>
          {label(s)}
          {abbr(s) ? ` (${abbr(s)})` : ''}
        </option>
      ))}
      {extra
        .filter((e) => !names.includes(e))
        .map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      {!known && <option value={value}>{t('sources.notInList', { name: value })}</option>}
    </select>
  );
}
