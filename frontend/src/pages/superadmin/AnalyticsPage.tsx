import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import {
  CalendarCheck,
  DollarSign,
  Users,
  Clock,
  Download,
  TrendingUp,
  BarChart3,
  PieChart,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface AnalyticsData {
  totalAppointments: number;
  revenue: number;
  newPatients: number;
  avgWaitTime: number;
  appointmentsChange: number;
  revenueChange: number;
  patientsChange: number;
  waitTimeChange: number;
  facilityPerformance: {
    facilityId: string;
    name: string;
    appointments: number;
    revenue: number;
    satisfaction: number;
    utilization: number;
  }[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function ChangeIndicator({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  );
}

export function AnalyticsPage() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics', startDate, endDate],
    queryFn: async () => {
      const res = await api.get('/admin/analytics', { params: { startDate, endDate } });
      return res.data as AnalyticsData;
    },
  });

  const metrics = [
    {
      label: 'Total Appointments',
      value: data?.totalAppointments?.toLocaleString() ?? '—',
      change: data?.appointmentsChange ?? 0,
      icon: CalendarCheck,
      color: 'bg-slate-100 text-slate-700',
    },
    {
      label: 'Revenue',
      value: data ? formatCurrency(data.revenue) : '—',
      change: data?.revenueChange ?? 0,
      icon: DollarSign,
      color: 'bg-slate-100 text-slate-700',
    },
    {
      label: 'New Patients',
      value: data?.newPatients?.toLocaleString() ?? '—',
      change: data?.patientsChange ?? 0,
      icon: Users,
      color: 'bg-slate-100 text-slate-700',
    },
    {
      label: 'Avg Wait Time',
      value: data ? `${data.avgWaitTime} min` : '—',
      change: data?.waitTimeChange ?? 0,
      icon: Clock,
      color: 'bg-slate-100 text-slate-700',
    },
  ];

  const chartPlaceholders = [
    { title: 'Appointment Trends', icon: TrendingUp, description: 'Line chart showing appointment volume over time' },
    { title: 'Revenue by Facility', icon: BarChart3, description: 'Bar chart comparing revenue across facilities' },
    { title: 'Patient Demographics', icon: PieChart, description: 'Pie chart of patient age and gender distribution' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">Analytics & Reports</h1>
          <p className="text-sm text-slate-500">System-wide performance metrics and insights</p>
        </div>
        <Button variant="outline" icon={Download}>
          Export Report
        </Button>
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="From Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="To Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <Card key={metric.label}>
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${metric.color}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                    <ChangeIndicator value={metric.change} />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-bold text-slate-900">{metric.value}</p>
                    <p className="text-xs text-slate-500">{metric.label}</p>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader
              title="Facility Performance"
              subtitle="Comparison across all registered facilities"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Facility</th>
                    <th className="px-4 py-3 text-right">Appointments</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Satisfaction</th>
                    <th className="px-4 py-3 text-right">Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.facilityPerformance?.length ? (
                    data.facilityPerformance.map((fac) => (
                      <tr key={fac.facilityId} className="transition-colors hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                              <Building2 className="h-4 w-4" />
                            </span>
                            <span className="font-medium text-slate-900">{fac.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{fac.appointments.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(fac.revenue)}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{fac.satisfaction}%</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-primary-500"
                                style={{ width: `${fac.utilization}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-600">{fac.utilization}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        <Building2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                        No facility data available for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            {chartPlaceholders.map((chart) => {
              const Icon = chart.icon;
              return (
                <Card key={chart.title}>
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
                      <Icon className="h-7 w-7 text-primary-500" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-slate-900">{chart.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{chart.description}</p>
                    <span className="mt-3 inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      Chart Integration — Coming Soon
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
