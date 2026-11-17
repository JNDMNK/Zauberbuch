import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role, UserDto } from '@zauberbuch/shared';
import { useAuth } from '../context/AuthContext';
import { PageSpinner } from './ui';

/**
 * Ohne Anmeldung -> Login. Mit `roles` bzw. `allow` zusätzlich Rechteprüfung (sonst zur Startseite).
 */
export function RequireAuth({ children, roles, allow }: { children: ReactNode; roles?: readonly Role[]; allow?: (user: UserDto) => boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSpinner />;
  if (!user) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={from !== '/' ? { from } : undefined} />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  if (allow && !allow(user)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
