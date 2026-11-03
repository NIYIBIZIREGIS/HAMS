import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Calendar, CalendarClock, CheckCircle2, Clock, MapPin, Stethoscope, Video, XCircle, ArrowLeft, AlertCircle, User,
} from 'lucide-react';
import {
  cancelAppointment,
  getAppointment,
  respondToRescheduleProposal,
  type Appointment,
} from '../../services/api';
import { StatusBadge } from '../../components/appointments/StatusBadge';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../store/toastStore';

export function AppointmentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [proposalAction, setProposalAction] = useState<'accept' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) {
      setError(t('appointments.noAppointments'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setAppointment(await getAppointment(id));
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
  const meetingLink =
    appointment &&
    ['Confirmed', 'Checked In', 'In Progress', 'Completed'].includes(appointment.status) &&
    /^https?:\/\//i.test(appointment.meetingLink ?? '')
      ? appointment.meetingLink
      : null;

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

  const handleProposal = async (decision: 'accept' | 'reject', reason?: string) => {
    if (!appointment) return;
    setProposalAction(decision);
    try {
      await respondToRescheduleProposal(appointment._id, decision, reason);
      toast.success(
        decision === 'accept'
          ? t('portal.appointments.proposalAccepted')
          : t('portal.appointments.proposalRejected')
      );
      setRejectOpen(false);
      setRejectReason('');
      await fetchData();
    } catch {
      setError(t('common.error'));
    } finally {
      setProposalAction(null);
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

        {appointment.status === 'Reschedule Proposed' && appointment.proposedDate && (
          <div className="mt-5 rounded-xl border border-status-pending-bg bg-status-pending-bg p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-status-pending-text">
              <CalendarClock className="h-4 w-4" />
              {t('portal.appointments.proposalTitle')}
            </p>
            <p className="mt-2 text-sm text-status-pending-text">
              {t('portal.appointments.proposalMessage', {
                date: new Date(appointment.proposedDate).toLocaleDateString(),
                time: appointment.proposedTimeSlot,
              })}
            </p>
            {appointment.proposedNote && (
              <p className="mt-1 text-sm text-status-pending-text">{appointment.proposedNote}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                icon={CheckCircle2}
                loading={proposalAction === 'accept'}
                disabled={proposalAction !== null}
                onClick={() => void handleProposal('accept')}
              >
                {t('portal.appointments.acceptProposal')}
              </Button>
              <Button
                variant="danger"
                icon={XCircle}
                disabled={proposalAction !== null}
                onClick={() => setRejectOpen(true)}
              >
                {t('portal.appointments.rejectProposal')}
              </Button>
            </div>
          </div>
        )}

        {meetingLink && (
          <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                <Video className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-text-main dark:text-white">
                  {t('teleconsultation.title', 'Online consultation')}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted dark:text-slate-400">
                  {t(
                    'teleconsultation.patientHint',
                    'Your doctor will meet you online. Join using the link below.'
                  )}
                </p>
                <a
                  href={meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  <Video className="h-4 w-4" />
                  {t('teleconsultation.join', 'Join video consultation')}
                </a>
              </div>
            </div>
          </div>
        )}

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

        {(appointment.declineReason || appointment.cancellationReason) && (
          <div className="mt-6">
            <p className="text-sm font-semibold text-text-main dark:text-white">
              {appointment.declineReason ? t('appointments.declineReason') : t('appointments.cancellationReason')}
            </p>
            <p className="mt-1.5 rounded-xl border border-status-cancelled-bg bg-status-cancelled-bg p-4 text-sm leading-relaxed text-status-cancelled-text">
              {appointment.declineReason ?? appointment.cancellationReason}
            </p>
          </div>
        )}
      </Card>

      <Modal
        open={rejectOpen}
        onClose={() => !proposalAction && setRejectOpen(false)}
        title={t('portal.appointments.rejectProposalTitle')}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={proposalAction !== null}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={proposalAction === 'reject'}
              onClick={() => void handleProposal('reject', rejectReason.trim() || undefined)}
            >
              {t('portal.appointments.rejectProposal')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-text-muted dark:text-slate-400">
            {t('portal.appointments.rejectProposalMessage')}
          </p>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-text-main dark:text-white">
              {t('common.optional')}
            </span>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={3}
              maxLength={300}
              className="w-full resize-none rounded-xl border border-slate-200 bg-card px-3 py-2.5 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
        </div>
      </Modal>

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