import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Stethoscope,
  Building2,
  CalendarCheck,
  Users,
  UserPlus,
  ArrowRight,
  Activity,
  Clock,
  AlertTriangle,
  Phone,
} from 'lucide-react';
import { MetricCard } from '../../components/ui/MetricCard';
import { Card, CardHeader } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import api, { getErrorMessage } from '../../services/api';
import type { Department, Facility as FacilityInfo } from '../../services/api';

interface Stats {
  totalDoctors: number;
  activeDepartments: number;
  todayAppointments: number;
  staffCount: number;
  patientRegistrations: number;
}

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  actor?: string | null;
  timestamp: string;
}

export function FacilityAdminDashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [facility, setFacility] = useState<FacilityInfo | null>(null);
  const [activities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A platform admin (or an admin not yet assigned to a hospital) has nothing to
    // fetch; without clearing the flag here the spinner below would never stop.
    if (!user?.facilityId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [statsRes, deptRes, facilityRes] = await Promise.all([
          api.get(`/facilities/${user.facilityId}/stats`),
          api.get(`/facilities/${user.facilityId}/departments`),
          api.get(`/facilities/${user.facilityId}`),
        ]);
        setStats(statsRes.data.data);
        setDepartments(deptRes.data.data);
        setFacility(facilityRes.data.data);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.facilityId]);

  const statCards = [
    {
      label: 'Total Doctors',
      value: stats?.totalDoctors ?? '—',
      icon: Stethoscope,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Active Departments',
      value: stats?.activeDepartments ?? '—',
      icon: Building2,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: "Today's Appointments",
      value: stats?.todayAppointments ?? '—',
      icon: CalendarCheck,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: 'Staff Count',
      value: stats?.staffCount ?? '—',
      icon: Users,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      label: 'Patient Registrations',
      value: stats?.patientRegistrations ?? '—',
      icon: UserPlus,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
    },
  ];

  const quickLinks = [
    {
      label: 'Manage Departments',
      to: '/admin/departments',
      icon: Building2,
    },
    {
      label: 'Manage Doctors',
      to: '/admin/doctors',
      icon: Stethoscope,
    },
    {
      label: 'Manage Staff',
      to: '/admin/staff',
      icon: Users,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user?.facilityId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
          <Building2 className="h-6 w-6 text-amber-600" />
        </div>
        <h2 className="mt-4 font-display text-lg font-bold text-slate-900">
          No hospital assigned
        </h2>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          Your account is not linked to a hospital yet. Ask the platform administrator to
          assign you to a facility, then reload this page.
        </p>
        <Link
          to="/settings"
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          Go to Settings
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h2 className="mt-4 font-display text-lg font-bold text-slate-900">
          Something went wrong
        </h2>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Facility Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            {t('common.welcomeBack', 'Welcome back')}, {user?.fullName}
            {facility?.name && (
              <>
                {' · '}
                <span className="font-medium text-slate-700">{facility.name}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <MetricCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            iconBg={card.iconBg}
            iconColor={card.iconColor}
          />
        ))}
      </div>

      {/* Department Overview */}
      <Card>
        <CardHeader
          title="Department Overview"
          subtitle="Departments across your facility"
          action={
            <Link
              to="/admin/departments"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Department Name</th>
                <th className="px-5 py-3 text-right">Consultation Fee</th>
                <th className="px-5 py-3">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {departments.map((dept) => (
                <tr key={dept._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{dept.name}</td>
                  <td className="px-5 py-3.5 text-right text-slate-600">
                    {dept.defaultConsultationFee != null
                      ? `RWF ${dept.defaultConsultationFee.toLocaleString()}`
                      : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Phone className="h-3 w-3" />
                      {dept.contactInfo?.phone || dept.contactInfo?.email || '—'}
                    </span>
                  </td>
                </tr>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-400">
                    No departments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader title="Recent Activity" subtitle="Latest actions in your facility" />
          <div className="space-y-3">
            {activities.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50"
              >
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700">{item.message}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>{item.timestamp}</span>
                    {item.actor && (
                      <>
                        <span>·</span>
                        <span>{item.actor}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Activity className="mb-2 h-8 w-8" />
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card padding={false}>
          <CardHeader title="Quick Actions" subtitle="Common administrative tasks" />
          <div className="space-y-3 p-5 pt-0">
            {quickLinks.map((link) => (
              <Link key={link.to} to={link.to}>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition-all hover:border-primary hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                      <link.icon className="h-5 w-5 text-blue-600" />
                    </span>
                    <span className="font-display font-semibold text-slate-900">{link.label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
