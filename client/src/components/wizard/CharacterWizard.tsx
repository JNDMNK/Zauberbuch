import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveCaster } from '../../lib/levelUp';
import { useActiveStory } from '../../hooks/useActiveStory';
import { useSources } from '../../hooks/useSources';
import { useContentLabels } from '../wiki/WikiLinks';
import { Check, ChevronLeft, ChevronRight, Dices, Minus, Plus, Wand2 } from 'lucide-react';
import {
  ABILITIES,
  HOMEBREW_SOURCE,
  SKILL_KEYS,
  sourceAllowed,
  abilityModifier,
  catalogInventoryText,
  formatModifier,
  type Ability,
  type CatalogItemDto,
  type CharacterSheet,
  type SheetItem,
  type SkillKey,
  type WikiEntryDto,
  localized,
} from '@zauberbuch/shared';
import { useFormatDamage } from '../sheet/InventoryTable';
import { matchesPlaceholder, parseEquipment } from '../../lib/startingEquipment';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../Modal';
import { Alert, PageSpinner, Spinner } from '../ui';
import { useSpellClass } from '../wiki/ClassSpells';
import {
  POINT_BUY_BUDGET,
  POINT_BUY_COST,
  STANDARD_ARRAY,
  buildSheet,
  choiceCount,
  findNames,
  parseAbilityIncrease,
  parseSkills,
  pointBuySpent,
  roll4d6,
  subclassLevel,
  toolChoiceType,
  type BackgroundEntry,
  type ClassEntry,
  type NameMap,
  type RaceEntry,
} from '../../lib/characterWizard';

const STEPS = ['story', 'basics', 'race', 'class', 'background', 'abilities', 'skills', 'equipment', 'summary'] as const;
type Step = (typeof STEPS)[number];
type Method = 'standard' | 'pointBuy' | 'manual';
type BonusSource = 'race' | 'background' | 'none';
const base8 = () => Object.fromEntries(ABILITIES.map((a) => [a, 8])) as Record<Ability, number>;

/** Quellen einer Geschichte als Liste (Name) */
function StorySourceList({ sources }: { sources: string[] }) {
  const { t } = useTranslation();
  const { byId, label } = useSources();
  return (
    <p className="text-sm text-parchment-700 dark:text-parchment-400">
      {t('wizard.storySources', { list: sources.map((id) => (id === HOMEBREW_SOURCE ? t('storySources.homebrew') : (byId(id) ? label(byId(id)!) : id))).join(', ') })}
    </p>
  );
}

/** Auswahlkarte (Volk, Klasse, Hintergrund) */
function ChoiceCard({ selected, onClick, title, children }: { selected: boolean; onClick: () => void; title: string; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex h-full w-full flex-col gap-1 rounded-lg border p-3 text-left transition ${
        selected
          ? 'border-parchment-800 bg-parchment-200 ring-2 ring-parchment-700 dark:border-parchment-300 dark:bg-night-700 dark:ring-parchment-400'
          : 'border-parchment-400 bg-parchment-50 hover:border-parchment-700 dark:border-night-700 dark:bg-night-800'
      }`}
    >
      <span className="flex items-center gap-2 font-display font-bold">
        {selected && <Check className="h-4 w-4 shrink-0" />}
        {title}
      </span>
      {children && <span className="text-sm text-parchment-800 dark:text-parchment-300">{children}</span>}
    </button>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder ?? '—'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Assistent für neue Charaktere: Name → Volk → Klasse → Hintergrund → Attributswerte → Fertigkeiten/Sprachen/Werkzeuge
 * → Zusammenfassung. Werte stammen aus dem Wiki; am Ende wird ein vollständig ausgefüllter Bogen der Stufe 1 angelegt.
 */
export function CharacterWizard({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const [wiki, setWiki] = useState<WikiEntryDto[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogItemDto[]>([]);
  const tools = useMemo(() => catalog.filter((i) => i.category === 'tool'), [catalog]);
  const labels = useContentLabels();
  /** Wiki-Eintrag in der gewählten Sprache (Name, Kurzbeschreibung, Text) */
  const L = <E extends WikiEntryDto>(e: E): E => ({ ...e, name: localized(e.name, e.nameEn, i18n.language), summary: localized(e.summary, e.summaryEn, i18n.language), description: localized(e.description, e.descriptionEn, i18n.language) });
  const [error, setError] = useState<unknown>(null);
  const [step, setStep] = useState<Step>('story');
  // Geschichte, in der der Charakter mitspielt ('' = ohne Geschichte); vorausgewählt: aktive Geschichte
  const activeStory = useActiveStory();
  const myStories = activeStory.stories ?? [];
  const [storyId, setStoryId] = useState('');
  useEffect(() => {
    if (open) setStoryId(activeStory.story?.id ?? '');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosenStory = myStories.find((x) => x.id === storyId) ?? null;
  const storySources = chosenStory?.sources ?? null;
  const allowed = (sourceId: string | null | undefined) => sourceAllowed(storySources, sourceId);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [raceId, setRaceId] = useState('');
  const [subrace, setSubrace] = useState('');
  const [classId, setClassId] = useState('');
  const [subclass, setSubclass] = useState('');
  const [bgId, setBgId] = useState('');
  const [method, setMethod] = useState<Method>('standard');
  const [standard, setStandard] = useState<Record<Ability, string>>(() => Object.fromEntries(ABILITIES.map((a) => [a, ''])) as Record<Ability, string>);
  const [pointBuy, setPointBuy] = useState<Record<Ability, number>>(base8);
  const [manual, setManual] = useState<Record<Ability, number>>(() => Object.fromEntries(ABILITIES.map((a) => [a, 10])) as Record<Ability, number>);
  const [bonusSource, setBonusSource] = useState<BonusSource>('race');
  const [raceChoice, setRaceChoice] = useState<string[]>([]);
  const [bgMode, setBgMode] = useState<'21' | '111'>('21');
  const [bgPlus2, setBgPlus2] = useState('');
  const [bgPlus1, setBgPlus1] = useState('');
  const [classSkills, setClassSkills] = useState<SkillKey[]>([]);
  const [extraLanguages, setExtraLanguages] = useState<string[]>([]);
  const [extraTools, setExtraTools] = useState<string[]>([]);
  const [rollPersonality, setRollPersonality] = useState(true);
  const [takeEquipment, setTakeEquipment] = useState(true);
  const [unpackPacks, setUnpackPacks] = useState(true);
  const [equipChoice, setEquipChoice] = useState<Record<string, number>>({});
  const [equipPick, setEquipPick] = useState<Record<string, string>>({});
  const formatDamage = useFormatDamage();

  useEffect(() => {
    if (!open || wiki) return;
    Promise.all([api.wiki(), api.catalog()])
      .then(([w, c]) => {
        setWiki(w.entries);
        setCatalog(c.items.filter((i) => !i.hidden));
      })
      .catch(setError);
  }, [open, wiki]);

  // Namen zum Erkennen in den Wiki-Texten (deutsch und englisch)
  const abilityNames = useMemo(() => Object.fromEntries(ABILITIES.map((a) => [a, [t(`sheet.ability.${a}`, { lng: 'de' }), t(`sheet.ability.${a}`, { lng: 'en' })]])) as NameMap<Ability>, [t]);
  const skillNames = useMemo(() => Object.fromEntries(SKILL_KEYS.map((s) => [s, [t(`sheet.skill.${s}`, { lng: 'de' }), t(`sheet.skill.${s}`, { lng: 'en' })]])) as NameMap<SkillKey>, [t]);

  // Nur Inhalte aus den Quellen der gewählten Geschichte; Sprachen aus der Liste der Geschichte
  const races = (wiki ?? []).filter((e): e is RaceEntry => e.kind === 'race' && allowed(e.sourceId));
  const classes = (wiki ?? []).filter((e): e is ClassEntry => e.kind === 'class' && allowed(e.sourceId));
  const backgrounds = (wiki ?? []).filter((e): e is BackgroundEntry => e.kind === 'background' && allowed(e.sourceId));
  const wikiLanguageNames = (wiki ?? []).filter((e) => e.kind === 'language').map((e) => e.name);
  const languageNames = chosenStory ? chosenStory.languages : wikiLanguageNames;
  const race = races.find((r) => r.id === raceId) ?? null;
  const cls = classes.find((c) => c.id === classId) ?? null;
  const bg = backgrounds.find((b) => b.id === bgId) ?? null;
  const spellClass = useSpellClass(cls?.name ?? '');
  const casterInfo = resolveCaster(cls, spellClass);
  const level1Slots = casterInfo.slots(1);
  const subLevel = cls ? subclassLevel(cls) : null;
  const subclassOptions = cls ? cls.data.subclasses.filter((x) => allowed(x.sourceId ?? cls.sourceId)) : [];
  const needsSubclass = !!cls && subLevel === 1 && subclassOptions.length > 0;

  // Attributswerte
  const baseScores: Record<Ability, number> | null = useMemo(() => {
    if (method === 'pointBuy') return pointBuy;
    if (method === 'manual') return manual;
    if (ABILITIES.some((a) => !standard[a])) return null;
    return Object.fromEntries(ABILITIES.map((a) => [a, Number(standard[a])])) as Record<Ability, number>;
  }, [method, pointBuy, manual, standard]);
  const raceIncrease = useMemo(() => {
    const sub = race?.data.subraces.find((s) => s.name === subrace);
    const a = parseAbilityIncrease(race?.data.abilityIncrease ?? '', abilityNames);
    const b = parseAbilityIncrease(sub?.abilityIncrease ?? '', abilityNames);
    return {
      fixed: { ...a.fixed, ...Object.fromEntries(Object.entries(b.fixed).map(([k, v]) => [k, (a.fixed[k as Ability] ?? 0) + (v ?? 0)])) } as Partial<Record<Ability, number>>,
      choose: a.choose ?? b.choose,
    };
  }, [race, subrace, abilityNames]);
  const hasRaceBonus = Object.keys(raceIncrease.fixed).length > 0 || !!raceIncrease.choose;
  const bgAbilities = bg?.data.abilityScores ?? [];
  const bonus: Record<Ability, number> = useMemo(() => {
    const b = Object.fromEntries(ABILITIES.map((a) => [a, 0])) as Record<Ability, number>;
    if (bonusSource === 'race') {
      for (const [a, v] of Object.entries(raceIncrease.fixed)) b[a as Ability] += v ?? 0;
      if (raceIncrease.choose) for (const a of raceChoice.slice(0, raceIncrease.choose.count)) if (a) b[a as Ability] += raceIncrease.choose.amount;
    } else if (bonusSource === 'background') {
      if (bgMode === '111') for (const a of bgAbilities) b[a] += 1;
      else {
        if (bgPlus2) b[bgPlus2 as Ability] += 2;
        if (bgPlus1) b[bgPlus1 as Ability] += 1;
      }
    }
    return b;
  }, [bonusSource, raceIncrease, raceChoice, bgMode, bgAbilities, bgPlus2, bgPlus1]);
  const finalScores = baseScores ? (Object.fromEntries(ABILITIES.map((a) => [a, Math.min(20, baseScores[a] + bonus[a])])) as Record<Ability, number>) : null;

  // Fertigkeiten, Sprachen, Werkzeuge
  const bgSkills = useMemo(() => parseSkills(bg?.data.skills ?? '', skillNames).fixed, [bg, skillNames]);
  const clsSkills = useMemo(() => parseSkills(cls?.data.skills ?? '', skillNames), [cls, skillNames]);
  const langSources = [race?.data.languages ?? '', bg?.data.languages ?? ''].filter(Boolean);
  const langMap = useMemo(() => Object.fromEntries(languageNames.map((n) => [n, [n]])) as NameMap<string>, [languageNames]);
  const fixedLanguages = [...new Set(langSources.flatMap((s) => findNames(s, langMap)))];
  // „Halbling“ im Volkstext → Wiki-Sprache „Halblingisch“ (Endung fehlt im Text)
  for (const s of langSources) for (const n of languageNames) if (!fixedLanguages.includes(n) && new RegExp(`(?<![\\p{L}])${n.replace(/isch$/, '')}(?![\\p{L}])`, 'iu').test(s)) fixedLanguages.push(n);
  // Sprachen des Volks/Hintergrunds, die es in der Geschichte nicht gibt
  const excludedLanguages = chosenStory
    ? wikiLanguageNames.filter((n) => !languageNames.includes(n) && langSources.some((s) => new RegExp(`(?<![\\p{L}])${n.replace(/isch$/, '')}`, 'iu').test(s)))
    : [];
  const languageChoices = langSources.reduce((n, s) => n + choiceCount(s), 0);
  const toolSources = [cls?.data.tools ?? '', bg?.data.tools ?? ''].filter((s) => s && !/^keine$|^none$/i.test(s.trim()));
  const toolMap = useMemo(() => Object.fromEntries(tools.map((i) => [i.name, [i.name]])) as NameMap<string>, [tools]);
  const fixedTools = [...new Set(toolSources.flatMap((s) => findNames(s, toolMap)))];
  const toolChoices = toolSources.map((s) => ({ count: choiceCount(s), type: toolChoiceType(s), text: s })).filter((c) => c.count > 0);
  const toolSlots = toolChoices.flatMap((c) => Array.from({ length: c.count }, () => c));

  // Startausrüstung von Klasse und Hintergrund
  const equipLines = useMemo(
    () => [...(cls?.data.equipment ? parseEquipment(cls.data.equipment, cls.name, catalog) : []), ...(bg?.data.equipment ? parseEquipment(bg.data.equipment, bg.name, catalog) : [])],
    [cls, bg, catalog],
  );
  useEffect(() => (setEquipChoice({}), setEquipPick({})), [classId, bgId]);
  const startingEquipment = useMemo(() => {
    const items: SheetItem[] = [];
    const coins: Partial<CharacterSheet['coins']> = {};
    const add = (item: CatalogItemDto | null, name: string, qty: number) => {
      const existing = items.find((x) => (item ? x.ref === item.id : !x.ref && x.name === name));
      if (existing) existing.qty += qty;
      else items.push(item ? { name: catalogInventoryText({ ...item, name: localized(item.name, item.nameEn, i18n.language), description: localized(item.description, item.descriptionEn, i18n.language) }, formatDamage, { ac: t('combat.acShort'), strength: t('catalog.strengthShort') }), qty, weight: item.weight, ref: item.id } : { name: name.slice(0, 150), qty, weight: 0, ref: null });
    };
    equipLines.forEach((line, li) => {
      const oi = Math.min(equipChoice[`${li}`] ?? 0, line.options.length - 1);
      line.options[oi]?.parts.forEach((part, pi) => {
        if (part.coins) for (const [k, v] of Object.entries(part.coins)) coins[k as keyof CharacterSheet['coins']] = (coins[k as keyof CharacterSheet['coins']] ?? 0) + (v ?? 0);
        else if (part.placeholder)
          for (let q = 0; q < part.qty; q++) {
            const picked = catalog.find((c) => c.id === equipPick[`${li}-${oi}-${pi}-${q}`]);
            add(picked ?? null, picked ? picked.name : part.text.replace(/^(ein|eine|einen|zwei|drei)\s+/i, '').replace(/^./, (c) => c.toUpperCase()), 1);
          }
        else if (part.pack && unpackPacks) for (const c of part.pack) add(catalog.find((x) => x.name === c.name) ?? null, c.name, c.qty * part.qty);
        else add(part.item, part.name, part.qty);
      });
    });
    // Werkzeuge mit Übung auch als Gegenstand
    for (const name of [...fixedTools, ...extraTools.filter(Boolean)]) {
      const item = tools.find((x) => x.name === name);
      if (item && !items.some((x) => x.ref === item.id)) add(item, item.name, 1);
    }
    return { items, coins };
  }, [equipLines, equipChoice, equipPick, catalog, tools, fixedTools, extraTools, formatDamage, unpackPacks]);

  // Auswahl zurücksetzen, wenn sich die Grundlage ändert
  useEffect(() => setSubrace(''), [raceId]);
  useEffect(() => (setSubclass(''), setClassSkills([])), [classId]);
  useEffect(() => setRaceChoice([]), [raceId, subrace]);
  useEffect(() => (setBgPlus2(''), setBgPlus1('')), [bgId]);
  useEffect(() => setBonusSource(hasRaceBonus ? 'race' : bgAbilities.length ? 'background' : 'none'), [hasRaceBonus, bgAbilities.length]);

  const reset = () => {
    setStep('story');
    setName('');
    setRaceId('');
    setClassId('');
    setBgId('');
    setMethod('standard');
    setStandard(Object.fromEntries(ABILITIES.map((a) => [a, ''])) as Record<Ability, string>);
    setPointBuy(base8());
    setExtraLanguages([]);
    setExtraTools([]);
  };
  const close = () => {
    reset();
    onClose();
  };

  const stepOk: Record<Step, boolean> = {
    story: true,
    basics: name.trim().length > 0,
    race: !!race && (race.data.subraces.length === 0 || !!subrace),
    class: !!cls && (!needsSubclass || !!subclass),
    background: true,
    equipment: true,
    abilities:
      !!baseScores &&
      (method !== 'pointBuy' || pointBuySpent(pointBuy) <= POINT_BUY_BUDGET) &&
      (bonusSource !== 'race' || !raceIncrease.choose || raceChoice.filter(Boolean).length === raceIncrease.choose.count) &&
      (bonusSource !== 'background' || bgMode === '111' || (!!bgPlus2 && !!bgPlus1 && bgPlus2 !== bgPlus1)),
    skills: !clsSkills.choose || classSkills.length === Math.min(clsSkills.choose.count, clsSkills.choose.options.filter((s) => !bgSkills.includes(s)).length),
    summary: true,
  };
  const idx = STEPS.indexOf(step);

  const create = async () => {
    if (!finalScores) return;
    setBusy(true);
    try {
      const sheet = buildSheet({
        name,
        playerName: user?.username ?? '',
        // Namen in der gewählten Sprache in den Bogen (Klassen werden später an beiden Namen erkannt)
        race: race ? L(race) : race,
        subrace,
        cls: cls ? L(cls) : cls,
        subclass,
        spellClass,
        caster: casterInfo.type ? { ability: casterInfo.ability, slots: level1Slots } : null,
        background: bg ? L(bg) : bg,
        abilities: finalScores,
        skills: [...new Set([...bgSkills, ...classSkills])],
        languages: [...fixedLanguages, ...extraLanguages],
        tools: [...fixedTools, ...extraTools],
        rollPersonality,
        abilityNames,
        inventory: takeEquipment ? startingEquipment.items : null,
        equipmentHeading: t('wizard.equipmentHeading'),
        coins: takeEquipment ? startingEquipment.coins : {},
      });
      const { character } = await api.createCharacter(name.trim(), storyId || null);
      await api.saveCharacter(character.id, sheet);
      toast.success(t('wizard.created', { name: name.trim() }));
      reset();
      onCreated(character.id);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const abilityLabel = (a: Ability) => t(`sheet.ability.${a}`);
  const optionsAbilities = (list: readonly Ability[] = ABILITIES) => list.map((a) => ({ value: a, label: abilityLabel(a) }));

  return (
    <Modal
      open={open}
      onClose={close}
      size="max-w-4xl"
      title={
        <span className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          {t('wizard.title')}
        </span>
      }
    >
      {error ? (
        <Alert>{errorMessage(t, error)}</Alert>
      ) : !wiki ? (
        <PageSpinner />
      ) : (
        <div className="space-y-5">
          {/* Schritte */}
          <ol className="flex flex-wrap gap-1.5 text-xs" aria-label={t('wizard.steps')}>
            {STEPS.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  disabled={i > idx && !STEPS.slice(0, i).every((p) => stepOk[p])}
                  onClick={() => setStep(s)}
                  aria-current={s === step ? 'step' : undefined}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold disabled:opacity-40 ${
                    s === step
                      ? 'border-parchment-800 bg-parchment-800 text-parchment-50 dark:border-parchment-300 dark:bg-parchment-300 dark:text-night-900'
                      : 'border-parchment-400 dark:border-night-700'
                  }`}
                >
                  <span className="tabular-nums">{i + 1}.</span> {t(`wizard.step.${s}`)}
                  {i < idx && stepOk[s] && <Check className="h-3 w-3" />}
                </button>
              </li>
            ))}
          </ol>

          {step === 'story' && (
            <div className="space-y-3">
              <p>{t('wizard.storyIntro')}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {myStories.map((st) => (
                  <ChoiceCard key={st.id} selected={storyId === st.id} onClick={() => setStoryId(st.id)} title={st.name}>
                    {[st.role ? t(`storyRole.${st.role}`) : '', st.sources ? t('wizard.storyRestricted', { count: st.sources.length }) : t('wizard.storyAllSources')].filter(Boolean).join(' · ')}
                  </ChoiceCard>
                ))}
                <ChoiceCard selected={storyId === ''} onClick={() => setStoryId('')} title={t('wizard.noStory')}>
                  {t('wizard.noStoryHint')}
                </ChoiceCard>
              </div>
              {chosenStory?.sources && <StorySourceList sources={chosenStory.sources} />}
            </div>
          )}

          {step === 'basics' && (
            <div className="space-y-3">
              <p>{t('wizard.intro')}</p>
              <div className="max-w-md">
                <label htmlFor="wz-name" className="label">
                  {t('wizard.name')}
                </label>
                <input
                  id="wz-name"
                  className="input"
                  value={name}
                  maxLength={100}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && stepOk.basics && setStep('race')}
                />
              </div>
            </div>
          )}

          {step === 'race' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {races.map((r) => (
                  <ChoiceCard key={r.id} selected={r.id === raceId} onClick={() => setRaceId(r.id)} title={L(r).name}>
                    {[r.data.abilityIncrease, r.data.speed.split(';')[0]].filter(Boolean).join(' · ')}
                  </ChoiceCard>
                ))}
              </div>
              {race && race.data.subraces.length > 0 && (
                <div className="max-w-md">
                  <Select
                    id="wz-subrace"
                    label={t('wizard.subrace')}
                    value={subrace}
                    onChange={setSubrace}
                    options={race.data.subraces.map((s) => ({ value: s.name, label: s.abilityIncrease ? `${s.name} (${s.abilityIncrease})` : s.name }))}
                    placeholder={t('wizard.choose')}
                  />
                </div>
              )}
              {race && L(race).summary && <p className="italic">{L(race).summary}</p>}
            </div>
          )}

          {step === 'class' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map((c) => (
                  <ChoiceCard key={c.id} selected={c.id === classId} onClick={() => setClassId(c.id)} title={L(c).name}>
                    {[c.data.hitDie ? t('wizard.hitDie', { die: c.data.hitDie.replace('d', 'W') }) : '', c.data.primaryAbility].filter(Boolean).join(' · ')}
                  </ChoiceCard>
                ))}
              </div>
              {needsSubclass && cls && (
                <div className="max-w-md">
                  <Select
                    id="wz-subclass"
                    label={cls.data.subclassTitle || t('wiki.class.subclasses')}
                    value={subclass}
                    onChange={setSubclass}
                    options={subclassOptions.map((s) => ({ value: s.name, label: s.name }))}
                    placeholder={t('wizard.choose')}
                  />
                </div>
              )}
              {cls && !needsSubclass && subLevel && (
                <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('wizard.subclassLater', { title: cls.data.subclassTitle || t('wiki.class.subclasses'), level: subLevel })}</p>
              )}
              {cls && level1Slots && level1Slots.every((v) => v === 0) && <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('wizard.spellsLater')}</p>}
            </div>
          )}

          {step === 'background' && (
            <div className="space-y-4">
              {backgrounds.length === 0 ? (
                <p className="italic">{t('wizard.noBackgrounds')}</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {backgrounds.map((b) => (
                    <ChoiceCard key={b.id} selected={b.id === bgId} onClick={() => setBgId(b.id === bgId ? '' : b.id)} title={L(b).name}>
                      {[b.data.skills, b.data.feat].filter(Boolean).join(' · ')}
                    </ChoiceCard>
                  ))}
                </div>
              )}
              {bg && (bg.data.personalityTraits.length > 0 || bg.data.ideals.length > 0) && (
                <label className="chip-check chip-check-block">
                  <input type="checkbox" checked={rollPersonality} onChange={(e) => setRollPersonality(e.target.checked)} />
                  {t('wizard.rollPersonality')}
                </label>
              )}
            </div>
          )}

          {step === 'abilities' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('wizard.method')}>
                {(['standard', 'pointBuy', 'manual'] as Method[]).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={method === m ? 'btn-primary' : 'btn-secondary'}>
                    {t(`wizard.methods.${m}`)}
                  </button>
                ))}
              </div>
              <p className="text-sm text-parchment-700 dark:text-parchment-400">{t(`wizard.methodHint.${method}`, { budget: POINT_BUY_BUDGET })}</p>
              {method === 'pointBuy' && (
                <p className={`font-semibold ${pointBuySpent(pointBuy) > POINT_BUY_BUDGET ? 'text-red-700 dark:text-red-400' : ''}`}>
                  {t('wizard.pointsLeft', { n: POINT_BUY_BUDGET - pointBuySpent(pointBuy) })}
                </p>
              )}
              {method === 'manual' && (
                <button type="button" className="btn-secondary" onClick={() => setManual(Object.fromEntries(ABILITIES.map((a) => [a, roll4d6()])) as Record<Ability, number>)}>
                  <Dices className="h-4 w-4" />
                  {t('wizard.roll')}
                </button>
              )}

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-parchment-700 dark:text-parchment-400">
                      <th className="pb-1">{t('wizard.ability')}</th>
                      <th className="pb-1 text-center">{t('wizard.base')}</th>
                      <th className="pb-1 text-center">{t('wizard.bonus')}</th>
                      <th className="pb-1 text-center">{t('wizard.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ABILITIES.map((a) => {
                      const used = ABILITIES.filter((x) => x !== a).map((x) => standard[x]);
                      return (
                        <tr key={a} className="border-t border-parchment-300/70 dark:border-night-700">
                          <td className="py-1.5 font-semibold">{abilityLabel(a)}</td>
                          <td className="py-1.5 text-center">
                            {method === 'standard' ? (
                              <select
                                className="input !w-20 !py-1 text-center"
                                value={standard[a]}
                                onChange={(e) => setStandard((s) => ({ ...s, [a]: e.target.value }))}
                                aria-label={`${abilityLabel(a)}: ${t('wizard.base')}`}
                              >
                                <option value="">—</option>
                                {STANDARD_ARRAY.map((v) => (
                                  <option key={v} value={v} disabled={used.includes(String(v))}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            ) : method === 'pointBuy' ? (
                              <span className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  className="btn-icon !p-1"
                                  disabled={pointBuy[a] <= 8}
                                  onClick={() => setPointBuy((s) => ({ ...s, [a]: s[a] - 1 }))}
                                  aria-label={`${abilityLabel(a)} −1`}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-6 tabular-nums">{pointBuy[a]}</span>
                                <button
                                  type="button"
                                  className="btn-icon !p-1"
                                  disabled={pointBuy[a] >= 15 || pointBuySpent({ ...pointBuy, [a]: pointBuy[a] + 1 }) > POINT_BUY_BUDGET}
                                  onClick={() => setPointBuy((s) => ({ ...s, [a]: s[a] + 1 }))}
                                  aria-label={`${abilityLabel(a)} +1`}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-8 text-xs text-parchment-700 dark:text-parchment-400">({POINT_BUY_COST[pointBuy[a]]})</span>
                              </span>
                            ) : (
                              <input
                                className="input !w-20 !py-1 text-center"
                                inputMode="numeric"
                                value={manual[a]}
                                onChange={(e) => setManual((s) => ({ ...s, [a]: Math.min(20, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)) }))}
                                aria-label={`${abilityLabel(a)}: ${t('wizard.base')}`}
                              />
                            )}
                          </td>
                          <td className="py-1.5 text-center tabular-nums">{bonus[a] ? `+${bonus[a]}` : '–'}</td>
                          <td className="py-1.5 text-center font-bold tabular-nums">
                            {finalScores ? (
                              <>
                                {finalScores[a]} <span className="font-normal text-parchment-700 dark:text-parchment-400">({formatModifier(abilityModifier(finalScores[a]))})</span>
                              </>
                            ) : (
                              '–'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="space-y-3">
                  <fieldset>
                    <legend className="label">{t('wizard.bonusSource')}</legend>
                    <div className="space-y-1.5">
                      {(['race', 'background', 'none'] as BonusSource[]).map((s) => (
                        <label key={s} className="chip-check chip-check-block">
                          <input
                            type="radio"
                            name="wz-bonus"
                            checked={bonusSource === s}
                            disabled={(s === 'race' && !hasRaceBonus) || (s === 'background' && bgAbilities.length === 0)}
                            onChange={() => setBonusSource(s)}
                          />
                          {s === 'race'
                            ? t('wizard.bonusRace', { text: [race?.data.abilityIncrease, race?.data.subraces.find((x) => x.name === subrace)?.abilityIncrease].filter(Boolean).join(', ') || '–' })
                            : s === 'background'
                              ? t('wizard.bonusBackground', { list: bgAbilities.map(abilityLabel).join(', ') || '–' })
                              : t('wizard.bonusNone')}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {bonusSource === 'race' && raceIncrease.choose && (
                    <div className="grid grid-cols-2 gap-2">
                      {Array.from({ length: raceIncrease.choose.count }, (_, i) => (
                        <Select
                          key={i}
                          id={`wz-rc-${i}`}
                          label={t('wizard.chooseAbility', { n: i + 1, amount: raceIncrease.choose!.amount })}
                          value={raceChoice[i] ?? ''}
                          onChange={(v) => setRaceChoice((l) => Object.assign([...l], { [i]: v }))}
                          options={optionsAbilities(ABILITIES.filter((a) => !raceIncrease.fixed[a] && (raceChoice[i] === a || !raceChoice.includes(a))))}
                        />
                      ))}
                    </div>
                  )}
                  {bonusSource === 'background' && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {(['21', '111'] as const).map((m) => (
                          <button key={m} type="button" className={bgMode === m ? 'btn-primary !py-1' : 'btn-secondary !py-1'} onClick={() => setBgMode(m)} aria-pressed={bgMode === m}>
                            {m === '21' ? '+2 / +1' : '+1 / +1 / +1'}
                          </button>
                        ))}
                      </div>
                      {bgMode === '21' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Select id="wz-bg2" label="+2" value={bgPlus2} onChange={setBgPlus2} options={optionsAbilities(bgAbilities.filter((a) => a !== bgPlus1))} />
                          <Select id="wz-bg1" label="+1" value={bgPlus1} onChange={setBgPlus1} options={optionsAbilities(bgAbilities.filter((a) => a !== bgPlus2))} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'skills' && (
            <div className="space-y-5">
              <section className="space-y-2">
                <h3 className="font-display text-lg font-bold">{t('wizard.skills')}</h3>
                {bgSkills.length > 0 && <p className="text-sm">{t('wizard.fromBackground', { list: bgSkills.map((s) => t(`sheet.skill.${s}`)).join(', ') })}</p>}
                {clsSkills.choose ? (
                  <>
                    <p className="text-sm">{t('wizard.chooseSkills', { count: clsSkills.choose.count, cls: cls?.name ?? '', done: classSkills.length })}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {clsSkills.choose.options.map((s) => {
                        const granted = bgSkills.includes(s);
                        const on = classSkills.includes(s);
                        const full = classSkills.length >= clsSkills.choose!.count;
                        return (
                          <label key={s} className="chip-check">
                            <input
                              type="checkbox"
                              checked={on || granted}
                              disabled={granted || (full && !on)}
                              onChange={(e) => setClassSkills((l) => (e.target.checked ? [...l, s] : l.filter((x) => x !== s)))}
                            />
                            {t(`sheet.skill.${s}`)}
                          </label>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  cls && <p className="text-sm italic">{t('wizard.noSkillChoice')}</p>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="font-display text-lg font-bold">{t('wizard.languages')}</h3>
                <p className="text-sm">{fixedLanguages.length ? t('wizard.knownLanguages', { list: fixedLanguages.join(', ') }) : t('wizard.noFixedLanguages')}</p>
                {excludedLanguages.length > 0 && (
                  <p className="text-sm text-amber-800 dark:text-amber-300">{t('wizard.excludedLanguages', { list: excludedLanguages.join(', '), story: chosenStory?.name ?? '' })}</p>
                )}
                {languageChoices > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {Array.from({ length: languageChoices }, (_, i) => (
                      <Select
                        key={i}
                        id={`wz-lang-${i}`}
                        label={t('wizard.extraLanguage', { n: i + 1 })}
                        value={extraLanguages[i] ?? ''}
                        onChange={(v) => setExtraLanguages((l) => Object.assign([...l], { [i]: v }))}
                        options={languageNames.filter((n) => !fixedLanguages.includes(n) && (extraLanguages[i] === n || !extraLanguages.includes(n))).map((n) => ({ value: n, label: labels.language(n) }))}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="font-display text-lg font-bold">{t('wizard.tools')}</h3>
                <p className="text-sm">{fixedTools.length ? t('wizard.knownTools', { list: fixedTools.join(', ') }) : toolSlots.length ? '' : t('wizard.noTools')}</p>
                {toolSlots.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {toolSlots.map((slot, i) => (
                      <Select
                        key={i}
                        id={`wz-tool-${i}`}
                        label={`${slot.text} (${i + 1})`}
                        value={extraTools[i] ?? ''}
                        onChange={(v) => setExtraTools((l) => Object.assign([...l], { [i]: v }))}
                        options={tools
                          .filter(
                            (x) =>
                              allowed(x.sourceId) &&
                              (!slot.type || x.toolType === slot.type || (/oder|or/i.test(slot.text) && (x.toolType === 'artisan' || x.toolType === 'instrument'))) &&
                              !fixedTools.includes(x.name),
                          )
                          .filter((x) => extraTools[i] === x.name || !extraTools.includes(x.name))
                          .map((x) => ({ value: x.name, label: x.name }))}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {step === 'equipment' && (
            <div className="space-y-4">
              <label className="chip-check chip-check-block">
                <input type="checkbox" checked={takeEquipment} onChange={(e) => setTakeEquipment(e.target.checked)} />
                {t('wizard.takeEquipment')}
              </label>
              {takeEquipment && equipLines.some((l) => l.options.some((o) => o.parts.some((x) => x.pack))) && (
                <label className="chip-check chip-check-block">
                  <input type="checkbox" checked={unpackPacks} onChange={(e) => setUnpackPacks(e.target.checked)} />
                  {t('wizard.unpackPacks')}
                </label>
              )}
              {takeEquipment && (
                <>
                  {equipLines.length === 0 && <p className="italic">{t('wizard.noEquipment')}</p>}
                  {equipLines.map((line, li) => {
                    const oi = Math.min(equipChoice[`${li}`] ?? 0, line.options.length - 1);
                    return (
                      <fieldset key={li} className="space-y-1.5 rounded-lg border border-parchment-400/70 p-3 dark:border-night-700">
                        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-parchment-700 dark:text-parchment-400">{line.source}</legend>
                        {line.options.length > 1 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {line.options.map((o, i) => (
                              <label key={i} className="chip-check">
                                <input type="radio" name={`wz-eq-${li}`} checked={oi === i} onChange={() => setEquipChoice((c) => ({ ...c, [li]: i }))} />
                                {o.label}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p>{line.options[0]?.label}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                          {line.options[oi]?.parts.map((part, pi) =>
                            part.coins ? (
                              <span key={pi} className="badge bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                {Object.entries(part.coins)
                                  .map(([k, v]) => `${v} ${t(`sheet.coins.${k}`)}`)
                                  .join(', ')}
                              </span>
                            ) : part.placeholder ? (
                              Array.from({ length: part.qty }, (_, q) => (
                                <select
                                  key={`${pi}-${q}`}
                                  className="input !w-auto !py-1 text-sm"
                                  value={equipPick[`${li}-${oi}-${pi}-${q}`] ?? ''}
                                  onChange={(e) => setEquipPick((p) => ({ ...p, [`${li}-${oi}-${pi}-${q}`]: e.target.value }))}
                                  aria-label={part.text}
                                >
                                  <option value="">{t('wizard.pickItem', { what: part.text.replace(/^(ein|eine|einen|zwei|drei)\s+/i, '') })}</option>
                                  {catalog
                                    .filter((c) => allowed(c.sourceId) && matchesPlaceholder(c, part.placeholder!))
                                    .map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {localized(c.name, c.nameEn, i18n.language)}
                                      </option>
                                    ))}
                                </select>
                              ))
                            ) : (
                              <span
                                key={pi}
                                className={`badge ${part.item ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-parchment-200 text-parchment-900 dark:bg-night-700 dark:text-parchment-200'}`}
                                title={part.item ? t('wizard.linkedItem') : part.pack ? part.pack.map((c) => `${c.qty > 1 ? `${c.qty}× ` : ''}${c.name}`).join(', ') : t('wizard.textItem')}
                              >
                                {part.qty > 1 ? `${part.qty}× ` : ''}
                                {part.name}
                                {part.item && <Check className="ml-1 h-3 w-3" />}
                                {part.pack && unpackPacks && <span className="ml-1 font-normal opacity-70">{t('wizard.packParts', { count: part.pack.length })}</span>}
                              </span>
                            ),
                          )}
                        </div>
                      </fieldset>
                    );
                  })}
                  {[...fixedTools, ...extraTools.filter(Boolean)].length > 0 && (
                    <p className="text-sm">{t('wizard.toolsAsItems', { list: [...fixedTools, ...extraTools.filter(Boolean)].join(', ') })}</p>
                  )}
                  <p className="text-sm text-parchment-700 dark:text-parchment-400">
                    {t('wizard.equipmentResult', {
                      count: startingEquipment.items.length,
                      weight: startingEquipment.items.reduce((w, i) => w + i.qty * i.weight, 0).toLocaleString('de'),
                      gp: startingEquipment.coins.gp ?? 0,
                    })}
                  </p>
                </>
              )}
            </div>
          )}

          {step === 'summary' && finalScores && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {[
                  [t('wizard.name'), name],
                  [t('wizard.step.race'), race ? `${L(race).name}${subrace ? ` (${subrace})` : ''}` : '–'],
                  [t('wizard.step.class'), cls ? `${L(cls).name}${subclass ? ` (${subclass})` : ''} 1` : '–'],
                  [t('wizard.step.background'), bg?.name ?? '–'],
                  [t('sheet.hpMax'), cls ? String(Math.max(1, (Number.parseInt((cls.data.hitDie ?? '').replace(/\D/g, ''), 10) || 8) + abilityModifier(finalScores.con))) : '–'],
                  [t('sheet.ac'), String(10 + abilityModifier(finalScores.dex))],
                  [t('wizard.skills'), [...new Set([...bgSkills, ...classSkills])].map((s) => t(`sheet.skill.${s}`)).join(', ') || '–'],
                  [t('wizard.languages'), [...fixedLanguages, ...extraLanguages.filter(Boolean)].join(', ') || '–'],
                  [t('wizard.tools'), [...fixedTools, ...extraTools.filter(Boolean)].join(', ') || '–'],
                  [
                    t('wizard.step.equipment'),
                    takeEquipment ? t('wizard.equipmentSummary', { count: startingEquipment.items.length, gp: startingEquipment.coins.gp ?? 0 }) : t('wizard.equipmentAsText'),
                  ],
                ].map(([k, v]) => (
                  <p key={k} className="border-b border-parchment-300/60 py-1 dark:border-night-700">
                    <span className="font-semibold">{k}:</span> {v}
                  </p>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {ABILITIES.map((a) => (
                  <div key={a} className="rounded-lg border border-parchment-400 p-2 text-center dark:border-night-700">
                    <div className="text-xs font-bold uppercase">{t(`sheet.abilityShort.${a}`)}</div>
                    <div className="font-display text-xl font-bold">{finalScores[a]}</div>
                    <div className="text-xs">{formatModifier(abilityModifier(finalScores[a]))}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-parchment-700 dark:text-parchment-400">{t('wizard.summaryHint')}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-parchment-300/70 pt-4 dark:border-night-700">
            <button type="button" className="btn-secondary" onClick={() => (idx === 0 ? close() : setStep(STEPS[idx - 1]))}>
              <ChevronLeft className="h-4 w-4" />
              {idx === 0 ? t('common.cancel') : t('wizard.back')}
            </button>
            {step === 'summary' ? (
              <button type="button" className="btn-primary" onClick={create} disabled={busy || !finalScores}>
                {busy ? <Spinner className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
                {t('wizard.create')}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => setStep(STEPS[idx + 1])} disabled={!stepOk[step]}>
                {step === 'background' && !bg ? t('wizard.skip') : t('wizard.next')}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
