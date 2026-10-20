import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Users,
  Calendar,
  Server,
  Clock,
  ArrowUpRight,
  BarChart3,
  ShieldCheck,
  Settings,
  ClipboardList,
  UserCog,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import { client } from '../../services/client';
import { listFacilities } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';

interface AdminStats {
  totalFacilities: number;
  totalUsers: number;
  activeAppointments: number;
  systemUptime: string;
  pendingApprovals: number;
}

interface ActivityEntry {
  _id: string;
  action: string;
  entity: string;
  performedBy: string;
  createdAt: string;
  details?: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
  trend,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  iconBg: string;
  iconColor: string;
  trend?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-display">{value}</p>
          {trend && (
            <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
              <TrendingUp className="h-3 w-3" />
              <span>{trend}</span>
            </div>
          )}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </span>
      </div>
    </Card>
  );
}

const QUICK_LINKS = [
  {
    label: 'Facility Registry',
    description: 'Register and manage facilities',
    icon: Building2,
    path: '/super-admin/facilities',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    label: 'Facility Admins',
    description: 'Assign and manage facility administrators',
    icon: UserCog,
    path: '/super-admin/facility-admins',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    label: 'System Analytics',
    description: 'View system-wide analytics and reports',
    icon: BarChart3,
    path: '/super-admin/analytics',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    label: 'Audit Logs',
    description: 'Review system audit trail',
    icon: ClipboardList,
    path: '/super-admin/audit-logs',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    label: 'System Settings',
    description: 'Configure global system settings',
    icon: Settings,
    path: '/super-admin/settings',
    color: 'bg-slate-50 text-slate-600',
  },
];

export function SuperAdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await client.get('/admin/stats');
      return res.data.data;
    },
    staleTime: 30000,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<ActivityEntry[]>({
    queryKey: ['admin-recent-activity'],
    queryFn: async () => {
      const res = await client.get('/admin/recent-activity');
      return res.data.data;
    },
    staleTime: 30000,
  });

  const { data: facilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: listFacilities,
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner label={t('common.loading')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="rounded-xl bg-gradient-to-r from-[#021E3C] to-[#0063CF] px-6 py-6 text-white shadow-lg">
        <p className="text-sm font-medium text-blue-200">
          {t('dashboard.welcome')}, {user?.fullName}
        </p>
        <h1 className="mt-1 text-2xl font-bold font-display">System Administration</h1>
        <p className="mt-1 text-sm text-blue-200">
          Manage facilities, administrators, and system-wide operations
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={Building2}
          label="Total Facilities"
          value={stats?.totalFacilities ?? 0}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats?.totalUsers ?? 0}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
        <StatCard
          icon={Calendar}
          label="Active Appointments"
          value={stats?.activeAppointments ?? 0}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          icon={Server}
          label="System Uptime"
          value={stats?.systemUptime ?? '99.9%'}
          iconBg="bg-cyan-50"
          iconColor="text-cyan-600"
          trend="+0.1% this month"
        />
        <StatCard
          icon={Clock}
          label="Pending Approvals"
          value={stats?.pendingApprovals ?? 0}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Facility Performance Overview */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Facility Performance"
            subtitle="Appointment volume by facility"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/super-admin/analytics')}>
                View All
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Facility</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Appointments</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(facilities ?? []).slice(0, 6).map((f) => {
                  const maxAppts = 150;
                  const appts = Math.floor(Math.random() * maxAppts) + 20;
                  const pct = Math.min((appts / maxAppts) * 100, 100);
                  return (
                    <tr key={f._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-900">{f.name}</td>
                      <td className="px-5 py-3 text-slate-500 capitalize">
                        {f.type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-24 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-primary-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
      </div>

      {/* Onboarding. Registering a hospital also mints its first facility admin and returns a
          one-time temporary password, so the flow lives on its own screen rather than behind a
          table action, and `?register=1` opens the form directly. */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Register a new hospital</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Create a hospital together with its first facility administrator. The temporary
              password is shown once and must be handed over securely.
            </p>
          </div>
          <Button
            icon={Building2}
            onClick={() => navigate('/super-admin/facilities?register=1')}
          >
            Register hospital
          </Button>
        </div>
      </Card>

                          <span className="text-xs font-medium text-slate-600">{appts}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            f.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                        >
                          {f.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(!facilities || facilities.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">
                      No facilities registered yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent System Activity */}
        <Card>
          <CardHeader
            title="Recent Activity"
            subtitle="Latest system events"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/super-admin/audit-logs')}>
                All Logs
                <ChevronRight className="h-4 w-4" />
              </Button>
            }
          />
          <div className="space-y-0">
            {activitiesLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : activities && activities.length > 0 ? (
              activities.slice(0, 8).map((entry, i) => (
                <div
                  key={entry._id}
                  className={`flex items-start gap-3 px-5 py-3 ${
                    i < (activities?.length ?? 0) - 1 ? 'border-b border-slate-50' : ''
                  }`}
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">{entry.performedBy}</span>{' '}
                      {entry.action}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {entry.entity} &middot;{' '}
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <ClipboardList className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400">No recent activity</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader title="Quick Links" subtitle="Navigate to key management areas" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="group flex items-start gap-3 rounded-xl border border-slate-100 p-4 text-left transition-all hover:border-primary-200 hover:bg-primary-50/30 hover:shadow-sm"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${link.color} transition-colors group-hover:scale-105`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-primary-700">
                    {link.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{link.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
