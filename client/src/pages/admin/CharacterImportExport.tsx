import { useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileUp, Upload } from 'lucide-react';
import type { CharacterImportPreview, CharacterImportResult, CharacterImportStatus } from '@zauberbuch/shared';
import { api, type AdminUserDto } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { Alert, Spinner } from '../../components/ui';

const STATUS_CLS: Record<CharacterImportStatus, string> = {
  new: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  duplicate: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  no_owner: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  invalid: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
};

/** Export/Import aller Charakterbögen (nur Admin) */
export function CharacterImportExport() {
  const { t } = useTranslation();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [entries, setEntries] = useState<unknown[] | null>(null);
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string>('');
  const [duplicates, setDuplicates] = useState<'skip' | 'create'>('skip');
  const [preview, setPreview] = useState<CharacterImportPreview | null>(null);
  const [result, setResult] = useState<CharacterImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .users()
      .then((r) => setUsers(r.users))
      .catch(() => setUsers([]));
  }, []);

  const runPreview = async (list: unknown[], fallbackId: string) => {
    setBusy(true);
    setError(null);
    try {
      setPreview(await api.characterImportPreview(list, fallbackId || null));
    } catch (err) {
      setError(errorMessage(t, err));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setResult(null);
    setPreview(null);
    setError(null);
    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.characters) ? parsed.characters : null;
      if (!list || list.length === 0) {
        setError(t('admin.charInvalidFile'));
        setEntries(null);
        return;
      }
      setEntries(list);
      const size =
        file.size < 1024 * 1024
          ? t('admin.charFileSizeKb', { size: Math.max(1, Math.round(file.size / 1024)) })
          : t('admin.charFileSize', { size: (file.size / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 }) });
      setFileInfo(`${file.name} · ${size}`);
      await runPreview(list, fallback);
    } catch (err) {
      setError(t('admin.invalidJson', { message: (err as Error).message }));
      setEntries(null);
    }
  };

  const changeFallback = (id: string) => {
    setFallback(id);
    if (entries) void runPreview(entries, id);
  };

  const runImport = async () => {
    if (!entries) return;
    setBusy(true);
    try {
      const res = await api.importCharacters(entries, fallback || null, duplicates);
      setResult(res);
      setPreview(null);
      setEntries(null);
      toast.success(t('admin.charImportDone', { ...res }));
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const importable = preview ? preview.summary.new + (duplicates === 'create' ? preview.summary.duplicate : 0) : 0;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section className="parchment h-fit p-6">
        <h3 className="text-lg font-bold">{t('admin.export')}</h3>
        <p className="mt-2 text-sm">{t('admin.charExportText')}</p>
        <a href="/api/characters/export" download className="btn-primary mt-4">
          <Download className="h-4 w-4" />
          {t('admin.charExportButton')}
        </a>
      </section>

      <section className="parchment p-6 xl:col-span-2">
        <h3 className="text-lg font-bold">{t('admin.import')}</h3>
        <p className="mt-2 text-sm">{t('admin.charImportText')}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="btn-secondary cursor-pointer">
            {busy && !preview ? <Spinner className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
            {t('admin.chooseFile')}
            <input type="file" accept="application/json,.json" className="sr-only" onChange={onFile} />
          </label>
          {fileInfo && entries && <span className="text-sm text-parchment-700 dark:text-parchment-400">{fileInfo}</span>}
        </div>

        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}
        {result && (
          <div className="mt-4">
            <Alert kind="success">{t('admin.charImportDone', { ...result })}</Alert>
          </div>
        )}

        {preview && (
          <div className="mt-6 space-y-4">
            <Alert kind="info">{t('admin.charPreviewSummary', { ...preview.summary })}</Alert>
            <div className="max-h-96 overflow-auto rounded-lg border border-parchment-400/60 dark:border-night-700">
              <table className="table-base">
                <thead className="sticky top-0 bg-parchment-100 dark:bg-night-800">
                  <tr>
                    <th>#</th>
                    <th>{t('sheet.characterName')}</th>
                    <th>{t('admin.charOwnerOriginal')}</th>
                    <th>{t('admin.charOwnerTarget')}</th>
                    <th>{t('admin.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((it) => (
                    <tr key={it.index}>
                      <td>{it.index + 1}</td>
                      <td>{it.name || <span className="italic text-parchment-600">{t('characters.unnamed')}</span>}</td>
                      <td>{it.owner ?? '–'}</td>
                      <td>{it.targetUser ?? '–'}</td>
                      <td>
                        <span className={`badge ${STATUS_CLS[it.status]}`}>{t(`admin.charStatus_${it.status}`)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-end gap-6">
              <label className="block">
                <span className="label">{t('admin.charFallback')}</span>
                <select className="input !w-auto" value={fallback} onChange={(e) => changeFallback(e.target.value)} disabled={busy}>
                  <option value="">{t('admin.charFallbackSkip')}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {t('admin.charFallbackAssign', { name: u.username })}
                    </option>
                  ))}
                </select>
              </label>
              {preview.summary.duplicate > 0 && (
                <fieldset>
                  <legend className="label">{t('admin.charDuplicates')}</legend>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="char-dup" checked={duplicates === 'skip'} onChange={() => setDuplicates('skip')} />
                      {t('admin.charDuplicatesSkip')}
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="char-dup" checked={duplicates === 'create'} onChange={() => setDuplicates('create')} />
                      {t('admin.charDuplicatesCreate')}
                    </label>
                  </div>
                </fieldset>
              )}
              <button type="button" className="btn-primary" onClick={runImport} disabled={busy || importable === 0}>
                {busy ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                {t('admin.runImport')}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
