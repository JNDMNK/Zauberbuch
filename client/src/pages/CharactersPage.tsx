import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Copy, Plus, ScrollText, Trash2 } from 'lucide-react';
import type { CharacterSummaryDto } from '@zauberbuch/shared';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useToast } from '../context/ToastContext';
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
          {t('characters.title')}
        </h1>
        <button type="button" className="btn-primary" onClick={create} disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {t('characters.new')}
        </button>
      </div>
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
