import type { TFunction } from 'i18next';
import type { SpellDto, SpellTranslationDto } from '@zauberbuch/shared';

export function levelSchoolLabel(t: TFunction, spell: Pick<SpellDto, 'level' | 'school'>): string {
  const school = t(`school.${spell.school}`);
  return spell.level === 0 ? t('spell.cantripSchool', { school }) : t('spell.levelSchool', { level: spell.level, school });
}

export function castingTimeLabel(t: TFunction, spell: SpellDto, text: SpellTranslationDto): string {
  return text.castingTimeText || t(`castingTime.${spell.castingTime}`);
}

export function rangeLabel(spell: SpellDto, text: SpellTranslationDto): string {
  return text.rangeText || spell.range;
}

export function durationLabel(spell: SpellDto, text: SpellTranslationDto): string {
  return text.durationText || spell.duration;
}
