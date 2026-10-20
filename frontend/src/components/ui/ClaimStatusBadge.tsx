import type { ClaimStatus } from '../../services/api';

const STYLES: Record<ClaimStatus, string> = {
  Submitted: 'bg-status-pending-bg text-status-pending-text',
  'Under Review': 'bg-status-pending-bg text-status-pending-text',
  Approved: 'bg-status-confirmed-bg text-status-confirmed-text',
  Rejected: 'bg-status-cancelled-bg text-status-cancelled-text',
  Paid: 'bg-status-confirmed-bg text-status-confirmed-text',
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}