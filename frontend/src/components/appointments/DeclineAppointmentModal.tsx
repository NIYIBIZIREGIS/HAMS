import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

const PRESETS = ['unavailable', 'wrongDepartment', 'scheduleConflict', 'other'] as const;

type Preset = (typeof PRESETS)[number];

interface DeclineAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
  patientName?: string;
}

export function DeclineAppointmentModal({
  open,
  onClose,
  onConfirm,
  loading = false,
  patientName,
}: DeclineAppointmentModalProps) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<Preset>('unavailable');
  const [details, setDetails] = useState('');

  useEffect(() => {
    if (open) {
      setPreset('unavailable');
      setDetails('');
    }
  }, [open]);

  const detailText = details.trim();
  const presetReason = t(`doctorAppointments.presets.${preset}`);
  const reason =
    preset === 'other'
      ? detailText
      : detailText
        ? `${presetReason}: ${detailText}`
        : presetReason;
  const invalid = reason.trim().length < 3;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('doctorAppointments.declineTitle')}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(reason.trim())}
            loading={loading}
            disabled={invalid}
          >
            {t('doctorAppointments.declineConfirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-text-muted dark:text-slate-400">
          {patientName
            ? t('doctorAppointments.declineMessageNamed', { name: patientName })
            : t('doctorAppointments.declineMessage')}
        </p>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-text-main dark:text-white">
            {t('doctorAppointments.reasonLabel')}
          </span>
          <select
            value={preset}
            onChange={(event) => setPreset(event.target.value as Preset)}
            className="w-full rounded-xl border border-slate-200 bg-card px-3 py-2.5 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {PRESETS.map((value) => (
              <option key={value} value={value}>
                {t(`doctorAppointments.presets.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-text-main dark:text-white">
            {preset === 'other'
              ? t('doctorAppointments.detailsRequired')
              : t('doctorAppointments.detailsOptional')}
          </span>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={3}
            maxLength={300}
            placeholder={t('doctorAppointments.detailsPlaceholder')}
            className="w-full resize-none rounded-xl border border-slate-200 bg-card px-3 py-2.5 text-sm text-text-main outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>

        {invalid && (
          <p className="text-xs font-medium text-status-cancelled-text">
            {t('doctorAppointments.reasonRequired')}
          </p>
        )}
      </div>
    </Modal>
  );
}
