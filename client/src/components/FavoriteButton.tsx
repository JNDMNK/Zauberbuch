import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../lib/errors';

interface Props {
  spellId: string;
  size?: 'sm' | 'lg';
  onChange?: (isFavorite: boolean) => void;
}

export function FavoriteButton({ spellId, size = 'sm', onChange }: Props) {
  const { t } = useTranslation();
  const { user, isFavorite, toggleFavorite } = useAuth();
  const toast = useToast();
  const active = Boolean(user) && isFavorite(spellId);

  const onClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.show(t('spell.loginForFavorites'), 'info', { label: t('nav.login'), to: '/login' });
      return;
    }
    try {
      const now = await toggleFavorite(spellId);
      onChange?.(now);
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  const label = active ? t('spell.removeFavorite') : t('spell.addFavorite');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`relative z-10 inline-flex shrink-0 items-center justify-center rounded-full transition active:scale-90 ${
        size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
      } ${active ? 'text-red-600 dark:text-red-400' : 'text-parchment-600 hover:text-red-600 dark:text-parchment-500 dark:hover:text-red-400'} hover:bg-parchment-200/70 dark:hover:bg-night-700`}
    >
      <Heart className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} fill={active ? 'currentColor' : 'none'} aria-hidden />
    </button>
  );
}
