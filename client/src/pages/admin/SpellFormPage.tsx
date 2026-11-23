import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Copy, Save, Trash2 } from 'lucide-react';
import {
  CASTING_TIMES,
  CLASSES,
  DAMAGE_TYPES,
  LEVELS,
  LOCALES,
  SCHOOLS,
  damageDiceSchema,
  spellInputSchema,
  type CastingTime,
  type DamageType,
  type Locale,
  type School,
  type SpellClass,
  type SpellDto,
  type SpellInput,
} from '@zauberbuch/shared';
import { api, ApiError } from '../../lib/api';
import { SourceNameSelect } from '../../components/sources/SourceFields';
import { errorMessage, fieldMessage } from '../../lib/errors';
import { slugify, toggleInList } from '../../lib/filters';
import { DamageValue } from '../../components/DamageValue';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import { Alert, Checkbox, Field, PageSpinner, Spinner, TextInput } from '../../components/ui';

interface TranslationForm {
  name: string;
  castingTimeText: string;
  rangeText: string;
  durationText: string;
  materialDescription: string;
  description: string;
  higherLevels: string;
}

interface FormState {
  slug: string;
  level: number;
  school: School;
  castingTime: CastingTime;
  range: string;
  components: { verbal: boolean; somatic: boolean; material: boolean };
  concentration: boolean;
  ritual: boolean;
  duration: string;
  classes: SpellClass[];
  /** Eigene Wiki-Klassen (IDs) */
  wikiClasses: string[];
  source: string;
  isHomebrew: boolean;
  damageDice: string;
  damageType: DamageType | '';
  translations: Record<Locale, TranslationForm>;
}

const emptyTranslation = (): TranslationForm => ({
  name: '',
  castingTimeText: '',
  rangeText: '',
  durationText: '',
  materialDescription: '',
  description: '',
  higherLevels: '',
});

const emptyForm = (): FormState => ({
  slug: '',
  level: 1,
  school: 'evocation',
  castingTime: 'action',
  range: '',
  components: { verbal: true, somatic: true, material: false },
  concentration: false,
  ritual: false,
  duration: 'instantaneous',
  classes: [],
  wikiClasses: [],
  source: 'Homebrew',
  isHomebrew: true,
  damageDice: '',
  damageType: '',
  translations: { de: emptyTranslation(), en: emptyTranslation() },
});

function fromSpell(spell: SpellDto): FormState {
  const translations = { de: emptyTranslation(), en: emptyTranslation() };
  for (const l of LOCALES) {
    const t = spell.translations[l];
    if (!t) continue;
    translations[l] = {
      name: t.name,
      castingTimeText: t.castingTimeText ?? '',
      rangeText: t.rangeText ?? '',
      durationText: t.durationText ?? '',
      materialDescription: t.materialDescription ?? '',
      description: t.description ?? '',
      higherLevels: t.higherLevels ?? '',
    };
  }
  return {
    slug: spell.slug,
    level: spell.level,
    school: spell.school,
    castingTime: spell.castingTime,
    range: spell.range,
    components: { ...spell.components },
    concentration: spell.concentration,
    ritual: spell.ritual,
    duration: spell.duration,
    classes: [...spell.classes],
    wikiClasses: [...(spell.wikiClasses ?? [])],
    source: spell.source,
    isHomebrew: spell.isHomebrew,
    damageDice: spell.damage?.dice ?? '',
    damageType: spell.damage?.type ?? '',
    translations,
  };
}

const isBlank = (t: TranslationForm) => Object.values(t).every((v) => !v.trim());

function toInput(form: FormState): unknown {
  const translations: Record<string, unknown> = {};
  for (const l of LOCALES) {
    const t = form.translations[l];
    translations[l] = isBlank(t)
      ? null
      : {
          name: t.name,
          description: t.description,
          castingTimeText: t.castingTimeText || null,
          rangeText: t.rangeText || null,
          durationText: t.durationText || null,
          materialDescription: t.materialDescription || null,
          higherLevels: t.higherLevels || null,
        };
  }
  // Homebrew ergibt sich aus der Quelle
  return { ...form, isHomebrew: form.source.trim().toLocaleLowerCase('de') === 'homebrew', damageDice: form.damageDice.trim() || null, damageType: form.damageType || null, translations };
}

export function SpellFormPage() {
  const { slug } = useParams();
  const isEdit = Boolean(slug);
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { canDeleteSpells } = useAuth();
  // Eigene Wiki-Klassen zum Zuordnen (Klassen, deren Name keiner der neun Zauberklassen entspricht)
  const [customClasses, setCustomClasses] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    const known = new Set(CLASSES.flatMap((c) => [t(`class.${c}`, { lng: 'de' }), t(`class.${c}`, { lng: 'en' }), c].map((x) => x.toLocaleLowerCase('de'))));
    api
      .wiki()
      .then((r) => setCustomClasses(r.entries.filter((e) => e.kind === 'class' && !known.has(e.name.trim().toLocaleLowerCase('de'))).map((e) => ({ id: e.id, name: e.name }))))
      .catch(() => setCustomClasses([]));
  }, [t]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [spellId, setSpellId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [tab, setTab] = useState<Locale>('de');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!slug) {
      setForm(emptyForm());
      setSpellId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .spell(slug)
      .then(({ spell }) => {
        setForm(fromSpell(spell));
        setSpellId(spell.id);
        setDirty(false);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const update = (patch: Partial<FormState>) => {
    setDirty(true);
    setForm((f) => {
      const next = { ...f, ...patch };
      return next;
    });
  };

  const updateText = (locale: Locale, key: keyof TranslationForm, value: string) => {
    setDirty(true);
    setForm((f) => {
      const translations = { ...f.translations, [locale]: { ...f.translations[locale], [key]: value } };
      let nextSlug = f.slug;
      if (!slugTouched && key === 'name') {
        nextSlug = slugify(translations.en.name || translations.de.name);
      }
      return { ...f, translations, slug: nextSlug };
    });
  };

  const tabErrors = useMemo(() => {
    const res: Record<Locale, boolean> = { de: false, en: false };
    for (const key of Object.keys(errors)) {
      for (const l of LOCALES) if (key.startsWith(`translations.${l}`)) res[l] = true;
    }
    return res;
  }, [errors]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = spellInputSchema.safeParse(toInput(form));
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        if (!errs[key]) errs[key] = issue.message;
      }
      setErrors(errs);
      const firstLocale = LOCALES.find((l) => Object.keys(errs).some((k) => k.startsWith(`translations.${l}`)));
      if (firstLocale) setTab(firstLocale);
      setError(new ApiError(400, 'validation_error', t('admin.validationFailed')));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const input: SpellInput = parsed.data;
      const { spell } = spellId ? await api.updateSpell(spellId, input) : await api.createSpell(input);
      setDirty(false);
      toast.success(t('admin.spellSaved'));
      setSpellId(spell.id);
      if (!isEdit || spell.slug !== slug) navigate(`/admin/spells/${spell.slug}/edit`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setErrors(Object.fromEntries(err.details.map((d) => [d.path, d.message])));
      }
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    if (!spellId) return;
    try {
      const { spell } = await api.duplicateSpell(spellId);
      toast.success(t('admin.spellDuplicated'));
      navigate(`/admin/spells/${spell.slug}/edit`);
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  const doDelete = async () => {
    if (!spellId) return;
    try {
      await api.deleteSpell(spellId);
      toast.success(t('admin.spellDeleted'));
      setDirty(false);
      navigate('/admin/spells');
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  if (loading) return <PageSpinner />;
  if (isEdit && !spellId && error) return <Alert>{errorMessage(t, error)}</Alert>;

  const err = (path: string) => fieldMessage(t, errors[path]);
  const tr = form.translations[tab];
  // Live-Vorschau des Schadenswerts, sobald Würfel und Art gültig sind
  const dicePreview = damageDiceSchema.safeParse(form.damageDice);
  const damagePreview = dicePreview.success && dicePreview.data && form.damageType ? { dice: dicePreview.data, type: form.damageType } : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/admin/spells" className="btn-ghost !px-2">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Link>
        <h2 className="mr-auto text-xl font-bold">{isEdit ? t('admin.editSpell') : t('admin.newSpell')}</h2>
        {isEdit && (
          <>
            <button type="button" className="btn-secondary" onClick={duplicate}>
              <Copy className="h-4 w-4" />
              {t('common.duplicate')}
            </button>
            {canDeleteSpells && (
              <button type="button" className="btn-secondary !text-red-700 dark:!text-red-400" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />
                {t('common.delete')}
              </button>
            )}
          </>
        )}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {t('common.save')}
        </button>
      </div>

      {error ? (
        <Alert>
          {errorMessage(t, error)}
          {errors.translations && <div className="mt-1">{err('translations')}</div>}
        </Alert>
      ) : null}

      <section className="parchment space-y-5 p-5 sm:p-6">
        <h3 className="text-lg font-bold">{t('admin.general')}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label={t('admin.slug')} error={err('slug')} hint={t('admin.slugHint')} className="md:col-span-2">
            {(id) => (
              <TextInput
                id={id}
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  update({ slug: e.target.value });
                }}
                invalid={!!errors.slug}
                className="font-mono"
              />
            )}
          </Field>
          <Field label={t('filter.level')} error={err('level')}>
            {(id) => (
              <select id={id} className="input" value={form.level} onChange={(e) => update({ level: Number(e.target.value) })}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l === 0 ? t('spell.cantrip') : t('spell.levelOrdinal', { level: l })}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('filter.school')} error={err('school')}>
            {(id) => (
              <select id={id} className="input" value={form.school} onChange={(e) => update({ school: e.target.value as School })}>
                {SCHOOLS.map((s) => (
                  <option key={s} value={s}>
                    {t(`school.${s}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('admin.castingTimeCategory')} error={err('castingTime')}>
            {(id) => (
              <select id={id} className="input" value={form.castingTime} onChange={(e) => update({ castingTime: e.target.value as CastingTime })}>
                {CASTING_TIMES.map((c) => (
                  <option key={c} value={c}>
                    {t(`castingTime.${c}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('admin.rangeKey')} error={err('range')} hint={t('admin.rangeKeyHint')}>
            {(id) => <TextInput id={id} value={form.range} onChange={(e) => update({ range: e.target.value })} invalid={!!errors.range} />}
          </Field>
          <Field label={t('admin.durationKey')} error={err('duration')} hint={t('admin.durationKeyHint')}>
            {(id) => <TextInput id={id} value={form.duration} onChange={(e) => update({ duration: e.target.value })} invalid={!!errors.duration} />}
          </Field>
          <Field label={t('spell.source')} error={err('source')}>
            {(id) => <SourceNameSelect id={id} value={form.source} onChange={(v) => update({ source: v })} extra={['Homebrew']} allowEmpty={false} invalid={!!errors.source} />}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <fieldset>
            <legend className="label">{t('spell.components')}</legend>
            <div className="flex flex-wrap gap-4">
              {(['verbal', 'somatic', 'material'] as const).map((c) => (
                <Checkbox key={c} label={t(`component.${c}`)} checked={form.components[c]} onChange={(v) => update({ components: { ...form.components, [c]: v } })} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">{t('filter.properties')}</legend>
            <div className="flex flex-wrap gap-4">
              <Checkbox label={t('spell.concentration')} checked={form.concentration} onChange={(v) => update({ concentration: v })} />
              <Checkbox label={t('spell.ritual')} checked={form.ritual} onChange={(v) => update({ ritual: v })} />
            </div>
          </fieldset>
        </div>

        <fieldset>
          <legend className="label">{t('admin.damageSection')}</legend>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,14rem)_minmax(0,14rem)_1fr] md:items-start">
            <Field label={t('admin.damageDice')} error={err('damageDice')}>
              {(id) => (
                <TextInput
                  id={id}
                  value={form.damageDice}
                  onChange={(e) => update({ damageDice: e.target.value })}
                  invalid={!!errors.damageDice}
                  placeholder="8d6"
                  className="font-mono"
                  autoComplete="off"
                />
              )}
            </Field>
            <Field label={t('admin.damageType')} error={err('damageType')}>
              {(id) => (
                <select id={id} className={`input ${errors.damageType ? 'input-error' : ''}`} value={form.damageType} onChange={(e) => update({ damageType: e.target.value as DamageType | '' })}>
                  <option value="">{t('admin.noDamage')}</option>
                  {[...DAMAGE_TYPES]
                    .sort((a, b) => (a === 'healing' ? 1 : b === 'healing' ? -1 : t(`damageType.${a}`).localeCompare(t(`damageType.${b}`))))
                    .map((d) => (
                      <option key={d} value={d}>
                        {t(`damageType.${d}`)}
                      </option>
                    ))}
                </select>
              )}
            </Field>
            <div>
              <span className="label">{t('admin.damagePreview')}</span>
              <div className="flex min-h-[42px] items-center">{damagePreview ? <DamageValue damage={damagePreview} /> : <span className="text-parchment-600">–</span>}</div>
            </div>
          </div>
          <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">{t('admin.damageDiceHint')}</p>
        </fieldset>

        <fieldset>
          <legend className="label">{t('spell.classes')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {CLASSES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={form.classes.includes(c)}
                className={form.classes.includes(c) ? 'chip-on' : 'chip-off'}
                onClick={() => update({ classes: toggleInList(form.classes, c) })}
              >
                {t(`class.${c}`)}
              </button>
            ))}
            {/* Eigene Klassen aus dem Wiki (alle, die keiner der neun Zauberklassen entsprechen) */}
            {customClasses.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={form.wikiClasses.includes(c.id)}
                className={form.wikiClasses.includes(c.id) ? 'chip-on' : 'chip-off'}
                onClick={() => update({ wikiClasses: toggleInList(form.wikiClasses, c.id) })}
                title={t('admin.wikiClassHint')}
              >
                {c.name}
              </button>
            ))}
          </div>
          {customClasses.length > 0 && <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">{t('admin.wikiClassesHint')}</p>}
        </fieldset>
      </section>

      <section className="parchment p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-bold">{t('admin.translations')}</h3>
          <div role="tablist" className="flex overflow-hidden rounded-lg border border-parchment-400 dark:border-night-700">
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={tab === l}
                onClick={() => setTab(l)}
                className={`flex items-center gap-2 px-4 py-1.5 font-display text-sm font-bold ${
                  tab === l ? 'bg-parchment-800 text-parchment-50 dark:bg-parchment-300 dark:text-ink' : 'hover:bg-parchment-200 dark:hover:bg-night-700'
                }`}
              >
                {l.toUpperCase()}
                {tabErrors[l] && <span className="h-2 w-2 rounded-full bg-red-600" aria-label="!" />}
                {isBlank(form.translations[l]) && <span className="text-[10px] font-normal italic opacity-75">{t('admin.translationMissing')}</span>}
              </button>
            ))}
          </div>
          <span className="text-xs italic text-parchment-700 dark:text-parchment-400">{t('admin.translationEmpty')}</span>
        </div>

        <div key={tab} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t('admin.name')} error={err(`translations.${tab}.name`)} className="md:col-span-2">
            {(id) => <TextInput id={id} value={tr.name} onChange={(e) => updateText(tab, 'name', e.target.value)} invalid={!!errors[`translations.${tab}.name`]} lang={tab} />}
          </Field>
          <Field label={t('admin.castingTimeText')} error={err(`translations.${tab}.castingTimeText`)}>
            {(id) => (
              <TextInput id={id} value={tr.castingTimeText} onChange={(e) => updateText(tab, 'castingTimeText', e.target.value)} lang={tab} placeholder={tab === 'de' ? '1 Aktion' : '1 action'} />
            )}
          </Field>
          <Field label={t('admin.rangeText')} error={err(`translations.${tab}.rangeText`)}>
            {(id) => <TextInput id={id} value={tr.rangeText} onChange={(e) => updateText(tab, 'rangeText', e.target.value)} lang={tab} placeholder={tab === 'de' ? '45 m' : '150 feet'} />}
          </Field>
          <Field label={t('admin.durationText')} error={err(`translations.${tab}.durationText`)}>
            {(id) => (
              <TextInput id={id} value={tr.durationText} onChange={(e) => updateText(tab, 'durationText', e.target.value)} lang={tab} placeholder={tab === 'de' ? 'Unmittelbar' : 'Instantaneous'} />
            )}
          </Field>
          <Field label={t('admin.materialDescription')} error={err(`translations.${tab}.materialDescription`)}>
            {(id) => <TextInput id={id} value={tr.materialDescription} onChange={(e) => updateText(tab, 'materialDescription', e.target.value)} lang={tab} disabled={!form.components.material} />}
          </Field>
          <Field label={t('admin.description')} error={err(`translations.${tab}.description`)} className="md:col-span-2">
            {(id) => <MarkdownEditor id={id} value={tr.description} onChange={(v) => updateText(tab, 'description', v)} rows={12} invalid={!!errors[`translations.${tab}.description`]} />}
          </Field>
          <Field label={t('admin.higherLevels')} error={err(`translations.${tab}.higherLevels`)} className="md:col-span-2">
            {(id) => <MarkdownEditor id={id} value={tr.higherLevels} onChange={(v) => updateText(tab, 'higherLevels', v)} rows={4} />}
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {t('common.save')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t('common.delete')}
        message={t('admin.deleteSpellConfirm', { name: form.translations.de.name || form.translations.en.name || form.slug })}
        confirmLabel={t('common.delete')}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}
