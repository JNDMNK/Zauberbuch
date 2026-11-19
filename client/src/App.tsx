import { Navigate, Outlet, Route, Routes, useLocation, useParams, type Location } from 'react-router-dom';
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
import { StoriesAdminPage } from './pages/admin/StoriesAdminPage';
import { ItemsAdminPage } from './pages/admin/ItemsAdminPage';
import { CatalogAdminPage } from './pages/admin/CatalogAdminPage';
import { useAuth } from './context/AuthContext';
import { PageSpinner } from './components/ui';
import type { ReactNode } from 'react';
import { SpellbooksPage, UserSpellbookPage } from './pages/admin/SpellbooksPage';
import { CharactersPage } from './pages/CharactersPage';
import { CharacterSheetPage } from './pages/CharacterSheetPage';
import { BoardPage } from './pages/BoardPage';
import { BoardTrashPage } from './pages/BoardTrashPage';
import { CombatPage } from './pages/CombatPage';
import { EncounterPage } from './pages/EncounterPage';
import { BestiaryPage } from './pages/BestiaryPage';
import { EDITOR_ROLES, canWriteSpells } from '@zauberbuch/shared';

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
            <Route path="characters" element={<CharactersPage />} />
            <Route path="characters/:id" element={<CharacterSheetPage />} />
            <Route path="board" element={<BoardPage />} />
            <Route
              path="board/trash"
              element={
                <RequireAuth roles={['admin']}>
                  <BoardTrashPage />
                </RequireAuth>
              }
            />
            <Route path="board/:storyId" element={<BoardPage />} />
            <Route path="combat" element={<CombatPage />} />
            <Route path="combat/bestiary" element={<BestiaryPage />} />
            <Route path="combat/:id" element={<EncounterPage />} />
            <Route
              path="spellbooks"
              element={
                <RequireAuth roles={EDITOR_ROLES}>
                  <SpellbooksPage />
                </RequireAuth>
              }
            />
            <Route
              path="spellbooks/:userId"
              element={
                <RequireAuth roles={EDITOR_ROLES}>
                  <UserSpellbookPage />
                </RequireAuth>
              }
            />
            <Route path="account" element={<AccountPage />} />
            <Route
              path="admin"
              element={
                <AdminGuard>
                  <AdminLayout />
                </AdminGuard>
              }
            >
              <Route index element={<AdminIndex />} />
              <Route path="spells" element={<RequireAuth allow={canWriteSpells}><AdminSpellsPage /></RequireAuth>} />
              <Route path="spells/new" element={<RequireAuth allow={canWriteSpells}><SpellFormPage key="new" /></RequireAuth>} />
              <Route path="spells/:slug/edit" element={<RequireAuth allow={canWriteSpells}><SpellFormPage /></RequireAuth>} />
              <Route path="items" element={<ItemsAdminPage />} />
              <Route path="catalog" element={<RequireAuth roles={EDITOR_ROLES}><CatalogAdminPage /></RequireAuth>} />
              <Route
                path="stories"
                element={
                  <RequireAuth roles={EDITOR_ROLES}>
                    <StoriesAdminPage />
                  </RequireAuth>
                }
              />
              <Route path="spellbooks" element={<Navigate to="/spellbooks" replace />} />
              <Route path="spellbooks/:userId" element={<LegacySpellbookRedirect />} />
              <Route path="characters" element={<Navigate to="/characters" replace />} />
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

/** Alte Adresse /admin/spellbooks/:userId -> /spellbooks/:userId */
function LegacySpellbookRedirect() {
  const { userId } = useParams();
  return <Navigate to={`/spellbooks/${userId ?? ''}`} replace />;
}

/** Verwaltung: Zauber-Bearbeiter, Moderator/Admin oder Dungeon Master einer Geschichte (magische Gegenstände) */
function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading, canAccessAdmin, storyDmLoading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  // Zauber-Bearbeiter dürfen sofort; sonst erst nach der Prüfung „DM einer Geschichte?“ entscheiden
  if (!canAccessAdmin && storyDmLoading) return <PageSpinner />;
  if (!canAccessAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Startseite der Verwaltung: Zauber, sonst magische Gegenstände */
function AdminIndex() {
  const { user } = useAuth();
  return <Navigate to={canWriteSpells(user) ? 'spells' : 'items'} replace />;
}
