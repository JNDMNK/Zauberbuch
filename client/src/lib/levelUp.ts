import { XP_THRESHOLDS, abilityModifier, type Ability, type CharacterSheet, type SpellClass, type WikiLevelFeature } from '@zauberbuch/shared';
import type { ClassEntry } from './characterWizard';

/** Zauberplätze eines Vollzauberers je Stufe (Index = Stufe − 1, Werte = Plätze des 1. bis 9. Grades) nach SRD */
const FULL_CASTER: number[][] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
/** Paktmagie des Hexenmeisters: [Anzahl, Grad] je Stufe */
const PACT: [number, number][] = [
  [1, 1],
  [2, 1],
  [2, 2],
  [2, 2],
  [2, 3],
  [2, 3],
  [2, 4],
  [2, 4],
  [2, 5],
  [2, 5],
  [3, 5],
  [3, 5],
  [3, 5],
  [3, 5],
  [3, 5],
  [3, 5],
  [4, 5],
  [4, 5],
  [4, 5],
  [4, 5],
];

/** Gesamtzahl der Zauberplätze je Grad (9 Einträge) für eine Klasse auf einer Stufe */
export function spellSlots(spellClass: SpellClass, level: number): number[] {
  const out = Array.from({ length: 9 }, () => 0);
  const l = Math.max(1, Math.min(20, level));
  if (spellClass === 'warlock') {
    const [n, grade] = PACT[l - 1];
    out[grade - 1] = n;
    return out;
  }
  // Halbzauberer: Paladin/Waldläufer ab Stufe 2 (aufgerundet), Artificer schon ab Stufe 1
  const casterLevel = spellClass === 'paladin' || spellClass === 'ranger' ? (l < 2 ? 0 : Math.ceil(l / 2)) : spellClass === 'artificer' ? Math.ceil(l / 2) : l;
  if (casterLevel > 0) FULL_CASTER[casterLevel - 1].forEach((n, i) => (out[i] = n));
  return out;
}

const lower = (s: string) => s.toLocaleLowerCase('de');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const contains = (text: string, name: string) => new RegExp(`(?<![\\p{L}])${escapeRe(lower(name))}(?![\\p{L}])`, 'u').test(lower(text));

/** Klasse (und Unterklasse) aus „Klasse & Stufe“ des Bogens, z. B. „Kleriker (Domäne des Lebens) 3“ */
export function detectClass(classLevel: string, classes: ClassEntry[]) {
  const cls = [...classes].sort((a, b) => b.name.length - a.name.length).find((c) => contains(classLevel, c.name)) ?? null;
  const subclass = cls?.data.subclasses.find((s) => contains(classLevel, s.name)) ?? null;
  return { cls, subclass };
}

export const isAsi = (f: WikiLevelFeature) => /attributswerterhöhung|ability score improvement/i.test(f.name);

/** Durchschnittlicher Trefferpunktezuwachs (aufgerundet) eines Trefferwürfels */
export const averageHp = (die: number) => Math.floor(die / 2) + 1;

/** Trefferwürfel aus der Klasse oder aus „Trefferwürfel gesamt“ des Bogens („3W8“) */
export function hitDie(sheet: CharacterSheet, cls: ClassEntry | null): number {
  const fromClass = Number.parseInt((cls?.data.hitDie ?? '').replace(/\D/g, ''), 10);
  if (fromClass) return fromClass;
  const m = /\d*\s*[WwDd](\d+)/.exec(sheet.combat.hitDiceTotal);
  return m ? Number(m[1]) : 8;
}

/** „3W8“ → „4W8“; andere Schreibweisen werden durch die neue Stufe ersetzt */
function bumpDice(value: string, die: number, total: number, increment: boolean): string {
  const m = /^\s*(\d+)\s*[WwDd](\d+)\s*$/.exec(value);
  if (!m) return `${total}W${die}`;
  return `${increment ? Math.min(total, Number(m[1]) + 1) : total}W${m[2]}`;
}

export interface LevelUpPlan {
  newLevel: number;
  hpGain: number;
  /** zusätzliche TP durch höheren KON-Modifikator (rückwirkend für alle Stufen) */
  conBonus: number;
  features: { name: string; text: string; from: string }[];
  subclassName: string | null;
  abilityIncrease: Partial<Record<Ability, number>>;
  feat: string | null;
  slots: number[] | null;
  die: number;
}

/** Wendet einen Stufenaufstieg auf den Bogen an und liefert den neuen Bogen */
export function applyLevelUp(sheet: CharacterSheet, cls: ClassEntry | null, plan: LevelUpPlan): CharacterSheet {
  const s: CharacterSheet = structuredClone(sheet);
  const n = plan.newLevel;
  s.identity.level = n;
  const cl = s.identity.classLevel.trim();
  // Unterklasse vor der Stufenzahl ergänzen: „Magier 1“ → „Magier (Schule der Hervorrufung) 2“
  const base = cl.replace(/\s*\d+\s*$/, '');
  const withSub = plan.subclassName && cls && !cl.includes(plan.subclassName) ? `${base} (${plan.subclassName})` : base;
  s.identity.classLevel = `${withSub} ${n}`.trim().slice(0, 100);

  for (const [a, v] of Object.entries(plan.abilityIncrease)) s.abilities[a as Ability] = Math.min(20, s.abilities[a as Ability] + (v ?? 0));
  const gain = Math.max(1, plan.hpGain) + plan.conBonus;
  s.combat.hpMax = Math.min(9999, s.combat.hpMax + gain);
  s.combat.hpCurrent = Math.min(s.combat.hpMax, s.combat.hpCurrent + gain);
  s.combat.hitDiceTotal = bumpDice(s.combat.hitDiceTotal, plan.die, n, false);
  s.combat.hitDiceCurrent = s.combat.hitDiceCurrent.trim() ? bumpDice(s.combat.hitDiceCurrent, plan.die, n, true) : `${n}W${plan.die}`;

  if (plan.features.length) {
    const lines = plan.features.map((f) => `Stufe ${n} – ${f.name.replace(/\*/g, '')}: ${f.text.replace(/\*\*?/g, '')}`);
    s.features.classFeatures = [s.features.classFeatures.trim(), ...lines].filter(Boolean).join('\n\n').slice(0, 20000);
  }
  if (plan.feat) s.features.moreFeatures = [s.features.moreFeatures.trim(), `Talent (Stufe ${n}): ${plan.feat}`].filter(Boolean).join('\n\n').slice(0, 20000);
  if (plan.slots) s.spellcasting.slots = s.spellcasting.slots.map((slot, i) => ({ total: plan.slots![i], used: Math.min(slot.used, plan.slots![i]) }));
  return s;
}

/** KON-Modifikator nach der Erhöhung minus vorher, mal neue Stufe (rückwirkende TP) */
export function conBonusFor(sheet: CharacterSheet, increase: Partial<Record<Ability, number>>, newLevel: number) {
  const before = abilityModifier(sheet.abilities.con);
  const after = abilityModifier(Math.min(20, sheet.abilities.con + (increase.con ?? 0)));
  return (after - before) * newLevel;
}

export const xpForLevel = (level: number) => XP_THRESHOLDS[Math.max(1, Math.min(20, level)) - 1];
