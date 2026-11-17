import { useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileUp, ShieldAlert, Upload } from 'lucide-react';
import type { UserImportPreview, UserImportResult, UserImportStatus } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../context/ToastContext';
import { Alert, Spinner } from '../../components/ui';

const STATUS_CLS: Record<UserImportStatus, string> = {
  new: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  update: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  exists: 'bg-parchment-200 text-parchment-900 dark:bg-night-700 dark:text-parchment-200',
  self: 'bg-parchment-200 text-parchment-900 dark:bg-night-700 dark:text-parchment-200',
  no_password: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  conflict: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  invalid: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
};

/** Export/Import aller Benutzer inkl. Passwort-Hashes und „Mein Zauberbuch“ (nur Admin) */
export function UserImportExport() {
  const { t } = useTranslation();
  const toast = useToast();
  const [withPasswords, setWithPasswords] = useState(true);
  const [entries, setEntries] = useState<unknown[] | null>(null);
  const [mode, setMode] = useState<'skip' | 'update'>('skip');
  const [defaultPassword, setDefaultPassword] = useState('');
  const debouncedPassword = useDebounce(defaultPassword, 400);
  const [preview, setPreview] = useState<UserImportPreview | null>(null);
  const [result, setResult] = useState<UserImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pw = debouncedPassword.length >= 8 ? debouncedPassword : null;

  useEffect(() => {
    if (!entries) return;
    let cancelled = false;
    setBusy(true);
    api
      .userImportPreview(entries, mode, pw)
      .then((p) => !cancelled && (setPreview(p), setError(null)))
      .catch((err) => !cancelled && setError(errorMessage(t, err)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [entries, mode, pw, t]);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setResult(null);
    setPreview(null);
    setError(null);
    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.users) ? parsed.users : null;
      if (!list || list.length === 0) {
        setError(t('admin.userInvalidFile'));
        setEntries(null);
        return;
      }
      setEntries(list);
    } catch (err) {
      setError(t('admin.invalidJson', { message: (err as Error).message }));
      setEntries(null);
    }
  };

  const runImport = async () => {
    if (!entries) return;
    setBusy(true);
    try {
      const res = await api.importUsers(entries, mode, pw);
      setResult(res);
      setPreview(null);
      setEntries(null);
      toast.success(t('admin.userImportDone', { ...res }));
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const importable = preview ? preview.summary.new + preview.summary.update : 0;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section className="parchment h-fit p-6">
        <h3 className="text-lg font-bold">{t('admin.export')}</h3>
        <p className="mt-2 text-sm">{t('admin.userExportText')}</p>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-parchment-800" checked={withPasswords} onChange={(e) => setWithPasswords(e.target.checked)} />
          <span>{t('admin.userExportPasswords')}</span>
        </label>
        {withPasswords && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {t('admin.userExportWarning')}
          </p>
        )}
        <a href={`/api/users/export?passwords=${withPasswords}`} download className="btn-primary mt-4">
          <Download className="h-4 w-4" />
          {t('admin.userExportButton')}
        </a>
      </section>

      <section className="parchment p-6 xl:col-span-2">
        <h3 className="text-lg font-bold">{t('admin.import')}</h3>
        <p className="mt-2 text-sm">{t('admin.userImportText')}</p>
        <label className="btn-secondary mt-4 cursor-pointer">
          {busy && !preview ? <Spinner className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
          {t('admin.chooseFile')}
          <input type="file" accept="application/json,.json" className="sr-only" onChange={onFile} />
        </label>

        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}
        {result && (
          <div className="mt-4 space-y-2">
            <Alert kind="success">{t('admin.userImportDone', { ...result })}</Alert>
            {result.favoritesMissing > 0 && <Alert kind="info">{t('admin.userFavoritesMissing', { count: result.favoritesMissing })}</Alert>}
          </div>
        )}

        {entries && preview && (
          <div className="mt-6 space-y-4">
            <Alert kind="info">{t('admin.userPreviewSummary', { ...preview.summary })}</Alert>
            <div className="max-h-96 overflow-auto rounded-lg border border-parchment-400/60 dark:border-night-700">
              <table className="table-base">
                <thead className="sticky top-0 bg-parchment-100 dark:bg-night-800">
                  <tr>
                    <th>#</th>
                    <th>{t('auth.username')}</th>
                    <th>{t('account.role')}</th>
                    <th>{t('admin.favoritesCount')}</th>
                    <th>{t('admin.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((it) => (
                    <tr key={it.index}>
                      <td>{it.index + 1}</td>
                      <td>
                        {it.username ?? '–'}
                        {it.errors && <div className="text-xs text-red-700 dark:text-red-400">{it.errors.join(' · ')}</div>}
                      </td>
                      <td>{it.role ? t(`role.${it.role}`) : '–'}</td>
                      <td>{it.favorites}</td>
                      <td>
                        <span className={`badge ${STATUS_CLS[it.status]}`}>{t(`admin.userStatus_${it.status}`)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <fieldset>
                <legend className="label">{t('admin.userMode')}</legend>
                <div className="space-y-1">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="user-mode" checked={mode === 'skip'} onChange={() => setMode('skip')} />
                    {t('admin.userModeSkip')}
                  </label>
                  <label className="flex items-start gap-2">
                    <input type="radio" name="user-mode" className="mt-1.5" checked={mode === 'update'} onChange={() => setMode('update')} />
                    {t('admin.userModeUpdate')}
                  </label>
                </div>
              </fieldset>
              <label className="block">
                <span className="label">{t('admin.userDefaultPassword')}</span>
                <input type="password" className="input" autoComplete="new-password" value={defaultPassword} onChange={(e) => setDefaultPassword(e.target.value)} />
                <span className="mt-1 block text-xs text-parchment-700 dark:text-parchment-400">{t('admin.userDefaultPasswordHint')}</span>
              </label>
            </div>
            <button type="button" className="btn-primary" onClick={runImport} disabled={busy || importable === 0}>
              {busy ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {t('admin.runImport')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
