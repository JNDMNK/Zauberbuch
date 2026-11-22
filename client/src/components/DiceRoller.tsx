import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Dices, History, Minus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Modal } from './Modal';

/** Würfel in D&D */
const DICE = [4, 6, 8, 10, 12, 20, 100] as const;
type Die = (typeof DICE)[number];
type Mode = 'normal' | 'advantage' | 'disadvantage';

interface RolledDie {
  sides: Die;
  value: number;
  /** bei Vorteil/Nachteil: der verworfene Wurf */
  dropped?: number;
}
interface RollResult {
  id: number;
  expression: string;
  dice: RolledDie[];
  modifier: number;
  total: number;
  mode: Mode;
  at: number;
}

const HISTORY_KEY = 'zauberbuch.diceHistory';
const MAX_HISTORY = 20;

/** Fairer Zufallswert 1..sides (crypto, ohne Modulo-Verzerrung) */
function rollDie(sides: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return (buf[0] % sides) + 1;
}

function loadHistory(): RollResult[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as RollResult[]) : [];
    return Array.isArray(list) ? list.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}
function saveHistory(list: RollResult[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  } catch {
    /* privater Modus o. Ä. – Verlauf nur für diese Sitzung */
  }
}

/** Einfache Würfelform je Seitenzahl (Umriss) */
function DieShape({ sides, className = '' }: { sides: Die; className?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinejoin: 'round' as const };
  const shape =
    sides === 4 ? (
      <path d="M12 2.5 22 20H2z" {...common} />
    ) : sides === 6 ? (
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" {...common} />
    ) : sides === 8 ? (
      <path d="M12 2 21 12 12 22 3 12z" {...common} />
    ) : sides === 10 || sides === 100 ? (
      <path d="M12 2 21 10 12 22 3 10z M3 10l9 3.5 9-3.5" {...common} />
    ) : sides === 12 ? (
      <path d="M12 2 20.5 8.2 17.3 18.5H6.7L3.5 8.2z" {...common} />
    ) : (
      <path d="M12 2 20.7 7v10L12 22 3.3 17V7z M12 2v6 M3.3 7 12 8l8.7-1 M12 8l-5 9h10z" {...common} />
    );
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {shape}
    </svg>
  );
}

/**
 * Würfel-Knopf in der Kopfzeile: öffnet den Würfelbecher mit W4, W6, W8, W10, W12, W20 und W100, Anzahl je Würfel,
 * Modifikator, Vorteil/Nachteil für W20 und einem Verlauf der letzten Würfe (nur in diesem Browser gespeichert).
 */
export function DiceRoller() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-icon" onClick={() => setOpen(true)} aria-label={t('dice.open')} title={t('dice.open')}>
        <Dices className="h-5 w-5" />
      </button>
      {/* Portal: die Kopfzeile (backdrop-blur) würde fixierte Dialoge sonst auf ihre Höhe begrenzen */}
      {open && createPortal(<DiceDialog onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function DiceDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const W = t('dice.prefix');
  const [pool, setPool] = useState<Record<Die, number>>(() => Object.fromEntries(DICE.map((d) => [d, d === 20 ? 1 : 0])) as Record<Die, number>);
  const [modifier, setModifier] = useState(0);
  const [mode, setMode] = useState<Mode>('normal');
  const [result, setResult] = useState<RollResult | null>(null);
  const [rolling, setRolling] = useState<RolledDie[] | null>(null);
  const [history, setHistory] = useState<RollResult[]>(loadHistory);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && window.clearInterval(timer.current)), []);

  const count = DICE.reduce((n, d) => n + pool[d], 0);
  const describe = (p: Record<Die, number>, mod: number, m: Mode) => {
    const parts = DICE.filter((d) => p[d] > 0).map((d) => `${p[d]}${W}${d}`);
    let text = parts.join(' + ');
    if (mod) text += ` ${mod > 0 ? '+' : '−'} ${Math.abs(mod)}`;
    if (m !== 'normal' && p[20] > 0) text += ` (${t(`dice.${m}`)})`;
    return text || '–';
  };
  const add = (d: Die, delta: number) => setPool((p) => ({ ...p, [d]: Math.max(0, Math.min(20, p[d] + delta)) }));
  const clear = () => {
    setPool(Object.fromEntries(DICE.map((d) => [d, 0])) as Record<Die, number>);
    setModifier(0);
    setMode('normal');
  };

  const roll = (p = pool, mod = modifier, m = mode) => {
    const n = DICE.reduce((s, d) => s + p[d], 0);
    if (n === 0 || rolling) return;
    const dice: RolledDie[] = [];
    for (const d of DICE)
      for (let i = 0; i < p[d]; i++) {
        if (d === 20 && m !== 'normal') {
          const a = rollDie(20);
          const b = rollDie(20);
          const keep = m === 'advantage' ? Math.max(a, b) : Math.min(a, b);
          dice.push({ sides: 20, value: keep, dropped: keep === a ? b : a });
        } else dice.push({ sides: d, value: rollDie(d) });
      }
    const final: RollResult = { id: Date.now(), expression: describe(p, mod, m), dice, modifier: mod, total: dice.reduce((s, x) => s + x.value, 0) + mod, mode: m, at: Date.now() };
    // kurze „Roll“-Animation, dann Ergebnis (bei reduzierter Bewegung sofort)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      setRolling(null);
      setResult(final);
      setHistory((h) => {
        const next = [final, ...h].slice(0, MAX_HISTORY);
        saveHistory(next);
        return next;
      });
    };
    if (reduced) return finish();
    let ticks = 0;
    setRolling(dice.map((x) => ({ sides: x.sides, value: rollDie(x.sides) })));
    timer.current = window.setInterval(() => {
      ticks++;
      setRolling(dice.map((x) => ({ sides: x.sides, value: rollDie(x.sides) })));
      if (ticks >= 6) {
        window.clearInterval(timer.current!);
        timer.current = null;
        finish();
      }
    }, 60);
  };

  /** Wurf aus dem Verlauf wiederholen */
  const repeat = (r: RollResult) => {
    const p = Object.fromEntries(DICE.map((d) => [d, r.dice.filter((x) => x.sides === d).length])) as Record<Die, number>;
    setPool(p);
    setModifier(r.modifier);
    setMode(r.mode);
    roll(p, r.modifier, r.mode);
  };

  const shown = rolling ?? result?.dice ?? [];
  return (
    <Modal
      open
      onClose={onClose}
      size="max-w-lg"
      title={
        <span className="flex items-center gap-2">
          <Dices className="h-5 w-5" />
          {t('dice.title')}
        </span>
      }
    >
      <div className="space-y-4" onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON' && roll()}>
        {/* Würfel wählen */}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {DICE.map((d) => (
            <div key={d} className="relative">
              <button
                type="button"
                onClick={() => add(d, 1)}
                className={`flex w-full flex-col items-center rounded-lg border px-1 py-2 transition ${
                  pool[d] > 0
                    ? 'border-parchment-800 bg-parchment-200 dark:border-parchment-300 dark:bg-night-700'
                    : 'border-parchment-400 bg-parchment-50 hover:border-parchment-700 dark:border-night-700 dark:bg-night-800'
                }`}
                aria-label={t('dice.add', { die: `${W}${d}` })}
              >
                <DieShape sides={d} className="h-8 w-8 text-parchment-800 dark:text-parchment-200" />
                <span className="font-display text-sm font-bold">
                  {W}
                  {d}
                </span>
              </button>
              {pool[d] > 0 && (
                <>
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-parchment-800 px-1 text-xs font-bold text-parchment-50 dark:bg-parchment-300 dark:text-night-900">
                    {pool[d]}
                  </span>
                  <button
                    type="button"
                    onClick={() => add(d, -1)}
                    className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-parchment-500 bg-parchment-50 dark:border-night-700 dark:bg-night-800"
                    aria-label={t('dice.remove', { die: `${W}${d}` })}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Modifikator, Vorteil/Nachteil */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold">{t('dice.modifier')}</span>
            <button type="button" className="btn-icon !p-1" onClick={() => setModifier((m) => Math.max(-30, m - 1))} aria-label={t('dice.modifierMinus')}>
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center font-bold tabular-nums">{modifier > 0 ? `+${modifier}` : modifier}</span>
            <button type="button" className="btn-icon !p-1" onClick={() => setModifier((m) => Math.min(30, m + 1))} aria-label={t('dice.modifierPlus')}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('dice.mode')}>
            {(['normal', 'advantage', 'disadvantage'] as Mode[]).map((m) => (
              <label key={m} className="chip-check !py-0.5">
                <input type="radio" name="dice-mode" checked={mode === m} disabled={pool[20] === 0 && m !== 'normal'} onChange={() => setMode(m)} />
                {t(`dice.${m}`)}
              </label>
            ))}
          </div>
        </div>

        {/* Ausdruck + Würfeln */}
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate rounded-md bg-parchment-200/60 px-3 py-2 font-display font-bold dark:bg-night-900/60" aria-live="polite">
            {describe(pool, modifier, mode)}
          </p>
          <button type="button" className="btn-icon" onClick={clear} title={t('dice.clear')} aria-label={t('dice.clear')}>
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
        <button type="button" className="btn-primary w-full !py-3 text-lg" onClick={() => roll()} disabled={count === 0 || !!rolling}>
          <Dices className={`h-5 w-5 ${rolling ? 'animate-spin' : ''}`} />
          {t('dice.roll')}
        </button>

        {/* Ergebnis */}
        {(rolling || result) && (
          <div className="rounded-xl border border-parchment-400/70 bg-parchment-50 p-4 text-center dark:border-night-700 dark:bg-night-800" aria-live="polite">
            <div className={`font-display text-5xl font-bold tabular-nums ${rolling ? 'opacity-40' : ''}`}>{rolling ? '…' : result!.total}</div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {shown.map((x, i) => {
                const crit = !rolling && x.sides === 20 && x.value === 20;
                const fail = !rolling && x.sides === 20 && x.value === 1;
                return (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm tabular-nums ${
                      crit
                        ? 'border-emerald-600 bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                        : fail
                          ? 'border-red-600 bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
                          : 'border-parchment-400 dark:border-night-700'
                    }`}
                    title={`${W}${x.sides}`}
                  >
                    <DieShape sides={x.sides} className="h-4 w-4 opacity-70" />
                    <strong>{x.value}</strong>
                    {x.dropped !== undefined && !rolling && <s className="opacity-50">{x.dropped}</s>}
                  </span>
                );
              })}
              {!rolling && result && result.modifier !== 0 && (
                <span className="inline-flex items-center rounded-md border border-dashed border-parchment-400 px-2 py-1 text-sm tabular-nums dark:border-night-700">
                  {result.modifier > 0 ? `+${result.modifier}` : `−${Math.abs(result.modifier)}`}
                </span>
              )}
            </div>
            {!rolling && result?.dice.some((x) => x.sides === 20 && x.value === 20) && <p className="mt-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">{t('dice.natural20')}</p>}
            {!rolling && result?.dice.some((x) => x.sides === 20 && x.value === 1) && <p className="mt-2 text-sm font-semibold text-red-800 dark:text-red-300">{t('dice.natural1')}</p>}
          </div>
        )}

        {/* Verlauf */}
        {history.length > 0 && (
          <section className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="flex flex-1 items-center gap-1.5 font-display font-bold">
                <History className="h-4 w-4" />
                {t('dice.history')}
              </h3>
              <button type="button" className="btn-icon !p-1" onClick={() => (setHistory([]), saveHistory([]))} title={t('dice.clearHistory')} aria-label={t('dice.clearHistory')}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-48 divide-y divide-parchment-300/70 overflow-y-auto text-sm dark:divide-night-700">
              {history.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 py-1.5 text-left hover:bg-parchment-200/50 dark:hover:bg-night-700/50"
                    onClick={() => repeat(r)}
                    title={t('dice.repeat')}
                  >
                    <span className="w-10 shrink-0 text-right font-display text-lg font-bold tabular-nums">{r.total}</span>
                    <span className="min-w-0 flex-1 truncate">{r.expression}</span>
                    <span className="shrink-0 text-xs text-parchment-700 dark:text-parchment-400">{new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}
