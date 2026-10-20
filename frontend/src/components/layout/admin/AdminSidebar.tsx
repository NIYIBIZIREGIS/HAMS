import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLogoutConfirmation } from '../../../hooks/useLogoutConfirmation';
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Database,
  BarChart3,
  ClipboardList,
  Settings,
  HeartPulse,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Users,
  UserCog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SidebarLink {
  to: string;
  icon: LucideIcon;
  labelKey: string;
}

const LINKS: SidebarLink[] = [
  { to: '/admin/dashboard',      icon: LayoutDashboard,  labelKey: 'admin.sidebar.dashboard' },
  { to: '/admin/patients',       icon: Users,            labelKey: 'admin.sidebar.patients' },
  { to: '/admin/users',          icon: UserCog,          labelKey: 'admin.sidebar.users' },
  { to: '/admin/facilities',     icon: Building2,        labelKey: 'admin.sidebar.facilities' },
  { to: '/admin/facility-admins',icon: ShieldCheck,      labelKey: 'admin.sidebar.facilityAdmins' },
  { to: '/admin/master-data',    icon: Database,         labelKey: 'admin.sidebar.masterData' },
  { to: '/admin/analytics',      icon: BarChart3,        labelKey: 'admin.sidebar.analytics' },
  { to: '/admin/audit-logs',     icon: ClipboardList,    labelKey: 'admin.sidebar.auditLogs' },
  { to: '/admin/settings',       icon: Settings,         labelKey: 'admin.sidebar.settings' },
];

interface Props {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function AdminSidebar({ collapsed, onToggle }: Props) {
  const { t } = useTranslation();
  const { requestLogout, dialog: logoutDialog } = useLogoutConfirmation();

  const handleLogout = () => requestLogout();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-navy-900 text-white transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
          <HeartPulse className="h-5 w-5" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">HAS Admin</p>
            <p className="truncate text-xs text-slate-400">Super Administrator</p>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Admin navigation">
        {!collapsed && (
          <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Management
          </p>
        )}
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/admin/dashboard'}
              className={({ isActive }) =>
                `mx-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-primary text-white font-medium'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
              title={collapsed ? t(link.labelKey) : undefined}
            >
              <Icon className="shrink-0 h-5 w-5" aria-hidden="true" />
              {!collapsed && <span className="truncate">{t(link.labelKey)}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-white/10 p-2">
        <button
          onClick={handleLogout}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? t('nav.logout') : undefined}
        >
          <LogOut className="shrink-0 h-5 w-5" aria-hidden="true" />
          {!collapsed && <span>{t('nav.logout')}</span>}
        </button>
        <button
          onClick={onToggle}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/10 hover:text-slate-200 ${
            collapsed ? 'justify-center' : ''
          }`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="shrink-0 h-5 w-5" />
          ) : (
            <>
              <ChevronsLeft className="shrink-0 h-5 w-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
      {logoutDialog}
    </aside>
  );
}
