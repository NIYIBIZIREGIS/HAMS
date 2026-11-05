import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  PlayCircle,
  Stethoscope,
  UserPlus,
  UserRound,
  UserX,
  Video,
  XCircle,
} from 'lucide-react';
import {
  acceptAppointment,
  bookFollowUp,
  cancelAppointment,
  completeConsultation,
  declineAppointment,
  getAppointment,
  markNoShow,
  proposeReschedule,
  referPatient,
  rescheduleAppointment,
  sendMessage,
  startConsultation,
  updateAppointmentMeetingLink,
  type Appointment,
} from '../../services/api';
import { StatusBadge, formatDate } from '../../components/appointments/StatusBadge';
import { DeclineAppointmentModal } from '../../components/appointments/DeclineAppointmentModal';
import { ScheduleAppointmentModal } from '../../components/appointments/ScheduleAppointmentModal';
import { CancelAppointmentModal } from '../../components/appointments/CancelAppointmentModal';
import { DoctorPatientSummary } from '../../components/appointments/DoctorPatientSummary';
import { FollowUpModal, type FollowUpPayload } from '../../components/appointments/FollowUpModal';
import { ReferralModal, type ReferralPayload } from '../../components/appointments/ReferralModal';
import { AskPatientModal } from '../../components/appointments/AskPatientModal';
import { MeetingLinkModal } from '../../components/appointments/MeetingLinkModal';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { toast } from '../../store/toastStore';

function errorMessage(error: unknown, fallback: string): string {
  const value = error as { response?: { data?: { message?: string } } };
  return value.response?.data?.message ?? fallback;
}

export function DoctorAppointmentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'propose' | 'reschedule' | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [referralSaving, setReferralSaving] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askSending, setAskSending] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingSaving, setMeetingSaving] = useState(false);

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

  const patient = appointment && typeof appointment.patientId === 'object' ? appointment.patientId : null;
  const patientName = patient?.userId?.fullName ?? patient?.patientNumber ?? '—';

  const handleAccept = async () => {
    if (!appointment) return;
    setAccepting(true);
    try {
      await acceptAppointment(appointment._id);
      toast.success(t('doctorAppointments.accepted', { name: patientName }));
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async (reason: string) => {
    if (!appointment) return;
    setDeclining(true);
    try {
      await declineAppointment(appointment._id, reason);
      toast.success(t('doctorAppointments.declined', { name: patientName }));
      setDeclineOpen(false);
      await fetchData();
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
    if (!appointment || !scheduleMode) return;
    setScheduleSaving(true);
    try {
      if (scheduleMode === 'propose') {
        await proposeReschedule(appointment._id, {
          appointmentDate: payload.appointmentDate,
          timeSlot: payload.timeSlot,
          note: payload.note || undefined,
        });
        toast.success(t('doctorAppointments.proposed', { name: patientName }));
      } else {
        await rescheduleAppointment(appointment._id, {
          appointmentDate: payload.appointmentDate,
          timeSlot: payload.timeSlot,
          reason: payload.note || undefined,
        });
        toast.success(t('doctorAppointments.rescheduled', { name: patientName }));
      }
      setScheduleMode(null);
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleDoctorCancel = async (reason: string) => {
    if (!appointment) return;
    setCancelling(true);
    try {
      await cancelAppointment(appointment._id, reason);
      toast.success(t('doctorAppointments.cancelled', { name: patientName }));
      setCancelOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setCancelling(false);
    }
  };

  const handleStart = async () => {
    if (!appointment) return;
    setActionLoading('start');
    try {
      await startConsultation(appointment._id);
      toast.success(t('doctorAppointments.started', { name: patientName }));
      navigate(`/consultation/${appointment._id}`);
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
      setActionLoading(null);
    }
  };

  const handleComplete = async () => {
    if (!appointment) return;
    setActionLoading('complete');
    try {
      await completeConsultation(appointment._id);
      toast.success(t('doctorAppointments.completed', { name: patientName }));
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setActionLoading(null);
    }
  };

  const handleNoShow = async () => {
    if (!appointment) return;
    setActionLoading('no-show');
    try {
      await markNoShow(appointment._id);
      toast.success(t('doctorAppointments.noShowMarked', { name: patientName }));
      setNoShowOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setActionLoading(null);
    }
  };

  const handleFollowUp = async (payload: FollowUpPayload) => {
    if (!appointment) return;
    setFollowUpSaving(true);
    try {
      await bookFollowUp(appointment._id, payload);
      toast.success(t('followUp.booked', { name: patientName }));
      setFollowUpOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setFollowUpSaving(false);
    }
  };

  const handleReferral = async (payload: ReferralPayload) => {
    if (!appointment) return;
    setReferralSaving(true);
    try {
      const result = await referPatient(appointment._id, payload);
      toast.success(
        result.appointment
          ? t('referral.sentWithAppointment', { name: patientName })
          : t('referral.sent', { name: patientName }),
      );
      setReferralOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setReferralSaving(false);
    }
  };

  const handleAskPatient = async (subject: string, body: string) => {
    if (!patient) return;
    setAskSending(true);
    try {
      await sendMessage({ patientId: patient._id, subject, body });
      toast.success(t('askPatient.sent', 'Message sent to {{name}}.', { name: patientName }));
      setAskOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setAskSending(false);
    }
  };

  const handleMeetingLink = async (meetingLink: string | null) => {
    if (!appointment) return;
    setMeetingSaving(true);
    try {
      await updateAppointmentMeetingLink(appointment._id, meetingLink);
      toast.success(
        meetingLink
          ? t('teleconsultation.saved', 'Meeting link saved.')
          : t('teleconsultation.removed', 'Meeting link removed.')
      );
      setMeetingOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(errorMessage(err, t('common.error')));
    } finally {
      setMeetingSaving(false);
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
        <Link to="/doctor/appointments" className="mt-4 inline-block">
          <Button variant="outline">{t('common.back')}</Button>
        </Link>
      </div>
    );
  }

  const isPending = appointment.status === 'Pending';
  const isConfirmed = appointment.status === 'Confirmed';
  const isCheckedIn = appointment.status === 'Checked In';
  const isInProgress = appointment.status === 'In Progress';
  const isCompleted = appointment.status === 'Completed';
  const isProposalPending = appointment.status === 'Reschedule Proposed';
  const canManageMeetingLink = [
    'Pending',
    'Confirmed',
    'Checked In',
    'In Progress',
    'Reschedule Proposed',
  ].includes(appointment.status);
  const isToday =
    appointment.appointmentDate.slice(0, 10) === new Date().toISOString().slice(0, 10);
  const canStartConsultation = isConfirmed || isCheckedIn;
  const canMarkNoShow = canStartConsultation && isToday;
  const doctorId =
    typeof appointment.doctorId === 'object' ? appointment.doctorId._id : appointment.doctorId;
  const department =
    typeof appointment.departmentId === 'object' ? appointment.departmentId.name : '—';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/doctor/appointments')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted transition-colors hover:text-text-main dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> {t('common.back')}
        </button>

        {(isPending || isConfirmed || isCheckedIn || isInProgress || isCompleted) && (
          <div className="flex flex-wrap items-center gap-2">
            {isPending && (
              <>
                <Button
                  variant="outline"
                  icon={CalendarClock}
                  onClick={() => setScheduleMode('propose')}
                  disabled={accepting}
                >
                  {t('doctorAppointments.propose')}
                </Button>
                <Button
                  variant="danger"
                  icon={XCircle}
                  onClick={() => setDeclineOpen(true)}
                  disabled={accepting}
                >
                  {t('doctorAppointments.decline')}
                </Button>
                <Button icon={CheckCircle2} loading={accepting} onClick={() => void handleAccept()}>
                  {t('doctorAppointments.accept')}
                </Button>
              </>
            )}

            {(isConfirmed || isCheckedIn) && (
              <>
                {canStartConsultation && (
                  <Button
                    icon={PlayCircle}
                    loading={actionLoading === 'start'}
                    onClick={() => void handleStart()}
                    disabled={Boolean(actionLoading)}
                  >
                    {t('doctorAppointments.startConsultation', 'Start consultation')}
                  </Button>
                )}
                {canMarkNoShow && (
                  <Button
                    variant="danger"
                    icon={UserX}
                    onClick={() => setNoShowOpen(true)}
                    disabled={Boolean(actionLoading)}
                  >
                    {t('doctorAppointments.markNoShow', 'Mark no-show')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  icon={CalendarClock}
                  onClick={() => setScheduleMode('reschedule')}
                  disabled={Boolean(actionLoading)}
                >
                  {t('doctorAppointments.reschedule')}
                </Button>
                <Button
                  variant="danger"
                  icon={XCircle}
                  onClick={() => setCancelOpen(true)}
                  disabled={Boolean(actionLoading)}
                >
                  {t('doctorAppointments.cancelAppointment')}
                </Button>
              </>
            )}

            {isInProgress && (
              <>
                <Button
                  icon={Stethoscope}
                  onClick={() => navigate(`/consultation/${appointment._id}`)}
                  disabled={Boolean(actionLoading)}
                >
                  {t('doctorAppointments.continueConsultation', 'Continue consultation')}
                </Button>
                <Button
                  icon={CheckCircle2}
                  loading={actionLoading === 'complete'}
                  onClick={() => void handleComplete()}
                  disabled={Boolean(actionLoading)}
                >
                  {t('doctorAppointments.completeConsultation', 'Complete consultation')}
                </Button>
                <Button
                  variant="outline"
                  icon={CalendarPlus}
                  onClick={() => setFollowUpOpen(true)}
                  disabled={Boolean(actionLoading)}
                >
                  {t('doctorAppointments.bookFollowUp', 'Book follow-up')}
                </Button>
                <Button
                  variant="outline"
                  icon={UserPlus}
                  onClick={() => setReferralOpen(true)}
                  disabled={Boolean(actionLoading)}
                >
                  {t('doctorAppointments.referPatient', 'Refer patient')}
                </Button>
              </>
            )}

            {isCompleted && (
              <>
                <Button
                  variant="outline"
                  icon={CalendarPlus}
                  onClick={() => setFollowUpOpen(true)}
                  disabled={Boolean(actionLoading)}
                >
                  {t('doctorAppointments.bookFollowUp', 'Book follow-up')}
                </Button>
                <Button
                  variant="outline"
                  icon={UserPlus}
                  onClick={() => setReferralOpen(true)}
                  disabled={Boolean(actionLoading)}
                >
                  {t('doctorAppointments.referPatient', 'Refer patient')}
                </Button>
              </>
            )}

            {patient && (
              <Button
                variant="outline"
                icon={MessageSquare}
                onClick={() => setAskOpen(true)}
                disabled={Boolean(actionLoading)}
              >
                {t('doctorAppointments.askPatient', 'Ask patient')}
              </Button>
            )}
          </div>
        )}
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-text-main dark:text-white">
              {t('doctorAppointments.detailTitle')}
            </h1>
            <p className="mt-1 text-base text-text-muted dark:text-slate-400">
              {formatDate(appointment.appointmentDate)} · {appointment.timeSlot}
            </p>
          </div>
          <StatusBadge status={appointment.status} />
        </div>

        {isPending && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-status-pending-bg bg-status-pending-bg p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-status-pending-text" />
            <p className="text-sm font-medium leading-relaxed text-status-pending-text">
              {t('doctorAppointments.pendingHint')}
            </p>
          </div>
        )}

        {isProposalPending && appointment.proposedDate && (
          <div className="mt-5 rounded-xl border border-status-pending-bg bg-status-pending-bg p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-status-pending-text">
              <CalendarClock className="h-4 w-4" />
              {t('doctorAppointments.proposalPending')}
            </p>
            <p className="mt-2 text-sm text-status-pending-text">
              {formatDate(appointment.proposedDate)} · {appointment.proposedTimeSlot}
            </p>
            {appointment.proposedNote && (
              <p className="mt-1 text-sm text-status-pending-text">{appointment.proposedNote}</p>
            )}
          </div>
        )}

        {(canManageMeetingLink || appointment.meetingLink) && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                <Video className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-main dark:text-white">
                  {t('teleconsultation.title', 'Online consultation')}
                </p>
                {appointment.meetingLink ? (
                  <a
                    href={appointment.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block break-all text-sm font-semibold text-primary hover:underline"
                  >
                    {t('teleconsultation.join', 'Join video consultation')}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-text-muted dark:text-slate-400">
                    {t('teleconsultation.noLink', 'No meeting link has been added yet.')}
                  </p>
                )}
              </div>
            </div>
            {canManageMeetingLink && (
              <Button
                variant="outline"
                icon={Video}
                onClick={() => setMeetingOpen(true)}
                disabled={Boolean(actionLoading)}
              >
                {appointment.meetingLink
                  ? t('teleconsultation.editLink', 'Edit meeting link')
                  : t('teleconsultation.setLink', 'Set meeting link')}
              </Button>
            )}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-muted">{t('doctorAppointments.patient')}</p>
              <p className="truncate text-sm font-semibold text-text-main dark:text-slate-200">
                {patientName}
              </p>
              <p className="text-xs text-text-muted">{patient?.patientNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              <Calendar className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-muted">{t('booking.date')}</p>
              <p className="truncate text-sm font-semibold text-text-main dark:text-slate-200">
                {formatDate(appointment.appointmentDate)}
              </p>
              <p className="text-xs text-text-muted">{appointment.timeSlot}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              <MapPin className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-muted">
                {t('doctorAppointments.department')}
              </p>
              <p className="truncate text-sm font-semibold text-text-main dark:text-slate-200">
                {department}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              <Stethoscope className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-muted">{t('appointments.type')}</p>
              <p className="truncate text-sm font-semibold capitalize text-text-main dark:text-slate-200">
                {appointment.visitType}
              </p>
            </div>
          </div>

          {patient?.userId?.phone && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-surface p-4 dark:border-slate-800 dark:bg-slate-950">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                <Phone className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-muted">{t('booking.phone')}</p>
                <p className="truncate text-sm font-semibold text-text-main dark:text-slate-200">
                  {patient.userId.phone}
                </p>
              </div>
            </div>
          )}
        </div>

        {appointment.reason && (
          <div className="mt-6">
            <p className="text-sm font-semibold text-text-main dark:text-white">
              {t('appointments.reason')}
            </p>
            <p className="mt-1.5 rounded-xl border border-slate-200 bg-surface p-4 text-sm leading-relaxed text-text-muted dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              {appointment.reason}
            </p>
          </div>
        )}

        {appointment.declineReason && (
          <div className="mt-6">
            <p className="text-sm font-semibold text-text-main dark:text-white">
              {t('appointments.declineReason')}
            </p>
            <p className="mt-1.5 rounded-xl border border-status-cancelled-bg bg-status-cancelled-bg p-4 text-sm leading-relaxed text-status-cancelled-text">
              {appointment.declineReason}
            </p>
          </div>
        )}
      </Card>

      <DoctorPatientSummary appointmentId={appointment._id} />

      <DeclineAppointmentModal
        open={declineOpen}
        onClose={() => !declining && setDeclineOpen(false)}
        onConfirm={(reason) => void handleDecline(reason)}
        loading={declining}
        patientName={patientName}
      />

      {scheduleMode && (
        <ScheduleAppointmentModal
          open
          mode={scheduleMode}
          doctorId={doctorId}
          initialDate={appointment.appointmentDate}
          onClose={() => !scheduleSaving && setScheduleMode(null)}
          onConfirm={(payload) => void handleSchedule(payload)}
          loading={scheduleSaving}
        />
      )}

      <CancelAppointmentModal
        open={cancelOpen}
        onClose={() => !cancelling && setCancelOpen(false)}
        onConfirm={(reason) => void handleDoctorCancel(reason)}
        loading={cancelling}
        patientName={patientName}
      />

      <ConfirmDialog
        open={noShowOpen}
        onClose={() => !actionLoading && setNoShowOpen(false)}
        onConfirm={() => void handleNoShow()}
        title={t('doctorAppointments.noShowTitle', 'Mark as no-show?')}
        message={t(
          'doctorAppointments.noShowMessage',
          'This marks the appointment as missed. The patient will be notified and the slot is released.',
        )}
        confirmLabel={t('doctorAppointments.markNoShow', 'Mark no-show')}
        loading={actionLoading === 'no-show'}
      />

      <FollowUpModal
        open={followUpOpen}
        doctorId={doctorId}
        initialDate={appointment.appointmentDate}
        onClose={() => !followUpSaving && setFollowUpOpen(false)}
        onConfirm={(payload) => void handleFollowUp(payload)}
        loading={followUpSaving}
      />

      <ReferralModal
        open={referralOpen}
        excludeDoctorId={doctorId}
        onClose={() => !referralSaving && setReferralOpen(false)}
        onConfirm={(payload) => void handleReferral(payload)}
        loading={referralSaving}
      />

      <MeetingLinkModal
        open={meetingOpen}
        initialLink={appointment.meetingLink}
        patientName={patientName}
        onClose={() => !meetingSaving && setMeetingOpen(false)}
        onSave={(meetingLink) => void handleMeetingLink(meetingLink)}
        loading={meetingSaving}
      />

      <AskPatientModal
        open={askOpen}
        patientName={patientName}
        defaultSubject={t('askPatient.defaultSubject', 'Question about your appointment on {{date}}', {
          date: formatDate(appointment.appointmentDate),
        })}
        onClose={() => !askSending && setAskOpen(false)}
        onSend={(subject, body) => void handleAskPatient(subject, body)}
        loading={askSending}
      />
    </div>
  );
}
