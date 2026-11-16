import { Navigate, Outlet, Route, Routes, useLocation, type Location } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { SpellModal } from './components/SpellModal';
import { SpellsPage } from './pages/SpellsPage';
import { SpellPage } from './pages/SpellPage';
import { LoginPage } from './pages/LoginPage';
import { AccountPage } from './pages/AccountPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminSpellsPage } from './pages/admin/AdminSpellsPage';
import { SpellFormPage } from './pages/admin/SpellFormPage';
import { ImportExportPage } from './pages/admin/ImportExportPage';
import { UsersPage } from './pages/admin/UsersPage';
import { SpellbooksPage, UserSpellbookPage } from './pages/admin/SpellbooksPage';
import { EDITOR_ROLES } from '@zauberbuch/shared';

export default function App() {
  const location = useLocation();
  // Wird eine Karte angeklickt, bleibt die Liste im Hintergrund und das Detail öffnet als Modal
  const background = (location.state as { background?: Location } | null)?.background;

  return (
    <>
      <Routes location={background ?? location}>
        <Route element={<Layout />}>
          {/* Einzige öffentliche Seite: ohne Anmeldung landet man immer hier */}
          <Route path="login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Outlet />
              </RequireAuth>
            }
          >
            <Route index element={<SpellsPage key="all" />} />
            <Route path="spellbook" element={<SpellsPage key="spellbook" favoritesPage />} />
            <Route path="favorites" element={<Navigate to="/spellbook" replace />} />
            <Route path="register" element={<Navigate to="/" replace />} />
            <Route path="spells/:slug" element={<SpellPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route
              path="admin"
              element={
                <RequireAuth roles={EDITOR_ROLES}>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="spells" replace />} />
              <Route path="spells" element={<AdminSpellsPage />} />
              <Route path="spells/new" element={<SpellFormPage key="new" />} />
              <Route path="spells/:slug/edit" element={<SpellFormPage />} />
              <Route path="spellbooks" element={<SpellbooksPage />} />
              <Route path="spellbooks/:userId" element={<UserSpellbookPage />} />
              <Route
                path="import-export"
                element={
                  <RequireAuth roles={['admin']}>
                    <ImportExportPage />
                  </RequireAuth>
                }
              />
              <Route
                path="users"
                element={
                  <RequireAuth roles={['admin']}>
                    <UsersPage />
                  </RequireAuth>
                }
              />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
      {background && (
        <Routes>
          <Route path="/spells/:slug" element={<SpellModal />} />
        </Routes>
      )}
    </>
  );
}
