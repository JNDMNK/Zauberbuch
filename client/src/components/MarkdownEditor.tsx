import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Pencil } from 'lucide-react';
import { Markdown } from './Markdown';
import { TextArea } from './ui';

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  invalid?: boolean;
}

/** Einfacher Markdown-Editor mit Schreib- und Vorschau-Modus. */
export function MarkdownEditor({ id, value, onChange, rows = 10, invalid }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const tab = (m: 'write' | 'preview', label: string, Icon: typeof Eye) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => setMode(m)}
      className={`flex items-center gap-1 rounded-t-md px-3 py-1 font-display text-xs font-semibold ${
        mode === m ? 'bg-parchment-300/70 dark:bg-night-700' : 'text-parchment-700 hover:bg-parchment-200/60 dark:text-parchment-400 dark:hover:bg-night-800'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
  return (
    <div>
      <div role="tablist" className="flex gap-1">
        {tab('write', t('common.write'), Pencil)}
        {tab('preview', t('common.preview'), Eye)}
      </div>
      {mode === 'write' ? (
        <TextArea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} invalid={invalid} className="!rounded-tl-none font-mono text-sm" />
      ) : (
        <div className="min-h-[8rem] rounded-lg rounded-tl-none border border-parchment-400 bg-white/50 p-3 dark:border-night-700 dark:bg-night-950/40">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="italic text-parchment-600">–</p>}
        </div>
      )}
      <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">{t('admin.markdownHint')}</p>
    </div>
  );
}
