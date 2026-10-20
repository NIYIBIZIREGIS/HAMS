import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useLogoutConfirmation } from '../../hooks/useLogoutConfirmation';
import {
  HeartPulse, Menu, X, LogOut, Globe, User, Sun, Moon,
  ChevronDown, ArrowRight,
} from 'lucide-react';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'rw', label: 'Kinyarwanda' },
];

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const { requestLogout, dialog: logoutDialog } = useLogoutConfirmation();

  const currentLang = LANGS.find((l) => i18n.language?.startsWith(l.code)) ?? LANGS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    setMobileOpen(false);
    requestLogout();
  };

  if (user?.role === 'super_admin') return null;

  const publicLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/about', label: t('nav.aboutUs') },
    { to: '/how-it-works', label: t('nav.howItWorks') },
    { to: '/comments', label: t('nav.comments') },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-card/70 shadow-sm backdrop-blur-xl backdrop-saturate-150 dark:border-slate-800/70 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
            <HeartPulse className="h-5 w-5" />
          </span>
          <div className="hidden sm:block">
            <span className="text-lg font-bold text-text-main dark:text-white">HAS</span>
            <span className="ml-1.5 text-sm text-text-muted dark:text-slate-400">Hospital System</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {user ? (
            <>
              <Link to="/dashboard" className="rounded-xl px-3 py-2 text-base font-medium text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">{t('nav.dashboard')}</Link>
              <Link to="/book" className="rounded-xl px-3 py-2 text-base font-medium text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">{t('nav.book')}</Link>
              {(user.role === 'facility_admin' || user.role === 'super_admin') && (
                <Link to="/admin" className="rounded-xl px-3 py-2 text-base font-medium text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">Admin</Link>
              )}
            </>
          ) : (
            publicLinks.map(({ to, label }) => (
              <Link key={to} to={to} className="rounded-xl px-3 py-2 text-base font-medium text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">{label}</Link>
            ))
          )}
        </nav>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={toggleTheme} className="rounded-xl p-2 text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <div ref={langRef} className="relative hidden sm:block">
            <button type="button" onClick={() => setLangOpen(!langOpen)} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-text-main transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
              <Globe className="h-4 w-4 text-text-muted dark:text-slate-500" />
              {currentLang.label}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-card py-1 shadow-md dark:border-slate-700 dark:bg-slate-900">
                {LANGS.map((lang) => (
                  <button key={lang.code} type="button" onClick={() => { setLanguage(lang.code); setLangOpen(false); }}
                    className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors ${
                      i18n.language?.startsWith(lang.code)
                        ? 'bg-primary font-medium text-white'
                        : 'text-text-muted hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}>{lang.label}</button>
                ))}
              </div>
            )}
          </div>

          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white"><User className="h-4 w-4" /></span>
                <span className="max-w-[120px] truncate text-sm font-medium text-text-main dark:text-slate-300">{user.fullName}</span>
              </div>
              <button type="button" onClick={handleLogout} className="rounded-xl p-2 text-text-muted transition-colors hover:bg-status-cancelled-bg hover:text-status-cancelled-text dark:hover:bg-red-950 dark:hover:text-red-400" aria-label={t('nav.logout')}>
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <Link to="/register" className="hidden items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow transition-all duration-200 hover:bg-primary-hover dark:bg-primary dark:text-white dark:hover:bg-primary-hover md:inline-flex">
              {t('nav.getStarted')}<ArrowRight className="h-4 w-4" />
            </Link>
          )}

          <button type="button" className="rounded-xl p-2 text-text-main hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-100 bg-card px-4 pb-4 pt-2 dark:border-slate-800 dark:bg-slate-950 md:hidden">
          <nav className="flex flex-col gap-1">
            {user ? (
              <>
                <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white"><User className="h-4 w-4" /></span>
                  <div>
                    <p className="text-base font-medium text-text-main dark:text-slate-100">{user.fullName}</p>
                    <p className="text-sm text-text-muted dark:text-slate-400">{user.role}</p>
                  </div>
                </div>
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2.5 text-base font-medium text-text-main hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{t('nav.dashboard')}</Link>
                <Link to="/book" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2.5 text-base font-medium text-text-main hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{t('nav.book')}</Link>
                <hr className="my-1 border-slate-100 dark:border-slate-800" />
                <button type="button" onClick={() => { handleLogout(); setMobileOpen(false); }} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-base font-medium text-status-cancelled-text hover:bg-status-cancelled-bg dark:text-red-400 dark:hover:bg-red-950"><LogOut className="h-4 w-4" />{t('nav.logout')}</button>
              </>
            ) : (
              <>
                {publicLinks.map(({ to, label }) => (
                  <Link key={to} to={to} onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2.5 text-base font-medium text-text-main hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{label}</Link>
                ))}
                <hr className="my-1 border-slate-100 dark:border-slate-800" />
                <Link to="/register" onClick={() => setMobileOpen(false)} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-center text-base font-semibold text-white dark:bg-primary dark:text-white">{t('nav.getStarted')}<ArrowRight className="h-4 w-4" /></Link>
              </>
            )}
          </nav>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button type="button" onClick={toggleTheme} className="rounded-xl p-2 text-text-muted hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-1">
              {LANGS.map((lang) => (
                <button key={lang.code} type="button" onClick={() => setLanguage(lang.code)}
                  className={`rounded-xl px-3 py-1.5 text-sm font-medium ${i18n.language?.startsWith(lang.code) ? 'bg-primary text-white' : 'text-text-muted hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>{lang.code.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      {logoutDialog}
    </header>
  );
}