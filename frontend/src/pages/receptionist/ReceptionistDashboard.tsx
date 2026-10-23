import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { getErrorMessage } from '../../services/client';
import { MetricCard } from '../../components/ui/MetricCard';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import {
  ClipboardCheck,
  Users,
  UserPlus,
  CalendarDays,
  CheckCircle2,
  ArrowRight,
  CalendarPlus,
} from 'lucide-react';

interface ReceptionistAppointment {
  _id: string;
  appointmentDate: string;
  timeSlot: string;
  reason?: string;
  visitType?: string;
  status: string;
  bookingChannel?: string;
  patientId:
    | { _id: string; patientNumber?: string; userId?: { fullName?: string } }
    | string;
  doctorId:
    | { _id: string; specialization?: string[]; userId?: { fullName?: string } }
    | string;
}

function getPatientName(appt: ReceptionistAppointment): string {
  const pid = appt.patientId;
  if (typeof pid === 'object') {
    return pid.userId?.fullName ?? 'Patient';
  }
  return 'Patient';
}

function getDoctorName(appt: ReceptionistAppointment): string {
  const did = appt.doctorId;
  if (typeof did === 'object') {
    return did.userId?.fullName ?? 'Doctor';
  }
  return 'Doctor';
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending: 'border-amber-200 bg-amber-50 text-amber-700',
    Confirmed: 'border-blue-200 bg-blue-50 text-blue-700',
    'Checked In': 'border-emerald-200 bg-emerald-50 text-emerald-700',
    'In Progress': 'border-purple-200 bg-purple-50 text-purple-700',
    Completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Cancelled: 'border-red-200 bg-red-50 text-red-700',
    'No Show': 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        styles[status] ?? 'border-slate-200 bg-slate-50 text-slate-600'
      }`}
    >
      {status}
    </span>
  );
}

function VisitTypeBadge({ visitType }: { visitType?: string }) {
  const value = (visitType ?? '').toLowerCase();
  const className =
    value === 'emergency'
      ? 'border-red-200 bg-red-50 text-red-700'
      : value === 'walk_in'
        ? 'border-purple-200 bg-purple-50 text-purple-700'
        : value === 'follow_up'
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${className}`}
    >
      {(visitType ?? 'Visit').replace('_', ' ')}
    </span>
  );
}

export function ReceptionistDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [appointments, setAppointments] = useState<ReceptionistAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadAppointments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await api.get<{ data: ReceptionistAppointment[] }>('/appointments', {
        params: { date: todayStr },
      });
      setAppointments(res.data.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const checkedIns = appointments.filter((a) =>
    ['Checked In', 'In Progress'].includes(a.status),
  ).length;
  const pendingArrivals = appointments.filter((a) => a.status === 'Confirmed').length;
  const walkIns = appointments.filter(
    (a) =>
      a.visitType === 'walk_in' ||
      (a as ReceptionistAppointment & { bookingChannel?: string }).bookingChannel ===
        'walk_in',
  ).length;
  const totalAppointments = appointments.length;

  async function handleCheckIn(id: string) {
    setCheckingInId(id);
    setError('');
    try {
      await api.post(`/appointments/${id}/check-in`);
      await loadAppointments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCheckingInId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" label={t('common.loading')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-display">
          {t('dashboard.welcome', 'Welcome back')}, {user?.fullName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t('receptionist.subtitle', 'Front Desk')} ·{' '}
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={ClipboardCheck}
          label={t('receptionist.todayCheckins', "Today's Check-ins")}
          value={checkedIns}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <MetricCard
          icon={Users}
          label={t('receptionist.pendingArrivals', 'Pending Arrivals')}
          value={pendingArrivals}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <MetricCard
          icon={UserPlus}
          label={t('receptionist.walkInsToday', 'Walk-ins Today')}
          value={walkIns}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <MetricCard
          icon={CalendarDays}
          label={t('receptionist.totalAppointments', 'Total Appointments')}
          value={totalAppointments}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's Appointments */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={t('receptionist.todayAppointments', "Today's Appointments")}
            subtitle={`${todayStr} · ${totalAppointments} ${t('receptionist.appointments', 'appointments')}`}
          />
          {appointments.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <CalendarDays className="h-6 w-6 text-slate-400" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-900">
                {t('receptionist.noAppointments', 'No appointments today')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t('receptionist.noAppointmentsHint', 'The schedule is clear for today.')}
              </p>
            </div>
          ) : (
            <div className="-mx-4 overflow-x-auto pb-1 sm:-mx-5">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">{t('receptionist.time', 'Time')}</th>
                    <th className="px-5 py-3">{t('receptionist.patientName', 'Patient')}</th>
                    <th className="px-5 py-3">{t('receptionist.doctor', 'Doctor')}</th>
                    <th className="px-5 py-3">{t('receptionist.type', 'Type')}</th>
                    <th className="px-5 py-3">{t('receptionist.status', 'Status')}</th>
                    <th className="px-5 py-3 text-right">
                      {t('receptionist.actions', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {appointments.map((appt) => (
                    <tr key={appt._id} className="transition-colors hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-900">
                        {appt.timeSlot}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">{getPatientName(appt)}</td>
                      <td className="px-5 py-3.5 text-slate-700">{getDoctorName(appt)}</td>
                      <td className="px-5 py-3.5">
                        <VisitTypeBadge visitType={appt.visitType} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={appt.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end">
                          {appt.status === 'Confirmed' ? (
                            <Button
                              size="sm"
                              icon={ClipboardCheck}
                              loading={checkingInId === appt._id}
                              onClick={() => handleCheckIn(appt._id)}
                            >
                              {t('receptionist.checkIn', 'Check-in')}
                            </Button>
                          ) : (
                            ['Checked In', 'In Progress'].includes(appt.status) && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {t('receptionist.checkedIn', 'Checked In')}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader
            title={t('receptionist.quickActions', 'Quick Actions')}
            subtitle={t('receptionist.quickActionsHint', 'Front desk shortcuts')}
          />
          <div className="space-y-3">
            <button
              onClick={() => document.getElementById('checkin-search')?.focus()}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary-200 hover:bg-primary-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {t('receptionist.checkinPatient', 'Check-in Patient')}
                </p>
                <p className="text-xs text-slate-500">
                  {t('receptionist.checkinPatientHint', 'Register patient arrival')}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>

            <Link to="/booking" className="block">
              <div className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary-200 hover:bg-primary-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                  <CalendarPlus className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {t('receptionist.scheduleAppointment', 'Schedule Appointment')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t('receptionist.scheduleAppointmentHint', 'Book a new appointment')}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              </div>
            </Link>

            <Link to="/receptionist/walk-in" className="block">
              <div className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary-200 hover:bg-primary-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50">
                  <UserPlus className="h-5 w-5 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {t('receptionist.walkinRegistration', 'Walk-in Registration')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t('receptionist.walkinRegistrationHint', 'Register a walk-in patient')}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
