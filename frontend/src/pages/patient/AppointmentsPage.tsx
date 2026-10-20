import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Calendar, CalendarPlus, Filter, AlertCircle, Eye, XCircle, MapPin, Stethoscope,
} from 'lucide-react';
import { cancelAppointment, listAppointmentsPage, type Appointment } from '../../services/api';
import { StatusBadge } from '../../components/appointments/StatusBadge';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Pagination } from '../../components/ui/Pagination';

type Tab = 'all' | 'upcoming' | 'completed' | 'cancelled';

const PAGE_SIZE = 10;

/**
 * Each tab is a server-side filter rather than a client-side one. Filtering the current page in
 * the browser produced pages that looked empty while matching rows existed further back, and the
 * counts could not be made honest without loading everything.
 */
const TAB_FILTERS: Record<Tab, { status?: string; dateFrom?: string }> = {
  all: {},
  upcoming: {
    status: 'Pending,Confirmed,Checked In,In Progress',
    dateFrom: new Date().toISOString().slice(0, 10),
  },
  completed: { status: 'Completed' },
  cancelled: { status: 'Cancelled,Rejected,Missed' },
};

export function AppointmentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchData = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAppointmentsPage({
        page: targetPage,
        limit: PAGE_SIZE,
        ...TAB_FILTERS[tab],
      });
      setAppointments(result.items);
      setPages(result.pages);
      setPage(result.page);
      setTotal(result.total);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t, tab]);

  useEffect(() => {
    void fetchData(1);
  }, [fetchData]);

  const changeTab = (next: Tab) => {
    setTab(next);
    setPage(1);
  };

  const doctorName = (a: Appointment) =>
    typeof a.doctorId === 'object' ? (a.doctorId.userId?.fullName ?? '—') : '—';

  const departmentName = (a: Appointment) =>
    typeof a.departmentId === 'object' ? (a.departmentId.name ?? '—') : '—';

  const canCancel = (a: Appointment) => ['Pending', 'Confirmed'].includes(a.status);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelAppointment(cancelTarget._id, 'Cancelled by patient');
      setCancelTarget(null);
      await fetchData(page);
    } catch {
      setError(t('common.error'));
    } finally {
      setCancelling(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: t('appointments.all') },
    { id: 'upcoming', label: t('appointments.upcoming') },
    { id: 'completed', label: t('appointments.Completed') },
    { id: 'cancelled', label: t('appointments.Cancelled') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main dark:text-white md:text-3xl">{t('portal.appointments.title')}</h1>
          <p className="mt-1 text-base text-text-muted dark:text-slate-400">{t('portal.appointments.subtitle')}</p>
        </div>
        <Link to="/book">
          <Button icon={CalendarPlus}>{t('dashboard.quickBook')}</Button>
        </Link>
      </div>

      {error && (
        <Card className="flex items-center gap-3 border-status-cancelled-bg bg-status-cancelled-bg">
          <AlertCircle className="h-5 w-5 shrink-0 text-status-cancelled-text" />
          <p className="text-sm font-medium text-status-cancelled-text">{error}</p>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-text-muted" />
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => changeTab(tabItem.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              tab === tabItem.id
                ? 'bg-primary text-white shadow'
                : 'bg-card text-text-muted shadow hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-text-muted">{t('common.loading')}</div>
      ) : appointments.length === 0 ? (        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <Calendar className="mx-auto h-12 w-12 text-text-muted dark:text-slate-600" />
          <p className="mt-3 text-base text-text-muted dark:text-slate-400">{t('appointments.noAppointments')}</p>
          <Link to="/book" className="mt-4 inline-block">
            <Button>{t('dashboard.quickBook')}</Button>
          </Link>
        </div>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-text-muted dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3">{t('booking.date')}</th>
                  <th className="px-5 py-3">{t('booking.time')}</th>
                  <th className="px-5 py-3">{t('portal.appointments.department')}</th>
                  <th className="px-5 py-3">{t('booking.doctor')}</th>
                  <th className="px-5 py-3">{t('appointments.type')}</th>
                  <th className="px-5 py-3">{t('appointments.status')}</th>
                  <th className="px-5 py-3 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {appointments.map((a) => (
                  <tr key={a._id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-3.5 font-medium text-text-main dark:text-white">
                      {new Date(a.appointmentDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-text-muted dark:text-slate-400">{a.timeSlot}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-text-muted dark:text-slate-400">
                        <MapPin className="h-3.5 w-3.5" /> {departmentName(a)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-text-muted dark:text-slate-400">
                        <Stethoscope className="h-3.5 w-3.5" /> {doctorName(a)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 capitalize text-text-muted dark:text-slate-400">{a.visitType}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={a.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {canCancel(a) && (
                          <button
                            type="button"
                            onClick={() => setCancelTarget(a)}
                            className="rounded-xl p-1.5 text-text-muted transition-colors hover:bg-status-cancelled-bg hover:text-status-cancelled-text"
                            aria-label={t('appointments.cancel')}
                            title={t('appointments.cancel')}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/appointments/${a._id}`)}
                          className="rounded-xl p-1.5 text-text-muted transition-colors hover:bg-slate-100 hover:text-text-main dark:hover:bg-slate-800 dark:hover:text-white"
                          aria-label={t('portal.appointments.view')}
                          title={t('portal.appointments.view')}
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

      <ConfirmDialog
        open={cancelTarget !== null}
        onClose={() => !cancelling && setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={cancelling}
        title={t('portal.appointments.cancelTitle')}
        message={t('portal.appointments.cancelMessage')}
        confirmLabel={t('appointments.cancel')}
      />
    </div>
  );
}