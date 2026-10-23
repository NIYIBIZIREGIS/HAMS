import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';
import { useNotificationStore } from '../../../store/notificationStore';
import { useLogoutConfirmation } from '../../../hooks/useLogoutConfirmation';
import { UserAvatar } from '../../ui/UserAvatar';
import { NotificationPanel } from '../../ui/NotificationPanel';
import {
  Menu, Bell, LogOut, ChevronDown,
} from 'lucide-react';

interface Props {
  onOpenMobile: () => void;
}

export function PortalHeader({ onOpenMobile }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { notifications } = useNotificationStore();
  const { requestLogout, dialog: logoutDialog } = useLogoutConfirmation();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    setProfileOpen(false);
    requestLogout();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-card/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 md:px-6">
        {/* Left: menu + system name/logo */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenMobile}
            className="rounded-lg p-1.5 text-text-main transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 22V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 7l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <p className="truncate text-sm font-bold text-text-main dark:text-white sm:text-base">
              HAS
            </p>
          </div>
        </div>

        {/* Right: notifications, profile */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Notifications */}
          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            className="relative rounded-lg p-1.5 text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label={t('portal.header.notifications')}
            title={t('portal.header.notifications')}
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-white">
                {unread}
              </span>
            )}
          </button>

          {/* User menu */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              aria-expanded={profileOpen}
              aria-haspopup="true"
            >
              <UserAvatar name={user?.fullName} imageUrl={user?.profileImageUrl} size="sm" />
              <ChevronDown className={`h-3.5 w-3.5 text-text-muted transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-card py-1 shadow-md dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={user?.fullName} imageUrl={user?.profileImageUrl} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-text-main dark:text-white">{user?.fullName}</p>
                      <p className="truncate text-xs text-text-muted dark:text-slate-400">{user?.email}</p>
                    </div>
                  </div>
                </div>
                <Link to="/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-main transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                  {t('portal.sidebar.settings')}
                </Link>
                <button onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-status-cancelled-text transition-colors hover:bg-status-cancelled-bg dark:text-red-400 dark:hover:bg-red-950">
                  <LogOut className="h-4 w-4" /> {t('nav.logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      {logoutDialog}
    </header>
  );
}