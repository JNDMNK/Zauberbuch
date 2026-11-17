import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileUp, Upload } from 'lucide-react';
import { BOARD_EXPORT_FORMAT, type BoardImportResult } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { Alert, Spinner } from '../../components/ui';

/** Export/Import der Infotafel (alle Geschichten, Beiträge und Kommentare) – nur Admin */
export function BoardImportExport() {
  const { t } = useTranslation();
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; data: unknown; stories: number; posts: number } | null>(null);
  const [result, setResult] = useState<BoardImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setResult(null);
    setError(null);
    setFile(null);
    try {
      const data = JSON.parse(await f.text());
      if (data?.format !== BOARD_EXPORT_FORMAT || !Array.isArray(data.stories)) {
        setError(t('admin.boardInvalidFile'));
        return;
      }
      const posts = data.stories.reduce((n: number, s: { posts?: unknown[] }) => n + (Array.isArray(s.posts) ? s.posts.length : 0), 0);
      setFile({ name: f.name, data, stories: data.stories.length, posts });
    } catch (err) {
      setError(t('admin.invalidJson', { message: (err as Error).message }));
    }
  };

  const runImport = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await api.importBoard(file.data);
      setResult(res);
      setFile(null);
      toast.success(t('admin.boardImportDone', { ...res }));
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section className="parchment h-fit p-6">
        <h3 className="text-lg font-bold">{t('admin.export')}</h3>
        <p className="mt-2 text-sm">{t('admin.boardExportText')}</p>
        <a href="/api/board/export" download className="btn-primary mt-4">
          <Download className="h-4 w-4" />
          {t('admin.boardExportButton')}
        </a>
      </section>
      <section className="parchment p-6 xl:col-span-2">
        <h3 className="text-lg font-bold">{t('admin.import')}</h3>
        <p className="mt-2 text-sm">{t('admin.boardImportText')}</p>
        <label className="btn-secondary mt-4 cursor-pointer">
          <FileUp className="h-4 w-4" />
          {t('admin.chooseFile')}
          <input type="file" accept="application/json,.json" className="sr-only" onChange={onFile} />
        </label>
        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}
        {file && (
          <div className="mt-4 space-y-3">
            <Alert kind="info">{t('admin.boardFileSummary', { name: file.name, stories: file.stories, posts: file.posts })}</Alert>
            <button type="button" className="btn-primary" onClick={runImport} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {t('admin.runImport')}
            </button>
          </div>
        )}
        {result && (
          <div className="mt-4 space-y-2">
            <Alert kind="success">{t('admin.boardImportDone', { ...result })}</Alert>
            {result.unknownUsers.length > 0 && <Alert kind="info">{t('admin.boardUnknownUsers', { names: result.unknownUsers.join(', ') })}</Alert>}
          </div>
        )}
      </section>
    </div>
  );
}
