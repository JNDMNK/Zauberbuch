import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { itemsWeight, type SheetItem } from '@zauberbuch/shared';
import { useSheet } from './SheetContext';
import { NF, TF } from './fields';

/** Gegenstandsliste (Name, Anzahl, Gewicht) mit Teilgewicht */
export function InventoryTable({ listKey }: { listKey: 'inventory' | 'extraEquipment' }) {
  const { t, i18n } = useTranslation();
  const { sheet, set, readOnly } = useSheet();
  const items: SheetItem[] = sheet[listKey];
  return (
    <div>
      <table className="sheet-table">
        <thead>
          <tr>
            <th>{t('sheet.item')}</th>
            <th className="w-20">{t('sheet.qty')}</th>
            <th className="w-24">{t('sheet.itemWeight')}</th>
            {!readOnly && <th className="w-8 print:hidden" />}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td>
                <TF path={[listKey, i, 'name']} maxLength={150} />
              </td>
              <td>
                <NF path={[listKey, i, 'qty']} min={0} step={1} />
              </td>
              <td>
                <NF path={[listKey, i, 'weight']} min={0} step={0.01} />
              </td>
              {!readOnly && (
                <td className="print:hidden">
                  <button
                    type="button"
                    className="btn-icon h-8 w-8 text-red-700 dark:text-red-400"
                    onClick={() => set([listKey], items.filter((_, j) => j !== i))}
                    aria-label={`${t('sheet.remove')}: ${it.name}`}
                    title={t('sheet.remove')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="text-right text-xs text-parchment-700 dark:text-parchment-400">
              {t('sheet.subtotal')}
            </td>
            <td className="text-center font-semibold tabular-nums">{itemsWeight(items).toLocaleString(i18n.language)}</td>
            {!readOnly && <td className="print:hidden" />}
          </tr>
        </tfoot>
      </table>
      {!readOnly && (
        <button type="button" className="btn-ghost mt-1 !px-2 !py-1 text-xs print:hidden" onClick={() => set([listKey], [...items, { name: '', qty: 1, weight: 0 }])}>
          <Plus className="h-4 w-4" />
          {t('sheet.addItem')}
        </button>
      )}
    </div>
  );
}
