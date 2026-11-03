import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  Search,
  UserRound,
  XCircle,
} from 'lucide-react';
import {
  acceptAppointment,
  cancelAppointment,
  declineAppointment,
  listAppointmentsPage,
  proposeReschedule,
  rescheduleAppointment,
  type Appointment,
} from '../../services/api';
import { StatusBadge, formatDate } from '../../components/appointments/StatusBadge';
import { DeclineAppointmentModal } from '../../components/appointments/DeclineAppointmentModal';
import { ScheduleAppointmentModal } from '../../components/appointments/ScheduleAppointmentModal';
import { CancelAppointmentModal } from '../../components/appointments/CancelAppointmentModal';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { toast } from '../../store/toastStore';

type Tab = 'pending' | 'upcoming' | 'completed' | 'closed' | 'all';

const PAGE_SIZE = 10;
const today = () => new Date().toISOString().slice(0, 10);

const TAB_FILTERS: Record<Tab, { status?: string }> = {
  pending: { status: 'Pending' },
  upcoming: { status: 'Confirmed,Checked In,In Progress,Reschedule Proposed' },
  completed: { status: 'Completed' },
  closed: { status: 'Declined,Rejected,Cancelled,Missed' },
  all: {},
};

function patientName(appointment: Appointment): string {
  if (typeof appointment.patientId !== 'object') return appointment.patientId;
  return appointment.patientId.userId?.fullName ?? appointment.patientId.patientNumber ?? '—';
}

function patientNumber(appointment: Appointment): string {
  return typeof appointment.patientId === 'object' ? appointment.patientId.patientNumber : '—';
}

function departmentName(appointment: Appointment): string {
  return typeof appointment.departmentId === 'object' ? appointment.departmentId.name : '�?"';
}

function doctorIdOf(appointment: Appointment): string {
  return typeof appointment.doctorId === 'object' ? appointment.doctorId._id : appointment.doctorId;
}

function errorMessage(error: unknown, fallback: string): string {
  const value = error as { response?: { data?: { message?: string } } };
  return value.response?.data?.message ?? fallback;
}

export function DoctorAppointmentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<Appointment | null>(null);
  const [declining, setDeclining] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<{
    appointment: Appointment;
    mode: 'propose' | 'reschedule';
  } | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchData = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const filters: Record<string, unknown> = {
          page: targetPage,
          limit: PAGE_SIZE,
          sort: 'asc',
          ...TAB_FILTERS[tab],
        };
        if (search) filters.search = search;
        if (date) filters.date = date;
        else if (tab === 'upcoming') filters.dateFrom = today();

        const [result, pending] = await Promise.all([
          listAppointmentsPage(filters),
          listAppointmentsPage({ status: 'Pending', limit: 1 }),
        ]);
        setAppointments(result.items);
        setPages(result.pages);
        setPage(result.page);
        setTotal(result.total);
        setPendingCount(pending.total);
      } catch {
        setError(t('common.error'));
      } finally {
        setLoading(false);
      }
    },
    [date, search, t, tab]
  );

  useEffect(() => {
    void fetchData(1);
  }, [fetchData]);

  const changeTab = (next: Tab) => {
    setTab(next);
    setPage(1);
  };

  const handleAccept = async (appointment: Appointment) => {
    setActionId(appointment._id);
    try {
      await acceptAppointment(appointment._id);
      toast.success(t('doctorAppointments.accepted', { name: patientName(appointment) }));
      await fetchData(page);
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (reason: string) => {
    if (!declineTarget) return;
    setDeclining(true);
    try {
      await declineAppointment(declineTarget._id, reason);
      toast.success(t('doctorAppointments.declined', { name: patientName(declineTarget) }));
      setDeclineTarget(null);
      await fetchData(page);
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setDeclining(false);
    }
  };

  const handleSchedule = async (payload: {
    appointmentDate: string;
    timeSlot: string;
    note: string;
  }) => {
    if (!scheduleTarget) return;
    setScheduleSaving(true);
    try {
      if (scheduleTarget.mode === 'propose') {
        await proposeReschedule(scheduleTarget.appointment._id, {
          appointmentDate: payload.appointmentDate,
          timeSlot: payload.timeSlot,
          note: payload.note || undefined,
        });
        toast.success(t('doctorAppointments.proposed', { name: patientName(scheduleTarget.appointment) }));
      } else {
        await rescheduleAppointment(scheduleTarget.appointment._id, {
          appointmentDate: payload.appointmentDate,
          timeSlot: payload.timeSlot,
          reason: payload.note || undefined,
        });
        toast.success(t('doctorAppointments.rescheduled', { name: patientName(scheduleTarget.appointment) }));
      }
      setScheduleTarget(null);
      await fetchData(page);
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleDoctorCancel = async (reason: string) => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelAppointment(cancelTarget._id, reason);
      toast.success(t('doctorAppointments.cancelled', { name: patientName(cancelTarget) }));
      setCancelTarget(null);
      await fetchData(page);
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setCancelling(false);
    }
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'pending', label: t('doctorAppointments.pending'), count: pendingCount },
    { id: 'upcoming', label: t('doctorAppointments.upcoming') },
    { id: 'completed', label: t('doctorAppointments.completed') },
    { id: 'closed', label: t('doctorAppointments.closed') },
    { id: 'all', label: t('doctorAppointments.all') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-text-main dark:text-white md:text-3xl">
          {t('doctorAppointments.title')}
        </h1>
        <p className="mt-1 text-base text-text-muted dark:text-slate-400">
          {t('doctorAppointments.subtitle')}
        </p>
      </div>

      {error && (
        <Card className="flex items-center gap-3 border-status-cancelled-bg bg-status-cancelled-bg">
          <AlertCircle className="h-5 w-5 shrink-0 text-status-cancelled-text" />
          <p className="text-sm font-medium text-status-cancelled-text">{error}</p>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => changeTab(item.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              tab === item.id
                ? 'bg-primary text-white shadow'
                : 'bg-card text-text-muted shadow hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 && (
              <span
                className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  tab === item.id ? 'bg-white/20 text-white' : 'bg-status-pending-bg text-status-pending-text'
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('doctorAppointments.searchPlaceholder')}
            className="w-full rounded-xl border border-slate-200 bg-surface py-2.5 pl-9 pr-3 text-sm text-text-main outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-text-muted dark:text-slate-400">
          <Calendar className="h-4 w-4" />
          <span className="sr-only">{t('doctorAppointments.filterDate')}</span>
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-surface px-3 py-2 text-sm text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          {date && (
            <button
              type="button"
              onClick={() => {
                setDate('');
                setPage(1);
              }}
              className="rounded-lg p-1 text-text-muted hover:bg-slate-100 hover:text-text-main dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label={t('doctorAppointments.clearDate')}
              title={t('doctorAppointments.clearDate')}
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </label>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-text-muted">
          {t('common.loading')}
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <Calendar className="mx-auto h-12 w-12 text-text-muted dark:text-slate-600" />
          <p className="mt-3 text-base text-text-muted dark:text-slate-400">
            {t('doctorAppointments.empty')}
          </p>
        </div>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-text-muted dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3">{t('doctorAppointments.patient')}</th>
                  <th className="px-5 py-3">{t('booking.date')}</th>
                  <th className="px-5 py-3">{t('booking.time')}</th>
                  <th className="px-5 py-3">{t('doctorAppointments.department')}</th>
                  <th className="px-5 py-3">{t('doctorAppointments.type')}</th>
                  <th className="px-5 py-3">{t('doctorAppointments.reason')}</th>
                  <th className="px-5 py-3">{t('appointments.status')}</th>
                  <th className="px-5 py-3 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {appointments.map((appointment) => (
                  <tr
                    key={appointment._id}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 font-semibold text-text-main dark:text-white">
                        <UserRound className="h-4 w-4 text-text-muted" />
                        {patientName(appointment)}
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {patientNumber(appointment)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-text-main dark:text-white">
                      {formatDate(appointment.appointmentDate)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-text-muted dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {appointment.timeSlot}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-text-muted dark:text-slate-400">
                      {departmentName(appointment)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 capitalize text-text-muted dark:text-slate-400">
                      {appointment.visitType}
                    </td>
                    <td className="max-w-56 px-5 py-3.5 text-text-muted dark:text-slate-400">
                      <span className="line-clamp-2">{appointment.reason || '—'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={appointment.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {appointment.status === 'Pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setScheduleTarget({ appointment, mode: 'propose' })}
                              disabled={actionId === appointment._id}
                              className="rounded-xl p-1.5 text-primary transition-colors hover:bg-primary-50 disabled:opacity-50 dark:hover:bg-slate-800"
                              aria-label={t('doctorAppointments.propose')}
                              title={t('doctorAppointments.propose')}
                            >
                              <CalendarClock className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAccept(appointment)}
                              disabled={actionId === appointment._id}
                              className="rounded-xl p-1.5 text-status-confirmed-text transition-colors hover:bg-status-confirmed-bg disabled:opacity-50"
                              aria-label={t('doctorAppointments.accept')}
                              title={t('doctorAppointments.accept')}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeclineTarget(appointment)}
                              disabled={actionId === appointment._id}
                              className="rounded-xl p-1.5 text-status-cancelled-text transition-colors hover:bg-status-cancelled-bg disabled:opacity-50"
                              aria-label={t('doctorAppointments.decline')}
                              title={t('doctorAppointments.decline')}
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {appointment.status === 'Confirmed' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setScheduleTarget({ appointment, mode: 'reschedule' })}
                              className="rounded-xl p-1.5 text-primary transition-colors hover:bg-primary-50 dark:hover:bg-slate-800"
                              aria-label={t('doctorAppointments.reschedule')}
                              title={t('doctorAppointments.reschedule')}
                            >
                              <CalendarClock className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCancelTarget(appointment)}
                              className="rounded-xl p-1.5 text-status-cancelled-text transition-colors hover:bg-status-cancelled-bg"
                              aria-label={t('doctorAppointments.cancelAppointment')}
                              title={t('doctorAppointments.cancelAppointment')}
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/doctor/appointments/${appointment._id}`)}
                          className="rounded-xl p-1.5 text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:hover:bg-slate-800 dark:hover:text-white"
                          aria-label={t('doctorAppointments.view')}
                          title={t('doctorAppointments.view')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Pagination
        page={page}
        pages={pages}
        total={total}
        itemLabel="pagination.appointments"
        disabled={loading}
        onChange={(next) => fetchData(next)}
      />

      <DeclineAppointmentModal
        open={declineTarget !== null}
        onClose={() => !declining && setDeclineTarget(null)}
        onConfirm={(reason) => void handleDecline(reason)}
        loading={declining}
        patientName={declineTarget ? patientName(declineTarget) : undefined}
      />

      {scheduleTarget && (
        <ScheduleAppointmentModal
          open
          mode={scheduleTarget.mode}
          doctorId={doctorIdOf(scheduleTarget.appointment)}
          initialDate={scheduleTarget.appointment.appointmentDate}
          onClose={() => !scheduleSaving && setScheduleTarget(null)}
          onConfirm={(payload) => void handleSchedule(payload)}
          loading={scheduleSaving}
        />
      )}

      <CancelAppointmentModal
        open={cancelTarget !== null}
        onClose={() => !cancelling && setCancelTarget(null)}
        onConfirm={(reason) => void handleDoctorCancel(reason)}
        loading={cancelling}
        patientName={cancelTarget ? patientName(cancelTarget) : undefined}
      />
    </div>
  );
}
