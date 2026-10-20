import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../../../i18n';
import { useAuthStore } from '../../../store/authStore';
import { useThemeStore } from '../../../store/themeStore';
import { useNotificationStore } from '../../../store/notificationStore';
import { useLogoutConfirmation } from '../../../hooks/useLogoutConfirmation';
import { UserAvatar } from '../../ui/UserAvatar';
import {
  Menu, Bell, Settings, Sun, Moon, Globe, LogOut, ChevronDown, CheckCheck, CalendarDays,
} from 'lucide-react';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'rw', label: 'Kinyarwanda' },
];

interface Props {
  onOpenMobile: () => void;
}

export function PortalHeader({ onOpenMobile }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { notifications, markAllRead, markRead } = useNotificationStore();
  const { requestLogout, dialog: logoutDialog } = useLogoutConfirmation();

  const [notifOpen, setNotifOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    setProfileOpen(false);
    requestLogout();
  };

  const currentLang = LANGS.find((l) => i18n.language?.startsWith(l.code)) ?? LANGS[0];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-card/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        {/* Left: menu + system name */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobile}
            className="rounded-xl p-2 text-text-main transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="truncate text-base font-bold text-text-main dark:text-white">{t('portal.systemSubtitle')}</p>
        </div>

        {/* Right: theme, notifications, settings, language, user */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl p-2 text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label={t('portal.header.toggleTheme')}
            title={t('portal.header.toggleTheme')}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className="relative rounded-xl p-2 text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label={t('portal.header.notifications')}
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-card shadow-md dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <p className="text-sm font-bold text-text-main dark:text-white">{t('portal.header.notifications')}</p>
                  {unread > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text-main dark:text-slate-400 dark:hover:text-white"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> {t('portal.header.markAllRead')}
                    </button>
                  )}
                </div>
                <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                  {notifications.length === 0 ? (
                    <li className="px-4 py-10 text-center text-sm text-text-muted">{t('portal.header.noNotifications')}</li>
                  ) : (
                    notifications.map((n) => (
                      <li key={n.id}>
                        <Link
                          to={n.to ?? '#'}
                          onClick={() => markRead(n.id)}
                          className={`block px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${n.read ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                              {n.type === 'appointment' ? <CalendarDays className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-text-main dark:text-white">{n.title}</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-text-muted dark:text-slate-400">{n.message}</p>
                              <p className="mt-1 text-[11px] text-text-muted dark:text-slate-500">{n.time}</p>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Settings icon */}
          <Link
            to="/settings"
            className="rounded-xl p-2 text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label={t('portal.sidebar.settings')}
            title={t('portal.sidebar.settings')}
          >
            <Settings className="h-5 w-5" />
          </Link>

          {/* Language */}
          <div ref={langRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-text-main transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Globe className="h-4 w-4 text-text-muted" />
              <span className="uppercase">{currentLang.code}</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-card py-1 shadow-md dark:border-slate-700 dark:bg-slate-900">
                {LANGS.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => { setLanguage(lang.code); setLangOpen(false); }}
                    className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors ${
                      i18n.language?.startsWith(lang.code)
                        ? 'bg-primary font-medium text-white'
                        : 'text-text-muted hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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
              <div className="hidden max-w-[120px] text-left md:block">
                <p className="truncate text-xs font-semibold text-text-main dark:text-white">{user?.fullName}</p>
                <p className="truncate text-[10px] capitalize text-text-muted dark:text-slate-400">{user?.role?.replace(/_/g, ' ')}</p>
              </div>
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
                  <Settings className="h-4 w-4" /> {t('portal.sidebar.settings')}
                </Link>
                <button onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-status-cancelled-text transition-colors hover:bg-status-cancelled-bg dark:text-red-400 dark:hover:bg-red-950">
                  <LogOut className="h-4 w-4" /> {t('nav.logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {logoutDialog}
    </header>
  );
}