import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../../../i18n';
import { useAuthStore } from '../../../store/authStore';
import { useLogoutConfirmation } from '../../../hooks/useLogoutConfirmation';
import { Search, Bell, Globe, User, LogOut, ChevronDown } from 'lucide-react';

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'rw', label: 'RW' },
];

export function AdminHeader() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { requestLogout, dialog: logoutDialog } = useLogoutConfirmation();

  const handleLogout = () => {
    setShowProfileMenu(false);
    requestLogout();
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
      {/* Left: Search */}
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search facilities, admins..."
            className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-text-main placeholder:text-text-muted transition-colors focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {/* System health */}
        <div className="flex items-center gap-2 rounded-full bg-status-confirmed-bg px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-status-confirmed-text" aria-hidden="true" />
          <span className="text-xs font-medium text-status-confirmed-text">{t('admin.header.systemHealth')}</span>
        </div>
      </div>

      {/* Right: language + notifications + user */}
      <div className="flex items-center gap-2">
        {/* Language switcher */}
        <div
          className="hidden items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 sm:flex"
          aria-label={t('app.language')}
        >
          <Globe className="ml-1 h-3.5 w-3.5 text-slate-400" />
          {LANGS.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`rounded-xl px-2 py-1 text-xs font-medium transition-colors ${
                i18n.language?.startsWith(lang.code)
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:bg-slate-100'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* Notifications */}
        <button
          className="relative rounded-xl p-2 text-text-muted hover:bg-slate-100 hover:text-text-main"
          aria-label={t('admin.header.notifications')}
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-status-cancelled-text" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 hover:bg-slate-100"
            aria-expanded={showProfileMenu}
            aria-haspopup="true"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary">
              <User className="h-3.5 w-3.5" />
            </span>
            <div className="hidden text-left md:block">
              <p className="text-xs font-semibold text-text-main">{user?.fullName}</p>
              <p className="text-[10px] text-text-muted">{t('admin.header.superAdmin')}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </button>

          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-card py-1 shadow-md">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-medium text-text-main">{user?.fullName}</p>
                  <p className="text-xs text-text-muted">{t('admin.header.superAdmin')}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-status-cancelled-text hover:bg-status-cancelled-bg"
                >
                  <LogOut className="h-4 w-4" />
                  {t('nav.logout')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {logoutDialog}
    </header>
  );
}
