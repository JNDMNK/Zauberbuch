import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import type { WikiEntryDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { Modal } from '../Modal';
import { WikiDetail } from '../wiki/WikiDetail';
import { getIn, useSheet } from './SheetContext';
import { Box, TA, TF } from './fields';
import { ImageField } from './ImageField';
import { InventoryTable } from './InventoryTable';

/**
 * Glaube / Gottheit: Vorschläge aus den Göttern der Geschichte (bzw. allen aus dem Wiki), freier Text bleibt möglich.
 * Steht die Gottheit im Wiki, öffnet ein Knopf ihre Karte.
 */
function FaithField() {
  const { t } = useTranslation();
  const { sheet, set, readOnly, gods } = useSheet();
  const id = useId();
  const value = String(getIn(sheet, ['identity', 'faith']) ?? '');
  // Götter aus dem Wiki (für den Link zur Karte; eigene Götter einer Geschichte haben keine Karte)
  const [wikiGods, setWikiGods] = useState<Map<string, WikiEntryDto>>(new Map());
  useEffect(() => {
    let cancelled = false;
    api
      .wiki()
      .then((r) => !cancelled && setWikiGods(new Map(r.entries.filter((e) => e.kind === 'god').map((e) => [e.name.toLocaleLowerCase('de'), e]))))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const entry = wikiGods.get(value.trim().toLocaleLowerCase('de'));
  const [open, setOpen] = useState<WikiEntryDto | null>(null);
  return (
    <div>
      <div className="flex items-center gap-1">
        <input
          id={id}
          className="sheet-input min-w-0 flex-1"
          value={value}
          list={readOnly ? undefined : `${id}-gods`}
          disabled={readOnly}
          maxLength={100}
          onChange={(e) => set(['identity', 'faith'], e.target.value)}
        />
        {entry && (
          <button type="button" className="btn-icon h-7 w-7 shrink-0 print:hidden" onClick={() => setOpen(entry)} title={t('sheet.openDeity')} aria-label={`${t('sheet.openDeity')}: ${entry.name}`}>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <datalist id={`${id}-gods`}>
        {gods.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <label htmlFor={id} className="sheet-label">
        {t('sheet.faith')}
      </label>
      <Modal open={!!open} title={open?.name ?? ''} onClose={() => setOpen(null)} size="max-w-2xl">
        {open && <WikiDetail entry={open} />}
      </Modal>
    </div>
  );
}

export function PhysicalHeader() {
  const { t } = useTranslation();
  const f = (k: string, label: string) => <TF key={k} path={['identity', k]} label={label} maxLength={100} />;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
      {f('age', t('sheet.age'))}
      <FaithField />
      {f('size', t('sheet.size'))}
      {f('height', t('sheet.height'))}
      {f('weight', t('sheet.weight'))}
      {f('gender', t('sheet.gender'))}
      {f('alignment', t('sheet.alignment'))}
      {f('eyes', t('sheet.eyes'))}
      {f('hair', t('sheet.hair'))}
      {f('skin', t('sheet.skin'))}
    </div>
  );
}

export function BackgroundTab() {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <Box className="lg:col-span-4">
        <ImageField path={['portrait']} label={t('sheet.portrait')} />
      </Box>
      <Box className="lg:col-span-5">
        <TA path={['features', 'allies']} label={t('sheet.allies')} rows={16} />
      </Box>
      <Box className="lg:col-span-3">
        <TF path={['symbolName']} label={t('sheet.symbolName')} className="mb-2" maxLength={100} />
        <ImageField path={['symbol']} label={t('sheet.symbol')} aspect="aspect-square" maxSize={500} />
      </Box>
      <Box className="lg:col-span-4">
        <TA path={['features', 'appearance']} label={t('sheet.appearance')} rows={12} />
      </Box>
      <Box className="lg:col-span-8">
        <TA path={['features', 'backstory']} label={t('sheet.backstory')} rows={12} />
      </Box>
      <Box label={t('sheet.extraEquipment')} className="lg:col-span-4">
        <InventoryTable listKey="extraEquipment" />
      </Box>
      <Box className="lg:col-span-8">
        <TA path={['features', 'development']} label={t('sheet.development')} rows={14} />
      </Box>
    </div>
  );
}
