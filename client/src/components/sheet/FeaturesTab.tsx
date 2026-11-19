import { useTranslation } from 'react-i18next';
import { carrying, jumps, lifestyleCost } from '@zauberbuch/shared';
import { useSheet } from './SheetContext';
import { Box, NF, TA } from './fields';
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
  const { sheet, items } = useSheet();
  // Magische Gegenstände des Charakters zählen zur Last
  const magicWeight = (items.data?.items ?? []).reduce((sum, i) => sum + (i.weight || 0), 0);
  const c = carrying(sheet, magicWeight);
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
          {c.extra > 0 && <dd className="text-xs text-parchment-700 dark:text-parchment-400">{t('items.weightShare', { weight: c.extra.toLocaleString(i18n.language) })}</dd>}
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
          <LifestyleFields />
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
  const { sheet, set, readOnly, items } = useSheet();
  const slots = [0, 1, 2].map((i) => sheet.attunedItems[i] ?? '');
  // Auswahl aus den magischen Gegenständen des Bogens; frühere freie Einträge bleiben wählbar
  const owned = (items.data?.items ?? []).map((i) => i.name);
  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {slots.map((v, i) => {
          const chosen = new Set(slots.filter((_, j) => j !== i && slots[j]).map((x) => x.toLocaleLowerCase('de')));
          const known = !v || owned.some((o) => o.toLocaleLowerCase('de') === v.toLocaleLowerCase('de'));
          return (
            <select
              key={i}
              className="sheet-input"
              value={v}
              disabled={readOnly}
              aria-label={t('sheet.attunedSlot', { n: i + 1 })}
              onChange={(e) => {
                const next = [...slots];
                next[i] = e.target.value;
                // leere Einträge am Ende abschneiden
                while (next.length && !next[next.length - 1]) next.pop();
                set(['attunedItems'], next);
              }}
            >
              <option value="">{t('sheet.attunedSlot', { n: i + 1 })}</option>
              {owned.map((o) => (
                <option key={o} value={o} disabled={chosen.has(o.toLocaleLowerCase('de'))}>
                  {o}
                </option>
              ))}
              {!known && <option value={v}>{v}</option>}
            </select>
          );
        })}
      </div>
      {items.data && owned.length === 0 && <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400 print:hidden">{t('items.attuneHint')}</p>}
    </div>
  );
}

/**
 * Lebensstil als Auswahl; die täglichen Kosten kommen aus der Tabelle (Geschichte des Bogens bzw. Standardwerte).
 * Ein früher frei eingetragener Lebensstil, der nicht in der Tabelle steht, bleibt wählbar und behält seine Kosten.
 */
function LifestyleFields() {
  const { t } = useTranslation();
  const { sheet, set, readOnly, lifestyles } = useSheet();
  const current = sheet.lifestyle.name;
  const tableCost = current ? lifestyleCost(lifestyles, current) : null;
  const inTable = tableCost !== null;
  const cost = tableCost ?? sheet.lifestyle.dailyCost;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <select
          id="sheet-lifestyle"
          className="sheet-input"
          value={current}
          disabled={readOnly}
          onChange={(e) => {
            const name = e.target.value;
            set(['lifestyle'], { name, dailyCost: name ? (lifestyleCost(lifestyles, name) ?? '') : '' });
          }}
        >
          <option value="">–</option>
          {lifestyles.map((l) => (
            <option key={l.name} value={l.name}>
              {l.name}
            </option>
          ))}
          {current && !inTable && <option value={current}>{current}</option>}
        </select>
        <label htmlFor="sheet-lifestyle" className="sheet-label">
          {t('sheet.lifestyleName')}
        </label>
      </div>
      <div>
        <output className="sheet-input flex min-h-[2.125rem] items-center justify-center tabular-nums" aria-labelledby="sheet-daily-cost" title={t('sheet.dailyCostHint')}>
          {cost || '–'}
        </output>
        <span id="sheet-daily-cost" className="sheet-label">
          {t('sheet.dailyCost')}
        </span>
      </div>
    </div>
  );
}
