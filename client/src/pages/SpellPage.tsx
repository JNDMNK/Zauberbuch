import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { AdminEditLink, useSpell } from '../components/SpellModal';
import { SpellDetail } from '../components/SpellDetail';
import { Alert, PageSpinner } from '../components/ui';
import { errorMessage } from '../lib/errors';
import { asLocale, resolveText } from '../lib/spellText';

/** Eigenständige Detailseite (Direktaufruf von /spells/:slug). */
export function SpellPage() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const { spell, error, loading } = useSpell(slug);

  useEffect(() => {
    if (spell) document.title = `${resolveText(spell, asLocale(i18n.language)).t.name} · ${t('app.title')}`;
    return () => {
      document.title = t('app.title');
    };
  }, [spell, i18n.language, t]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="btn-ghost mb-4 !px-2">
        <ArrowLeft className="h-4 w-4" />
        {t('common.toHome')}
      </Link>
      {loading && !spell ? (
        <PageSpinner />
      ) : error ? (
        <Alert>{errorMessage(t, error)}</Alert>
      ) : spell ? (
        <SpellDetail spell={spell} actions={<AdminEditLink spell={spell} />} />
      ) : null}
    </div>
  );
}
