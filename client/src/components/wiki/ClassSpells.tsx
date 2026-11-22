import { useEffect, useState } from 'react';
import { Link, useLocation, type Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CLASSES, type SpellClass, type SpellDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { asLocale, resolveText } from '../../lib/spellText';
import { Spinner } from '../ui';

const lower = (s: string) => s.trim().toLocaleLowerCase('de');

/** Ordnet einen Klassennamen aus dem Wiki (deutsch oder englisch) der Zauberklasse der Zauberbibliothek zu */
export function useSpellClass(name: string): SpellClass | null {
  const { t } = useTranslation();
  const n = lower(name);
  return CLASSES.find((c) => [t(`class.${c}`, { lng: 'de' }), t(`class.${c}`, { lng: 'en' }), c].some((x) => lower(x) === n)) ?? null;
}

/** Alle Zauber einer Klasse aus der Zauberbibliothek, nach Grad gruppiert; ein Klick öffnet den Zauber */
export function ClassSpells({ spellClass }: { spellClass: SpellClass }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [spells, setSpells] = useState<SpellDto[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const all: SpellDto[] = [];
      for (let page = 1; ; page++) {
        const r = await api.spells(new URLSearchParams({ class: spellClass, sort: 'level', pageSize: '100', page: String(page) }), ctrl.signal);
        all.push(...r.items);
        if (page >= r.totalPages) break;
      }
      setSpells(all);
    })().catch(() => setSpells((s) => s ?? []));
    return () => ctrl.abort();
  }, [spellClass]);

  if (!spells) return <Spinner />;
  if (spells.length === 0) return <p className="text-sm italic text-parchment-700 dark:text-parchment-400">{t('wiki.class.noSpells')}</p>;
  const lang = asLocale(i18n.language);
  const background = (location.state as { background?: Location } | null)?.background ?? location;
  const levels = [...new Set(spells.map((s) => s.level))].sort((a, b) => a - b);
  return (
    <div className="space-y-3">
      <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('wiki.class.spellsCount', { count: spells.length })}</p>
      {levels.map((level) => {
        const list = spells.filter((s) => s.level === level).map((s) => ({ slug: s.slug, name: resolveText(s, lang).t.name }));
        list.sort((a, b) => a.name.localeCompare(b.name, lang));
        return (
          <div key={level}>
            <h4 className="font-display font-bold">
              {level === 0 ? t('sheet.cantrips') : t('spell.levelOrdinal', { level })}{' '}
              <span className="font-serif text-sm font-normal text-parchment-700 dark:text-parchment-400">({list.length})</span>
            </h4>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {list.map((s) => (
                <li key={s.slug}>
                  <Link
                    to={`/spells/${s.slug}`}
                    state={{ background }}
                    className="inline-block rounded-full border border-parchment-400 bg-parchment-50 px-2.5 py-0.5 text-sm hover:border-parchment-700 hover:bg-parchment-200 dark:border-night-700 dark:bg-night-800 dark:hover:bg-night-700"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
