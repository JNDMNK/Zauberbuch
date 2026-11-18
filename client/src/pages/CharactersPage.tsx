import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Copy, Plus, ScrollText, Search, Trash2, Users } from 'lucide-react';
import type { CharacterSummaryDto } from '@zauberbuch/shared';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Alert, PageSpinner, Spinner } from '../components/ui';

export function CharacterCard({ c, to, actions }: { c: CharacterSummaryDto; to: string; actions?: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  return (
    <article className="parchment relative flex items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-cardhover">
      <ScrollText className="mt-1 h-8 w-8 shrink-0 text-parchment-700 dark:text-parchment-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-display text-lg font-bold">
          <Link to={to} className="after:absolute after:inset-0 after:content-['']">
            {c.name || t('characters.unnamed')}
          </Link>
        </h2>
        <p className="truncate text-sm">
          {[c.classLevel, c.race].filter(Boolean).join(' · ') || t('characters.level', { level: c.level })}
        </p>
        <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">
          {c.owner && <span className="font-semibold">{c.owner.username} · </span>}
          {t('characters.updated', { date: new Date(c.updatedAt).toLocaleDateString(i18n.language) })}
        </p>
      </div>
      {actions && <div className="relative z-10 flex gap-1">{actions}</div>}
    </article>
  );
}

export function CharactersPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState<CharacterSummaryDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<CharacterSummaryDto | null>(null);
  const { isEditor } = useAuth();

  useEffect(() => {
    api
      .characters()
      .then((r) => setList(r.characters))
      .catch(setError);
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const { character } = await api.createCharacter();
      navigate(`/characters/${character.id}`);
    } catch (err) {
      toast.error(errorMessage(t, err));
      setBusy(false);
    }
  };

  const duplicate = async (c: CharacterSummaryDto) => {
    try {
      const { character } = await api.duplicateCharacter(c.id);
      setList((l) => [character, ...(l ?? [])]);
      toast.success(t('characters.duplicated'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    try {
      await api.deleteCharacter(toDelete.id);
      setList((l) => l?.filter((x) => x.id !== toDelete.id) ?? null);
      toast.success(t('characters.deleted'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setToDelete(null);
    }
  };

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!list) return <PageSpinner />;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <ScrollText className="h-7 w-7 text-parchment-600" />
          {isEditor ? t('characters.titleAll') : t('characters.title')}
        </h1>
        <button type="button" className="btn-primary" onClick={create} disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {t('characters.new')}
        </button>
      </div>
      {isEditor && (
        <h2 className="mb-3 text-xl font-bold">{t('characters.mine')}</h2>
      )}
      {list.length === 0 ? (
        <div className="parchment px-6 py-16 text-center">
          <p className="font-display text-xl font-bold">{t('characters.empty')}</p>
          <p className="mt-2 text-parchment-700 dark:text-parchment-400">{t('characters.emptyHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <CharacterCard
              key={c.id}
              c={c}
              to={`/characters/${c.id}`}
              actions={
                <>
                  <button type="button" className="btn-icon" onClick={() => duplicate(c)} title={t('characters.duplicate')} aria-label={`${t('characters.duplicate')}: ${c.name}`}>
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="btn-icon text-red-700 dark:text-red-400"
                    onClick={() => setToDelete(c)}
                    title={t('characters.delete')}
                    aria-label={`${t('characters.delete')}: ${c.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}
      {isEditor && <OtherCharacters />}
      <ConfirmDialog
        open={!!toDelete}
        title={t('characters.delete')}
        message={toDelete ? t('characters.deleteConfirm', { name: toDelete.name || t('characters.unnamed') }) : ''}
        confirmLabel={t('characters.delete')}
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

/** Charakterbögen der anderen Benutzer (nur lesen) – nur für Dungeon Master und Admin */
function OtherCharacters() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [list, setList] = useState<CharacterSummaryDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .allCharacters()
      .then((r) => setList(r.characters.filter((c) => c.owner?.id !== user?.id)))
      .catch(setError);
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('de');
    return (list ?? [])
      .filter((c) => !q || [c.name, c.classLevel, c.race, c.owner?.username].some((v) => v?.toLocaleLowerCase('de').includes(q)))
      .sort((a, b) => (a.owner?.username ?? '').localeCompare(b.owner?.username ?? '', 'de') || a.name.localeCompare(b.name, 'de'));
  }, [list, query]);

  return (
    <section className="mt-10" aria-labelledby="other-characters">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="other-characters" className="flex items-center gap-2 text-xl font-bold">
            <Users className="h-5 w-5 text-parchment-600" />
            {t('characters.others')}
          </h2>
          <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('characters.othersHint')}</p>
        </div>
        {list && list.length > 0 && (
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-600" />
            <input type="search" className="input !pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('characters.othersSearch')} aria-label={t('characters.othersSearch')} />
          </div>
        )}
      </div>
      {error ? (
        <Alert>{errorMessage(t, error)}</Alert>
      ) : !list ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <div className="parchment px-6 py-8 text-center italic">{list.length === 0 ? t('characters.othersEmpty') : t('search.noResults')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <CharacterCard key={c.id} c={c} to={`/characters/${c.id}`} />
          ))}
        </div>
      )}
    </section>
  );
}
