import { Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { SpellModal } from './components/SpellModal';
import { SpellsPage } from './pages/SpellsPage';
import { SpellPage } from './pages/SpellPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AccountPage } from './pages/AccountPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminSpellsPage } from './pages/admin/AdminSpellsPage';
import { SpellFormPage } from './pages/admin/SpellFormPage';
import { ImportExportPage } from './pages/admin/ImportExportPage';
import { UsersPage } from './pages/admin/UsersPage';

export default function App() {
  const location = useLocation();
  // Wird eine Karte angeklickt, bleibt die Liste im Hintergrund und das Detail öffnet als Modal
  const background = (location.state as { background?: Location } | null)?.background;

  return (
    <>
      <Routes location={background ?? location}>
        <Route element={<Layout />}>
          <Route index element={<SpellsPage key="all" />} />
          <Route
            path="favorites"
            element={
              <RequireAuth>
                <SpellsPage key="favorites" favoritesPage />
              </RequireAuth>
            }
          />
          <Route path="spells/:slug" element={<SpellPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route
            path="account"
            element={
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            }
          />
          <Route
            path="admin"
            element={
              <RequireAuth admin>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="spells" replace />} />
            <Route path="spells" element={<AdminSpellsPage />} />
            <Route path="spells/new" element={<SpellFormPage key="new" />} />
            <Route path="spells/:slug/edit" element={<SpellFormPage />} />
            <Route path="import-export" element={<ImportExportPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
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
