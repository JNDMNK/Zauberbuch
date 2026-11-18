import { useTranslation } from 'react-i18next';
import { Gamepad2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCombatPlayerMode } from '../../hooks/useCombatPlayerMode';

/** Umschalter „Als Spieler“ – nur für Admins sichtbar */
export function PlayerModeToggle() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [asPlayer, setAsPlayer] = useCombatPlayerMode();
  if (!isAdmin) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={asPlayer}
      onClick={() => setAsPlayer(!asPlayer)}
      title={t('combat.playerModeHint')}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
        asPlayer
          ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-500 dark:bg-emerald-600'
          : 'border-parchment-500/70 hover:bg-parchment-200/80 dark:border-night-700 dark:hover:bg-night-700'
      }`}
    >
      <Gamepad2 className="h-4 w-4" />
      {t('combat.playerMode')}
      <span className={`relative h-5 w-9 rounded-full transition ${asPlayer ? 'bg-white/40' : 'bg-parchment-300 dark:bg-night-700'}`} aria-hidden>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${asPlayer ? 'left-[1.125rem]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
