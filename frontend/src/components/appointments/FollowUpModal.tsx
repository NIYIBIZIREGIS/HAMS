import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { getAvailability, getErrorMessage, type AvailableSlot } from '../../services/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SlotPicker } from './SlotPicker';

export interface FollowUpPayload {
  appointmentDate: string;
  timeSlot: string;
  note: string;
  autoConfirm: boolean;
}

interface FollowUpModalProps {
  open: boolean;
  doctorId: string;
  initialDate?: string;
  onClose: () => void;
  onConfirm: (payload: FollowUpPayload) => void;
  loading?: boolean;
}

function toDateInput(value?: string): string {
  return value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export function FollowUpModal({
  open,
  doctorId,
  initialDate,
  onClose,
  onConfirm,
  loading = false,
}: FollowUpModalProps) {
  const { t } = useTranslation();
  const [date, setDate] = useState(toDateInput(initialDate));
  const [timeSlot, setTimeSlot] = useState('');
  const [note, setNote] = useState('');
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(toDateInput(initialDate));
    setTimeSlot('');
    setNote('');
    setAutoConfirm(true);
    setSlotError(null);
  }, [open, initialDate]);

  useEffect(() => {
    if (!open || !doctorId || !date) {
      setSlots([]);
      return;
    }
    let active = true;
    setLoadingSlots(true);
    setSlotError(null);
    setTimeSlot('');
    getAvailability(doctorId, date)
      .then((result) => {
        if (active) setSlots(result);
      })
      .catch((err) => {
        if (active) {
          setSlots([]);
          setSlotError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [open, doctorId, date]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('followUp.title', 'Book follow-up')}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                appointmentDate: new Date(date).toISOString(),
                timeSlot,
                note: note.trim(),
                autoConfirm,
              })
            }
            loading={loading}
            disabled={!timeSlot}
            icon={CalendarPlus}
          >
            {t('followUp.confirm', 'Book follow-up')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-text-muted dark:text-slate-400">
          {t(
            'followUp.message',
            'Choose a follow-up slot. Confirm it immediately or leave it pending for the patient.',
          )}
        </p>

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
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : slotError ? (
            <p className="rounded-xl border border-status-cancelled-bg bg-status-cancelled-bg p-3 text-sm text-status-cancelled-text">
              {slotError}
            </p>
          ) : (
            <SlotPicker slots={slots} selected={timeSlot} onSelect={setTimeSlot} disabled={loading} />
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-text-main dark:text-white">
            {t('followUp.note', 'Note for the patient (optional)')}
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t('followUp.notePlaceholder', 'Reason for follow-up or preparation instructions')}
            className="w-full resize-none rounded-xl border border-slate-200 bg-card px-3 py-2.5 text-sm text-text-main outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-surface p-3 dark:border-slate-700 dark:bg-slate-950">
          <input
            type="checkbox"
            checked={autoConfirm}
            onChange={(event) => setAutoConfirm(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
          />
          <span>
            <span className="block text-sm font-semibold text-text-main dark:text-white">
              {t('followUp.autoConfirm', 'Confirm automatically')}
            </span>
            <span className="mt-0.5 block text-xs text-text-muted">
              {t(
                'followUp.autoConfirmHint',
                'When unchecked, the new appointment stays pending until the patient confirms.',
              )}
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
