import { useTranslation } from 'react-i18next';
import { BookMarked, Globe2 } from 'lucide-react';
import { HOMEBREW_SOURCE } from '@zauberbuch/shared';
import { useActiveStory } from '../hooks/useActiveStory';
import { useSources } from '../hooks/useSources';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../lib/errors';

/**
 * Hinweis in der Geschichten-Ansicht, wenn die aktive Geschichte die Quellen einschränkt – mit Wechsel zur
 * allgemeinen Ansicht, um wieder alles zu sehen.
 */
export function StorySourceBanner({ what }: { what: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { story, restricted, toGeneral } = useActiveStory();
  const { byId } = useSources();
  if (!story || !restricted) return null;
  const list = (story.sources ?? []).map((id) => (id === HOMEBREW_SOURCE ? t('storySources.homebrew') : byId(id)?.abbreviation || byId(id)?.name)).filter(Boolean);
  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 print:hidden dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
      role="status"
    >
      <BookMarked className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{t('storySources.banner', { what, story: story.name, list: list.join(', ') || '–' })}</span>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold underline"
        onClick={() =>
          toGeneral().then(
            () => toast.show(t('storyView.general')),
            (err) => toast.error(errorMessage(t, err)),
          )
        }
      >
        <Globe2 className="h-4 w-4" aria-hidden />
        {t('storySources.showAll')}
      </button>
    </div>
  );
}
