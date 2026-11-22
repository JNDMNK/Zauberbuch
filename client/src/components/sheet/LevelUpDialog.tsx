import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowBigUpDash, Dices } from 'lucide-react';
import { ABILITIES, sourceAllowed, abilityModifier, formatModifier, proficiencyBonusForLevel, type Ability, type WikiEntryDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { Modal } from '../Modal';
import { Alert, PageSpinner } from '../ui';
import { Markdown } from '../Markdown';
import { useSpellClass } from '../wiki/ClassSpells';
import type { ClassEntry } from '../../lib/characterWizard';
import { applyLevelUp, averageHp, conBonusFor, detectClass, hitDie, isAsi, spellSlots, xpForLevel } from '../../lib/levelUp';
import { useSheet } from './SheetContext';

type HpMode = 'average' | 'roll' | 'manual';
type AsiMode = 'two' | 'one' | 'feat';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="border-b border-parchment-400/70 pb-1 font-display text-lg font-bold dark:border-night-700">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Stufenaufstieg: neue Stufe mit Trefferpunkten (Durchschnitt, Würfeln oder eigener Wert), neuen Klassen- und
 * Unterklassenmerkmalen aus dem Wiki, Wahl der Unterklasse, Attributswerterhöhung bzw. Talent, Zauberplätzen.
 */
export function LevelUpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { sheet, set, sources, milestone } = useSheet();
  const [wiki, setWiki] = useState<WikiEntryDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [hpMode, setHpMode] = useState<HpMode>('average');
  const [rolled, setRolled] = useState<number | null>(null);
  const [manualHp, setManualHp] = useState('');
  const [subclass, setSubclass] = useState('');
  const [asiMode, setAsiMode] = useState<AsiMode>('two');
  const [asiA, setAsiA] = useState<Ability | ''>('');
  const [asiB, setAsiB] = useState<Ability | ''>('');
  const [feat, setFeat] = useState('');

  useEffect(() => {
    if (!open) return;
    setHpMode('average');
    setRolled(null);
    setManualHp('');
    setSubclass('');
    setAsiMode('two');
    setAsiA('');
    setAsiB('');
    setFeat('');
    if (!wiki) api.wiki().then((r) => setWiki(r.entries), setError);
  }, [open, wiki]);

  const classes = useMemo(() => (wiki ?? []).filter((e): e is ClassEntry => e.kind === 'class'), [wiki]);
  // Talente und Unterklassen nur aus den Quellen der Geschichte des Bogens
  const feats = (wiki ?? []).filter((e) => e.kind === 'feat' && sourceAllowed(sources, e.sourceId)).map((e) => e.name);
  const { cls, subclass: currentSub } = detectClass(sheet.identity.classLevel, classes);
  const spellClass = useSpellClass(cls?.name ?? '');
  const level = sheet.identity.level;
  const n = Math.min(20, level + 1);
  const die = hitDie(sheet, cls);
  const con = abilityModifier(sheet.abilities.con);
  const avg = averageHp(die) + con;

  // Unterklasse: wird auf dieser Stufe gewählt, wenn noch keine im Bogen steht
  const subLevel = cls ? Math.min(...cls.data.subclasses.flatMap((s) => s.features.map((f) => f.level)), 99) : 99;
  const subclassOptions = cls ? cls.data.subclasses.filter((x) => sourceAllowed(sources, x.sourceId ?? cls.sourceId)) : [];
  const choosesSubclass = !!cls && !currentSub && subclassOptions.length > 0 && subLevel <= n;
  const sub = currentSub ?? cls?.data.subclasses.find((s) => s.name === subclass) ?? null;
  const classFeatures = cls?.data.features.filter((f) => f.level === n) ?? [];
  const asi = classFeatures.some(isAsi);
  const subFeatures = sub ? sub.features.filter((f) => (currentSub ? f.level === n : f.level <= n)) : [];
  const features = [...classFeatures.filter((f) => !isAsi(f)).map((f) => ({ ...f, from: cls!.name })), ...subFeatures.map((f) => ({ ...f, from: sub!.name }))];

  const increase: Partial<Record<Ability, number>> = {};
  if (asi && asiMode === 'one' && asiA) increase[asiA] = 2;
  if (asi && asiMode === 'two') {
    if (asiA) increase[asiA] = 1;
    if (asiB) increase[asiB] = (increase[asiB] ?? 0) + 1;
  }
  const hpGain = hpMode === 'average' ? avg : hpMode === 'roll' ? (rolled ?? 0) + con : Number.parseInt(manualHp, 10) || 0;
  const conBonus = conBonusFor(sheet, increase, n);
  const slotsBefore = sheet.spellcasting.slots.map((s) => s.total);
  const slotsAfter = spellClass ? spellSlots(spellClass, n) : null;
  const slotChanges = slotsAfter ? slotsAfter.map((v, i) => ({ grade: i + 1, from: slotsBefore[i], to: v })).filter((x) => x.from !== x.to) : [];
  const xpNeeded = xpForLevel(n);

  const ok =
    level < 20 &&
    (hpMode !== 'roll' || rolled !== null) &&
    (hpMode !== 'manual' || (Number.parseInt(manualHp, 10) || 0) > 0) &&
    (!choosesSubclass || !!subclass) &&
    (!asi || (asiMode === 'one' ? !!asiA : asiMode === 'two' ? !!asiA && !!asiB && asiA !== asiB : !!feat.trim()));

  const apply = () => {
    const next = applyLevelUp(sheet, cls, {
      newLevel: n,
      hpGain,
      conBonus,
      features,
      subclassName: choosesSubclass ? subclass : null,
      abilityIncrease: increase,
      feat: asi && asiMode === 'feat' ? feat.trim() : null,
      slots: slotsAfter && slotChanges.length ? slotsAfter : null,
      die,
    });
    for (const key of ['identity', 'abilities', 'combat', 'features', 'spellcasting'] as const) set([key], next[key]);
    onClose();
  };

  const abilityOptions = (exclude?: Ability | '') =>
    ABILITIES.filter((a) => a !== exclude).map((a) => (
      <option key={a} value={a} disabled={sheet.abilities[a] >= 20}>
        {t(`sheet.ability.${a}`)} ({sheet.abilities[a]})
      </option>
    ));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="max-w-3xl"
      title={
        <span className="flex items-center gap-2">
          <ArrowBigUpDash className="h-5 w-5" />
          {t('levelUp.title', { name: sheet.identity.name || t('levelUp.character') })}
        </span>
      }
    >
      {error ? (
        <Alert>{errorMessage(t, error)}</Alert>
      ) : !wiki ? (
        <PageSpinner />
      ) : level >= 20 ? (
        <p>{t('levelUp.max')}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-display text-xl font-bold">{cls ? `${cls.name} ${level}` : t('levelUp.level', { n: level })}</span>
            <span className="text-xl">→</span>
            <span className="font-display text-xl font-bold text-emerald-800 dark:text-emerald-300">{cls ? `${cls.name} ${n}` : t('levelUp.level', { n })}</span>
            <span className="ml-auto text-sm text-parchment-700 dark:text-parchment-400">
              {sheet.identity.xp < xpNeeded && (milestone.level ?? 0) >= n
                ? t('levelUp.milestoneOk', { level: n })
                : sheet.identity.xp >= xpNeeded
                  ? t('levelUp.xpOk', { xp: sheet.identity.xp.toLocaleString('de'), need: xpNeeded.toLocaleString('de') })
                  : t('levelUp.xpMissing', { xp: sheet.identity.xp.toLocaleString('de'), need: xpNeeded.toLocaleString('de') })}
            </span>
          </div>
          {!cls && <Alert kind="info">{t('levelUp.noClass')}</Alert>}

          <Section title={t('levelUp.hp')}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('levelUp.hp')}>
              <label className="chip-check">
                <input type="radio" name="lu-hp" checked={hpMode === 'average'} onChange={() => setHpMode('average')} />
                {t('levelUp.average', { avg: averageHp(die), con: formatModifier(con), total: avg })}
              </label>
              <label className="chip-check">
                <input type="radio" name="lu-hp" checked={hpMode === 'roll'} onChange={() => setHpMode('roll')} />
                {t('levelUp.roll', { die, con: formatModifier(con) })}
                {rolled !== null && hpMode === 'roll' && <strong>= {rolled + con}</strong>}
              </label>
              <label className="chip-check">
                <input type="radio" name="lu-hp" checked={hpMode === 'manual'} onChange={() => setHpMode('manual')} />
                {t('levelUp.manual')}
              </label>
            </div>
            {hpMode === 'roll' && (
              <button type="button" className="btn-secondary !py-1" onClick={() => setRolled(1 + Math.floor(Math.random() * die))}>
                <Dices className="h-4 w-4" />
                {rolled === null ? t('levelUp.rollButton', { die }) : t('levelUp.rollAgain', { value: rolled })}
              </button>
            )}
            {hpMode === 'manual' && (
              <input
                className="input !w-28"
                inputMode="numeric"
                value={manualHp}
                onChange={(e) => setManualHp(e.target.value.replace(/\D/g, '').slice(0, 3))}
                aria-label={t('levelUp.manual')}
                placeholder="+TP"
              />
            )}
            <p>
              {t('levelUp.hpResult', { from: sheet.combat.hpMax, to: sheet.combat.hpMax + Math.max(1, hpGain) + conBonus, dice: `${n}W${die}` })}
              {conBonus > 0 && <span className="text-sm text-parchment-700 dark:text-parchment-400"> {t('levelUp.conBonus', { n: conBonus })}</span>}
            </p>
          </Section>

          {choosesSubclass && cls && (
            <Section title={t('levelUp.chooseSubclass', { title: cls.data.subclassTitle || t('wiki.class.subclasses') })}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {subclassOptions.map((s) => (
                  <label key={s.name} className="chip-check chip-check-block">
                    <input type="radio" name="lu-sub" checked={subclass === s.name} onChange={() => setSubclass(s.name)} />
                    <span>
                      <strong>{s.name}</strong>
                      {s.description && <span className="block text-sm opacity-80">{s.description.replace(/[*_#]/g, '').slice(0, 140)}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </Section>
          )}

          {asi && (
            <Section title={t('levelUp.asi')}>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('levelUp.asi')}>
                {(['two', 'one', 'feat'] as AsiMode[]).map((m) => (
                  <label key={m} className="chip-check">
                    <input type="radio" name="lu-asi" checked={asiMode === m} onChange={() => setAsiMode(m)} />
                    {t(`levelUp.asiModes.${m}`)}
                  </label>
                ))}
              </div>
              {asiMode === 'feat' ? (
                <div className="max-w-md">
                  <input
                    className="input"
                    list="lu-feats"
                    value={feat}
                    maxLength={100}
                    onChange={(e) => setFeat(e.target.value)}
                    placeholder={t('levelUp.featPlaceholder')}
                    aria-label={t('levelUp.asiModes.feat')}
                  />
                  <datalist id="lu-feats">
                    {feats.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
              ) : (
                <div className="grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                  <select className="input" value={asiA} onChange={(e) => setAsiA(e.target.value as Ability)} aria-label={asiMode === 'one' ? '+2' : '+1 (1)'}>
                    <option value="">{asiMode === 'one' ? '+2 …' : '+1 …'}</option>
                    {abilityOptions(asiMode === 'two' ? asiB : '')}
                  </select>
                  {asiMode === 'two' && (
                    <select className="input" value={asiB} onChange={(e) => setAsiB(e.target.value as Ability)} aria-label="+1 (2)">
                      <option value="">+1 …</option>
                      {abilityOptions(asiA)}
                    </select>
                  )}
                </div>
              )}
            </Section>
          )}

          <Section title={t('levelUp.features')}>
            {features.length === 0 ? (
              <p className="text-sm italic text-parchment-700 dark:text-parchment-400">
                {cls ? (choosesSubclass && !subclass ? t('levelUp.chooseFirst') : t('levelUp.noFeatures')) : t('levelUp.noClassFeatures')}
              </p>
            ) : (
              <div className="space-y-2">
                {features.map((f, i) => (
                  <div key={i} className="rounded-lg border border-parchment-400/70 bg-parchment-200/30 px-3 py-2 dark:border-night-700 dark:bg-night-900/40">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <strong className="font-display">{f.name}</strong>
                      <span className="ml-auto text-xs text-parchment-700 dark:text-parchment-400">{t('levelUp.featureFrom', { from: f.from, level: f.level })}</span>
                    </div>
                    <Markdown links className="!text-sm">
                      {f.text}
                    </Markdown>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={t('levelUp.other')}>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ...slotChanges.map((s) => [t('levelUp.slots', { grade: s.grade }), String(s.from), String(s.to)]),
                  [t('sheet.proficiencyBonus'), `+${proficiencyBonusForLevel(level)}`, `+${proficiencyBonusForLevel(n)}`],
                  ...Object.entries(increase).map(([a, v]) => [t(`sheet.ability.${a}`), String(sheet.abilities[a as Ability]), String(Math.min(20, sheet.abilities[a as Ability] + (v ?? 0)))]),
                  [t('levelUp.nextLevel'), n < 20 ? `${xpForLevel(n).toLocaleString('de')} EP` : '–', n < 20 ? `${xpForLevel(n + 1).toLocaleString('de')} EP` : t('sheet.xpMaxLevel')],
                ].map(([label, from, to]) => (
                  <tr key={label} className="border-t border-parchment-300/70 dark:border-night-700">
                    <td className="py-1.5 font-semibold">{label}</td>
                    <td className="py-1.5 text-center tabular-nums text-parchment-700 dark:text-parchment-400">{from}</td>
                    <td className="py-1.5 text-center">→</td>
                    <td className={`py-1.5 text-center font-bold tabular-nums ${from !== to ? 'text-emerald-800 dark:text-emerald-300' : ''}`}>{to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <p className="text-xs text-parchment-700 dark:text-parchment-400">{t('levelUp.hint')}</p>
          <div className="flex justify-between gap-2 border-t border-parchment-300/70 pt-4 dark:border-night-700">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn-primary" onClick={apply} disabled={!ok}>
              <ArrowBigUpDash className="h-4 w-4" />
              {t('levelUp.apply', { n })}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
