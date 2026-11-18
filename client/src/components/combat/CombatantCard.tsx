import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Handshake, Heart, Minus, Pencil, Plus, ScrollText, Shield, Skull, Tags, Trash2, UserRound, X } from 'lucide-react';
import { CONDITIONS, type CombatantDto, type CombatantUpdate, type Condition, type HealthStatus } from '@zauberbuch/shared';

const BAR_CLS: Record<HealthStatus, string> = {
  unharmed: 'bg-emerald-600',
  injured: 'bg-amber-500',
  bloodied: 'bg-orange-600',
  down: 'bg-red-700',
};
const STATUS_CLS: Record<HealthStatus, string> = {
  unharmed: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  injured: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  bloodied: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  down: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
};

interface Props {
  c: CombatantDto;
  active: boolean;
  manage: boolean;
  onUpdate: (data: CombatantUpdate) => Promise<void>;
  onHp: (delta: number) => Promise<void>;
  onRemove: () => void;
}

export function CombatantCard({ c, active, manage, onUpdate, onHp, onRemove }: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [condOpen, setCondOpen] = useState(false);
  // Monster und verbündete NSCs pflegt der DM selbst; Spielercharaktere kommen aus dem Bogen
  const isMonster = c.kind !== 'character';
  const isAlly = c.kind === 'ally';
  const down = c.status === 'down';
  // Gegner gelten bei 0 LP als besiegt, Spieler und Verbündete als bewusstlos
  const statusLabel = down && !(isMonster && !isAlly) ? t('combat.status.unconscious') : t(`combat.status.${c.status}`);

  return (
    <article
      className={`parchment relative flex flex-col gap-3 p-4 transition ${isAlly ? 'border-l-4 !border-l-sky-600 dark:!border-l-sky-400' : ''} ${active ? 'ring-4 ring-red-700/70 dark:ring-red-500/70' : ''} ${down ? 'opacity-70' : ''}`}
      aria-current={active ? 'step' : undefined}
      aria-label={c.name}
    >
      {active && (
        <span className="absolute -top-3 left-4 rounded-full bg-red-700 px-2.5 py-0.5 font-display text-xs font-bold uppercase tracking-wider text-white shadow">{t('combat.yourTurn')}</span>
      )}
      <div className="flex items-start gap-3">
        <InitiativeBadge value={c.initiative} manage={manage} onChange={(initiative) => onUpdate({ initiative })} />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 break-words font-display text-lg font-bold leading-tight">
            {isAlly ? (
              <Handshake className="h-4 w-4 shrink-0 text-sky-800 dark:text-sky-300" aria-label={t('combat.ally')} />
            ) : isMonster ? (
              <Skull className="h-4 w-4 shrink-0 text-red-800 dark:text-red-400" aria-label={t('combat.monster')} />
            ) : (
              <UserRound className="h-4 w-4 shrink-0 text-emerald-800 dark:text-emerald-400" aria-label={t('combat.player')} />
            )}
            {c.name}
          </h3>
          {isAlly && <span className="badge mt-0.5 bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200">{t('combat.allyBadge')}</span>}
          {c.owner && <p className="text-xs text-parchment-700 dark:text-parchment-400">{t('combat.playedBy', { name: c.owner })}</p>}
          {manage && isMonster && c.hideStats && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-parchment-700 dark:text-parchment-400">
              <EyeOff className="h-3.5 w-3.5" />
              {t('combat.hiddenForPlayers')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center" title={t('combat.ac')}>
          <div className="relative flex h-12 w-11 items-center justify-center">
            <Shield className="absolute inset-0 h-12 w-11 text-parchment-600 dark:text-parchment-500" strokeWidth={1.5} />
            <span className="relative pt-0.5 font-display text-sm font-bold">{c.ac ?? '?'}</span>
          </div>
          <span className="sheet-label">{t('combat.acShort')}</span>
        </div>
      </div>

      {/* Lebenspunkte */}
      {c.hpCurrent !== null && c.hpMax !== null ? (
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="sheet-label">{t('combat.hp')}</span>
            <span className="font-semibold tabular-nums">
              {c.hpCurrent} / {c.hpMax}
              {c.hpTemp ? <span className="ml-1 text-sky-700 dark:text-sky-300">(+{c.hpTemp})</span> : null}
            </span>
          </div>
          <div
            className="mt-1 h-3 overflow-hidden rounded-full bg-parchment-200 dark:bg-night-700"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={c.hpMax}
            aria-valuenow={c.hpCurrent}
            aria-label={t('combat.hp')}
          >
            <div className={`h-full rounded-full transition-all ${BAR_CLS[c.status]}`} style={{ width: `${c.hpMax > 0 ? Math.max(0, Math.min(100, (c.hpCurrent / c.hpMax) * 100)) : 0}%` }} />
          </div>
          {down && <p className="mt-1 text-xs font-semibold text-red-800 dark:text-red-300">{statusLabel}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span className="sheet-label">{t('combat.condition')}</span>
          <span className={`badge ${STATUS_CLS[c.status]}`}>{statusLabel}</span>
        </div>
      )}

      {manage && isMonster && !editing && <HpControls onHp={onHp} />}
      {manage && isMonster && editing && <MonsterEdit c={c} onCancel={() => setEditing(false)} onSave={async (d) => (await onUpdate(d), setEditing(false))} />}

      {/* Zustände */}
      {(c.conditions.length > 0 || manage) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {c.conditions.map((cond) => (
            <span key={cond} className="badge bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200">
              {t(`combat.conditions.${cond}`)}
              {manage && (
                <button type="button" className="ml-1" onClick={() => onUpdate({ conditions: c.conditions.filter((x) => x !== cond) })} aria-label={`${t('combat.removeCondition')}: ${t(`combat.conditions.${cond}`)}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {manage && (
            <div className="relative">
              <button type="button" className="btn-ghost !px-2 !py-0.5 text-xs" onClick={() => setCondOpen((o) => !o)} aria-expanded={condOpen}>
                <Tags className="h-3.5 w-3.5" />
                {t('combat.conditionsButton')}
              </button>
              {condOpen && <ConditionPicker selected={c.conditions} onClose={() => setCondOpen(false)} onChange={(conditions) => onUpdate({ conditions })} />}
            </div>
          )}
        </div>
      )}

      {manage && (
        <div className="mt-auto flex items-center justify-end gap-1 border-t border-parchment-300/70 pt-2 dark:border-night-700">
          {c.characterId && (
            <Link to={`/characters/${c.characterId}`} className="btn-icon mr-auto" title={t('combat.openSheet')} aria-label={t('combat.openSheet')}>
              <ScrollText className="h-4 w-4" />
            </Link>
          )}
          {isMonster && (
            <>
              <button
                type="button"
                className="btn-icon"
                onClick={() => onUpdate({ hideStats: !c.hideStats })}
                title={c.hideStats ? t('combat.showForPlayers') : t('combat.hideForPlayers')}
                aria-label={c.hideStats ? t('combat.showForPlayers') : t('combat.hideForPlayers')}
                aria-pressed={!c.hideStats}
              >
                {c.hideStats ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button type="button" className="btn-icon" onClick={() => setEditing(true)} title={t('common.edit')} aria-label={t('common.edit')}>
                <Pencil className="h-4 w-4" />
              </button>
            </>
          )}
          <button type="button" className="btn-icon text-red-700 dark:text-red-400" onClick={onRemove} title={t('combat.remove')} aria-label={t('combat.remove')}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
      {!manage && c.characterId && (
        <Link to={`/characters/${c.characterId}`} className="mt-auto inline-flex items-center gap-1 text-sm underline">
          <ScrollText className="h-4 w-4" />
          {t('combat.openSheet')}
        </Link>
      )}
    </article>
  );
}

/** Initiative-Kreis; für den DM direkt editierbar */
function InitiativeBadge({ value, manage, onChange }: { value: number | null; manage: boolean; onChange: (v: number | null) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(value === null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === null ? '' : String(value));
  }, [value]);
  const cls = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-parchment-700 bg-white/70 font-display text-lg font-bold dark:border-parchment-400 dark:bg-night-950/50';
  if (!manage) {
    return (
      <div className={cls} title={t('combat.initiative')} aria-label={`${t('combat.initiative')}: ${value ?? '–'}`}>
        {value ?? '–'}
      </div>
    );
  }
  const commit = () => {
    focused.current = false;
    const trimmed = text.trim();
    const n = trimmed === '' ? null : Number(trimmed);
    if (n !== null && (!Number.isInteger(n) || n < -20 || n > 99)) {
      setText(value === null ? '' : String(value));
      return;
    }
    if (n !== value) onChange(n);
  };
  return (
    <input
      className={`${cls} text-center outline-none focus:ring-2 focus:ring-parchment-500/50`}
      inputMode="numeric"
      value={text}
      placeholder="–"
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onChange={(e) => setText(e.target.value.replace(/[^\d-]/g, '').slice(0, 3))}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      aria-label={t('combat.initiative')}
      title={t('combat.initiative')}
    />
  );
}

/** Schaden/Heilung für Monster */
function HpControls({ onHp }: { onHp: (delta: number) => Promise<void> }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const valid = amount !== '' && Number.isInteger(n) && n > 0;
  const apply = async (sign: 1 | -1) => {
    if (!valid) return;
    setBusy(true);
    try {
      await onHp(sign * n);
      setAmount('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void apply(-1);
      }}
    >
      <input
        className="input !w-20 !py-1 text-center"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder={t('combat.amount')}
        aria-label={t('combat.amount')}
      />
      <button type="submit" className="btn-secondary !px-2 !py-1 text-sm !text-red-800 dark:!text-red-300" disabled={!valid || busy} title={t('combat.damage')}>
        <Minus className="h-4 w-4" />
        {t('combat.damage')}
      </button>
      <button type="button" className="btn-secondary !px-2 !py-1 text-sm !text-emerald-800 dark:!text-emerald-300" disabled={!valid || busy} onClick={() => apply(1)} title={t('combat.heal')}>
        <Heart className="h-4 w-4" />
        {t('combat.heal')}
      </button>
    </form>
  );
}

function MonsterEdit({ c, onSave, onCancel }: { c: CombatantDto; onSave: (d: CombatantUpdate) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(c.name);
  const [ac, setAc] = useState(c.ac ?? '');
  const [hpMax, setHpMax] = useState(String(c.hpMax ?? 0));
  const [hpCurrent, setHpCurrent] = useState(String(c.hpCurrent ?? 0));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void onSave({ name: name.trim() || c.name, ac: ac === '' ? null : Math.min(50, Number(ac)), hpMax: Math.min(9999, Number(hpMax) || 0), hpCurrent: Math.min(9999, Number(hpCurrent) || 0) });
  };
  const num = (v: string) => v.replace(/\D/g, '').slice(0, 4);
  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg bg-parchment-100/70 p-2 dark:bg-night-900/60">
      <input className="input !py-1" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label={t('combat.monsterName')} />
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs">
          {t('combat.acShort')}
          <input className="input !py-1 text-center" inputMode="numeric" value={ac} onChange={(e) => setAc(num(e.target.value))} />
        </label>
        <label className="text-xs">
          {t('combat.hpCurrent')}
          <input className="input !py-1 text-center" inputMode="numeric" value={hpCurrent} onChange={(e) => setHpCurrent(num(e.target.value))} />
        </label>
        <label className="text-xs">
          {t('combat.hpMax')}
          <input className="input !py-1 text-center" inputMode="numeric" value={hpMax} onChange={(e) => setHpMax(num(e.target.value))} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary !py-1 text-sm" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="btn-primary !py-1 text-sm">
          {t('common.save')}
        </button>
      </div>
    </form>
  );
}

function ConditionPicker({ selected, onChange, onClose }: { selected: Condition[]; onChange: (c: Condition[]) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  // Sofort aktualisierte Auswahl, damit schnelle Klicks sich nicht gegenseitig überschreiben
  const [sel, setSel] = useState<Condition[]>(selected);
  useEffect(() => setSel(selected), [selected]);
  const toggle = (cond: Condition, on: boolean) => {
    const next = on ? [...sel.filter((x) => x !== cond), cond] : sel.filter((x) => x !== cond);
    setSel(next);
    onChange(next);
  };
  useEffect(() => {
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="parchment absolute bottom-full left-0 z-30 mb-1 grid w-64 grid-cols-2 gap-x-3 gap-y-1 p-3 text-sm">
      {CONDITIONS.map((cond) => (
        <label key={cond} className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            className="h-4 w-4 accent-parchment-800 dark:accent-parchment-300"
            checked={sel.includes(cond)}
            onChange={(e) => toggle(cond, e.target.checked)}
          />
          {t(`combat.conditions.${cond}`)}
        </label>
      ))}
      <button type="button" className="btn-ghost col-span-2 mt-1 justify-center !py-1 text-xs" onClick={onClose}>
        <Plus className="h-3.5 w-3.5 rotate-45" />
        {t('common.close')}
      </button>
    </div>
  );
}
