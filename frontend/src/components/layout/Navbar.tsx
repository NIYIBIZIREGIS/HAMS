import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useLogoutConfirmation } from '../../hooks/useLogoutConfirmation';
import { HeartPulse, Menu, X, LogOut, User, ArrowRight } from 'lucide-react';

const desktopLinkClass =
  'rounded-xl px-3 py-2 text-base font-medium text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

const mobileLinkClass =
  'rounded-xl px-3 py-2.5 text-base font-medium text-text-main hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800';

export function Navbar() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const { requestLogout, logoutDialog } = useLogoutConfirmation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
            <HeartPulse className="h-5 w-5" />
          </span>
          <div className="hidden sm:block">
            <span className="text-lg font-bold text-text-main dark:text-white">HAS</span>
            <span className="ml-1.5 text-sm text-text-muted dark:text-slate-400">Hospital System</span>
          </div>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {user ? (
            <>
              <Link to="/dashboard" className={desktopLinkClass}>{t('nav.dashboard')}</Link>
              <Link to="/book" className={desktopLinkClass}>{t('nav.book')}</Link>
              {(user.role === 'facility_admin' || user.role === 'super_admin') && (
                <Link to="/admin" className={desktopLinkClass}>Admin</Link>
              )}
            </>
          ) : (
            publicLinks.map(({ to, label }) => (
              <Link key={to} to={to} className={desktopLinkClass}>{label}</Link>
            ))
          )}
        </nav>

        <div className="flex items-center gap-1.5">
          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
                  <User className="h-4 w-4" />
                </span>
                <span className="max-w-[120px] truncate text-sm font-medium text-text-main dark:text-slate-300">
                  {user.fullName}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl p-2 text-text-muted transition-colors hover:bg-status-cancelled-bg hover:text-status-cancelled-text dark:hover:bg-red-950 dark:hover:text-red-400"
                aria-label={t('nav.logout')}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <Link
              to="/register"
              className="hidden items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow transition-all duration-200 hover:bg-primary-hover md:inline-flex"
            >
              {t('nav.getStarted')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          <button
            type="button"
            className="rounded-xl p-2 text-text-main hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileOpen && (
        <div className="border-t border-slate-100 bg-card px-4 pb-4 pt-2 dark:border-slate-800 dark:bg-slate-950 md:hidden">
          <nav className="flex flex-col gap-1">
            {user ? (
              <>
                <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
                    <User className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-base font-medium text-text-main dark:text-slate-100">{user.fullName}</p>
                    <p className="text-sm text-text-muted dark:text-slate-400">{user.role}</p>
                  </div>
                </div>
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} className={mobileLinkClass}>
                  {t('nav.dashboard')}
                </Link>
                <Link to="/book" onClick={() => setMobileOpen(false)} className={mobileLinkClass}>
                  {t('nav.book')}
                </Link>
                {user.role === 'facility_admin' && (
                  <Link to="/admin" onClick={() => setMobileOpen(false)} className={mobileLinkClass}>
                    Admin
                  </Link>
                )}
                <hr className="my-1 border-slate-100 dark:border-slate-800" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-base font-medium text-status-cancelled-text hover:bg-status-cancelled-bg dark:text-red-400 dark:hover:bg-red-950"
                >
                  <LogOut className="h-4 w-4" />
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                {publicLinks.map(({ to, label }) => (
                  <Link key={to} to={to} onClick={() => setMobileOpen(false)} className={mobileLinkClass}>
                    {label}
                  </Link>
                ))}
                <hr className="my-1 border-slate-100 dark:border-slate-800" />
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-center text-base font-semibold text-white"
                >
                  {t('nav.getStarted')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </nav>
        </div>
      )}

      {logoutDialog}
    </header>
  );
}