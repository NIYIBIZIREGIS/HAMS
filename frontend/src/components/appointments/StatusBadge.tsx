import { useTranslation } from 'react-i18next';

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-status-pending-bg text-status-pending-text border-status-pending-bg',
  Confirmed: 'bg-status-confirmed-bg text-status-confirmed-text border-status-confirmed-bg',
  'Checked In': 'bg-status-confirmed-bg text-status-confirmed-text border-status-confirmed-bg',
  'In Progress': 'bg-status-pending-bg text-status-pending-text border-status-pending-bg',
  Completed: 'bg-status-confirmed-bg text-status-confirmed-text border-status-confirmed-bg',
  Cancelled: 'bg-status-cancelled-bg text-status-cancelled-text border-status-cancelled-bg',
  Missed: 'bg-status-cancelled-bg text-status-cancelled-text border-status-cancelled-bg',
  'No Show': 'bg-status-cancelled-bg text-status-cancelled-text border-status-cancelled-bg',
  Rejected: 'bg-status-cancelled-bg text-status-cancelled-text border-status-cancelled-bg',
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const color = STATUS_COLORS[status] ?? 'bg-status-pending-bg text-status-pending-text border-status-pending-bg';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {t(`appointments.${status}`)}
    </span>
  );
}

export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString();
}

export function doctorName(doctor: unknown): string {
  const d = doctor as {
    userId?: { fullName?: string };
    specialization?: string[];
  };
  return d?.userId?.fullName ?? 'Doctor';
}