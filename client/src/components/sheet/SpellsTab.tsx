import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookHeart, ExternalLink, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { ABILITIES, formatModifier, spellAttackBonus, spellSaveDc, type SheetSpell, type SpellDto } from '@zauberbuch/shared';
import { api, type SpellNameDto } from '../../lib/api';
import { asLocale, resolveText } from '../../lib/spellText';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { useSheet } from './SheetContext';
import { Computed, NF, TF } from './fields';

function useSpellNames() {
  const [names, setNames] = useState<SpellNameDto[]>([]);
  // Bogen einer Geschichte mit eingeschränkten Quellen: nur deren Zauber vorschlagen
  const { storyId, sources } = useSheet();
  const story = sources ? storyId : null;
  useEffect(() => {
    api
      .spellNames(story)
      .then((r) => setNames(r.spells))
      .catch(() => setNames([]));
  }, [story]);
  return names;
}

function displayName(n: SpellNameDto, lang: 'de' | 'en') {
  return (lang === 'en' ? (n.en ?? n.de) : (n.de ?? n.en)) ?? n.slug;
}

function SlotPips({ level }: { level: number }) {
  const { t } = useTranslation();
  const { sheet, set, readOnly } = useSheet();
  const slot = sheet.spellcasting.slots[level - 1];
  return (
    <div className="flex flex-wrap items-center gap-1" aria-label={t('sheet.slotsUsed')}>
      {Array.from({ length: slot.total }, (_, i) => {
        const used = i < slot.used;
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => set(['spellcasting', 'slots', level - 1, 'used'], used && i === slot.used - 1 ? i : i + 1)}
            className={`h-4 w-4 rounded-full border-2 border-parchment-700 dark:border-parchment-400 ${used ? 'bg-parchment-700 dark:bg-parchment-400' : ''}`}
            aria-pressed={used}
            aria-label={`${t('sheet.slotsUsed')} ${i + 1}`}
          />
        );
      })}
    </div>
  );
}

function SpellRow({ spell, index, names }: { spell: SheetSpell; index: number; names: SpellNameDto[] }) {
  const { t } = useTranslation();
  const { sheet, set, readOnly } = useSheet();
  const location = useLocation();
  const listId = `spell-names-${spell.level}`;
  const update = (patch: Partial<SheetSpell>) =>
    set(
      ['spellcasting', 'spells'],
      sheet.spellcasting.spells.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );

  const onName = (name: string) => {
    const lower = name.trim().toLowerCase();
    const match = names.find((n) => n.level === spell.level && [n.de, n.en].some((x) => x?.toLowerCase() === lower));
    update({ name, slug: match?.slug ?? null });
  };

  return (
    <li className="flex items-center gap-1.5">
      {spell.level > 0 ? (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => update({ prepared: !spell.prepared })}
          className={`h-4 w-4 shrink-0 rounded-full border-2 border-parchment-700 dark:border-parchment-400 ${spell.prepared ? 'bg-parchment-700 dark:bg-parchment-400' : ''}`}
          aria-pressed={spell.prepared}
          aria-label={`${spell.name}: ${t('sheet.prepared')}`}
          title={t('sheet.prepared')}
        />
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <input
        className="sheet-input !border-0 !border-b !rounded-none !bg-transparent !px-1 !py-0.5 text-sm"
        value={spell.name}
        list={listId}
        maxLength={150}
        onChange={(e) => onName(e.target.value)}
        aria-label={t('sheet.spellName')}
      />
      {spell.slug && (
        <Link to={`/spells/${spell.slug}`} state={{ background: location }} className="btn-icon h-7 w-7 shrink-0" title={t('sheet.openSpell')} aria-label={t('sheet.openSpell')}>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}
      {!readOnly && (
        <button
          type="button"
          className="btn-icon h-7 w-7 shrink-0 text-red-700 print:hidden dark:text-red-400"
          onClick={() =>
            set(
              ['spellcasting', 'spells'],
              sheet.spellcasting.spells.filter((_, i) => i !== index),
            )
          }
          title={t('sheet.remove')}
          aria-label={`${t('sheet.remove')}: ${spell.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

function LevelBox({ level, names, lang }: { level: number; names: SpellNameDto[]; lang: 'de' | 'en' }) {
  const { t } = useTranslation();
  const { sheet, set, readOnly } = useSheet();
  const spells = sheet.spellcasting.spells.map((s, i) => ({ s, i })).filter(({ s }) => s.level === level);
  const options = useMemo(() => names.filter((n) => n.level === level).map((n) => displayName(n, lang)), [names, level, lang]);
  return (
    <section className="sheet-box">
      <header className="mb-2 flex items-center gap-3 border-b border-parchment-400/60 pb-2 dark:border-night-700">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-parchment-700 font-display text-lg font-bold dark:border-parchment-400">{level}</span>
        {level === 0 ? (
          <span className="sheet-label !text-xs">{t('sheet.cantrips')}</span>
        ) : (
          <div className="flex min-w-0 flex-1 items-end gap-3">
            <NF path={['spellcasting', 'slots', level - 1, 'total']} label={t('sheet.slotsTotal')} min={0} max={20} className="w-20" inputClassName="!py-0.5" />
            <div className="min-w-0 flex-1">
              <SlotPips level={level} />
              <span className="sheet-label">{t('sheet.slotsUsed')}</span>
            </div>
          </div>
        )}
      </header>
      <datalist id={`spell-names-${level}`}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <ul className="space-y-1">
        {spells.map(({ s, i }) => (
          <SpellRow key={i} spell={s} index={i} names={names} />
        ))}
      </ul>
      {!readOnly && (
        <button
          type="button"
          className="btn-ghost mt-1 !px-2 !py-1 text-xs print:hidden"
          onClick={() => set(['spellcasting', 'spells'], [...sheet.spellcasting.spells, { level, name: '', prepared: false, slug: null }])}
        >
          <Plus className="h-4 w-4" />
          {t('sheet.addSpell')}
        </button>
      )}
    </section>
  );
}

/** Übernimmt Zauber aus „Mein Zauberbuch“ (Favoriten), die noch nicht auf dem Bogen stehen. */
async function loadFavoriteSpells(): Promise<SpellDto[]> {
  const all: SpellDto[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await api.spells(new URLSearchParams({ favorites: 'true', pageSize: '100', page: String(page) }));
    all.push(...res.items);
    if (page >= res.totalPages) break;
  }
  return all;
}

export function SpellsTab() {
  const { t, i18n } = useTranslation();
  const { sheet, set, readOnly } = useSheet();
  const toast = useToast();
  const names = useSpellNames();
  const lang = asLocale(i18n.language);
  const dc = spellSaveDc(sheet);
  const atk = spellAttackBonus(sheet);
  const [busy, setBusy] = useState(false);

  const importFavorites = async () => {
    setBusy(true);
    try {
      const favs = await loadFavoriteSpells();
      const have = new Set(sheet.spellcasting.spells.map((s) => s.slug).filter(Boolean));
      const add = favs.filter((f) => !have.has(f.slug)).map<SheetSpell>((f) => ({ level: f.level, name: resolveText(f, lang).t.name, slug: f.slug, prepared: false }));
      if (add.length === 0) {
        toast.show(t('sheet.fromSpellbookNone'));
      } else {
        set(['spellcasting', 'spells'], [...sheet.spellcasting.spells, ...add]);
        toast.success(t('sheet.fromSpellbookDone', { count: add.length }));
      }
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="sheet-box grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TF path={['spellcasting', 'className']} label={t('sheet.spellcastingClass')} inputClassName="font-display !text-xl font-bold" />
        <div>
          <select
            className="sheet-input text-center font-display !text-xl font-bold"
            value={sheet.spellcasting.ability}
            onChange={(e) => set(['spellcasting', 'ability'], e.target.value)}
            aria-label={t('sheet.spellAbility')}
          >
            {(['none', ...ABILITIES] as const).map((a) => (
              <option key={a} value={a}>
                {a === 'none' ? '–' : t(`sheet.ability.${a}`)}
              </option>
            ))}
          </select>
          <span className="sheet-label">{t('sheet.spellAbility')}</span>
        </div>
        <div className="text-center">
          <Computed value={dc ?? '–'} className="font-display text-3xl font-bold" />
          <span className="sheet-label block">{t('sheet.spellSaveDc')}</span>
        </div>
        <div className="text-center">
          <Computed value={atk === null ? '–' : formatModifier(atk)} className="font-display text-3xl font-bold" />
          <span className="sheet-label block">{t('sheet.spellAttack')}</span>
        </div>
      </div>
      {!readOnly && (
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" className="btn-secondary" onClick={importFavorites} disabled={busy}>
            <BookHeart className="h-4 w-4" />
            {t('sheet.fromSpellbook')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              set(
                ['spellcasting', 'slots'],
                sheet.spellcasting.slots.map((s) => ({ ...s, used: 0 })),
              )
            }
          >
            <RotateCcw className="h-4 w-4" />
            {t('sheet.resetSlots')}
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 10 }, (_, level) => (
          <LevelBox key={level} level={level} names={names} lang={lang} />
        ))}
      </div>
    </div>
  );
}
