import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Save, Search, Users } from 'lucide-react';
import type { CharacterSettingsDto } from '@zauberbuch/shared';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { Alert, PageSpinner, Spinner } from '../ui';

/**
 * Einstellungen eines Charakterbogens (Besitzer, DM, Admin):
 * Mitbearbeiter auswählen und den Bogen einer Geschichte zuordnen.
 */
export function SettingsTab({ characterId, ownerName, onStoryChange }: { characterId: string; ownerName: string; onStoryChange: (story: { id: string; name: string } | null) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [settings, setSettings] = useState<CharacterSettingsDto | null>(null);
  const [storyId, setStoryId] = useState<string>('');
  const [editors, setEditors] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const apply = (s: CharacterSettingsDto) => {
    setSettings(s);
    setStoryId(s.storyId ?? '');
    setEditors(new Set(s.editors.map((e) => e.id)));
  };

  useEffect(() => {
    api
      .characterSettings(characterId)
      .then((r) => apply(r.settings))
      .catch(setError);
  }, [characterId]);

  const dirty = useMemo(() => {
    if (!settings) return false;
    const before = new Set(settings.editors.map((e) => e.id));
    return (settings.storyId ?? '') !== storyId || before.size !== editors.size || [...editors].some((id) => !before.has(id));
  }, [settings, storyId, editors]);

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!settings) return <PageSpinner />;

  // Archivierte, aber noch zugeordnete Geschichte trotzdem anzeigen
  const stories = settings.options.stories;
  const needle = filter.trim().toLocaleLowerCase('de');
  const users = settings.options.users.filter((u) => !needle || u.username.toLocaleLowerCase('de').includes(needle) || editors.has(u.id));

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.saveCharacterSettings(characterId, { storyId: storyId || null, editorIds: [...editors] });
      apply(r.settings);
      onStoryChange(r.settings.storyId ? stories.find((s) => s.id === r.settings.storyId) ?? null : null);
      toast.success(t('sheet.settings.saved'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 print:hidden">
      <section className="sheet-box space-y-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold">
          <BookOpen className="h-5 w-5" />
          {t('sheet.settings.story')}
        </h3>
        <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('sheet.settings.storyHint', { owner: ownerName })}</p>
        <select className="input sm:max-w-md" value={storyId} onChange={(e) => setStoryId(e.target.value)} aria-label={t('sheet.settings.story')}>
          <option value="">{t('sheet.settings.noStory')}</option>
          {stories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          {settings.storyId && !stories.some((s) => s.id === settings.storyId) && <option value={settings.storyId}>{t('sheet.settings.archivedStory')}</option>}
        </select>
        {stories.length === 0 && <p className="text-xs text-parchment-700 dark:text-parchment-400">{t('sheet.settings.noStories')}</p>}
      </section>

      <section className="sheet-box space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex flex-1 items-center gap-2 font-display text-lg font-bold">
            <Users className="h-5 w-5" />
            {t('sheet.settings.editors')}
          </h3>
          {settings.options.users.length > 8 && (
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-600" />
              <input type="search" className="input !py-1 !pl-9 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('common.search')} aria-label={t('common.search')} />
            </div>
          )}
        </div>
        <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('sheet.settings.editorsHint', { owner: ownerName })}</p>
        {settings.options.users.length === 0 ? (
          <p className="text-sm">{t('sheet.settings.noUsers')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {users.map((u) => (
              <label key={u.id} className="chip-check">
                <input
                  type="checkbox"
                  checked={editors.has(u.id)}
                  onChange={(e) =>
                    setEditors((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(u.id);
                      else next.delete(u.id);
                      return next;
                    })
                  }
                />
                {u.username}
              </label>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button type="button" className="btn-primary" onClick={save} disabled={busy || !dirty}>
          {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {t('sheet.settings.save')}
        </button>
      </div>
    </div>
  );
}
