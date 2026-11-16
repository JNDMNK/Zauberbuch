import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@zauberbuch/shared';
import { useAuth } from '../context/AuthContext';
import { PageSpinner } from './ui';

/** Ohne Anmeldung -> Login. Mit `roles` zusätzlich Rollenprüfung (sonst zur Startseite). */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: readonly Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSpinner />;
  if (!user) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={from !== '/' ? { from } : undefined} />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
