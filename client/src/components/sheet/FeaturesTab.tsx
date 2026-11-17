import { useTranslation } from 'react-i18next';
import { carrying, jumps } from '@zauberbuch/shared';
import { useSheet } from './SheetContext';
import { Box, NF, TA, TF } from './fields';
import { InventoryTable } from './InventoryTable';

const fmt = (n: number, lang: string) => n.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function JumpBox() {
  const { t, i18n } = useTranslation();
  const { sheet } = useSheet();
  const j = jumps(sheet);
  return (
    <Box label={t('sheet.jumps')}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-parchment-700 dark:text-parchment-400">
            <th />
            <th className="font-semibold">{t('sheet.standing')}</th>
            <th className="font-semibold">{t('sheet.running')}</th>
          </tr>
        </thead>
        <tbody className="text-center tabular-nums">
          <tr>
            <th className="text-left font-semibold">{t('sheet.highJump')}</th>
            <td>{fmt(j.highStanding, i18n.language)} m</td>
            <td>{fmt(j.highRunning, i18n.language)} m</td>
          </tr>
          <tr>
            <th className="text-left font-semibold">{t('sheet.longJump')}</th>
            <td>{fmt(j.longStanding, i18n.language)} m</td>
            <td>{fmt(j.longRunning, i18n.language)} m</td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}

export function CoinsAndLoad() {
  const { t, i18n } = useTranslation();
  const { sheet } = useSheet();
  const c = carrying(sheet);
  const stateCls =
    c.state === 'heavy' ? 'text-red-700 dark:text-red-400' : c.state === 'encumbered' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400';
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-2 lg:grid-cols-1">
        {(['pp', 'gp', 'ep', 'sp', 'cp'] as const).map((k) => (
          <NF key={k} path={['coins', k]} label={t(`sheet.coins.${k}`)} min={0} inputClassName="font-display !text-lg font-bold" />
        ))}
      </div>
      <p className="text-[0.6875rem] text-parchment-700 dark:text-parchment-400">{t('sheet.coinsHint')}</p>
      <dl className="space-y-1.5 text-sm">
        <div>
          <dt className="sheet-label">{t('sheet.totalWeight')}</dt>
          <dd className="font-semibold tabular-nums">
            {c.total.toLocaleString(i18n.language)} lb · <span className={stateCls}>{t(`sheet.loadState.${c.state}`)}</span>
          </dd>
        </div>
        <div>
          <dt className="sheet-label">{t('sheet.encumbered')}</dt>
          <dd className="tabular-nums">
            {c.encumberedFrom} – {c.encumberedTo} lb
          </dd>
        </div>
        <div>
          <dt className="sheet-label">{t('sheet.heavilyEncumbered')}</dt>
          <dd className="tabular-nums">
            {c.heavyFrom} – {c.heavyTo} lb
          </dd>
        </div>
        <div>
          <dt className="sheet-label">{t('sheet.maxPushDrag')}</dt>
          <dd className="tabular-nums">{c.maxPushDrag} lb</dd>
        </div>
      </dl>
    </div>
  );
}

export function FeaturesTab() {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="flex flex-col gap-4 lg:col-span-5">
        <Box>
          <TA path={['features', 'racialTraits']} label={t('sheet.racialTraits')} rows={10} />
        </Box>
        <Box>
          <TA path={['features', 'senses']} label={t('sheet.senses')} rows={5} />
        </Box>
        <Box label={t('sheet.lifestyle')}>
          <div className="grid grid-cols-2 gap-3">
            <TF path={['lifestyle', 'name']} label={t('sheet.lifestyleName')} maxLength={50} />
            <TF path={['lifestyle', 'dailyCost']} label={t('sheet.dailyCost')} maxLength={30} align="center" />
          </div>
        </Box>
        <JumpBox />
        <Box>
          <TA path={['features', 'enemies']} label={t('sheet.enemies')} rows={6} />
        </Box>
      </div>
      <div className="lg:col-span-7">
        <Box className="h-full">
          <TA path={['features', 'moreFeatures']} label={t('sheet.moreFeatures')} rows={30} />
        </Box>
      </div>
      <div className="lg:col-span-12">
        <Box label={t('sheet.inventory')}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_12rem]">
            <div className="space-y-4">
              <InventoryTable listKey="inventory" />
              <div>
                <p className="sheet-label mb-1">{t('sheet.attuned')}</p>
                <AttunedItems />
              </div>
            </div>
            <CoinsAndLoad />
          </div>
        </Box>
      </div>
    </div>
  );
}

function AttunedItems() {
  const { t } = useTranslation();
  const { sheet, set } = useSheet();
  const items = [0, 1, 2].map((i) => sheet.attunedItems[i] ?? '');
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map((v, i) => (
        <input
          key={i}
          className="sheet-input"
          value={v}
          maxLength={150}
          placeholder={t('sheet.attunedSlot', { n: i + 1 })}
          aria-label={t('sheet.attunedSlot', { n: i + 1 })}
          onChange={(e) => {
            const next = [...items];
            next[i] = e.target.value;
            // leere Einträge am Ende abschneiden
            while (next.length && !next[next.length - 1]) next.pop();
            set(['attunedItems'], next);
          }}
        />
      ))}
    </div>
  );
}
