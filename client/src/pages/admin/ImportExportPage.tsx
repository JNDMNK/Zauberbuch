import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileUp, Upload } from 'lucide-react';
import type { ImportPreviewResult, ImportResult } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { Alert, Spinner, TextArea } from '../../components/ui';
import { CharacterImportExport } from './CharacterImportExport';
import { UserImportExport } from './UserImportExport';
import { BoardImportExport } from './BoardImportExport';
import { FullBackup } from './FullBackup';

/** Akzeptiert ein Array von Zaubern oder ein Export-Objekt { spells: [...] }. */
function extractSpells(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as { spells?: unknown }).spells)) {
    return (raw as { spells: unknown[] }).spells;
  }
  return null;
}

export function ImportExportPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [text, setText] = useState('');
  const [spells, setSpells] = useState<unknown[] | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [mode, setMode] = useState<'skip' | 'overwrite'>('skip');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPreview(null);
    setSpells(null);
    setResult(null);
    setError(null);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();
    setText(await file.text());
    e.target.value = '';
  };

  const analyze = async () => {
    reset();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setError(t('admin.invalidJson', { message: (err as Error).message }));
      return;
    }
    const list = extractSpells(parsed);
    if (!list || list.length === 0) {
      setError(t('admin.noSpellsInFile'));
      return;
    }
    setBusy(true);
    try {
      setPreview(await api.importPreview(list));
      setSpells(list);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!spells) return;
    setBusy(true);
    try {
      const res = await api.importSpells(spells, mode);
      setResult(res);
      setPreview(null);
      setSpells(null);
      toast.success(t('admin.importDone', { ...res }));
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (status: 'new' | 'duplicate' | 'invalid') => {
    const map = {
      new: ['bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200', t('admin.statusNew')],
      duplicate: ['bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200', t('admin.statusDuplicate')],
      invalid: ['bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200', t('admin.statusInvalid')],
    } as const;
    return <span className={`badge ${map[status][0]}`}>{map[status][1]}</span>;
  };

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-1 text-xl font-bold">{t('backup.section')}</h2>
        <p className="mb-4 text-sm text-parchment-700 dark:text-parchment-400">{t('backup.sectionHint')}</p>
        <FullBackup />
      </section>
      <section>
        <h2 className="mb-4 text-xl font-bold">{t('admin.spellsSection')}</h2>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="parchment h-fit p-6">
            <h2 className="text-lg font-bold">{t('admin.export')}</h2>
            <p className="mt-2 text-sm">{t('admin.exportText')}</p>
            <a href="/api/spells/export" download className="btn-primary mt-4">
              <Download className="h-4 w-4" />
              {t('admin.exportButton')}
            </a>
          </section>

          <section className="parchment p-6 xl:col-span-2">
            <h2 className="text-lg font-bold">{t('admin.import')}</h2>
            <p className="mt-2 text-sm">{t('admin.importText')}</p>
            <div className="mt-4 space-y-3">
              <label className="btn-secondary cursor-pointer">
                <FileUp className="h-4 w-4" />
                {t('admin.chooseFile')}
                <input type="file" accept="application/json,.json" className="sr-only" onChange={onFile} />
              </label>
              <TextArea
                rows={8}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  reset();
                }}
                placeholder={t('admin.pasteJson')}
                className="font-mono text-xs"
                aria-label={t('admin.pasteJson')}
              />
              <button type="button" className="btn-primary" onClick={analyze} disabled={busy || !text.trim()}>
                {busy && !preview ? <Spinner className="h-4 w-4" /> : null}
                {t('admin.analyze')}
              </button>
            </div>

            {error && (
              <div className="mt-4">
                <Alert>{error}</Alert>
              </div>
            )}
            {result && (
              <div className="mt-4">
                <Alert kind="success">{t('admin.importDone', { ...result })}</Alert>
              </div>
            )}

            {preview && (
              <div className="mt-6 space-y-4">
                <Alert kind="info">{t('admin.previewSummary', { ...preview.summary })}</Alert>
                <div className="max-h-96 overflow-auto rounded-lg border border-parchment-400/60 dark:border-night-700">
                  <table className="table-base">
                    <thead className="sticky top-0 bg-parchment-100 dark:bg-night-800">
                      <tr>
                        <th>#</th>
                        <th>{t('admin.slug')}</th>
                        <th>{t('admin.name')}</th>
                        <th>{t('admin.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.map((item) => (
                        <tr key={item.index}>
                          <td>{item.index + 1}</td>
                          <td className="font-mono text-xs">{item.slug ?? '–'}</td>
                          <td>
                            {item.name ?? '–'}
                            {item.errors && (
                              <ul className="mt-1 list-disc pl-4 text-xs text-red-700 dark:text-red-400">
                                {item.errors.slice(0, 5).map((e) => (
                                  <li key={e}>{e}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td>{statusBadge(item.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  {preview.summary.duplicate > 0 && (
                    <fieldset>
                      <legend className="label">{t('admin.duplicateMode')}</legend>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input type="radio" name="mode" checked={mode === 'skip'} onChange={() => setMode('skip')} />
                          {t('admin.modeSkip')}
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" name="mode" checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} />
                          {t('admin.modeOverwrite')}
                        </label>
                      </div>
                    </fieldset>
                  )}
                  <button type="button" className="btn-primary" onClick={runImport} disabled={busy || preview.summary.new + (mode === 'overwrite' ? preview.summary.duplicate : 0) === 0}>
                    {busy ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                    {t('admin.runImport')}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-xl font-bold">{t('admin.usersSection')}</h2>
        <UserImportExport />
      </section>
      <section>
        <h2 className="mb-4 text-xl font-bold">{t('admin.charactersSection')}</h2>
        <CharacterImportExport />
      </section>
      <section>
        <h2 className="mb-4 text-xl font-bold">{t('admin.boardSection')}</h2>
        <BoardImportExport />
      </section>
    </div>
  );
}
