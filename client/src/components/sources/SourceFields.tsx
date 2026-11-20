import { useTranslation } from 'react-i18next';
import { BookMarked } from 'lucide-react';
import { useSources } from '../../hooks/useSources';

/** Auswahl der Quelle (Buch) aus der app-weiten Quellen-Liste */
export function SourceSelect({ id, value, onChange }: { id: string; value: string | null; onChange: (v: string | null) => void }) {
  const { t } = useTranslation();
  const { sources } = useSources();
  return (
    <div>
      <label htmlFor={id} className="label">
        {t('sources.source')}
      </label>
      <select id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t('sources.none')}</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.abbreviation ? ` (${s.abbreviation})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Filter nach Quelle (leer = alle) */
export function SourceFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const { sources } = useSources();
  if (sources.length === 0) return null;
  return (
    <select className="input !w-auto" value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('sources.filter')}>
      <option value="">
        {t('sources.source')}: {t('common.any')}
      </option>
      {sources.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
      <option value="none">{t('sources.withoutSource')}</option>
    </select>
  );
}

/** Kleines Quellen-Abzeichen (Kürzel, voller Name als Tooltip) */
export function SourceBadge({ sourceId, full = false, className = '' }: { sourceId: string | null; full?: boolean; className?: string }) {
  const { t } = useTranslation();
  const { byId } = useSources();
  const s = byId(sourceId);
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs italic text-parchment-700 dark:text-parchment-400 ${className}`} title={`${t('sources.source')}: ${s.name}`}>
      <BookMarked className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{t('sources.source')}:</span>
      {full || !s.abbreviation ? s.name : s.abbreviation}
    </span>
  );
}

/** Passt ein Eintrag zum Quellenfilter? */
export const matchesSource = (filter: string, sourceId: string | null) => !filter || (filter === 'none' ? !sourceId : sourceId === filter);
