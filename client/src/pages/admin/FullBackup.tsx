import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DatabaseBackup, Download, FileUp, ShieldAlert, Upload } from 'lucide-react';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { Alert, Spinner } from '../../components/ui';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface BackupFile {
  format: string;
  version: number;
  appVersion?: string;
  exportedAt?: string;
  tables: Record<string, unknown[]>;
}

/** Wichtige Tabellen mit Namen für die Vorschau (Rest erscheint unter „Weitere Datensätze“) */
const MAIN_TABLES = ['User', 'Spell', 'Character', 'Story', 'BoardPost', 'Encounter', 'MonsterTemplate', 'BestiaryEntry', 'MagicItem', 'CatalogItem', 'WikiEntry', 'Source', 'DmNote'] as const;

/** Gesamtsicherung: alle Daten als eine Datei exportieren bzw. komplett wiederherstellen (nur Admin) */
export function FullBackup() {
  const { t, i18n } = useTranslation();
  const [file, setFile] = useState<{ name: string; backup: BackupFile } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ total: number; safetyCopy: string } | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    setFile(null);
    setError(null);
    setDone(null);
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text()) as BackupFile;
      if (parsed?.format !== 'zauberbuch-backup' || !parsed.tables || typeof parsed.tables !== 'object') {
        setError(t('backup.notABackup'));
        return;
      }
      setFile({ name: f.name, backup: parsed });
    } catch (err) {
      setError(t('admin.invalidJson', { message: (err as Error).message }));
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await api.importBackup(file.backup);
      setConfirm(false);
      setFile(null);
      setDone({ total: Object.values(r.counts).reduce((a, b) => a + b, 0), safetyCopy: r.safetyCopy });
    } catch (err) {
      setConfirm(false);
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const count = (name: string) => (Array.isArray(file?.backup.tables[name]) ? file!.backup.tables[name].length : 0);
  const total = file ? Object.values(file.backup.tables).reduce((a, rows) => a + (Array.isArray(rows) ? rows.length : 0), 0) : 0;
  const mainTotal = MAIN_TABLES.reduce((a, n) => a + count(n), 0);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section className="parchment h-fit p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <DatabaseBackup className="h-5 w-5" />
          {t('admin.export')}
        </h3>
        <p className="mt-2 text-sm">{t('backup.exportText')}</p>
        <p className="mt-2 flex gap-2 text-sm text-amber-800 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {t('backup.sensitive')}
        </p>
        <a href="/api/backup/export" download className="btn-primary mt-4">
          <Download className="h-4 w-4" />
          {t('backup.exportButton')}
        </a>
      </section>

      <section className="parchment p-6 xl:col-span-2">
        <h3 className="text-lg font-bold">{t('admin.import')}</h3>
        <p className="mt-2 text-sm">{t('backup.importText')}</p>
        <label className="btn-secondary mt-4 cursor-pointer">
          <FileUp className="h-4 w-4" />
          {t('backup.chooseFile')}
          <input type="file" accept="application/json,.json" className="sr-only" onChange={onFile} />
        </label>
        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}
        {done && (
          <div className="mt-4 space-y-2">
            <Alert kind="success">
              <p className="font-semibold">{t('backup.done', { count: done.total })}</p>
              <p className="text-sm">{t('backup.safetyCopy', { file: done.safetyCopy })}</p>
            </Alert>
            <button type="button" className="btn-primary" onClick={() => window.location.assign('/')}>
              {t('backup.reload')}
            </button>
          </div>
        )}
        {file && (
          <div className="mt-4 space-y-3">
            <p className="text-sm">
              <strong>{file.name}</strong>
              {file.backup.exportedAt && <> · {t('backup.exportedAt', { date: new Date(file.backup.exportedAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }) })}</>}
              {file.backup.appVersion && <> · v{file.backup.appVersion}</>}
            </p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              {MAIN_TABLES.filter((n) => count(n) > 0).map((n) => (
                <li key={n} className="flex justify-between gap-2 border-b border-parchment-300/60 py-0.5 dark:border-night-700">
                  <span>{t(`backup.tables.${n}`)}</span>
                  <span className="tabular-nums font-semibold">{count(n)}</span>
                </li>
              ))}
              {total - mainTotal > 0 && (
                <li className="flex justify-between gap-2 border-b border-parchment-300/60 py-0.5 dark:border-night-700">
                  <span>{t('backup.otherRows')}</span>
                  <span className="tabular-nums font-semibold">{total - mainTotal}</span>
                </li>
              )}
            </ul>
            <Alert kind="info">{t('backup.warning')}</Alert>
            <button type="button" className="btn-danger" onClick={() => setConfirm(true)} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {t('backup.importButton')}
            </button>
          </div>
        )}
      </section>
      <ConfirmDialog
        open={confirm}
        title={t('backup.confirmTitle')}
        message={t('backup.confirmText', { count: total })}
        confirmLabel={t('backup.importButton')}
        busy={busy}
        onConfirm={run}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
