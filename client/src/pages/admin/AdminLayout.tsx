import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookHeart, FileJson, ScrollText, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function AdminLayout() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 border-b-2 px-4 py-2 font-display text-sm font-semibold ${
      isActive ? 'border-parchment-800 text-ink dark:border-parchment-300 dark:text-parchment-50' : 'border-transparent text-parchment-700 hover:text-ink dark:text-parchment-400 dark:hover:text-parchment-100'
    }`;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold sm:text-3xl">{t('admin.title')}</h1>
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-parchment-400/60 dark:border-night-700">
        <NavLink to="/admin/spells" className={cls}>
          <ScrollText className="h-4 w-4" />
          {t('admin.spells')}
        </NavLink>
        <NavLink to="/admin/spellbooks" className={cls}>
          <BookHeart className="h-4 w-4" />
          {t('admin.spellbooks')}
        </NavLink>
        <NavLink to="/admin/characters" className={cls}>
          <ScrollText className="h-4 w-4" />
          {t('admin.characters')}
        </NavLink>
        {isAdmin && (
          <>
            <NavLink to="/admin/import-export" className={cls}>
              <FileJson className="h-4 w-4" />
              {t('admin.importExport')}
            </NavLink>
            <NavLink to="/admin/users" className={cls}>
              <Users className="h-4 w-4" />
              {t('admin.users')}
            </NavLink>
          </>
        )}
      </nav>
      <Outlet />
    </div>
  );
}
