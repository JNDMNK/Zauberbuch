import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import type { CharacterSummaryDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { Alert, PageSpinner } from '../../components/ui';
import { CharacterCard } from '../CharactersPage';

/** Alle Charakterbögen (nur lesen) – für Admin und Dungeon Master */
export function CharactersAdminPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<CharacterSummaryDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .allCharacters()
      .then((r) => setList(r.characters))
      .catch(setError);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list ?? []).filter((c) => !q || [c.name, c.classLevel, c.race, c.owner?.username].some((v) => v?.toLowerCase().includes(q)));
  }, [list, query]);

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!list) return <PageSpinner />;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">{t('admin.charactersTitle')}</h2>
          <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('admin.charactersHint')}</p>
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-600" />
          <input type="search" className="input !pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.search')} aria-label={t('common.search')} />
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="parchment px-6 py-12 text-center italic">{t('search.noResults')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <CharacterCard key={c.id} c={c} to={`/characters/${c.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
