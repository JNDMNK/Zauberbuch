import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, X } from 'lucide-react';
import { BOARD_CATEGORIES, MAX_POST_LENGTH, type BoardCategory, type PostInput } from '@zauberbuch/shared';
import { MarkdownEditor } from '../MarkdownEditor';
import { Spinner } from '../ui';

interface Props {
  initial?: { title: string; body: string; category: BoardCategory };
  submitLabel: string;
  onSubmit: (input: PostInput) => Promise<void>;
  onCancel?: () => void;
}

/** Formular zum Schreiben oder Bearbeiten eines Beitrags */
export function PostForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [category, setCategory] = useState<BoardCategory>(initial?.category ?? 'general');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ title: title.trim(), body, category });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem]">
        <div>
          <label htmlFor={`${id}-title`} className="label">
            {t('board.title')} <span className="font-normal text-parchment-700 dark:text-parchment-400">({t('board.optional')})</span>
          </label>
          <input id={`${id}-title`} className="input" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${id}-cat`} className="label">
            {t('board.category')}
          </label>
          <select id={`${id}-cat`} className="input" value={category} onChange={(e) => setCategory(e.target.value as BoardCategory)}>
            {BOARD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`board.categories.${c}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-body`} className="label">
          {t('board.text')}
        </label>
        <MarkdownEditor id={`${id}-body`} value={body} onChange={(v) => setBody(v.slice(0, MAX_POST_LENGTH))} rows={6} />
        <p className="mt-1 flex justify-between text-xs text-parchment-700 dark:text-parchment-400">
          <span>{t('board.markdownHint')}</span>
          <span>
            {body.length.toLocaleString()} / {MAX_POST_LENGTH.toLocaleString()}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            <X className="h-4 w-4" />
            {t('common.cancel')}
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={busy || !body.trim()}>
          {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
