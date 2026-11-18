import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';

/**
 * Spielermodus der Kampfhilfe (nur Admins): Der Admin sieht und spielt Kämpfe wie ein Benutzer.
 * Die Einstellung liegt im Konto auf dem Server – beim Ausschalten werden die Dungeon Master benachrichtigt.
 */
export function useCombatPlayerMode(): [boolean, (on: boolean) => Promise<void>] {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, isAdmin, setUser } = useAuth();
  const set = useCallback(
    async (on: boolean) => {
      if (!user) return;
      try {
        const res = await api.setCombatPlayerMode(on);
        setUser({ ...user, combatAsPlayer: res.asPlayer });
      } catch (err) {
        toast.error(errorMessage(t, err));
      }
    },
    [user, setUser, toast, t],
  );
  return [isAdmin && Boolean(user?.combatAsPlayer), set];
}
