import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookHeart, KeyRound, Trash2, UserPlus, X } from 'lucide-react';
import { ROLES, createUserSchema, isEditorRole, passwordSchema, type Role } from '@zauberbuch/shared';
import { api, type AdminUserDto } from '../../lib/api';
import { errorMessage, fieldMessage } from '../../lib/errors';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Alert, Field, PageSpinner, Spinner, TextInput } from '../../components/ui';

const emptyForm = { username: '', email: '', password: '', role: 'user' as Role, canEditSpells: false };

/** Formular „Neuer Benutzer“ – Benutzer werden nur durch den Admin angelegt. */
function CreateUserForm({ onCreated, onCancel }: { onCreated: (u: AdminUserDto) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: 'username' | 'email' | 'password' | 'role') => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = createUserSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const { user } = await api.createUser(form);
      toast.success(t('admin.userCreated', { name: user.username }));
      setForm(emptyForm);
      onCreated(user);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="parchment mb-6 space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{t('admin.newUser')}</h3>
        <button type="button" className="btn-icon" onClick={onCancel} aria-label={t('common.close')}>
          <X className="h-5 w-5" />
        </button>
      </div>
      {error ? <Alert>{errorMessage(t, error)}</Alert> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label={t('auth.username')} error={fieldMessage(t, errors.username)}>
          {(id) => <TextInput id={id} value={form.username} onChange={set('username')} invalid={!!errors.username} autoComplete="off" autoFocus />}
        </Field>
        <Field label={t('admin.emailOptional')} error={fieldMessage(t, errors.email)}>
          {(id) => <TextInput id={id} type="email" value={form.email} onChange={set('email')} invalid={!!errors.email} autoComplete="off" />}
        </Field>
        <Field label={t('auth.password')} error={fieldMessage(t, errors.password)}>
          {(id) => <TextInput id={id} type="password" value={form.password} onChange={set('password')} invalid={!!errors.password} autoComplete="new-password" />}
        </Field>
        <Field label={t('account.role')}>
          {(id) => (
            <select id={id} className="input" value={form.role} onChange={set('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-parchment-800 dark:accent-parchment-300"
          checked={form.canEditSpells || isEditorRole(form.role)}
          disabled={isEditorRole(form.role)}
          onChange={(e) => setForm((f) => ({ ...f, canEditSpells: e.target.checked }))}
        />
        <span>
          {t('admin.canEditSpells')} <span className="text-parchment-700 dark:text-parchment-400">– {t('admin.canEditSpellsHint')}</span>
        </span>
      </label>
      <p className="text-xs text-parchment-700 dark:text-parchment-400">{t('admin.rolesHint')}</p>
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? <Spinner className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {t('admin.createUser')}
      </button>
    </form>
  );
}

/** Dialog „Passwort setzen“ für einen Benutzer. */
function SetPasswordDialog({ user, onClose }: { user: AdminUserDto; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(fieldMessage(t, parsed.error.issues[0]?.message) ?? null);
      return;
    }
    setBusy(true);
    try {
      await api.updateUser(user.id, { password });
      toast.success(t('admin.passwordSet'));
      onClose();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form role="dialog" aria-modal="true" aria-label={t('admin.setPassword')} onSubmit={onSubmit} noValidate className="parchment w-full max-w-md space-y-4 p-6">
        <h2 className="font-display text-xl font-bold">{t('admin.setPasswordFor', { name: user.username })}</h2>
        <Field label={t('account.newPassword')} error={error ?? undefined}>
          {(id) => (
            <TextInput id={id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!error} autoComplete="new-password" autoFocus />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
            {t('admin.setPassword')}
          </button>
        </div>
      </form>
    </div>
  );
}

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUserDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toDelete, setToDelete] = useState<AdminUserDto | null>(null);
  const [passwordFor, setPasswordFor] = useState<AdminUserDto | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .users()
      .then((r) => setUsers(r.users))
      .catch(setError);
  }, []);

  const changeRole = async (u: AdminUserDto, role: Role) => {
    try {
      const res = await api.updateUser(u.id, { role });
      setUsers((list) => list?.map((x) => (x.id === u.id ? { ...x, role: res.user.role } : x)) ?? null);
      toast.success(t('admin.roleChanged'));
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  };

  const changeSpellRight = async (u: AdminUserDto, canEditSpells: boolean) => {
    const apply = (value: boolean) =>
      setUsers((list) => list?.map((x) => (x.id === u.id ? { ...x, canEditSpells: value } : x)) ?? null);
    apply(canEditSpells);
    try {
      const res = await api.updateUser(u.id, { canEditSpells });
      apply(res.user.canEditSpells);
      toast.success(t('admin.rightChanged'));
    } catch (err) {
      apply(u.canEditSpells);
      toast.error(errorMessage(t, err));
    }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.deleteUser(toDelete.id);
      setUsers((list) => list?.filter((x) => x.id !== toDelete.id) ?? null);
      toast.success(t('admin.userDeleted'));
      setToDelete(null);
    } catch (err) {
      toast.error(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Alert>{errorMessage(t, error)}</Alert>;
  if (!users) return <PageSpinner />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{t('admin.usersTitle')}</h2>
        {!showCreate && (
          <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
            <UserPlus className="h-4 w-4" />
            {t('admin.newUser')}
          </button>
        )}
      </div>

      {showCreate && (
        <CreateUserForm
          onCreated={(u) => {
            setUsers((list) => [...(list ?? []), u]);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="parchment overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>{t('auth.username')}</th>
              <th className="hidden md:table-cell">{t('auth.email')}</th>
              <th>{t('account.role')}</th>
              <th className="text-center" title={t('admin.canEditSpellsHint')}>{t('admin.canEditSpellsShort')}</th>
              <th className="hidden sm:table-cell">{t('admin.favorites')}</th>
              <th className="hidden lg:table-cell">{t('admin.created')}</th>
              <th className="text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold">
                  {u.username}
                  {u.id === me?.id && <span className="ml-2 text-xs italic text-parchment-600">({t('admin.you')})</span>}
                </td>
                <td className="hidden md:table-cell">{u.email ?? '–'}</td>
                <td>
                  <select
                    className="input !w-auto !py-1"
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                    aria-label={`${t('account.role')}: ${u.username}`}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`role.${r}`)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-parchment-800 disabled:opacity-60 dark:accent-parchment-300"
                    checked={u.canEditSpells || isEditorRole(u.role)}
                    disabled={isEditorRole(u.role)}
                    title={isEditorRole(u.role) ? t('admin.canEditSpellsByRole') : t('admin.canEditSpellsHint')}
                    onChange={(e) => changeSpellRight(u, e.target.checked)}
                    aria-label={`${t('admin.canEditSpells')}: ${u.username}`}
                  />
                </td>
                <td className="hidden sm:table-cell">
                  <Link to={`/spellbooks/${u.id}`} className="inline-flex items-center gap-1 hover:underline">
                    <BookHeart className="h-4 w-4 text-red-700 dark:text-red-400" aria-hidden />
                    {u.favoriteCount}
                  </Link>
                </td>
                <td className="hidden lg:table-cell">{new Date(u.createdAt).toLocaleDateString(i18n.language)}</td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setPasswordFor(u)}
                      title={t('admin.setPassword')}
                      aria-label={`${t('admin.setPassword')}: ${u.username}`}
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="btn-icon text-red-700 disabled:opacity-30 dark:text-red-400"
                      onClick={() => setToDelete(u)}
                      disabled={u.id === me?.id}
                      title={t('common.delete')}
                      aria-label={`${t('common.delete')}: ${u.username}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {passwordFor && <SetPasswordDialog user={passwordFor} onClose={() => setPasswordFor(null)} />}
      <ConfirmDialog
        open={!!toDelete}
        title={t('common.delete')}
        message={toDelete ? t('admin.deleteUserConfirm', { name: toDelete.username }) : ''}
        confirmLabel={t('common.delete')}
        busy={busy}
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
