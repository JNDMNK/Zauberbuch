import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="parchment mx-auto mt-10 max-w-lg p-10 text-center">
      <p className="font-display text-6xl font-bold text-parchment-600">404</p>
      <h1 className="mt-2 text-2xl font-bold">{t('common.notFound')}</h1>
      <p className="mt-2 italic">{t('common.notFoundText')}</p>
      <Link to="/" className="btn-primary mt-6">
        {t('common.toHome')}
      </Link>
    </div>
  );
}
