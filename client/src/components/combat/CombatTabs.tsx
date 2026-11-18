import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookMarked, Swords } from 'lucide-react';

/** Unterreiter im Bereich Kampf */
export function CombatTabs() {
  const { t } = useTranslation();
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 font-display text-sm font-semibold transition ${
      isActive ? 'border-parchment-800 text-ink dark:border-parchment-300 dark:text-parchment-50' : 'border-transparent text-parchment-700 hover:text-ink dark:text-parchment-400 dark:hover:text-parchment-100'
    }`;
  return (
    <nav aria-label={t('combat.heading')} className="flex gap-1 overflow-x-auto border-b border-parchment-400/60 dark:border-night-700">
      <NavLink to="/combat" end className={cls}>
        <Swords className="h-4 w-4" />
        {t('combat.encountersTab')}
      </NavLink>
      <NavLink to="/combat/bestiary" className={cls}>
        <BookMarked className="h-4 w-4" />
        {t('bestiary.tab')}
      </NavLink>
    </nav>
  );
}
