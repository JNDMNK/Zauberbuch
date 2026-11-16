import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from './Header';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { t } = useTranslation();
  const { config } = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        {t('common.skipToContent')}
      </a>
      <Header />
      <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-parchment-400/50 py-4 text-center text-xs text-parchment-700 dark:border-night-700 dark:text-parchment-500">
        {t('app.title')} {config?.version ? `v${config.version}` : ''} · {t('app.subtitle')}
      </footer>
    </div>
  );
}
