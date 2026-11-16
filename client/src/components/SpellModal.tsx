import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Pencil, X } from 'lucide-react';
import type { SpellDto } from '@zauberbuch/shared';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../context/AuthContext';
import { SpellDetail } from './SpellDetail';
import { Alert, PageSpinner } from './ui';

/** Hook: lädt einen Zauber per slug. */
export function useSpell(slug: string | undefined) {
  const [spell, setSpell] = useState<SpellDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .spell(slug, controller.signal)
      .then((r) => setSpell(r.spell))
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [slug]);
  return { spell, error, loading };
}

export function AdminEditLink({ spell }: { spell: SpellDto }) {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;
  return (
    <Link to={`/admin/spells/${spell.slug}/edit`} className="btn-icon" title={t('common.edit')} aria-label={t('common.edit')}>
      <Pencil className="h-5 w-5" />
    </Link>
  );
}

/** Detailansicht als Modal über der Liste (eigene URL /spells/:slug). */
export function SpellModal() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { spell, error, loading } = useSpell(slug);
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = () => navigate(-1);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const prevFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [navigate]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="relative my-4 w-full max-w-3xl outline-none sm:my-10"
      >
        <div className="absolute -top-2 right-0 z-20 flex -translate-y-full gap-1 sm:-right-2">
          {spell && (
            <Link
              to={`/spells/${spell.slug}`}
              replace
              state={null}
              className="btn-icon bg-parchment-50/90 text-ink shadow dark:bg-night-800/90 dark:text-parchment-100"
              title={t('spell.openFull')}
              aria-label={t('spell.openFull')}
            >
              <ExternalLink className="h-5 w-5" />
            </Link>
          )}
          <button
            type="button"
            onClick={close}
            className="btn-icon bg-parchment-50/90 text-ink shadow dark:bg-night-800/90 dark:text-parchment-100"
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {loading && !spell ? (
          <div className="parchment">
            <PageSpinner />
          </div>
        ) : error ? (
          <div className="parchment p-6">
            <h2 id={headingId} className="sr-only">
              {t('common.error')}
            </h2>
            <Alert>{errorMessage(t, error)}</Alert>
          </div>
        ) : spell ? (
          <SpellDetail spell={spell} headingId={headingId} actions={<AdminEditLink spell={spell} />} />
        ) : null}
      </div>
    </div>
  );
}
