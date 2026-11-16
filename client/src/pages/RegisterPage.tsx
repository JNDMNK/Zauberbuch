import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { registerSchema } from '@zauberbuch/shared';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorMessage, fieldMessage } from '../lib/errors';
import { Alert, Field, PageSpinner, Spinner, TextInput } from '../components/ui';
import { AuthCard } from './LoginPage';

export function RegisterPage() {
  const { t } = useTranslation();
  const { user, register, config, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <PageSpinner />;
  if (user && !busy) return <Navigate to="/" replace />;
  if (config && !config.allowRegistration) {
    return (
      <AuthCard title={t('auth.registerTitle')}>
        <Alert kind="info">{t('auth.registrationDisabled')}</Alert>
        <p className="mt-4 text-center">
          <Link to="/login" className="font-semibold underline">
            {t('nav.login')}
          </Link>
        </p>
      </AuthCard>
    );
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = registerSchema.safeParse(form);
    const errs: Record<string, string> = parsed.success
      ? {}
      : Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    if (form.password !== form.confirm) errs.confirm = t('auth.passwordMismatch');
    setErrors(errs);
    if (!parsed.success || Object.keys(errs).length) return;
    setBusy(true);
    try {
      const u = await register(parsed.data);
      toast.success(t('auth.welcome', { name: u.username }));
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title={t('auth.registerTitle')}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
        <Field label={t('auth.username')} error={fieldMessage(t, errors.username)}>
          {(id) => <TextInput id={id} autoComplete="username" value={form.username} onChange={set('username')} invalid={!!errors.username} autoFocus />}
        </Field>
        <Field label={t('auth.email')} error={fieldMessage(t, errors.email)}>
          {(id) => <TextInput id={id} type="email" autoComplete="email" value={form.email} onChange={set('email')} invalid={!!errors.email} />}
        </Field>
        <Field label={t('auth.password')} error={fieldMessage(t, errors.password)}>
          {(id) => <TextInput id={id} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} invalid={!!errors.password} />}
        </Field>
        <Field label={t('auth.passwordConfirm')} error={errors.confirm}>
          {(id) => <TextInput id={id} type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} invalid={!!errors.confirm} />}
        </Field>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}
          {t('auth.registerSubmit')}
        </button>
        <p className="text-center text-sm">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-semibold underline">
            {t('nav.login')}
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
