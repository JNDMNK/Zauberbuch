import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { ROLES, type Role } from '@zauberbuch/shared';
import { api, type AdminUserDto } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Alert, PageSpinner } from '../../components/ui';

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUserDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [toDelete, setToDelete] = useState<AdminUserDto | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .users()
      .then((r) => setUsers(r.users))
      .catch(setError);
  }, []);

  const changeRole = async (u: AdminUserDto, role: Role) => {
    try {
      const res = await api.updateUser(u.id, role);
      setUsers((list) => list?.map((x) => (x.id === u.id ? { ...x, role: res.user.role } : x)) ?? null);
      toast.success(t('admin.roleChanged'));
    } catch (err) {
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
      <h2 className="mb-4 text-xl font-bold">{t('admin.usersTitle')}</h2>
      <div className="parchment overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>{t('auth.username')}</th>
              <th className="hidden md:table-cell">{t('auth.email')}</th>
              <th>{t('account.role')}</th>
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
                <td className="hidden sm:table-cell">{u.favoriteCount}</td>
                <td className="hidden lg:table-cell">{new Date(u.createdAt).toLocaleDateString(i18n.language)}</td>
                <td className="text-right">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
