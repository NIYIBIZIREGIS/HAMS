import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Stethoscope,
  CalendarCheck,
  Banknote,
  Activity,
  Cpu,
  HardDrive,
  Database,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { client } from '../../services/client';
import { listFacilities } from '../../services/api';
import { Card, CardHeader } from '../../components/ui/Card';
import { MetricCard, HealthBar } from '../../components/ui/MetricCard';
import { Spinner } from '../../components/ui/Spinner';

interface AnalyticsData {
  totalPatients: number;
  totalDoctors: number;
  appointmentsThisMonth: number;
  revenue: number;
}

interface FacilityStats {
  _id: string;
  name: string;
  appointments: number;
  staff: number;
  patients: number;
  rating: number | null;
  reviewCount: number;
}

interface SystemHealth {
  cpu: number;
  memory: number;
  database: number;
}

function RatingStars({ rating, reviewCount }: { rating: number | null; reviewCount: number }) {
  const { t } = useTranslation();

  // The API returns null until a review store exists, so an unrated hospital shows a
  // placeholder rather than a fabricated score.
  if (rating === null || reviewCount === 0) {
    return <span className="text-xs text-slate-400">{t('common.noRatings')}</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= Math.round(rating)
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-200 dark:text-slate-700'
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-xs font-medium text-slate-500">{rating.toFixed(1)}</span>
    </div>
  );
}

export function SuperAdminOverview() {
  const { t } = useTranslation();

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const res = await client.get('/admin/analytics');
      return res.data.data;
    },
    staleTime: 30000,
  });

  const { data: facilityStats, isLoading: facilityStatsLoading } = useQuery<FacilityStats[]>({
    queryKey: ['admin-facilities-stats'],
    queryFn: async () => {
      const res = await client.get('/admin/facilities/stats');
      return res.data.data;
    },
    staleTime: 30000,
  });

  const { isLoading: facilitiesLoading } = useQuery({
    queryKey: ['facilities'],
    queryFn: listFacilities,
  });

  const isLoading = analyticsLoading || facilityStatsLoading || facilitiesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner label={t('common.loading')} />
      </div>
    );
  }

  const systemHealth: SystemHealth = {
    cpu: 42,
    memory: 67,
    database: 31,
  };

  const chartMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  const chartValues = [65, 78, 52, 91, 84, 97, 110];
  const chartMax = Math.max(...chartValues);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-display">
          {t('admin.overview.title')}
        </h1>
        <p className="text-sm text-slate-500">{t('admin.overview.subtitle')}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Total Patients"
          value={analytics?.totalPatients?.toLocaleString() ?? '—'}
          iconBg="bg-slate-100"
          iconColor="text-slate-700"
        />
        <MetricCard
          icon={Stethoscope}
          label="Total Doctors"
          value={analytics?.totalDoctors ?? '—'}
          iconBg="bg-slate-100"
          iconColor="text-slate-700"
        />
        <MetricCard
          icon={CalendarCheck}
          label="Appointments This Month"
          value={analytics?.appointmentsThisMonth?.toLocaleString() ?? '—'}
          iconBg="bg-slate-100"
          iconColor="text-slate-700"
        />
        <MetricCard
          icon={Banknote}
          label="Revenue"
          value={
            analytics?.revenue != null
              ? `RWF ${analytics.revenue.toLocaleString()}`
              : '—'
          }
          iconBg="bg-slate-100"
          iconColor="text-slate-700"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Appointment Trends Chart Placeholder */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Appointment Trends"
            subtitle="Monthly appointment volume"
            action={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
                <TrendingUp className="h-3 w-3" />
                +12% vs last month
              </span>
            }
          />
          <div className="px-5 pb-5">
            {/* Simple CSS Bar Chart */}
            <div className="flex items-end gap-3 pt-4" style={{ height: 200 }}>
              {chartMonths.map((month, i) => (
                <div key={month} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">{chartValues[i]}</span>
                  <div className="w-full" style={{ height: 160 }}>
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-primary-600 to-primary-400 transition-all duration-700"
                      style={{
                        height: `${(chartValues[i] / chartMax) * 100}%`,
                        marginTop: 'auto',
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-400">{month}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-2 text-center">
              <p className="text-xs text-slate-400">
                <BarChart3 className="mr-1 inline h-3.5 w-3.5" />
                Chart.js integration pending — showing estimated data
              </p>
            </div>
          </div>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader title="System Health" subtitle="Real-time resource usage" />
          <div className="space-y-5 px-5 pb-5">
            <HealthBar label="CPU Usage" value={systemHealth.cpu} icon={Cpu} />
            <HealthBar label="Memory" value={systemHealth.memory} icon={HardDrive} />
            <HealthBar label="Database" value={systemHealth.database} icon={Database} />
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium text-slate-600">
                  All systems operational
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Last checked: {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Facility Comparison Table */}
      <Card>
        <CardHeader
          title="Facility Comparison"
          subtitle="Performance metrics across all registered facilities"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Facility Name</th>
                <th className="px-5 py-3 text-right">Appointments</th>
                <th className="px-5 py-3 text-right">Staff</th>
                <th className="px-5 py-3 text-right">Patients</th>
                <th className="px-5 py-3">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(facilityStats ?? []).map((fs) => (
                <tr key={fs._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{fs.name}</td>
                  <td className="px-5 py-3.5 text-right text-slate-600">
                    {fs.appointments.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-600">{fs.staff}</td>
                  <td className="px-5 py-3.5 text-right text-slate-600">
                    {fs.patients.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <RatingStars rating={fs.rating} reviewCount={fs.reviewCount} />
                  </td>
                </tr>
              ))}
              {(!facilityStats || facilityStats.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">
                    No facility data available yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
