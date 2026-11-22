import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowBigUpDash, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { OptionListField, type OptionGroup } from './OptionListField';
import { Modal } from '../Modal';
import { CatalogCard } from '../catalog/CatalogCard';
import {
  ABILITIES,
  TOOL_TYPES,
  type CatalogItemDto,
  MAX_ATTACKS,
  SKILLS,
  abilityModifier,
  attackBonus,
  formatModifier,
  initiative,
  levelForXp,
  xpForNextLevel,
  passivePerception,
  proficiencyBonus,
  proficiencyBonusForLevel,
  savingThrowBonus,
  skillBonus,
  type SheetAttack,
} from '@zauberbuch/shared';
import { useSheet } from './SheetContext';
import { LevelUpDialog } from './LevelUpDialog';
import { Box, CheckField, Computed, NF, ProfToggle, TA, TF } from './fields';

/** Erfahrungspunkte mit automatisch berechneter Schwelle für die nächste Stufe */
function ExperienceField({ onLevelUp }: { onLevelUp: () => void }) {
  const { t, i18n } = useTranslation();
  const { sheet, readOnly } = useSheet();
  const { level, xp } = sheet.identity;
  const next = xpForNextLevel(level);
  const reachable = Math.min(20, levelForXp(xp));
  const canLevelUp = reachable > level;
  return (
    <div className="col-span-2">
      <div className="flex items-start gap-1">
        <NF path={['identity', 'xp']} label={t('sheet.xp')} min={0} className="flex-1" />
        <span className="pt-2 text-parchment-600">/</span>
        <div className="flex-1">
          <output className="sheet-input block !border-dashed text-center tabular-nums text-parchment-800 dark:text-parchment-300" title={t('sheet.computed')}>
            {next === null ? t('sheet.xpMaxLevel') : next.toLocaleString(i18n.language)}
          </output>
          <span className="sheet-label">{t('sheet.xpNext')}</span>
        </div>
      </div>
      {canLevelUp && (
        <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md bg-amber-100 px-2 py-1 text-sm text-amber-900 print:hidden dark:bg-amber-950 dark:text-amber-200" role="status">
          <span>{t('sheet.levelUpPossible', { level: reachable })}</span>
          {!readOnly && (
            <button type="button" className="font-semibold underline" onClick={onLevelUp}>
              {t('sheet.levelUpButton', { level: Math.min(20, level + 1) })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function IdentityHeader() {
  const { t } = useTranslation();
  const { sheet, readOnly } = useSheet();
  const [levelUp, setLevelUp] = useState(false);
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
      <TF path={['identity', 'classLevel']} label={t('sheet.classLevel')} className="col-span-2" />
      <div>
        <NF path={['identity', 'level']} label={t('sheet.level')} min={1} max={20} />
        {!readOnly && sheet.identity.level < 20 && (
          <button
            type="button"
            className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline decoration-dotted underline-offset-2 hover:decoration-solid print:hidden dark:text-emerald-300"
            onClick={() => setLevelUp(true)}
          >
            <ArrowBigUpDash className="h-3.5 w-3.5" />
            {t('levelUp.open')}
          </button>
        )}
      </div>
      <TF path={['identity', 'playerName']} label={t('sheet.playerName')} />
      <ExperienceField onLevelUp={() => setLevelUp(true)} />
      <LevelUpDialog open={levelUp} onClose={() => setLevelUp(false)} />
      <TF path={['identity', 'background']} label={t('sheet.background')} className="col-span-2 sm:col-span-1 lg:col-span-3" />
      <TF path={['identity', 'race']} label={t('sheet.race')} className="col-span-2 lg:col-span-3" />
    </div>
  );
}

function AbilityColumn() {
  const { t, i18n } = useTranslation();
  const { sheet } = useSheet();
  return (
    <div className="flex flex-col gap-3">
      {ABILITIES.map((a) => (
        <div key={a} className="sheet-box flex flex-col items-center !px-2 !py-2">
          <span className="sheet-label w-full break-words text-center !text-[0.5625rem] hyphens-auto" lang={i18n.language}>
            {t(`sheet.ability.${a}`)}
          </span>
          <Computed value={formatModifier(abilityModifier(sheet.abilities[a]))} className="font-display text-3xl font-bold" />
          <NF path={['abilities', a]} min={1} max={30} className="w-16" inputClassName="!rounded-full !py-0.5 text-sm" />
        </div>
      ))}
    </div>
  );
}

function SavesAndSkills() {
  const { t } = useTranslation();
  const { sheet } = useSheet();
  const pb = proficiencyBonus(sheet);
  return (
    <div className="flex flex-col gap-3">
      <div className="sheet-box flex items-center gap-3 !py-2">
        <CheckField path={['inspiration']} label={<span className="sheet-label !text-xs">{t('sheet.inspiration')}</span>} />
      </div>
      <div className="sheet-box flex items-center gap-3 !py-2">
        <Computed
          value={formatModifier(pb)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-parchment-700 font-display text-xl font-bold dark:border-parchment-400"
        />
        <div className="min-w-0 flex-1">
          <span className="sheet-label !text-xs">{t('sheet.proficiencyBonus')}</span>
          <ProficiencyOverride />
        </div>
      </div>
      <Box label={t('sheet.savingThrows')}>
        <ul className="space-y-1">
          {ABILITIES.map((a) => (
            <li key={a} className="flex items-center gap-2 text-sm">
              <ProfToggle path={['savingThrows', a]} allowExpertise={false} label={t(`sheet.ability.${a}`)} />
              <Computed value={formatModifier(savingThrowBonus(sheet, a))} className="w-7 text-right font-semibold" />
              <span>{t(`sheet.ability.${a}`)}</span>
            </li>
          ))}
        </ul>
      </Box>
      <Box label={t('sheet.skills')}>
        <ul className="space-y-1">
          {SKILLS.map(([k, a]) => (
            <li key={k} className="flex items-center gap-2 text-sm">
              <ProfToggle path={['skills', k]} label={t(`sheet.skill.${k}`)} />
              <Computed value={formatModifier(skillBonus(sheet, k))} className="w-7 text-right font-semibold" />
              <span className="truncate">
                {t(`sheet.skill.${k}`)} <span className="text-parchment-600 dark:text-parchment-500">({t(`sheet.abilityShort.${a}`)})</span>
              </span>
            </li>
          ))}
        </ul>
      </Box>
    </div>
  );
}

function ProficiencyOverride() {
  const { t } = useTranslation();
  const { sheet, set } = useSheet();
  const auto = proficiencyBonusForLevel(sheet.identity.level);
  return (
    <input
      type="number"
      min={0}
      max={10}
      className="sheet-input !py-0.5 text-sm"
      value={sheet.proficiencyBonusOverride ?? ''}
      placeholder={`${t('sheet.proficiencyAuto')} (${formatModifier(auto)})`}
      onChange={(e) => set(['proficiencyBonusOverride'], e.target.value === '' ? null : Math.max(0, Math.min(10, Number(e.target.value))))}
      aria-label={t('sheet.proficiencyBonus')}
    />
  );
}

function CombatBlock() {
  const { t } = useTranslation();
  const { sheet, set, readOnly } = useSheet();
  const pips = (key: 'deathSuccesses' | 'deathFailures', label: string) => (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-1.5">
        {[1, 2, 3].map((n) => {
          const on = sheet.combat[key] >= n;
          return (
            <button
              key={n}
              type="button"
              disabled={readOnly}
              onClick={() => set(['combat', key], sheet.combat[key] === n ? n - 1 : n)}
              className={`h-4 w-4 rounded-full border-2 ${on ? (key === 'deathSuccesses' ? 'border-emerald-700 bg-emerald-600' : 'border-red-800 bg-red-700') : 'border-parchment-600'}`}
              aria-label={`${label} ${n}`}
              aria-pressed={on}
            />
          );
        })}
      </div>
      <span className="sheet-label">{label}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Box label={t('sheet.ac')} className="!py-2">
          <TF path={['combat', 'ac']} align="center" inputClassName="font-display !text-2xl font-bold" maxLength={20} />
        </Box>
        <Box label={t('sheet.initiative')} className="!py-2">
          <div className="flex flex-col items-center">
            <Computed value={formatModifier(initiative(sheet))} className="font-display text-2xl font-bold" />
          </div>
        </Box>
        <Box label={t('sheet.speed')} className="!py-2">
          <TF path={['combat', 'speed']} align="center" inputClassName="font-display !text-2xl font-bold" maxLength={30} />
        </Box>
      </div>
      <NF path={['combat', 'initiativeBonus']} label={t('sheet.initiativeBonus')} min={-20} max={20} className="-mt-1" inputClassName="!py-0.5 text-sm" />
      <Box label={t('sheet.hpCurrent')}>
        <NF path={['combat', 'hpMax']} label={t('sheet.hpMax')} min={0} max={9999} inputClassName="!py-0.5 text-sm" />
        <NF path={['combat', 'hpCurrent']} min={-9999} max={9999} inputClassName="mt-2 font-display !text-4xl font-bold" />
      </Box>
      <Box label={t('sheet.hpTemp')}>
        <NF path={['combat', 'hpTemp']} min={0} max={9999} inputClassName="font-display !text-3xl font-bold" />
      </Box>
      <div className="grid grid-cols-2 gap-3">
        <Box label={t('sheet.hitDice')}>
          <TF path={['combat', 'hitDiceTotal']} label={t('sheet.hitDiceTotal')} align="center" inputClassName="!py-0.5 text-sm" maxLength={30} />
          <TF path={['combat', 'hitDiceCurrent']} label={t('sheet.hitDiceCurrent')} align="center" inputClassName="mt-1 font-display !text-xl font-bold" maxLength={30} />
        </Box>
        <Box label={t('sheet.deathSaves')}>
          {/* füllt den Platz über der Beschriftung, Zeilen mittig – Beschriftung bleibt im Kasten */}
          <div className="flex flex-1 flex-col justify-center gap-3 py-1">
            {pips('deathSuccesses', t('sheet.successes'))}
            {pips('deathFailures', t('sheet.failures'))}
          </div>
        </Box>
      </div>
    </div>
  );
}

function Personality() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      {(['traits', 'ideals', 'bonds', 'flaws'] as const).map((k) => (
        <Box key={k}>
          <TA path={['personality', k]} label={t(`sheet.${k}`)} rows={4} />
        </Box>
      ))}
    </div>
  );
}

const emptyAttack = (): SheetAttack => ({ name: '', ability: 'none', proficient: false, bonus: 0, range: '', damage: '', damageType: '', description: '' });

function Attacks() {
  const { t } = useTranslation();
  const { sheet, set, readOnly } = useSheet();
  const attacks = sheet.attacks;
  return (
    <Box label={t('sheet.attacks')}>
      <div className="overflow-x-auto">
        <table className="sheet-table min-w-[40rem]">
          <thead>
            <tr>
              <th className="w-[26%]">{t('sheet.attack.name')}</th>
              <th title={t('sheet.attack.proficient')}>{t('sheet.attack.proficient')}</th>
              <th>{t('sheet.attack.ability')}</th>
              <th>{t('sheet.attack.range')}</th>
              <th>{t('sheet.attack.extraBonus')}</th>
              <th>{t('sheet.attack.bonus')}</th>
              <th>{t('sheet.attack.damage')}</th>
              <th>{t('sheet.attack.damageType')}</th>
              {!readOnly && <th className="w-8 print:hidden" />}
            </tr>
          </thead>
          <tbody>
            {attacks.map((a, i) => (
              <AttackRow key={i} index={i} attack={a} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 print:hidden">
        {!readOnly && attacks.length < MAX_ATTACKS && (
          <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => set(['attacks'], [...attacks, emptyAttack()])}>
            <Plus className="h-4 w-4" />
            {t('sheet.addAttack')}
          </button>
        )}
        <span className={`text-xs ${attacks.length >= MAX_ATTACKS ? 'text-amber-700 dark:text-amber-400' : 'text-parchment-700 dark:text-parchment-400'}`}>
          {t('sheet.attackCount', { count: attacks.length, max: MAX_ATTACKS })}
          {!readOnly && attacks.length > MAX_ATTACKS && <> · {t('sheet.attackLimitExceeded', { max: MAX_ATTACKS })}</>}
        </span>
      </div>
    </Box>
  );
}

function AttackRow({ index, attack }: { index: number; attack: SheetAttack }) {
  const { t } = useTranslation();
  const { sheet, set, readOnly } = useSheet();
  const p = (k: keyof SheetAttack) => ['attacks', index, k] as const;
  return (
    <>
      <tr>
        <td>
          <TF path={p('name')} />
        </td>
        <td className="text-center">
          <ProfToggle path={p('proficient')} allowExpertise={false} label={t('sheet.attack.proficient')} />
        </td>
        <td>
          <select className="sheet-input min-w-[4.5rem] !px-1" value={attack.ability} onChange={(e) => set(p('ability'), e.target.value)} aria-label={t('sheet.attack.ability')}>
            {(['none', ...ABILITIES] as const).map((a) => (
              <option key={a} value={a}>
                {t(`sheet.abilityShort.${a}`)}
              </option>
            ))}
          </select>
        </td>
        <td>
          <TF path={p('range')} align="center" maxLength={50} />
        </td>
        <td>
          <NF path={p('bonus')} min={-20} max={20} />
        </td>
        <td className="text-center font-semibold">
          <Computed value={formatModifier(attackBonus(sheet, attack))} />
        </td>
        <td>
          <TF path={p('damage')} align="center" maxLength={50} />
        </td>
        <td>
          <TF path={p('damageType')} align="center" maxLength={50} />
        </td>
        {!readOnly && (
          <td rowSpan={2} className="align-middle print:hidden">
            <button
              type="button"
              className="btn-icon h-8 w-8 text-red-700 dark:text-red-400"
              onClick={() =>
                set(
                  ['attacks'],
                  sheet.attacks.filter((_, j) => j !== index),
                )
              }
              aria-label={`${t('sheet.remove')}: ${attack.name}`}
              title={t('sheet.remove')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </td>
        )}
      </tr>
      <tr className="sheet-subrow">
        <td colSpan={8}>
          <TF path={p('description')} placeholder={t('sheet.attack.description')} maxLength={500} inputClassName="!text-sm italic" />
        </td>
      </tr>
    </>
  );
}

/**
 * Werkzeuge & Andere: Auswahl aus der Wiki-Ausrüstung (Gegenstands-Datenbank der Geschichte bzw. Standard), nach Art
 * gruppiert, mit Link zur Karte. Eine selbst angepasste Werkzeugliste der Geschichte liefert zusätzliche Einträge.
 */
const TOOL_ALIASES: Record<string, string> = {
  Alchemistenlabor: 'Alchemistenausrüstung',
  Brauereivorräte: 'Brauerausrüstung',
  Glasbläserwerkzeuge: 'Glasbläserwerkzeug',
  Holzschnitzwerkzeuge: 'Holzschnitzerwerkzeug',
  Juwelierwerkzeuge: 'Juwelierswerkzeug',
  Kalligraphiewerkzeuge: 'Kalligrafieausrüstung',
  Ledererwerkzeuge: 'Lederverarbeitungswerkzeug',
  Malutensilien: 'Malerausrüstung',
  Maurerwerkzeuge: 'Steinmetzwerkzeug',
  Schmiedewerkzeuge: 'Schmiedewerkzeug',
  Schreinerwerkzeuge: 'Zimmermannswerkzeug',
  Schusterwerkzeuge: 'Schusterwerkzeug',
  Töpferwerkzeuge: 'Töpferwerkzeug',
  Tüftlerwerkzeuge: 'Kesselflickerwerkzeug',
  Weberwerkzeuge: 'Weberwerkzeug',
  'Satz Spielkarten': 'Kartenspiel',
  'Satz Würfel': 'Würfelspiel',
  Navigationswerkzeuge: 'Navigationswerkzeug',
};

function ToolsField({ tools }: { tools: string[] }) {
  const { t } = useTranslation();
  const { catalog } = useSheet();
  const [open, setOpen] = useState<CatalogItemDto | null>(null);
  const toolItems = catalog.filter((c) => c.category === 'tool');
  const byName = new Map(toolItems.map((c) => [c.name.toLocaleLowerCase('de'), c]));
  // Bezeichnungen der früheren Standardliste → Name im Wiki (damit alte Einträge verknüpft sind)
  const find = (value: string) => byName.get(value.toLocaleLowerCase('de')) ?? byName.get((TOOL_ALIASES[value] ?? '').toLocaleLowerCase('de'));
  const sorted = (l: string[]) => [...l].sort((a, b) => a.localeCompare(b, 'de'));
  // Einträge der Werkzeugliste der Geschichte, die es im Wiki nicht gibt, bleiben unter „Weitere“ wählbar
  const extra = tools.filter((x) => !find(x));
  const groups: OptionGroup[] = [
    ...TOOL_TYPES.map((tt) => ({ label: t(`catalog.toolTypes.${tt}`), options: sorted(toolItems.filter((c) => c.toolType === tt).map((c) => c.name)) })),
    { label: t('sheet.toolsOther'), options: sorted([...toolItems.filter((c) => !c.toolType).map((c) => c.name), ...extra]) },
  ];
  return (
    <>
      <OptionListField
        path={['proficiencies', 'tools']}
        label={t('sheet.tools')}
        options={[]}
        groups={groups}
        renderAction={(value) => {
          const item = find(value);
          return item ? (
            <button type="button" className="btn-icon h-7 w-7 shrink-0 print:hidden" onClick={() => setOpen(item)} title={t('catalog.openCard')} aria-label={`${t('catalog.openCard')}: ${item.name}`}>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          ) : null;
        }}
      />
      <Modal open={!!open} title={open ? t('catalog.categoriesOne.tool') : ''} onClose={() => setOpen(null)} size="max-w-md">
        {open && <CatalogCard item={open} />}
      </Modal>
    </>
  );
}

function Proficiencies() {
  const { languages, tools } = useSheet();
  const { t } = useTranslation();
  return (
    <Box label={t('sheet.proficienciesLanguages')}>
      <div className="space-y-3">
        <div>
          <p className="sheet-label mb-1 text-center">{t('sheet.armor')}</p>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
            <CheckField path={['proficiencies', 'armor', 'light']} label={t('sheet.armorLight')} />
            <CheckField path={['proficiencies', 'armor', 'medium']} label={t('sheet.armorMedium')} />
            <CheckField path={['proficiencies', 'armor', 'heavy']} label={t('sheet.armorHeavy')} />
            <CheckField path={['proficiencies', 'armor', 'shields']} label={t('sheet.shields')} />
          </div>
        </div>
        <div>
          <p className="sheet-label mb-1 text-center">{t('sheet.weapons')}</p>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
            <CheckField path={['proficiencies', 'weapons', 'simple']} label={t('sheet.weaponsSimple')} />
            <CheckField path={['proficiencies', 'weapons', 'martial']} label={t('sheet.weaponsMartial')} />
            <CheckField path={['proficiencies', 'weapons', 'other']} label={t('sheet.weaponsOther')} />
          </div>
          <TF path={['proficiencies', 'otherWeapons']} label={t('sheet.otherWeapons')} className="mt-1" maxLength={500} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <OptionListField path={['proficiencies', 'languages']} label={t('sheet.languages')} options={languages} />
          <ToolsField tools={tools} />
        </div>
      </div>
    </Box>
  );
}

export function MainTab() {
  const { t } = useTranslation();
  const { sheet } = useSheet();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="grid grid-cols-[7.25rem_1fr] content-start gap-3 lg:col-span-4">
        <AbilityColumn />
        <SavesAndSkills />
        <div className="sheet-box col-span-2 flex items-center gap-3 !py-2">
          <Computed
            value={passivePerception(sheet)}
            className="flex h-10 w-12 items-center justify-center rounded-full border-2 border-parchment-700 font-display text-lg font-bold dark:border-parchment-400"
          />
          <div>
            <p className="sheet-label !text-xs">{t('sheet.passivePerception')}</p>
            <p className="text-xs text-parchment-700 dark:text-parchment-400">[{t('sheet.passiveHint')}]</p>
          </div>
        </div>
        <div className="col-span-2">
          <Proficiencies />
        </div>
      </div>
      <div className="grid grid-cols-1 content-start gap-4 lg:col-span-8 lg:grid-cols-2">
        <CombatBlock />
        <Personality />
        <div className="lg:col-span-2">
          <Attacks />
        </div>
        <div className="lg:col-span-2">
          <Box>
            <TA path={['features', 'classFeatures']} label={t('sheet.classFeatures')} rows={14} />
          </Box>
        </div>
      </div>
    </div>
  );
}
