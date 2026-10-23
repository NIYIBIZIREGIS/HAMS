import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';
import { useLogoutConfirmation } from '../../../hooks/useLogoutConfirmation';
import { Bell, User, LogOut, ChevronDown } from 'lucide-react';

export function AdminHeader() {
  const { t } = useTranslation();
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
          <input
            type="text"
            placeholder="Search facilities, admins..."
            className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-3 text-sm text-text-main placeholder:text-text-muted transition-colors focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          className="relative rounded-xl p-2 text-text-muted hover:bg-slate-100 hover:text-text-main"
          aria-label={t('admin.header.notifications')}
        >
          <Bell className="h-5 w-5" />
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
