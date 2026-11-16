import { useTranslation } from 'react-i18next';
import { Box, TA, TF } from './fields';
import { ImageField } from './ImageField';
import { InventoryTable } from './InventoryTable';

export function PhysicalHeader() {
  const { t } = useTranslation();
  const f = (k: string, label: string) => <TF key={k} path={['identity', k]} label={label} maxLength={100} />;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
      {f('age', t('sheet.age'))}
      {f('faith', t('sheet.faith'))}
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
