import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeft, Check, Eye, Printer } from 'lucide-react';
import { characterSheetSchema, type CharacterDto, type CharacterSheet } from '@zauberbuch/shared';
import { api, saveCharacterKeepalive } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { Alert, PageSpinner, Spinner } from '../components/ui';
import { SheetContext, setIn, type Path, type SheetCtx } from '../components/sheet/SheetContext';
import { IdentityHeader, MainTab } from '../components/sheet/MainTab';
import { FeaturesTab } from '../components/sheet/FeaturesTab';
import { BackgroundTab, PhysicalHeader } from '../components/sheet/BackgroundTab';
import { SpellsTab } from '../components/sheet/SpellsTab';
import { SettingsTab } from '../components/sheet/SettingsTab';

const TABS = ['main', 'features', 'background', 'spells'] as const;
/** „Einstellungen“ nur für Besitzer, DM und Admin; nicht im Druck */
type Tab = (typeof TABS)[number] | 'settings';
type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export function CharacterSheetPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') ?? '';
  const [character, setCharacter] = useState<CharacterDto | null>(null);
  const [sheet, setSheet] = useState<CharacterSheet | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const pending = useRef<CharacterSheet | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    api
      .character(id)
      .then(({ character: c }) => {
        setCharacter(c);
        setSheet(characterSheetSchema.parse(c.data));
      })
      .catch(setError);
  }, [id]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const data = pending.current;
    if (!id || !data) return;
    pending.current = null;
    setSaveState('saving');
    try {
      await api.saveCharacter(id, data);
      setSaveState(pending.current ? 'dirty' : 'saved');
    } catch {
      pending.current = pending.current ?? data;
      setSaveState('error');
    }
  }, [id]);

  // Beim Verlassen der Seite / Schließen des Tabs ungespeicherte Änderungen sichern
  useEffect(() => {
    const onHide = () => {
      if (id && pending.current) {
        saveCharacterKeepalive(id, pending.current);
        pending.current = null;
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      onHide();
    };
  }, [id]);

  // Gedruckt wird immer im hellen Design (dunkler Modus würde dunkle Kästen aufs Papier bringen)
  useEffect(() => {
    const root = document.documentElement;
    let wasDark = false;
    const before = () => {
      wasDark = root.classList.contains('dark');
      if (wasDark) root.classList.remove('dark');
    };
    const after = () => {
      if (wasDark) root.classList.add('dark');
      wasDark = false;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  const canEdit = Boolean(character?.canEdit);
  const navTabs: readonly Tab[] = character?.canManageSettings ? [...TABS, 'settings'] : TABS;
  const tab: Tab = (navTabs as readonly string[]).includes(requestedTab) ? (requestedTab as Tab) : 'main';

  const set = useCallback(
    (path: Path, value: unknown) => {
      if (!canEdit) return;
      setSheet((prev) => {
        if (!prev) return prev;
        const next = setIn(prev, path, value);
        pending.current = next;
        return next;
      });
      setSaveState('dirty');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 800);
    },
    [canEdit, flush],
  );

  const ctx = useMemo<SheetCtx | null>(() => (sheet ? { sheet, set, readOnly: !canEdit } : null), [sheet, set, canEdit]);

  useEffect(() => {
    const name = sheet?.identity.name;
    document.title = `${name || t('characters.unnamed')} · ${t('app.title')}`;
    return () => {
      document.title = t('app.title');
    };
  }, [sheet?.identity.name, t]);

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!character || !sheet || !ctx) return <PageSpinner />;

  const backTo = '/characters';
  const status = {
    saved: { icon: <Check className="h-4 w-4" />, text: t('characters.saved'), cls: 'text-emerald-700 dark:text-emerald-400' },
    dirty: { icon: <span className="h-2 w-2 rounded-full bg-amber-500" />, text: t('characters.unsaved'), cls: 'text-amber-700 dark:text-amber-400' },
    saving: { icon: <Spinner className="h-4 w-4" />, text: t('characters.saving'), cls: 'text-parchment-700 dark:text-parchment-300' },
    error: { icon: <AlertTriangle className="h-4 w-4" />, text: t('characters.saveError'), cls: 'text-red-700 dark:text-red-400' },
  }[saveState];

  return (
    <SheetContext.Provider value={ctx}>
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
        <Link to={backTo} className="btn-ghost !px-2">
          <ArrowLeft className="h-4 w-4" />
          {canEdit ? t('characters.back') : t('characters.backAdmin')}
        </Link>
        <div className="ml-auto flex items-center gap-3">
          {canEdit && !character.isOwner && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              {t('characters.coEditing', { owner: character.owner?.username ?? '' })}
            </span>
          )}
          {canEdit ? (
            <span className={`inline-flex items-center gap-1.5 text-sm ${status.cls}`} role="status" aria-live="polite">
              {status.icon}
              {status.text}
              {saveState === 'error' && (
                <button type="button" className="underline" onClick={() => void flush()}>
                  {t('common.retry')}
                </button>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-200">
              <Eye className="h-4 w-4" />
              {t('characters.readOnly', { owner: character.owner?.username ?? '' })}
            </span>
          )}
          <button type="button" className="btn-icon" onClick={() => window.print()} title={t('characters.print')} aria-label={t('characters.print')}>
            <Printer className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="character-sheet min-w-0 space-y-4">
        <fieldset disabled={!canEdit} className="sheet-box grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <input
              className="sheet-input font-display !text-2xl font-bold sm:!text-3xl"
              value={sheet.identity.name}
              maxLength={100}
              onChange={(e) => set(['identity', 'name'], e.target.value)}
              aria-label={t('sheet.characterName')}
              placeholder={t('characters.unnamed')}
            />
            <span className="sheet-label">{t('sheet.characterName')}</span>
          </div>
          {tab === 'background' ? (
            <>
              <div className="print:hidden">
                <PhysicalHeader />
              </div>
              <div className="hidden print:block">
                <IdentityHeader />
              </div>
            </>
          ) : (
            <IdentityHeader />
          )}
        </fieldset>

        <nav role="tablist" className="flex gap-1 overflow-x-auto border-b border-parchment-400/60 print:hidden dark:border-night-700">
          {navTabs.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setSearchParams(k === 'main' ? {} : { tab: k }, { replace: true })}
              className={`whitespace-nowrap border-b-2 px-4 py-2 font-display text-sm font-semibold ${
                tab === k ? 'border-parchment-800 text-ink dark:border-parchment-300 dark:text-parchment-50' : 'border-transparent text-parchment-700 hover:text-ink dark:text-parchment-400 dark:hover:text-parchment-100'
              }`}
            >
              {t(`sheet.tabs.${k}`)}
            </button>
          ))}
        </nav>

        {/* Reiterleiste liegt außerhalb, damit sie auch im Nur-Lesen-Modus bedienbar bleibt */}
        {/* Beim Drucken werden alle Seiten des Bogens ausgegeben, jede auf einer neuen Seite */}
        <fieldset disabled={!canEdit} className="min-w-0 space-y-4">
          {TABS.map((k, i) => (
            <div key={k} className={`${tab === k ? '' : 'hidden print:block'} ${i > 0 ? 'print-page' : ''} space-y-4`}>
              {k === 'main' && <MainTab />}
              {k === 'features' && <FeaturesTab />}
              {k === 'background' && (
                <>
                  <div className="sheet-box hidden print:block">
                    <PhysicalHeader />
                  </div>
                  <BackgroundTab />
                </>
              )}
              {k === 'spells' && <SpellsTab />}
            </div>
          ))}
        </fieldset>
        {/* Einstellungen außerhalb des Bogens: auch DM/Admin (nur lesend im Bogen) dürfen sie ändern */}
        {tab === 'settings' && character.canManageSettings && (
          <SettingsTab characterId={character.id} ownerName={character.owner?.username ?? ''} onStoryChange={(story) => setCharacter((c) => (c ? { ...c, story } : c))} />
        )}
      </div>
    </SheetContext.Provider>
  );
}
