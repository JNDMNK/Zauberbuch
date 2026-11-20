import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import type { CatalogCategory, CatalogItemDto, CatalogItemInput } from '@zauberbuch/shared';
import { errorMessage } from '../../lib/errors';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../Modal';
import { Spinner } from '../ui';
import { DamageInput, checkDamage, type DamageState } from '../DamageInput';
import { SourceSelect } from '../sources/SourceFields';

/** Formular für Rüstung (RK), Waffe (Schaden) oder Gegenstand (Schaden/Heilung), jeweils mit Gewicht */
export function CatalogItemDialog({
  open,
  category,
  item,
  onClose,
  onSave,
}: {
  open: boolean;
  category: CatalogCategory;
  item: CatalogItemDto | null;
  onClose: () => void;
  onSave: (input: CatalogItemInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('');
  const [value, setValue] = useState('');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [ac, setAc] = useState('');
  const [strength, setStrength] = useState('');
  const [damage, setDamage] = useState<DamageState>({ dice: '', type: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? '');
    setDescription(item?.description ?? '');
    setWeight(item?.weight ? String(item.weight).replace('.', ',') : '');
    setAc(item?.ac ?? '');
    setStrength(item?.strength ? String(item.strength) : '');
    setValue(item?.value ?? '');
    setSourceId(item?.sourceId ?? null);
    setDamage({ dice: item?.damage?.dice ?? '', type: item?.damage?.type ?? '' });
  }, [open, item]);

  const parsedWeight = weight.trim() === '' ? 0 : Number(weight.trim().replace(',', '.'));
  const weightInvalid = !Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 99999;
  const dmg = checkDamage(damage);
  const parsedStrength = strength.trim() === '' ? null : Number(strength);
  const strengthInvalid = parsedStrength !== null && (!Number.isInteger(parsedStrength) || parsedStrength < 1 || parsedStrength > 30);
  const invalid = !name.trim() || weightInvalid || (category === 'armor' && strengthInvalid) || (category !== 'armor' && dmg.error !== null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    setBusy(true);
    try {
      await onSave({
        category,
        name: name.trim(),
        description: description.trim(),
        weight: parsedWeight,
        value: value.trim(),
        sourceId,
        ac: category === 'armor' ? ac.trim() : '',
        strength: category === 'armor' ? parsedStrength : null,
        damageDice: category === 'armor' ? null : dmg.value?.dice ?? null,
        damageType: category === 'armor' ? null : dmg.value?.type ?? null,
      });
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={`${t(`catalog.categoriesOne.${category}`)} ${item ? t('common.edit').toLowerCase() : t('catalog.add')}`} onClose={onClose} size="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="cat-name" className="label">
            {t('combat.monsterName')}
          </label>
          <input id="cat-name" className="input" value={name} maxLength={100} required autoFocus onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {category === 'armor' && (
            <div>
              <label htmlFor="cat-ac" className="label">
                {t('combat.ac')}
              </label>
              <input id="cat-ac" className="input" value={ac} maxLength={40} onChange={(e) => setAc(e.target.value)} placeholder="13 + GES (max. 2)" />
            </div>
          )}
          {category === 'armor' && (
            <div>
              <label htmlFor="cat-strength" className="label">
                {t('catalog.strength')}
              </label>
              <input
                id="cat-strength"
                className={`input text-right ${strengthInvalid ? 'input-error' : ''}`}
                inputMode="numeric"
                value={strength}
                maxLength={2}
                onChange={(e) => setStrength(e.target.value.replace(/\D/g, ''))}
                placeholder={t('catalog.strengthPlaceholder')}
              />
            </div>
          )}
          <div>
            <label htmlFor="cat-weight" className="label">
              {t('items.weight')}
            </label>
            <div className="relative">
              <input id="cat-weight" className={`input !pr-10 text-right ${weightInvalid ? 'input-error' : ''}`} inputMode="decimal" value={weight} maxLength={8} onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-parchment-700 dark:text-parchment-400">lb</span>
            </div>
          </div>
          <div>
            <label htmlFor="cat-value" className="label">
              {t('items.value')}
            </label>
            <input id="cat-value" className="input" value={value} maxLength={40} onChange={(e) => setValue(e.target.value)} placeholder={t('catalog.valuePlaceholder')} />
          </div>
        </div>
        {category !== 'armor' && (
          <div>
            <p className="label">{category === 'weapon' ? t('catalog.damage') : t('catalog.damageOrHealing')}</p>
            <DamageInput value={damage} onChange={setDamage} />
          </div>
        )}
        <SourceSelect id="cat-source" value={sourceId} onChange={setSourceId} />
        <div>
          <label htmlFor="cat-desc" className="label">
            {t('bestiary.description')}
          </label>
          <textarea id="cat-desc" className="input min-h-[5rem]" rows={4} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || invalid}>
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
