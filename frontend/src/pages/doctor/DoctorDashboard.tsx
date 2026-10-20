import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CalendarDays,
  Clock,
  CheckCircle,
  Users,
  ArrowRight,
  Stethoscope,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api, { getErrorMessage, type Appointment } from '../../services/api';
import { Card, CardHeader } from '../../components/ui/Card';
import { MetricCard } from '../../components/ui/MetricCard';
import { Button } from '../../components/ui/Button';
import { PageSpinner } from '../../components/ui/Spinner';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STATUS_STYLES: Record<string, string> = {
  Confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Pending: 'border-amber-200 bg-amber-50 text-amber-700',
  Cancelled: 'border-red-200 bg-red-50 text-red-700',
  Rejected: 'border-red-200 bg-red-50 text-red-700',
  Missed: 'border-red-200 bg-red-50 text-red-700',
  'In Progress': 'border-blue-200 bg-blue-50 text-blue-700',
  'Checked In': 'border-blue-200 bg-blue-50 text-blue-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? 'border-slate-200 bg-slate-50 text-slate-700'
      }`}
    >
      {status}
    </span>
  );
}

export function DoctorDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data?: Appointment[] } | Appointment[]>('/appointments', {
        params: { date: new Date().toISOString().split('T')[0] },
      });
      setAppointments(Array.isArray(res.data) ? res.data : (res.data.data ?? []));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const todayAppts = [...appointments].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

  const pendingCount = todayAppts.filter((a) =>
    ['Pending', 'Confirmed', 'Checked In'].includes(a.status),
  ).length;
  const completedCount = todayAppts.filter((a) => a.status === 'Completed').length;

  const patientsThisWeek = new Set(
    todayAppts.map((a) => (typeof a.patientId === 'string' ? a.patientId : a.patientId._id)),
  ).size;

  const specialty =
    typeof todayAppts[0]?.doctorId === 'object'
      ? todayAppts[0].doctorId.specialization?.join(' · ')
      : undefined;

  const patientName = (a: Appointment) =>
    typeof a.patientId === 'object' ? (a.patientId.userId?.fullName ?? t('common.patient', 'Patient')) : t('common.patient', 'Patient');

  const canStart = (status: string) => status === 'Confirmed' || status === 'Checked In';

  const firstStartable = todayAppts.find((a) => canStart(a.status));

  const todayLabel = `${WEEKDAY_NAMES[new Date().getDay()]}, ${new Date().toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-page">
        <PageSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">
              {t('dashboard.welcome', 'Welcome back')}, {user?.fullName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {specialty ?? t('doctor.subtitle', 'Doctor Dashboard')} · {todayLabel}
            </p>
          </div>
          {firstStartable ? (
            <Link to={`/consultation/${firstStartable._id}`} className="shrink-0">
              <Button variant="primary" icon={Stethoscope}>
                {t('doctor.startConsultation', 'Start Consultation')}
              </Button>
            </Link>
          ) : (
            <Button variant="primary" icon={Stethoscope} disabled>
              {t('doctor.startConsultation', 'Start Consultation')}
            </Button>
          )}
        </div>

        {error && (
          <Card className="flex items-start gap-3 border-red-200 bg-red-50">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-red-800">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void fetchData()}>
                {t('common.retry', 'Retry')}
              </Button>
            </div>
          </Card>
        )}

        {/* Key Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Calendar}
            label={t("doctor.todayAppointments", "Today's Appointments")}
            value={todayAppts.length}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />
          <MetricCard
            icon={Clock}
            label={t('doctor.pendingConsultations', 'Pending Consultations')}
            value={pendingCount}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
          />
          <MetricCard
            icon={CheckCircle}
            label={t('doctor.completedToday', 'Completed Today')}
            value={completedCount}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />
          <MetricCard
            icon={Users}
            label={t('doctor.patientsThisWeek', 'Patients This Week')}
            value={patientsThisWeek}
            iconBg="bg-purple-50"
            iconColor="text-purple-600"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Today's Schedule */}
          <Card className="lg:col-span-2">
            <CardHeader
              title={t('doctor.todaySchedule', "Today's Schedule")}
              subtitle={todayStr}
              action={
                <Link
                  to="/availability"
                  className="text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  {t('doctor.viewFullSchedule', 'View full schedule')} →
                </Link>
              }
            />
            {todayAppts.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                  <Calendar className="h-6 w-6 text-slate-400" />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-900">
                  {t('doctor.noAppointmentsToday', 'No appointments today')}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t('doctor.noAppointmentsHint', 'Your schedule for today is clear.')}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {todayAppts.map((appt) => {
                  const isInProgress = appt.status === 'In Progress';
                  return (
                    <li
                      key={appt._id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 py-3.5 transition-colors hover:bg-slate-50/50 sm:flex-nowrap"
                    >
                      {/* Time */}
                      <div className="flex w-16 shrink-0 flex-col items-start">
                        <span
                          className={`text-sm font-semibold ${
                            isInProgress ? 'text-primary-600' : 'text-slate-900'
                          }`}
                        >
                          {appt.timeSlot}
                        </span>
                        {appt.queueNumber != null && (
                          <span className="text-xs text-slate-400">#{appt.queueNumber}</span>
                        )}
                      </div>

                      {/* Patient + type */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {patientName(appt)}
                        </p>
                        <p className="truncate text-xs text-slate-500">{appt.visitType}</p>
                      </div>

                      {/* Status */}
                      <StatusBadge status={appt.status} />

                      {/* Action */}
                      {(canStart(appt.status) || isInProgress) && (
                        <Link to={`/consultation/${appt._id}`} className="shrink-0">
                          <Button variant={isInProgress ? 'secondary' : 'primary'} size="sm">
                            {isInProgress ? t('doctor.resume', 'Resume') : t('doctor.start', 'Start')}
                          </Button>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader title={t('doctor.quickActions', 'Quick Actions')} />
            <div className="space-y-2">
              {firstStartable ? (
                <Link to={`/consultation/${firstStartable._id}`} className="block">
                  <button className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-primary-200 hover:bg-primary-50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                      <Stethoscope className="h-5 w-5 text-primary-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {t('doctor.startConsultation', 'Start Consultation')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t('doctor.startConsultationHint', 'Open next patient consultation')}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                </Link>
              ) : (
                <button disabled className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition-colors opacity-60">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                    <Stethoscope className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {t('doctor.startConsultation', 'Start Consultation')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t('doctor.noAppointmentsHint', 'Your schedule for today is clear.')}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              )}

              <Link to="/availability" className="block">
                <button className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-primary-200 hover:bg-primary-50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                    <CalendarDays className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {t('doctor.updateAvailability', 'Update Availability')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t('doctor.updateAvailabilityHint', 'Manage your weekly schedule')}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              </Link>
            </div>

            {pendingCount > 0 && (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {pendingCount}{' '}
                    {pendingCount === 1
                      ? t('doctor.pendingSingular', 'pending consultation')
                      : t('doctor.pendingPlural', 'pending consultations')}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-600">
                    {t('doctor.pendingSummaryHint', 'Patients are waiting to be seen.')}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
