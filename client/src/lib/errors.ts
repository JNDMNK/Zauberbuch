import type { TFunction } from 'i18next';
import { ApiError } from './api';

/** Übersetzt Fehlercodes (API oder zod) in eine lesbare Meldung. */
export function errorMessage(t: TFunction, err: unknown): string {
  if (err instanceof ApiError) {
    return t(`errors.${err.code}`, { defaultValue: err.message || t('errors.unknown') });
  }
  if (typeof err === 'string') return t(`errors.${err}`, { defaultValue: err });
  return t('errors.unknown');
}

export function fieldMessage(t: TFunction, code: string | undefined): string | undefined {
  if (!code) return undefined;
  return t(`errors.${code}`, { defaultValue: code });
}
