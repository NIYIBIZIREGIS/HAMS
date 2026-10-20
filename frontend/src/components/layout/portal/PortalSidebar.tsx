import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';
import { useLogoutConfirmation } from '../../../hooks/useLogoutConfirmation';
import {
  LayoutDashboard,
  Calendar,
  CalendarPlus,
  FileText,
  Settings,
  HeartPulse,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Home,
  Clock,
  Package,
  UserCog,
  Building2,
  ShieldCheck,
  Database,
  BarChart3,
  ClipboardList,
  ReceiptText,
  Wallet,
  ArrowLeftRight,
  Stethoscope,
  Users,
  FlaskConical,
  Pill,
  Mail,
  Bell,
  FolderOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SidebarLink {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  end?: boolean;
}

const ROLE_LINKS: Record<string, SidebarLink[]> = {
  patient: [
    { to: '/dashboard', icon: LayoutDashboard, labelKey: 'portal.sidebar.dashboard', end: true },
    { to: '/book', icon: CalendarPlus, labelKey: 'portal.sidebar.book' },
    { to: '/appointments', icon: Calendar, labelKey: 'portal.sidebar.appointments' },
    { to: '/my-facilities', icon: Building2, labelKey: 'portal.sidebar.myFacilities' },
    { to: '/medical-history', icon: FileText, labelKey: 'portal.sidebar.medicalHistory' },
    { to: '/prescriptions', icon: Pill, labelKey: 'portal.sidebar.prescriptions' },
    { to: '/lab-results', icon: FlaskConical, labelKey: 'portal.sidebar.labResults' },
    { to: '/messages', icon: Mail, labelKey: 'portal.sidebar.messages' },
    { to: '/notifications', icon: Bell, labelKey: 'portal.sidebar.notifications' },
    { to: '/documents', icon: FolderOpen, labelKey: 'portal.sidebar.documents' },
    { to: '/billing-mine', icon: ReceiptText, labelKey: 'portal.sidebar.billing' },
  ],
  doctor: [
    { to: '/dashboard', icon: LayoutDashboard, labelKey: 'portal.sidebar.dashboard', end: true },
    { to: '/availability', icon: Clock, labelKey: 'portal.sidebar.availability' },
  ],
  receptionist: [
    { to: '/dashboard', icon: LayoutDashboard, labelKey: 'portal.sidebar.dashboard', end: true },
    { to: '/patients', icon: Users, labelKey: 'portal.sidebar.patients' },
    { to: '/book', icon: CalendarPlus, labelKey: 'portal.sidebar.book' },
    { to: '/billing', icon: ReceiptText, labelKey: 'portal.sidebar.billing' },
  ],
  nurse: [
    { to: '/dashboard', icon: LayoutDashboard, labelKey: 'portal.sidebar.dashboard', end: true },
  ],
  lab_technician: [
    { to: '/dashboard', icon: LayoutDashboard, labelKey: 'portal.sidebar.dashboard', end: true },
  ],
  pharmacist: [
    { to: '/dashboard', icon: LayoutDashboard, labelKey: 'portal.sidebar.dashboard', end: true },
    { to: '/pharmacy/inventory', icon: Package, labelKey: 'portal.sidebar.inventory' },
  ],
  insurance_verifier: [
    { to: '/dashboard', icon: LayoutDashboard, labelKey: 'portal.sidebar.dashboard', end: true },
    { to: '/billing', icon: ReceiptText, labelKey: 'portal.sidebar.billing' },
    { to: '/claims', icon: Wallet, labelKey: 'portal.sidebar.claims' },
  ],
  auditor: [
    { to: '/dashboard', icon: LayoutDashboard, labelKey: 'portal.sidebar.dashboard', end: true },
  ],
facility_admin: [
    { to: '/dashboard', icon: LayoutDashboard, labelKey: 'portal.sidebar.dashboard', end: true },
    { to: '/patients', icon: Users, labelKey: 'portal.sidebar.patients' },
    { to: '/admin', icon: UserCog, labelKey: 'portal.sidebar.adminPanel' },
    { to: '/admin/departments', icon: Building2, labelKey: 'portal.sidebar.departments' },
    { to: '/admin/doctors', icon: Stethoscope, labelKey: 'portal.sidebar.doctors' },
    { to: '/admin/staff', icon: Users, labelKey: 'portal.sidebar.staff' },
    { to: '/availability', icon: Clock, labelKey: 'portal.sidebar.availability' },
    { to: '/pharmacy/inventory', icon: Package, labelKey: 'portal.sidebar.inventory' },
    { to: '/reconciliation', icon: ArrowLeftRight, labelKey: 'portal.sidebar.reconciliation' },
  ],
  super_admin: [
    { to: '/admin/dashboard', icon: LayoutDashboard, labelKey: 'portal.sidebar.dashboard', end: true },
    { to: '/admin/patients', icon: Users, labelKey: 'portal.sidebar.patients' },
    { to: '/admin/users', icon: UserCog, labelKey: 'portal.sidebar.users' },
    { to: '/admin/facilities', icon: Building2, labelKey: 'portal.sidebar.facilities' },
    { to: '/admin/facility-admins', icon: ShieldCheck, labelKey: 'portal.sidebar.facilityAdmins' },
    { to: '/admin/doctors', icon: Stethoscope, labelKey: 'portal.sidebar.doctors' },
    { to: '/admin/master-data', icon: Database, labelKey: 'portal.sidebar.masterData' },
    { to: '/admin/analytics', icon: BarChart3, labelKey: 'portal.sidebar.analytics' },
    { to: '/admin/audit-logs', icon: ClipboardList, labelKey: 'portal.sidebar.auditLogs' },
    { to: '/admin/settings', icon: Settings, labelKey: 'portal.sidebar.globalSettings' },
  ],
};

const COMMON_LINKS: SidebarLink[] = [
  { to: '/settings', icon: Settings, labelKey: 'portal.sidebar.settings' },
];

function roleForSidebar(role: string): SidebarLink[] {
  return ROLE_LINKS[role] ?? ROLE_LINKS.patient;
}

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function PortalSidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { requestLogout, dialog: logoutDialog } = useLogoutConfirmation();

  const links = [...roleForSidebar(user?.role ?? 'patient'), ...COMMON_LINKS];

  const handleLogout = () => {
    onCloseMobile();
    requestLogout();
  };

  const body = (
    <>
      {/* Logo / branding */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
          <HeartPulse className="h-5 w-5" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-text-main dark:text-white">HAS</p>
            <p className="truncate text-xs text-text-muted dark:text-slate-400">{t('portal.systemSubtitle')}</p>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 overflow-y-auto py-3" aria-label="Sidebar navigation">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `mx-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out ${
              collapsed ? 'justify-center' : ''
            } ${
              isActive
                ? 'bg-primary text-white shadow-md'
                : 'text-text-main hover:translate-x-0.5 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }`
          }
          title={collapsed ? t('portal.sidebar.home') : undefined}
        >
          <Home className="h-5 w-5 shrink-0" aria-hidden="true" />
          {!collapsed && <span className="truncate">{t('portal.sidebar.home')}</span>}
        </NavLink>

        <div className="px-4 pt-2 pb-1">
          <p className={`text-[10px] font-semibold uppercase tracking-widest text-text-muted dark:text-slate-500 ${collapsed ? 'text-center' : ''}`}>
            {collapsed ? '•••' : t('portal.sidebar.menu')}
          </p>
        </div>

        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `mx-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-primary text-white shadow-md'
                    : 'text-text-main hover:translate-x-0.5 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`
              }
              title={collapsed ? t(link.labelKey) : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{t(link.labelKey)}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        <button
          type="button"
          onClick={handleLogout}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-main transition-colors hover:bg-status-cancelled-bg hover:text-status-cancelled-text dark:text-slate-300 dark:hover:bg-red-950 dark:hover:text-red-400 ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? t('nav.logout') : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
          {!collapsed && <span>{t('nav.logout')}</span>}
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`hidden lg:flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white ${
            collapsed ? 'justify-center' : ''
          }`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="h-5 w-5 shrink-0" />
          ) : (
            <>
              <ChevronsLeft className="h-5 w-5 shrink-0" />
              <span>{t('portal.sidebar.collapse')}</span>
            </>
          )}
        </button>
      </div>
      {logoutDialog}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-200 bg-card transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 lg:flex ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {body}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCloseMobile} aria-hidden="true" />
          <aside className="relative h-full w-64 border-r border-slate-200 bg-card dark:border-slate-800 dark:bg-slate-900">
            {body}
          </aside>
        </div>
      )}
    </>
  );
}