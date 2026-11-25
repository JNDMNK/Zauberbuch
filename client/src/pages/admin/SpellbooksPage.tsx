import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookHeart, ChevronRight, Search } from 'lucide-react';
import type { SpellbookOwnerDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { Alert, PageSpinner } from '../../components/ui';
import { SpellsPage } from '../SpellsPage';

function useOwners() {
  const [owners, setOwners] = useState<SpellbookOwnerDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api
      .spellbooks()
      .then((r) => setOwners(r.owners))
      .catch(setError);
  }, []);
  return { owners, error };
}

/** Übersicht aller Zauberbücher – für Admin und Dungeon Master. */
export function SpellbooksPage() {
  const { t } = useTranslation();
  const { owners, error } = useOwners();
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => owners?.filter((o) => o.username.toLowerCase().includes(query.trim().toLowerCase())) ?? [],
    [owners, query],
  );

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!owners) return <PageSpinner />;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <BookHeart className="h-7 w-7 text-red-700 dark:text-red-400" />
            {t('admin.spellbooksTitle')}
          </h1>
          <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('admin.spellbooksHint')}</p>
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-600" />
          <input
            type="search"
            className="input !pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('auth.username')}
            aria-label={t('auth.username')}
          />
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5">
        {filtered.map((o) => (
          <li key={o.id}>
            <Link
              to={`/spellbooks/${o.id}`}
              state={{ username: o.username }}
              className="parchment flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-cardhover"
            >
              <BookHeart className="h-8 w-8 shrink-0 text-red-700 dark:text-red-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-bold">{o.username}</p>
                <p className="text-sm text-parchment-700 dark:text-parchment-400">
                  {t(`role.${o.role}`)} · {t('admin.spellCount', { count: o.spellCount })}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-parchment-600" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Zauberbuch eines einzelnen Benutzers mit denselben Such- und Filterfunktionen. */
export function UserSpellbookPage() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const { owners, error } = useOwners();
  const owner = owners?.find((o) => o.id === userId);

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!owners) return <PageSpinner />;
  if (!owner) return <Alert>{t('errors.user_not_found')}</Alert>;

  return (
    <SpellsPage
      key={owner.id}
      owner={{ id: owner.id, username: owner.username }}
      header={
        <Link to="/spellbooks" className="btn-ghost mb-1 self-start !px-2">
          <ArrowLeft className="h-4 w-4" />
          {t('admin.backToSpellbooks')}
        </Link>
      }
    />
  );
}
