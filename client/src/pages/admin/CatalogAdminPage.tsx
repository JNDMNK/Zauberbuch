import { useTranslation } from 'react-i18next';
import { CatalogManager } from '../../components/catalog/CatalogManager';

/** Verwaltung → Gegenstände: Standard-Datenbank (Admin und Moderator) */
export function CatalogAdminPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">{t('catalog.standardTitle')}</h2>
        <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('catalog.standardHint')}</p>
      </div>
      <CatalogManager />
    </div>
  );
}
