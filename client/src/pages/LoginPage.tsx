import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loginSchema } from '@zauberbuch/shared';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorMessage, fieldMessage } from '../lib/errors';
import { Alert, Field, Spinner, TextInput } from '../components/ui';

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-6 max-w-md">
      <div className="parchment p-6 sm:p-8">
        <h1 className="text-center text-2xl font-bold">{title}</h1>
        <div className="divider-ornament" aria-hidden>
          ✦
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { user, login, config } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (user && !busy) return <Navigate to={from} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const u = await login(parsed.data.identifier, parsed.data.password);
      toast.success(t('auth.welcome', { name: u.username }));
      navigate(from, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title={t('auth.loginTitle')}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
        <Field label={t('auth.identifier')} error={fieldMessage(t, errors.identifier)}>
          {(id) => (
            <TextInput id={id} autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} invalid={!!errors.identifier} autoFocus />
          )}
        </Field>
        <Field label={t('auth.password')} error={fieldMessage(t, errors.password)}>
          {(id) => (
            <TextInput id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} />
          )}
        </Field>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}
          {t('auth.loginSubmit')}
        </button>
        {config?.allowRegistration && (
          <p className="text-center text-sm">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="font-semibold underline">
              {t('nav.register')}
            </Link>
          </p>
        )}
      </form>
    </AuthCard>
  );
}
