import { useEffect, useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

/** Einfacher Dialog mit fester Kopfzeile (Schließen-Knopf bleibt auch auf dem iPhone sichtbar) */
export function Modal({ open, title, onClose, children, size = 'max-w-2xl' }: { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; size?: string }) {
  const { t } = useTranslation();
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={`parchment relative my-auto w-full ${size}`}>
        <div className="sticky top-0 z-10 flex items-center gap-2 rounded-t-xl border-b border-parchment-400/60 bg-parchment-50/95 px-5 py-3 dark:border-night-700 dark:bg-night-800/95">
          <h2 id={titleId} className="flex-1 font-display text-xl font-bold">
            {title}
          </h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
