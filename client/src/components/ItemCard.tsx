import { useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Coins, Gem, Sparkles, UserRound, Weight } from 'lucide-react';
import type { MagicItemDto } from '@zauberbuch/shared';
import { Modal } from './Modal';

const ACCENT = { '--accent': '#7c3aed' } as CSSProperties;

/**
 * Karte eines magischen Gegenstands (Verwaltung und Charakterbogen) – wie die Zauberkarten: Name und Textvorschau,
 * ein Klick auf die Karte zeigt den Gegenstand vollständig im Vordergrund. `actions` (z. B. Bearbeiten/Löschen)
 * stehen auf der Karte und in der Detailansicht, `footer` (z. B. Weitergeben) nur in der Detailansicht.
 */
export function ItemCard({ item, actions, footer, attuned = false }: { item: MagicItemDto; actions?: ReactNode; footer?: ReactNode; attuned?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <article className="spell-card group relative" style={ACCENT}>
        <div className="flex items-start gap-2 px-4 pb-1 pt-4">
          <Gem className="accent-text mt-1 h-5 w-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 className="break-words font-display text-lg font-bold leading-tight">
              <button type="button" onClick={() => setOpen(true)} className="text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline" aria-haspopup="dialog">
                {item.name}
              </button>
            </h3>
            <ItemBadges item={item} attuned={attuned} className="mt-1" />
          </div>
          {actions && <div className="relative z-10 -mr-1 -mt-1 flex shrink-0 gap-1">{actions}</div>}
        </div>
        <div className="divider-ornament px-4 text-xs" aria-hidden>
          ✦
        </div>
        <p className="line-clamp-3 flex-1 whitespace-pre-line break-words px-4 text-sm">
          {item.description || <span className="italic text-parchment-700 dark:text-parchment-400">{t('items.noDescription')}</span>}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-parchment-300/70 px-4 py-3 text-sm dark:border-night-700">
          <ItemMeta item={item} />
          <Holders item={item} compact />
        </div>
      </article>
      {open &&
        createPortal(
          <Modal
            open
            onClose={() => setOpen(false)}
            size="max-w-2xl"
            title={
              <span className="flex items-center gap-2">
                <Gem className="h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300" aria-hidden />
                <span className="min-w-0 break-words">{item.name}</span>
              </span>
            }
          >
            <div className="space-y-4" style={ACCENT}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ItemBadges item={item} attuned={attuned} />
                {/* Aktionen schließen die Detailansicht, damit z. B. der Bearbeiten-Dialog im Vordergrund steht */}
                {actions && (
                  <div className="flex gap-1" onClick={() => setOpen(false)}>
                    {actions}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                <ItemMeta item={item} labels />
              </div>
              <div className="divider-ornament text-xs" aria-hidden>
                ✦
              </div>
              <p className="whitespace-pre-wrap break-words">{item.description || <span className="italic text-parchment-700 dark:text-parchment-400">{t('items.noDescription')}</span>}</p>
              <div className="flex flex-wrap items-center gap-1.5 border-t border-parchment-300/70 pt-3 text-sm dark:border-night-700">
                <span className="sheet-label !inline">{t('items.holders')}:</span>
                <Holders item={item} />
              </div>
              {footer}
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
}

function ItemBadges({ item, attuned, className = '' }: { item: MagicItemDto; attuned: boolean; className?: string }) {
  const { t } = useTranslation();
  if (!attuned && !item.attunement) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {attuned && (
        <span className="badge bg-violet-600 text-white dark:bg-violet-500">
          <Sparkles className="mr-1 h-3 w-3" />
          {t('items.attuned')}
        </span>
      )}
      {item.attunement && !attuned && (
        <span className="badge bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200">
          <Sparkles className="mr-1 h-3 w-3" />
          {t('items.requiresAttunement')}
        </span>
      )}
    </div>
  );
}

function ItemMeta({ item, labels = false }: { item: MagicItemDto; labels?: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      {item.value && (
        <span className="flex items-center gap-1.5" title={t('items.value')}>
          <Coins className="h-4 w-4 text-parchment-700 dark:text-parchment-400" aria-hidden />
          {labels ? <span className="sheet-label !inline">{t('items.value')}:</span> : <span className="sr-only">{t('items.value')}:</span>}
          <span className="tabular-nums">{item.value}</span>
        </span>
      )}
      {item.weight > 0 && (
        <span className="flex items-center gap-1.5" title={t('items.weight')}>
          <Weight className="h-4 w-4 text-parchment-700 dark:text-parchment-400" aria-hidden />
          {labels ? <span className="sheet-label !inline">{t('items.weight')}:</span> : <span className="sr-only">{t('items.weight')}:</span>}
          <span className="tabular-nums">{item.weight.toLocaleString(i18n.language)} lb</span>
        </span>
      )}
    </>
  );
}

function Holders({ item, compact = false }: { item: MagicItemDto; compact?: boolean }) {
  const { t } = useTranslation();
  if (item.holders.length === 0) return <span className="italic text-parchment-700 dark:text-parchment-400">{t('items.withDm')}</span>;
  return (
    <span className={`flex flex-wrap gap-1 ${compact ? 'ml-auto' : ''}`}>
      {item.holders.map((h) => (
        <span key={h.id} className="badge bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" title={`${t('items.holders')}: ${h.name} · ${h.owner}`}>
          <UserRound className="mr-1 h-3 w-3" />
          {compact ? h.name : `${h.name} · ${h.owner}`}
        </span>
      ))}
    </span>
  );
}
