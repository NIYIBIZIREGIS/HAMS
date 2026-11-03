import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, UserPlus } from 'lucide-react';
import {
  getAvailability,
  getErrorMessage,
  listDoctors,
  type AvailableSlot,
  type Doctor,
} from '../../services/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { SlotPicker } from './SlotPicker';

export interface ReferralPayload {
  targetDoctorId: string;
  note: string;
  appointmentDate?: string;
  timeSlot?: string;
}

interface ReferralModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: ReferralPayload) => void;
  loading?: boolean;
  excludeDoctorId?: string;
}

function doctorLabel(doctor: Doctor): string {
  const name =
    typeof doctor.userId === 'object' ? doctor.userId.fullName : 'Doctor';
  const departments = Array.isArray(doctor.departmentId)
    ? doctor.departmentId
        .map((department) => (typeof department === 'object' ? department.name : ''))
        .filter(Boolean)
        .join(', ')
    : '';
  return departments ? `${name} - ${departments}` : name;
}

export function ReferralModal({
  open,
  onClose,
  onConfirm,
  loading = false,
  excludeDoctorId,
}: ReferralModalProps) {
  const { t } = useTranslation();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [targetDoctorId, setTargetDoctorId] = useState('');
  const [note, setNote] = useState('');
  const [bookAppointment, setBookAppointment] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [timeSlot, setTimeSlot] = useState('');
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTargetDoctorId('');
    setNote('');
    setBookAppointment(false);
    setDate(new Date().toISOString().slice(0, 10));
    setTimeSlot('');
    setSlots([]);
    setError(null);
    setLoadingDoctors(true);
    listDoctors()
      .then((result) =>
        setDoctors(result.filter((doctor) => doctor._id !== excludeDoctorId)),
      )
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoadingDoctors(false));
  }, [open, excludeDoctorId]);

  useEffect(() => {
    if (!open || !bookAppointment || !targetDoctorId || !date) {
      setSlots([]);
      setTimeSlot('');
      return;
    }
    let active = true;
    setLoadingSlots(true);
    setTimeSlot('');
    setError(null);
    getAvailability(targetDoctorId, date)
      .then((result) => {
        if (active) setSlots(result);
      })
      .catch((err) => {
        if (active) {
          setSlots([]);
          setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [open, bookAppointment, targetDoctorId, date]);

  const noteValid = note.trim().length >= 3;
  const appointmentValid = !bookAppointment || Boolean(timeSlot);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('referral.title', 'Refer patient')}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                targetDoctorId,
                note: note.trim(),
                appointmentDate: bookAppointment ? new Date(date).toISOString() : undefined,
                timeSlot: bookAppointment ? timeSlot : undefined,
              })
            }
            loading={loading}
            disabled={!targetDoctorId || !noteValid || !appointmentValid}
            icon={UserPlus}
          >
            {t('referral.confirm', 'Send referral')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-text-muted dark:text-slate-400">
          {t(
            'referral.message',
            'Refer this patient to another doctor. The receiving doctor and the patient are notified.',
          )}
        </p>

        {loadingDoctors ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : (
          <Select
            label={t('referral.targetDoctor', 'Refer to doctor')}
            placeholder={t('referral.selectDoctor', 'Choose a doctor')}
            value={targetDoctorId}
            onChange={(event) => setTargetDoctorId(event.target.value)}
            options={doctors.map((doctor) => ({
              value: doctor._id,
              label: doctorLabel(doctor),
            }))}
            disabled={loading}
          />
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-text-main dark:text-white">
            {t('referral.note', 'Referral note')} <span className="text-status-cancelled-text">*</span>
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder={t(
              'referral.notePlaceholder',
              'Reason for referral, relevant findings, and what you need the receiving doctor to assess',
            )}
            className="w-full resize-none rounded-xl border border-slate-200 bg-card px-3 py-2.5 text-sm text-text-main outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          {!noteValid && note.length > 0 && (
            <p className="mt-1 text-xs text-status-cancelled-text">
              {t('referral.noteRequired', 'Enter at least 3 characters.')}
            </p>
          )}
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-surface p-3 dark:border-slate-700 dark:bg-slate-950">
          <input
            type="checkbox"
            checked={bookAppointment}
            onChange={(event) => setBookAppointment(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
          />
          <span>
            <span className="block text-sm font-semibold text-text-main dark:text-white">
              {t('referral.bookPending', 'Create a pending appointment')}
            </span>
            <span className="mt-0.5 block text-xs text-text-muted">
              {t(
                'referral.bookPendingHint',
                'Optional. The receiving doctor sees a new appointment request.',
              )}
            </span>
          </span>
        </label>

        {bookAppointment && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-text-main dark:text-white">
                {t('booking.date')}
              </span>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-card px-3 py-2.5 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </label>

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-text-main dark:text-white">
                {t('booking.time')}
              </span>
              {loadingSlots ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </div>
              ) : (
                <SlotPicker
                  slots={slots}
                  selected={timeSlot}
                  onSelect={setTimeSlot}
                  disabled={loading}
                />
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-status-cancelled-bg bg-status-cancelled-bg p-3 text-sm text-status-cancelled-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
