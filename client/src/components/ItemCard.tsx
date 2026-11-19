import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Gem, Sparkles, UserRound, Weight } from 'lucide-react';
import type { MagicItemDto } from '@zauberbuch/shared';

/** Karte eines magischen Gegenstands (auch im Charakterbogen genutzt) */
export function ItemCard({ item, actions, footer, attuned = false }: { item: MagicItemDto; actions?: ReactNode; footer?: ReactNode; attuned?: boolean }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const long = item.description.length > 260 || item.description.split('\n').length > 5;
  return (
    <article className="parchment flex h-full flex-col gap-2 border-t-4 !border-t-violet-500 p-4 dark:!border-t-violet-400">
      <div className="flex items-start gap-2">
        <Gem className="mt-1 h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300" aria-hidden />
        <h3 className="min-w-0 flex-1 break-words font-display text-lg font-bold">
          {item.name}
          {attuned && (
            <span className="badge ml-2 bg-violet-100 align-middle text-violet-900 dark:bg-violet-950 dark:text-violet-200">
              <Sparkles className="mr-1 h-3 w-3" />
              {t('items.attuned')}
            </span>
          )}
        </h3>
        {actions && <div className="flex shrink-0 gap-1">{actions}</div>}
      </div>
      {item.description && (
        <div className="text-sm">
          <p className={`whitespace-pre-wrap break-words ${long && !open ? 'line-clamp-5' : ''}`}>{item.description}</p>
          {long && (
            <button type="button" className="mt-0.5 text-xs font-semibold underline print:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? t('board.showLess') : t('board.showMore')}
            </button>
          )}
        </div>
      )}
      {item.weight > 0 && (
        <p className="flex items-center gap-1.5 text-sm">
          <Weight className="h-4 w-4 text-parchment-700 dark:text-parchment-400" aria-hidden />
          <span className="sheet-label !inline">{t('items.weight')}:</span>
          <span className="tabular-nums">{item.weight.toLocaleString(i18n.language)} lb</span>
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-sm">
        <span className="sheet-label !inline">{t('items.holders')}:</span>
        {item.holders.length === 0 ? (
          <span className="italic text-parchment-700 dark:text-parchment-400">{t('items.withDm')}</span>
        ) : (
          item.holders.map((h) => (
            <span key={h.id} className="badge bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              <UserRound className="mr-1 h-3 w-3" />
              {h.name} · {h.owner}
            </span>
          ))
        )}
      </div>
      {footer}
    </article>
  );
}

