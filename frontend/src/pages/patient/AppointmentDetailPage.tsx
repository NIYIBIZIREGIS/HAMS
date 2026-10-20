import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Calendar, Clock, MapPin, Stethoscope, XCircle, ArrowLeft, AlertCircle, User,
} from 'lucide-react';
import api, { cancelAppointment, type Appointment } from '../../services/api';
import { StatusBadge } from '../../components/appointments/StatusBadge';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export function AppointmentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data?: Appointment[] } | Appointment[]>('/appointments');
      const list = Array.isArray(res.data) ? res.data : (res.data.data ?? []);
      const found = list.find((a) => a._id === id) ?? null;
      if (!found) setError(t('appointments.noAppointments'));
      setAppointment(found);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const doctorName = appointment
    ? typeof appointment.doctorId === 'object'
      ? (appointment.doctorId.userId?.fullName ?? '—')
      : '—'
    : '—';

  const departmentName = appointment
    ? typeof appointment.departmentId === 'object'
      ? (appointment.departmentId.name ?? '—')
      : '—'
    : '—';

  const canCancel = appointment ? ['Pending', 'Confirmed'].includes(appointment.status) : false;

  const handleCancel = async () => {
    if (!appointment) return;
    setCancelling(true);
    try {
      await cancelAppointment(appointment._id, 'Cancelled by patient');
      setConfirmOpen(false);
      await fetchData();
    } catch {
      setError(t('common.error'));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-sm text-text-muted">{t('common.loading')}</div>;
  }

  if (error || !appointment) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
        <AlertCircle className="mx-auto h-10 w-10 text-text-muted dark:text-slate-600" />
        <p className="mt-3 text-base text-text-muted dark:text-slate-400">{error}</p>
        <Link to="/appointments" className="mt-4 inline-block">
          <Button variant="outline">{t('common.back')}</Button>
        </Link>
      </div>
    );
  }

  const rows = [
    { icon: Calendar, label: t('booking.date'), value: new Date(appointment.appointmentDate).toLocaleDateString() },
    { icon: Clock, label: t('booking.time'), value: appointment.timeSlot },
    { icon: User, label: t('booking.doctor'), value: doctorName },
    { icon: MapPin, label: t('portal.appointments.department'), value: departmentName },
    { icon: Stethoscope, label: t('appointments.type'), value: appointment.visitType },
    { icon: Calendar, label: t('appointments.status'), value: '' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/appointments')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted transition-colors hover:text-text-main dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> {t('common.back')}
        </button>
        {canCancel && (
          <Button variant="danger" icon={XCircle} onClick={() => setConfirmOpen(true)}>
            {t('appointments.cancel')}
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-text-main dark:text-white">{t('portal.appointments.detailTitle')}</h1>
            <p className="mt-1 text-base text-text-muted dark:text-slate-400">{new Date(appointment.appointmentDate).toLocaleDateString()}</p>
          </div>
          <StatusBadge status={appointment.status} />
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-text-muted">{label}</dt>
                <dd className="truncate text-sm font-semibold capitalize text-text-main dark:text-slate-200">{value || appointment.status}</dd>
              </div>
            </div>
          ))}
        </dl>

        {appointment.queueNumber && (
          <div className="mt-6 rounded-xl bg-primary p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-200">{t('appointments.queueNumber')}</p>
            <p className="mt-1 text-4xl font-extrabold">#{appointment.queueNumber}</p>
          </div>
        )}

        {appointment.reason && (
          <div className="mt-6">
            <p className="text-sm font-semibold text-text-main dark:text-white">{t('appointments.reason')}</p>
            <p className="mt-1.5 rounded-xl border border-slate-200 bg-surface p-4 text-sm leading-relaxed text-text-muted dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              {appointment.reason}
            </p>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleCancel}
        loading={cancelling}
        title={t('portal.appointments.cancelTitle')}
        message={t('portal.appointments.cancelMessage')}
        confirmLabel={t('appointments.cancel')}
      />
    </div>
  );
}