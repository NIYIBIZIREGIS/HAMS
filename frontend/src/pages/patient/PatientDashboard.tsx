import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  CalendarPlus,
  Pill,
  FlaskConical,
  ChevronRight,
  FileText,
  ArrowRight,
  Stethoscope,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import {
  getErrorMessage,
  listAppointmentsPage,
  listPrescriptionsPage,
  listLabTestsPage,
  type Appointment,
  type Prescription,
  type LaboratoryTest,
} from '../../services/api';
import { Card, CardHeader } from '../../components/ui/Card';
import { MetricCard } from '../../components/ui/MetricCard';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/appointments/StatusBadge';

// The dashboard is a summary, not a record viewer, so it asks for a bounded window
// instead of downloading a patient's entire history on every dashboard load.
const DASHBOARD_LIMIT = 5;

export function PatientDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [labTests, setLabTests] = useState<LaboratoryTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appts, rxs, labs] = await Promise.all([
        listAppointmentsPage({ page: 1, limit: DASHBOARD_LIMIT }),
        listPrescriptionsPage({ page: 1, limit: DASHBOARD_LIMIT }),
        listLabTestsPage({ page: 1, limit: DASHBOARD_LIMIT }),
      ]);
      setAppointments(appts.items);
      setPrescriptions(rxs.items);
      setLabTests(labs.items);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const upcoming = appointments
    .filter((a) => ['Pending', 'Confirmed', 'Checked In'].includes(a.status))
    .sort(
      (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime(),
    )
    .slice(0, 6);

  const labResultsCount = labTests.filter((l) => l.result).length;

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const doctorName = (a: Appointment) =>
    typeof a.doctorId === 'object' ? (a.doctorId.userId?.fullName ?? '—') : '—';

  const departmentName = (a: Appointment) =>
    typeof a.departmentId === 'object' ? (a.departmentId.name ?? '—') : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-text-muted">{t('common.loading')}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main dark:text-white md:text-3xl">
            {t('dashboard.welcome')}, {user?.fullName}
          </h1>
          <p className="mt-1 text-base text-text-muted dark:text-slate-400">{todayLabel}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-slate-200 bg-card px-3 py-1 text-sm font-medium text-text-main dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:self-auto">
          <Calendar className="h-4 w-4" />
          {t('dashboard.upcomingAppointments')}
        </span>
      </div>

      {error && (
        <Card
          className="flex items-start gap-3 border-status-cancelled-bg bg-status-cancelled-bg"> 
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-cancelled-text" />
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-status-cancelled-text">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void fetchData()}>
              {t('common.retry', 'Retry')}
            </Button>
          </div>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={Calendar}
          label={t('dashboard.upcomingAppointments')}
          value={upcoming.length}
          iconBg="bg-primary text-white"
          iconColor="text-white"
          action={
            <Link to="/appointments" className="text-sm font-semibold text-primary hover:underline">
              {t('common.viewAll', 'View all')} →
            </Link>
          }
        />
        <MetricCard
          icon={Pill}
          label={t('medicalHistory.prescriptions')}
          value={prescriptions.length}
          iconBg="bg-primary text-white"
          iconColor="text-white"
          action={
            <Link to="/medical-history" className="text-sm font-semibold text-primary hover:underline">
              {t('common.viewAll', 'View all')} →
            </Link>
          }
        />
        <MetricCard
          icon={FlaskConical}
          label={t('medicalHistory.labTests')}
          value={labResultsCount}
          iconBg="bg-primary text-white"
          iconColor="text-white"
          action={
            <Link to="/medical-history" className="text-sm font-semibold text-primary hover:underline">
              {t('common.viewAll', 'View all')} →
            </Link>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming Appointments */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={t('dashboard.upcomingAppointments')}
            subtitle={t('dashboard.upcomingHint', 'Your next scheduled visits')}
            action={
              <Link to="/appointments" className="text-sm font-semibold text-primary transition-colors hover:text-primary-hover">
                {t('common.viewAll', 'View all')} →
              </Link>
            }
          />
          <div className="overflow-x-auto">
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center dark:border-slate-700">
                <Calendar className="mx-auto h-10 w-10 text-text-muted dark:text-slate-600" />
                <p className="mt-2 text-sm text-text-muted dark:text-slate-400">{t('appointments.noAppointments')}</p>
                <Link to="/book" className="mt-3 inline-block">
                  <Button icon={CalendarPlus}>{t('dashboard.quickBook')}</Button>
                </Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-text-muted dark:border-slate-800 dark:text-slate-400">
                    <th className="px-5 py-3">{t('booking.date')}</th>
                    <th className="px-5 py-3">{t('booking.doctor')}</th>
                    <th className="px-5 py-3">{t('booking.department', 'Department')}</th>
                    <th className="px-5 py-3">{t('appointments.type', 'Type')}</th>
                    <th className="px-5 py-3">{t('appointments.status')}</th>
                    <th className="px-5 py-3 text-right">{t('common.actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {upcoming.map((a) => (
                    <tr
                      key={a._id}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      onClick={() => navigate(`/appointments/${a._id}`)}
                    >
                      <td className="px-5 py-3.5 font-medium text-text-main dark:text-white">
                        {new Date(a.appointmentDate).toLocaleDateString()}
                        <span className="ml-1 block text-xs font-normal text-text-muted">{a.timeSlot}</span>
                      </td>
                      <td className="px-5 py-3.5 text-text-muted dark:text-slate-400">{doctorName(a)}</td>
                      <td className="px-5 py-3.5 text-text-muted dark:text-slate-400">{departmentName(a)}</td>
                      <td className="px-5 py-3.5 capitalize text-text-muted dark:text-slate-400">{a.visitType}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/appointments/${a._id}`}
                          className="inline-flex items-center justify-center rounded-xl p-1.5 text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:hover:bg-slate-800 dark:hover:text-white"
                          aria-label={t('common.view', 'View appointment')}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader title={t('dashboard.quickBook')} subtitle={t('dashboard.quickActionsSubtitle', 'Common tasks')} />
          <div className="space-y-2">
            <Link to="/book" className="block">
              <button className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-card p-4 text-left shadow transition-colors hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:hover:bg-slate-800">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-main dark:text-white">{t('dashboard.quickBook')}</p>
                  <p className="text-xs text-text-muted dark:text-slate-400">{t('booking.stepFacility')}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-text-muted" />
              </button>
            </Link>
            <Link to="/medical-history" className="block">
              <button className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-card p-4 text-left shadow transition-colors hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:hover:bg-slate-800">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-main dark:text-white">{t('medicalHistory.title')}</p>
                  <p className="text-xs text-text-muted dark:text-slate-400">{t('medicalHistory.prescriptions')}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-text-muted" />
              </button>
            </Link>
            <Link to="/appointments" className="block">
              <button className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-card p-4 text-left shadow transition-colors hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:hover:bg-slate-800">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-main dark:text-white">{t('portal.sidebar.appointments')}</p>
                  <p className="text-xs text-text-muted dark:text-slate-400">{t('portal.appointments.subtitle')}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-text-muted" />
              </button>
            </Link>
          </div>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-text-muted dark:text-slate-500">
              {t('dashboard.upcomingHint', 'Your next scheduled visits')}:{' '}
              <ChevronRight className="inline h-3 w-3" />
              {upcoming.length > 0
                ? new Date(upcoming[0].appointmentDate).toLocaleDateString()
                : t('appointments.noAppointments')}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}