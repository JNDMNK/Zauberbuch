import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCALES, changePasswordSchema } from '@zauberbuch/shared';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { errorMessage, fieldMessage } from '../lib/errors';
import { Alert, Field, Spinner, TextInput } from '../components/ui';

export function AccountPage() {
  const { t, i18n } = useTranslation();
  const { user, setUser, language, setLanguage } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = changePasswordSchema.safeParse(form);
    const errs: Record<string, string> = parsed.success
      ? {}
      : Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), fieldMessage(t, i.message) ?? i.message]));
    if (form.newPassword !== form.confirm) errs.confirm = t('auth.passwordMismatch');
    setErrors(errs);
    if (!parsed.success || Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await api.changePassword(parsed.data.currentPassword, parsed.data.newPassword);
      setUser(res.user);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success(t('account.passwordChanged'));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{t('account.title')}</h1>

      <section className="parchment p-6">
        <h2 className="text-lg font-bold">{t('account.profile')}</h2>
        <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-6 gap-y-2">
          <dt className="label !mb-0 self-center">{t('auth.username')}</dt>
          <dd>{user.username}</dd>
          <dt className="label !mb-0 self-center">{t('auth.email')}</dt>
          <dd>{user.email ?? '–'}</dd>
          <dt className="label !mb-0 self-center">{t('account.role')}</dt>
          <dd>{t(`role.${user.role}`)}</dd>
          <dt className="label !mb-0 self-center">{t('account.memberSince')}</dt>
          <dd>{new Date(user.createdAt).toLocaleDateString(i18n.language)}</dd>
        </dl>
        <div className="mt-6">
          <label className="label" htmlFor="lang">
            {t('nav.language')}
          </label>
          <select id="lang" className="input !w-auto" value={language} onChange={(e) => setLanguage(e.target.value as 'de' | 'en')}>
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {t(`langName.${l}`)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-parchment-700 dark:text-parchment-400">{t('account.languageHint')}</p>
        </div>
      </section>

      <section className="parchment p-6">
        <h2 className="text-lg font-bold">{t('account.changePassword')}</h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
          {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
          <Field label={t('account.currentPassword')} error={errors.currentPassword}>
            {(id) => <TextInput id={id} type="password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} invalid={!!errors.currentPassword} />}
          </Field>
          <Field label={t('account.newPassword')} error={errors.newPassword}>
            {(id) => <TextInput id={id} type="password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} invalid={!!errors.newPassword} />}
          </Field>
          <Field label={t('auth.passwordConfirm')} error={errors.confirm}>
            {(id) => <TextInput id={id} type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} invalid={!!errors.confirm} />}
          </Field>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />}
            {t('account.changePassword')}
          </button>
        </form>
      </section>
    </div>
  );
}
