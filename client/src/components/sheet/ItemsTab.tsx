import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, Undo2 } from 'lucide-react';
import type { MagicItemDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../ConfirmDialog';
import { ItemCard } from '../ItemCard';
import { PageSpinner } from '../ui';
import { useSheet } from './SheetContext';

/** Reiter „Magische Gegenstände“: Gegenstände des Bogens als Karten, mit Weitergeben und Zurückgeben */
export function ItemsTab({ characterId }: { characterId: string }) {
  const { t } = useTranslation();
  const { sheet, items } = useSheet();
  const attuned = new Set(sheet.attunedItems.filter(Boolean).map((n) => n.toLocaleLowerCase('de')));

  if (!items.data) return <PageSpinner />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-parchment-700 dark:text-parchment-400 print:hidden">{items.data.canTransfer ? t('items.sheetHint') : t('items.sheetHintReadOnly')}</p>
      {items.data.items.length === 0 ? (
        <div className="parchment px-6 py-12 text-center italic">{t('items.sheetEmpty')}</div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.data.items.map((i) => (
            <li key={i.id}>
              <ItemCard item={i} attuned={attuned.has(i.name.toLocaleLowerCase('de'))} footer={items.data!.canTransfer ? <TransferControls item={i} characterId={characterId} /> : undefined} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TransferControls({ item, characterId }: { item: MagicItemDto; characterId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { items } = useSheet();
  const [target, setTarget] = useState('');
  const [confirm, setConfirm] = useState<'give' | 'return' | null>(null);
  const [busy, setBusy] = useState(false);
  const targets = (items.data?.targets ?? []).filter((c) => !item.holders.some((h) => h.id === c.id));
  const targetRef = targets.find((c) => c.id === target);

  const run = async () => {
    setBusy(true);
    try {
      await api.transferItem(item.id, characterId, confirm === 'give' ? target : null);
      toast.success(confirm === 'give' ? t('items.given', { name: targetRef?.name ?? '' }) : t('items.returned'));
      setConfirm(null);
      setTarget('');
      items.reload();
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 border-t border-parchment-300/70 pt-2 print:hidden dark:border-night-700">
      <div className="flex gap-2">
        <select className="input min-w-0 flex-1 !py-1 text-sm" value={target} onChange={(e) => setTarget(e.target.value)} aria-label={t('items.giveTo')}>
          <option value="">{targets.length ? t('items.giveTo') : t('items.noTargets')}</option>
          {targets.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.owner})
            </option>
          ))}
        </select>
        <button type="button" className="btn-secondary !px-2 !py-1 text-sm" disabled={!target} onClick={() => setConfirm('give')}>
          <Gift className="h-4 w-4" />
          {t('items.give')}
        </button>
      </div>
      <button type="button" className="btn-ghost !px-2 !py-1 text-sm" onClick={() => setConfirm('return')}>
        <Undo2 className="h-4 w-4" />
        {t('items.returnToDm')}
      </button>
      <ConfirmDialog
        open={confirm !== null}
        danger={false}
        title={confirm === 'give' ? t('items.giveTitle') : t('items.returnTitle')}
        message={confirm === 'give' ? t('items.giveText', { item: item.name, name: targetRef?.name ?? '', owner: targetRef?.owner ?? '' }) : t('items.returnText', { item: item.name })}
        confirmLabel={confirm === 'give' ? t('items.give') : t('items.returnToDm')}
        busy={busy}
        onConfirm={run}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
