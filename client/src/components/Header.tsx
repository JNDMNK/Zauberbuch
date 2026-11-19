import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookHeart, BookOpen, ChevronDown, Library, LogOut, Menu, MessagesSquare, Moon, ScrollText, Settings, Shield, Sun, Swords, UserRound, X } from 'lucide-react';
import { LOCALES } from '@zauberbuch/shared';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useBoardUnread } from '../hooks/useBoardUnread';
import { useCombatActive } from '../hooks/useCombatActive';
import { StorySwitcher } from './StorySwitcher';
import { NotificationBell } from './NotificationBell';

function LanguageSwitch() {
  const { t } = useTranslation();
  const { language, setLanguage } = useAuth();
  return (
    <div role="group" aria-label={t('nav.language')} className="flex overflow-hidden rounded-full border border-parchment-500/60 dark:border-night-700">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLanguage(l)}
          aria-pressed={language === l}
          title={t(`langName.${l}`)}
          className={`px-2.5 py-1 font-display text-xs font-bold transition ${
            language === l
              ? 'bg-parchment-800 text-parchment-50 dark:bg-parchment-300 dark:text-ink'
              : 'text-parchment-800 hover:bg-parchment-200 dark:text-parchment-300 dark:hover:bg-night-700'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark');
  return (
    <button type="button" onClick={toggle} className="btn-icon" aria-label={label} title={label}>
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

function UserMenu() {
  const { t } = useTranslation();
  const { user, logout, canAccessAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="btn-ghost !px-2">
        <UserRound className="h-5 w-5" />
        <span className="hidden max-w-[10rem] truncate sm:inline">{user.username}</span>
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="parchment absolute right-0 z-50 mt-2 w-52 overflow-hidden py-1">
          <Link role="menuitem" to="/account" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 hover:bg-parchment-200/70 dark:hover:bg-night-700">
            <Settings className="h-4 w-4" />
            {t('nav.account')}
          </Link>
          {canAccessAdmin && (
            <Link role="menuitem" to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 hover:bg-parchment-200/70 dark:hover:bg-night-700">
              <Shield className="h-4 w-4" />
              {t('nav.admin')}
            </Link>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              setOpen(false);
              await logout();
              toast.show(t('auth.loggedOut'));
              navigate('/');
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-parchment-200/70 dark:hover:bg-night-700"
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </button>
        </div>
      )}
    </div>
  );
}

/** Aufklappmenü „Zauber“ mit „Alle Zauber“ und „Mein Zauberbuch“ */
function SpellsMenu({ navCls }: { navCls: (s: { isActive: boolean }) => string }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isEditor } = useAuth();
  // „/spellbook“ = Mein Zauberbuch, „/spellbooks“ = Zauberbücher aller Benutzer (DM/Admin)
  const active = location.pathname === '/' || location.pathname.startsWith('/spellbook') || location.pathname.startsWith('/spells/');

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = 'flex items-center gap-2 px-4 py-2 hover:bg-parchment-200/70 dark:hover:bg-night-700';
  return (
    <div ref={ref} className="relative">
      <button type="button" className={navCls({ isActive: active })} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <BookOpen className="h-4 w-4" />
        {t('nav.spells')}
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="parchment absolute left-0 z-50 mt-2 w-56 overflow-hidden py-1">
          <NavLink role="menuitem" to="/" end className={({ isActive }) => `${item} ${isActive ? 'font-semibold' : ''}`}>
            <BookOpen className="h-4 w-4" />
            {t('nav.allSpells')}
          </NavLink>
          <NavLink role="menuitem" to="/spellbook" end className={({ isActive }) => `${item} ${isActive ? 'font-semibold' : ''}`}>
            <BookHeart className="h-4 w-4" />
            {t('nav.favorites')}
          </NavLink>
          {isEditor && (
            <NavLink role="menuitem" to="/spellbooks" className={({ isActive }) => `${item} border-t border-parchment-300/70 dark:border-night-700 ${isActive ? 'font-semibold' : ''}`}>
              <Library className="h-4 w-4" />
              {t('nav.spellbooks')}
            </NavLink>
          )}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { t } = useTranslation();
  const { user, canAccessAdmin, isEditor } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const unread = useBoardUnread(Boolean(user));
  const combats = useCombatActive(Boolean(user));

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 font-display text-sm font-semibold tracking-wide transition ${
      isActive
        ? 'bg-parchment-800/90 text-parchment-50 dark:bg-parchment-300 dark:text-ink'
        : 'text-ink hover:bg-parchment-200/80 dark:text-parchment-100 dark:hover:bg-night-700'
    }`;

  const unreadBadge = unread > 0 && (
    <span className="rounded-full bg-red-700 px-1.5 text-xs font-bold leading-5 text-white" aria-label={t('board.unreadCount', { count: unread })}>
      {unread > 99 ? '99+' : unread}
    </span>
  );
  const combatDot = combats > 0 && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" aria-label={t('combat.running', { count: combats })} title={t('combat.running', { count: combats })} />;

  // Ohne Anmeldung gibt es keine Navigation – die Startseite ist der Login
  const sharedLinks = (
    <>
      <NavLink to="/characters" state={{ fromNav: true }} className={navCls}>
        <ScrollText className="h-4 w-4" />
        {t('nav.characters')}
      </NavLink>
      <NavLink to="/board" state={{ fromNav: true }} className={navCls}>
        <MessagesSquare className="h-4 w-4" />
        {t('nav.board')}
        {unreadBadge}
      </NavLink>
      <NavLink to="/combat" state={{ fromNav: true }} className={navCls}>
        <Swords className="h-4 w-4" />
        {t('nav.combat')}
        {combatDot}
      </NavLink>
    </>
  );
  // Desktop: „Zauber“ als Aufklappmenü, Verwaltung im Benutzermenü
  const desktopLinks = !user ? null : (
    <>
      <SpellsMenu navCls={navCls} />
      {sharedLinks}
    </>
  );
  // Handy: alles als flache Liste
  const mobileLinks = !user ? null : (
    <>
      <NavLink to="/" end className={navCls}>
        <BookOpen className="h-4 w-4" />
        {t('nav.allSpells')}
      </NavLink>
      <NavLink to="/spellbook" end className={navCls}>
        <BookHeart className="h-4 w-4" />
        {t('nav.favorites')}
      </NavLink>
      {isEditor && (
        <NavLink to="/spellbooks" className={navCls}>
          <Library className="h-4 w-4" />
          {t('nav.spellbooks')}
        </NavLink>
      )}
      {sharedLinks}
      {canAccessAdmin && (
        <NavLink to="/admin" className={navCls}>
          <Shield className="h-4 w-4" />
          {t('nav.admin')}
        </NavLink>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-parchment-400/60 bg-parchment-100/85 backdrop-blur dark:border-night-700 dark:bg-night-900/85">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2" aria-label={t('app.title')}>
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="hidden flex-col leading-none sm:flex lg:hidden xl:flex">
            <span className="font-display text-xl font-bold tracking-wider">{t('app.title')}</span>
            <span className="text-xs italic text-parchment-700 dark:text-parchment-400">{t('app.subtitle')}</span>
          </span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 lg:flex">{desktopLinks}</nav>
        <div className="ml-auto flex items-center gap-1.5">
          {user && <StorySwitcher />}
          <LanguageSwitch />
          <ThemeToggle />
          {user && <NotificationBell />}
          <UserMenu />
          {user && (
          <button type="button" className="btn-icon relative lg:hidden" onClick={() => setMobileOpen((o) => !o)} aria-expanded={mobileOpen} aria-label={t('nav.menu')}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            {!mobileOpen && (unread > 0 || combats > 0) && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-700" aria-hidden />}
          </button>
          )}
        </div>
      </div>
      {mobileOpen && user && (
        <nav className="flex flex-col gap-1 border-t border-parchment-400/60 px-4 py-3 lg:hidden dark:border-night-700">
          {mobileLinks}
        </nav>
      )}
    </header>
  );
}
