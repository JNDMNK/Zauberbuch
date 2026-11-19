import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Check, ChevronDown, Globe2 } from 'lucide-react';
import type { StoryRole } from '@zauberbuch/shared';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

type MyStory = { id: string; name: string; role: StoryRole | null };

/**
 * Umschalter „Allgemein“ / Geschichte. In der Geschichten-Ansicht springen Charakterbogen, Infotafel und Kampf
 * direkt zu den Inhalten der gewählten Geschichte. Die Auswahl wird im Konto gespeichert.
 */
export function StorySwitcher() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [stories, setStories] = useState<MyStory[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Liste laden (auch um den Namen der aktiven Geschichte anzuzeigen)
  useEffect(() => {
    if (!user) return;
    api
      .myStories()
      .then((r) => setStories(r.stories))
      .catch(() => setStories([]));
  }, [user?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const active = stories?.find((s) => s.id === user.activeStoryId) ?? null;
  // Ohne Geschichten gibt es nichts umzuschalten
  if (stories && stories.length === 0 && !user.activeStoryId) return null;

  const choose = async (storyId: string | null) => {
    setOpen(false);
    if (storyId === user.activeStoryId) return;
    try {
      const r = await api.setActiveStory(storyId);
      setUser(r.user);
      const story = stories?.find((s) => s.id === storyId);
      toast.show(story ? t('storyView.switched', { name: story.name }) : t('storyView.general'));
      // Auf Infotafel/Kampf/Charakterbogen direkt in die neue Ansicht wechseln
      const section = ['/board', '/combat', '/characters'].find((p) => window.location.pathname.startsWith(p));
      if (section) navigate(section, { state: { fromNav: true } });
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  const label = active ? active.name : t('storyView.general');
  return (
    <div ref={ref} className="sm:relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t('storyView.title')}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
          active ? 'border-sky-700 bg-sky-700 text-white dark:border-sky-500 dark:bg-sky-600' : 'border-parchment-500/60 text-parchment-800 hover:bg-parchment-200 dark:border-night-700 dark:text-parchment-300 dark:hover:bg-night-700'
        }`}
      >
        {active ? <BookOpen className="h-3.5 w-3.5" /> : <Globe2 className="h-3.5 w-3.5" />}
        <span className="hidden max-w-[8rem] truncate sm:inline lg:hidden xl:inline xl:max-w-[12rem]">{label}</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div role="menu" className="parchment absolute inset-x-3 top-full z-50 mt-1 overflow-hidden py-1 sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-64">
          <p className="px-4 pb-1 pt-2 font-display text-xs font-bold uppercase tracking-wider text-parchment-700 dark:text-parchment-400">{t('storyView.title')}</p>
          <button role="menuitemradio" aria-checked={!user.activeStoryId} type="button" onClick={() => choose(null)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-parchment-200/70 dark:hover:bg-night-700">
            <Globe2 className="h-4 w-4" />
            <span className="flex-1">{t('storyView.general')}</span>
            {!user.activeStoryId && <Check className="h-4 w-4" />}
          </button>
          {(stories ?? []).map((s) => (
            <button
              key={s.id}
              role="menuitemradio"
              aria-checked={s.id === user.activeStoryId}
              type="button"
              onClick={() => choose(s.id)}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-parchment-200/70 dark:hover:bg-night-700"
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              {s.role && <span className="text-xs text-parchment-700 dark:text-parchment-400">{t(`storyRole.${s.role}`)}</span>}
              {s.id === user.activeStoryId && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
          <p className="border-t border-parchment-300/70 px-4 py-2 text-xs text-parchment-700 dark:border-night-700 dark:text-parchment-400">{t('storyView.hint')}</p>
        </div>
      )}
    </div>
  );
}
