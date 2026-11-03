import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface CancelAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
  patientName?: string;
}

export function CancelAppointmentModal({
  open,
  onClose,
  onConfirm,
  loading = false,
  patientName,
}: CancelAppointmentModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const trimmed = reason.trim();
  const invalid = trimmed.length < 3;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('doctorAppointments.cancelTitle')}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(trimmed)}
            loading={loading}
            disabled={invalid}
          >
            {t('doctorAppointments.cancelConfirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-text-muted dark:text-slate-400">
          {patientName
            ? t('doctorAppointments.cancelMessageNamed', { name: patientName })
            : t('doctorAppointments.cancelMessage')}
        </p>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-text-main dark:text-white">
            {t('doctorAppointments.cancelReasonLabel')}
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={300}
            placeholder={t('doctorAppointments.cancelReasonPlaceholder')}
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
