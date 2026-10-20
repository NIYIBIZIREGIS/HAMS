import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { getErrorMessage } from '../../services/client';
import { MetricCard } from '../../components/ui/MetricCard';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import {
  Users,
  Activity,
  ClipboardList,
  CheckCircle2,
  HeartPulse,
  ArrowRight,
  FlaskConical,
} from 'lucide-react';

interface QueueAppointment {
  _id: string;
  timeSlot: string;
  reason?: string;
  visitType?: string;
  status: string;
  queueNumber?: number;
  patientId:
    | { _id: string; patientNumber?: string; userId?: { fullName?: string } }
    | string;
}

type Priority = 'urgent' | 'moderate' | 'routine';

const PRIORITY_BADGES: Record<Priority, { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'border-red-200 bg-red-50 text-red-700' },
  moderate: { label: 'Moderate', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  routine: { label: 'Routine', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
};

const PRIORITY_BORDERS: Record<Priority, string> = {
  urgent: 'border-l-red-500',
  moderate: 'border-l-amber-400',
  routine: 'border-l-emerald-400',
};

function getPriority(appt: QueueAppointment): Priority {
  const reason = (appt.reason ?? '').toLowerCase();
  const visitType = (appt.visitType ?? '').toLowerCase();
  if (reason.includes('urgent') || reason.includes('emergency') || visitType === 'emergency') {
    return 'urgent';
  }
  if (reason.includes('follow') || reason.includes('moderate') || visitType === 'follow_up') {
    return 'moderate';
  }
  return 'routine';
}

function getPatientName(appt: QueueAppointment): string {
  const pid = appt.patientId;
  if (typeof pid === 'object') {
    return pid.userId?.fullName ?? 'Patient';
  }
  return 'Patient';
}

export function NurseDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState<QueueAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    let cancelled = false;

    async function loadQueue() {
      try {
        setIsLoading(true);
        setError('');
        const res = await api.get<{ data: QueueAppointment[] }>('/appointments', {
          params: { date: todayStr },
        });
        if (!cancelled) setAppointments(res.data.data ?? []);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadQueue();
    return () => {
      cancelled = true;
    };
  }, [todayStr]);

  const patientsToday = appointments.length;
  const pendingVitals = appointments.filter((a) =>
    ['Confirmed', 'Checked In'].includes(a.status),
  ).length;
  const upcomingTasks = appointments.filter((a) => a.status === 'In Progress').length;
  const completedTasks = appointments.filter((a) => a.status === 'Completed').length;

  const queue = appointments.filter((a) =>
    ['Confirmed', 'Checked In', 'In Progress'].includes(a.status),
  );

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
          {t('nurse.subtitle', 'Nurse Dashboard')} ·{' '}
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
          icon={Users}
          label={t('nurse.patientsToday', 'Patients Today')}
          value={patientsToday}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <MetricCard
          icon={Activity}
          label={t('nurse.pendingVitals', 'Pending Vitals')}
          value={pendingVitals}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <MetricCard
          icon={ClipboardList}
          label={t('nurse.upcomingTasks', 'Upcoming Tasks')}
          value={upcomingTasks}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
        <MetricCard
          icon={CheckCircle2}
          label={t('nurse.completedToday', 'Completed Tasks')}
          value={completedTasks}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Patient Queue */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={t('nurse.patientQueue', 'Patient Queue')}
            subtitle={`${todayStr} · ${queue.length} ${t('nurse.patients', 'patients awaiting attention')}`}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/nurse/queue')}>
                View All
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <div className="space-y-3">
            {queue.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                  <Users className="h-6 w-6 text-slate-400" />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-900">
                  {t('nurse.noPatients', 'No patients in queue')}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t('nurse.noPatientsHint', 'All patients have been attended to.')}
                </p>
              </div>
            ) : (
              queue.map((appt) => {
                const priority = getPriority(appt);
                return (
                  <div
                    key={appt._id}
                    className={`flex items-center gap-4 rounded-xl border border-l-4 border-slate-200 ${PRIORITY_BORDERS[priority]} p-4 transition-colors hover:bg-slate-50`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                      <Users className="h-4 w-4 text-primary-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {getPatientName(appt)}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${PRIORITY_BADGES[priority].className}`}
                        >
                          {PRIORITY_BADGES[priority].label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {appt.timeSlot}
                        {appt.queueNumber != null && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600">
                            #{appt.queueNumber}
                          </span>
                        )}
                      </p>
                      {appt.reason && (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                          {appt.reason}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      icon={HeartPulse}
                      onClick={() => navigate('/nurse/vitals')}
                    >
                      {t('nurse.recordVitals', 'Record Vitals')}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader
            title={t('nurse.quickActions', 'Quick Actions')}
            subtitle={t('nurse.quickActionsHint', 'Common nurse tasks')}
          />
          <div className="space-y-3">
            <button
              onClick={() => navigate('/nurse/vitals')}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary-200 hover:bg-primary-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <HeartPulse className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {t('nurse.recordVitalsAction', 'Record Vitals')}
                </p>
                <p className="text-xs text-slate-500">
                  {t('nurse.recordVitalsHint', 'Capture patient vital signs')}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>

            <button
              onClick={() => navigate('/nurse/queue')}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary-200 hover:bg-primary-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                <ClipboardList className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {t('nurse.viewQueue', 'View Patient Queue')}
                </p>
                <p className="text-xs text-slate-500">
                  {t('nurse.viewQueueHint', 'See all patients needing attention')}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>

            <button
              onClick={() => navigate('/nurse/lab-results')}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary-200 hover:bg-primary-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50">
                <FlaskConical className="h-5 w-5 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {t('nurse.checkLabResults', 'Check Lab Results')}
                </p>
                <p className="text-xs text-slate-500">
                  {t('nurse.checkLabResultsHint', 'View pending and completed lab results')}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
