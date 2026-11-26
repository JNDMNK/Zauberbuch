import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { itemsWeight, type SheetItem } from '@zauberbuch/shared';
import { useSheet } from './SheetContext';
import { NF } from './fields';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { catalogInventoryText, localized, type CatalogItemDto, type DamageType } from '@zauberbuch/shared';
import { Modal } from '../Modal';
import { CatalogCard } from '../catalog/CatalogCard';
import { formatDice } from '../../lib/damage';
import { asLocale } from '../../lib/spellText';

/** Gegenstandsliste (Name, Anzahl, Gewicht) mit Teilgewicht */
export function InventoryTable({ listKey }: { listKey: 'inventory' | 'extraEquipment' }) {
  const { t, i18n } = useTranslation();
  const { sheet, set, readOnly, catalog } = useSheet();
  const formatDamage = useFormatDamage();
  const items: SheetItem[] = sheet[listKey];
  const listId = `catalog-${listKey}`;
  const [openRef, setOpenRef] = useState<string | null>(null);
  const openItem = catalog.find((c) => c.id === openRef) ?? null;
  return (
    <div>
      {/* Vorschläge aus der Gegenstands-Datenbank (Name wie bei den Zaubern) */}
      <datalist id={listId}>
        {catalog.map((c) => (
          <option key={c.id} value={localized(c.name, c.nameEn, i18n.language)} label={`${c.category === 'tool' && c.toolType ? t(`catalog.toolTypes.${c.toolType}`) : t(`catalog.categoriesOne.${c.category}`)}${c.damage ? ` · ${formatDamage(c.damage)}` : ''}${c.ac ? ` · ${t('combat.acShort')} ${c.ac}` : ''}${c.strength ? ` · ${t('catalog.strengthShort')} ${c.strength}` : ''} · ${c.weight} lb${c.value ? ` · ${c.value}` : ''}`} />
        ))}
      </datalist>
      <Modal open={!!openItem} title={openItem ? t(`catalog.categoriesOne.${openItem.category}`) : ''} onClose={() => setOpenRef(null)} size="max-w-md">
        {openItem && <CatalogCard item={openItem} />}
      </Modal>
      <table className="sheet-table">
        <thead>
          <tr>
            <th>{t('sheet.item')}</th>
            <th className="w-12 sm:w-20">{t('sheet.qty')}</th>
            <th className="w-14 sm:w-24">{t('sheet.itemWeight')}</th>
            {!readOnly && <th className="w-8 print:hidden" />}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td>
                <ItemNameField listKey={listKey} index={i} item={it} listId={listId} onOpen={setOpenRef} />
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
        <button type="button" className="btn-ghost mt-1 !px-2 !py-1 text-xs print:hidden" onClick={() => set([listKey], [...items, { name: '', qty: 1, weight: 0, ref: null }])}>
          <Plus className="h-4 w-4" />
          {t('sheet.addItem')}
        </button>
      )}
    </div>
  );
}

/** Schaden/Heilung als Text, z. B. „1W8 Hieb“ bzw. „2W4 + 2 Heilung“ */
export function useFormatDamage() {
  const { t, i18n } = useTranslation();
  return (d: { dice: string; type: DamageType }) => `${formatDice(d.dice, asLocale(i18n.language), t)} ${t(`damageType.${d.type}`)}`;
}

/**
 * Name im Inventar mit Vorschlägen aus der Gegenstands-Datenbank. Wird ein Eintrag gewählt, werden Name, Schaden/RK
 * und Beschreibung als Text übernommen, das Gewicht ins Gewichtsfeld geschrieben und die Karte verknüpft.
 */
function ItemNameField({ listKey, index, item, listId, onOpen }: { listKey: 'inventory' | 'extraEquipment'; index: number; item: SheetItem; listId: string; onOpen: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  /** Katalogeintrag zu einem Namen (deutsch oder englisch) */
  const byName = (name: string) => {
    const n = name.trim().toLocaleLowerCase('de');
    return catalog.find((c) => c.name.toLocaleLowerCase('de') === n || (c.nameEn && c.nameEn.toLocaleLowerCase('de') === n));
  };
  const { sheet, set, readOnly, catalog } = useSheet();
  const formatDamage = useFormatDamage();
  const linked = item.ref ? catalog.find((c) => c.id === item.ref) : null;
  // Name entspricht genau einem Eintrag, ist aber noch nicht verknüpft -> „Übernehmen“ anbieten
  const exact = !linked && item.name.trim() ? byName(item.name) : undefined;

  const update = (patch: Partial<SheetItem>) => set([listKey], sheet[listKey].map((x, i) => (i === index ? { ...x, ...patch } : x)));
  const apply = (c: CatalogItemDto) =>
    update({
      name: catalogInventoryText({ ...c, name: localized(c.name, c.nameEn, i18n.language), description: localized(c.description, c.descriptionEn, i18n.language) }, formatDamage, { ac: t('combat.acShort'), strength: t('catalog.strengthShort') }),
      weight: c.weight,
      ref: c.id,
    });

  return (
    <div className="flex items-center gap-1">
      <input
        className="sheet-input"
        value={item.name}
        list={readOnly ? undefined : listId}
        maxLength={150}
        disabled={readOnly}
        aria-label={t('sheet.item')}
        title={item.name || (readOnly ? undefined : t('catalog.suggestions'))}
        onChange={(e) => {
          const value = e.target.value;
          // Exakter Treffer aus der Vorschlagsliste -> übernehmen
          const match = byName(value);
          if (match && value.length > item.name.length + 1) apply(match);
          else update({ name: value, ref: value.trim() ? item.ref : null });
        }}
      />
      {exact && !readOnly && (
        <button type="button" className="btn-secondary shrink-0 !px-2 !py-0.5 text-xs print:hidden" onClick={() => apply(exact)} title={t('catalog.suggestions')}>
          {t('catalog.take')}
        </button>
      )}
      {linked && (
        <button type="button" className="btn-icon h-7 w-7 shrink-0 print:hidden" onClick={() => onOpen(linked.id)} title={t('catalog.openCard')} aria-label={`${t('catalog.openCard')}: ${linked.name}`}>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
