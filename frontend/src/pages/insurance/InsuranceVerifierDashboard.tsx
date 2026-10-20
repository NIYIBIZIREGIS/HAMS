import { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Banknote,
  BadgeDollarSign,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { MetricCard } from '../../components/ui/MetricCard';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { ClaimStatusBadge } from '../../components/ui/ClaimStatusBadge';
import {
  getClaimReconciliation,
  listInsuranceProviders,
  listPayments,
  createClaim,
  updateClaimStatus,
  type ClaimRow,
  type InsuranceProvider,
  type Payment,
  type ClaimStatus,
  type PaymentMethod,
} from '../../services/api';
import { formatMoney, formatDate } from '../../lib/format';

const CLAIM_STATUSES: { value: ClaimStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Under Review', label: 'Under Review' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Paid', label: 'Paid' },
];

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  online: 'Online transfer',
  insurance: 'Insurance',
  government_scheme: 'Government scheme',
};

export function InsuranceVerifierDashboard() {
  const [summary, setSummary] = useState<ClaimRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<ClaimStatus | ''>('');
  const [providerFilter, setProviderFilter] = useState('');
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);

  const [rejectTarget, setRejectTarget] = useState<ClaimRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);

  const [fileOpen, setFileOpen] = useState(false);
  const [eligiblePayments, setEligiblePayments] = useState<Payment[]>([]);
  const [claimedPaymentIds, setClaimedPaymentIds] = useState<Set<string>>(new Set());
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claimSaving, setClaimSaving] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const all = await getClaimReconciliation({ limit: 100 });
      setSummary(all);
    } catch {
      setSummary([]);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (status) params.status = status;
      if (providerFilter) params.providerId = providerFilter;
      const res = await getClaimReconciliation(params);
      setRows(res);
      setClaimedPaymentIds(new Set(res.map((r) => r.claim.paymentId)));
    } catch {
      setError('Unable to load claims. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [status, providerFilter]);

  const loadProviders = useCallback(async () => {
    try {
      setProviders(await listInsuranceProviders());
    } catch {
      setProviders([]);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadProviders();
  }, [loadSummary, loadProviders]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const openFileModal = async () => {
    const eligible: Payment[] = [];
    try {
      for (const m of ['insurance', 'government_scheme'] as const) {
        const res = await listPayments({ method: m, status: 'Paid', limit: 100 });
        eligible.push(...res);
      }
    } catch {
      // fall through with whatever loaded
    }
    setEligiblePayments(eligible.filter((p) => !claimedPaymentIds.has(p._id)));
    setSelectedPaymentId('');
    setSelectedProviderId(providers[0]?._id ?? '');
    setClaimAmount('');
    setClaimError('');
    setFileOpen(true);
  };

  const handleClearClaimForm = () => {
    setSelectedPaymentId('');
    setSelectedProviderId(providers[0]?._id ?? '');
    setClaimAmount('');
    setClaimError('');
  };

  const handleTransition = async (action: 'under_review' | 'approve' | 'pay' | 'reject', row: ClaimRow) => {
    if (action === 'reject') {
      setRejectTarget(row);
      setRejectReason('');
      return;
    }
    setBusyId(row.claim._id);
    setError('');
    const next: ClaimStatus =
      action === 'under_review' ? 'Under Review' : action === 'approve' ? 'Approved' : 'Paid';
    try {
      await updateClaimStatus(row.claim._id, { status: next });
      await Promise.all([loadRows(), loadSummary()]);
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Status update failed.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejectSaving(true);
    setError('');
    try {
      await updateClaimStatus(rejectTarget.claim._id, { status: 'Rejected', rejectionReason: rejectReason.trim() });
      setRejectTarget(null);
      setRejectReason('');
      await Promise.all([loadRows(), loadSummary()]);
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Rejection failed.');
    } finally {
      setRejectSaving(false);
    }
  };

  const handleFileClaim = async () => {
    setClaimError('');
    if (!selectedPaymentId || !selectedProviderId) {
      setClaimError('Select both a payment and an insurance provider.');
      return;
    }
    setClaimSaving(true);
    try {
      await createClaim({
        paymentId: selectedPaymentId,
        providerId: selectedProviderId,
        claimAmount: Number(claimAmount) || undefined,
      });
      setFileOpen(false);
      await Promise.all([loadRows(), loadSummary()]);
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setClaimError(msg ?? 'Could not file the claim.');
    } finally {
      setClaimSaving(false);
    }
  };

  const providerName = (p: InsuranceProvider | null): string =>
    p ? p.name : 'Unknown provider';

  const count = (c: ClaimStatus) => summary.filter((r) => r.claim.status === c).length;
  const sumBy = (c: ClaimStatus[]) =>
    summary.filter((r) => c.includes(r.claim.status)).reduce((acc, r) => acc + r.claim.claimAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Insurance claims</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Review submitted claims, advance them through approval, and mark payouts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" icon={RefreshCw} onClick={() => void Promise.all([loadRows(), loadSummary()])}>
            Refresh
          </Button>
          <Button icon={FileText} onClick={() => void openFileModal()}>
            File new claim
          </Button>
        </div>
      </div>

      {summaryLoading ? (
        <div className="py-8">
          <Spinner size="sm" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            icon={ClipboardCheck}
            label="Awaiting review"
            value={count('Submitted') + count('Under Review')}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            action={
              <p className="text-xs text-slate-500">
                {formatMoney(sumBy(['Submitted', 'Under Review']))}
              </p>
            }
          />
          <MetricCard
            icon={CheckCircle2}
            label="Approved"
            value={count('Approved')}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            action={<p className="text-xs text-slate-500">{formatMoney(sumBy(['Approved']))}</p>}
          />
          <MetricCard
            icon={Banknote}
            label="Paid"
            value={count('Paid')}
            iconBg="bg-slate-100"
            iconColor="text-slate-700"
            action={<p className="text-xs text-slate-500">{formatMoney(sumBy(['Paid']))}</p>}
          />
          <MetricCard
            icon={XCircle}
            label="Rejected"
            value={count('Rejected')}
            iconBg="bg-red-50"
            iconColor="text-red-600"
            action={<p className="text-xs text-slate-500">{formatMoney(sumBy(['Rejected']))}</p>}
          />
        </div>
      )}

      <Card>
        <CardHeader title="Claim queue" subtitle="Insurance and government-scheme claims for this facility" icon={BadgeDollarSign} />
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ClaimStatus | '')}
            options={CLAIM_STATUSES}
          />
          <Select
            label="Provider"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            options={[
              { value: '', label: 'All providers' },
              ...providers.map((p) => ({ value: p._id, label: p.name })),
            ]}
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {loading ? (
          <div className="py-10">
            <Spinner size="sm" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No claims match the current filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-2 py-2.5">Receipt</th>
                  <th className="px-2 py-2.5">Provider</th>
                  <th className="px-2 py-2.5">Method</th>
                  <th className="px-2 py-2.5 text-right">Claim amount</th>
                  <th className="px-2 py-2.5">Submitted</th>
                  <th className="px-2 py-2.5">Status</th>
                  <th className="px-2 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => {
                  const c = row.claim;
                  const busy = busyId === c._id;
                  return (
                    <tr key={c._id} className="align-middle">
                      <td className="px-2 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {row.payment?.receiptNumber ?? '—'}
                      </td>
                      <td className="px-2 py-3">
                        <span className="font-medium text-slate-900 dark:text-white">{providerName(row.provider)}</span>
                        <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {row.provider?.type === 'government_scheme' ? 'Gov scheme' : 'Private'}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-slate-600 dark:text-slate-300">
                        {row.payment ? METHOD_LABEL[row.payment.method] : '—'}
                      </td>
                      <td className="px-2 py-3 text-right font-medium text-slate-900 dark:text-white">
                        {formatMoney(c.claimAmount)}
                      </td>
                      <td className="px-2 py-3 text-slate-600 dark:text-slate-300">{formatDate(c.submittedAt)}</td>
                      <td className="px-2 py-3">
                        <ClaimStatusBadge status={c.status} />
                      </td>
                      <td className="px-2 py-3">
                        {c.status === 'Submitted' && (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busy}
                              onClick={() => handleTransition('under_review', row)}
                            >
                              Review
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleTransition('reject', row)}>
                              Reject
                            </Button>
                          </div>
                        )}
                        {c.status === 'Under Review' && (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busy}
                              onClick={() => handleTransition('approve', row)}
                            >
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleTransition('reject', row)}>
                              Reject
                            </Button>
                          </div>
                        )}
                        {c.status === 'Approved' && (
                          <div className="flex justify-end">
                            <Button size="sm" loading={busy} onClick={() => handleTransition('pay', row)}>
                              Mark paid
                            </Button>
                          </div>
                        )}
                        {(c.status === 'Rejected' || c.status === 'Paid') && (
                          <span className="block text-right text-xs text-slate-400">{c.resolvedAt ? formatDate(c.resolvedAt) : '—'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Reject modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject claim"
        width="sm"
        density="compact"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={() => setRejectReason('')}>
              Clear
            </Button>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={XCircle}
              loading={rejectSaving}
              disabled={!rejectReason.trim()}
              onClick={() => void confirmReject()}
            >
              Reject claim
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Provide a reason for rejecting the claim for{' '}
            <span className="font-medium text-slate-900 dark:text-white">
              {rejectTarget ? providerName(rejectTarget.provider) : ''}
            </span>
            .
          </p>
          <Input
            label="Rejection reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Missing supporting document"
          />
        </div>
      </Modal>

      {/* File claim modal */}
<Modal
        open={fileOpen}
        onClose={() => setFileOpen(false)}
        title="File a new claim"
        width="lg"
        density="compact"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={handleClearClaimForm}>
              Clear
            </Button>
            <Button variant="outline" onClick={() => setFileOpen(false)}>
              Cancel
            </Button>
            <Button
              icon={FileText}
              loading={claimSaving}
              disabled={!selectedPaymentId || !selectedProviderId}
              onClick={() => void handleFileClaim()}
            >
              Submit claim
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label="Payment (insurance / government scheme)"
            value={selectedPaymentId}
            onChange={(e) => {
              setSelectedPaymentId(e.target.value);
              const p = eligiblePayments.find((pp) => pp._id === e.target.value);
              setClaimAmount(p ? String(p.amount) : '');
            }}
            options={[
              { value: '', label: 'Select a payment' },
              ...eligiblePayments.map((p) => ({
                value: p._id,
                label: `${p.receiptNumber ?? 'No receipt'} - ${formatMoney(p.amount)} - ${METHOD_LABEL[p.method]}`,
              })),
            ]}
          />
          <Select
            label="Insurance provider"
            value={selectedProviderId}
            onChange={(e) => setSelectedProviderId(e.target.value)}
            options={providers.map((p) => ({ value: p._id, label: `${p.name} (${p.type === 'government_scheme' ? 'Government scheme' : 'Private'})` }))}
          />
          <Input
            label="Claim amount (RWF)"
            type="number"
            min={0}
            value={claimAmount}
            onChange={(e) => setClaimAmount(e.target.value)}
            placeholder="Defaults to payment amount"
          />
          {eligiblePayments.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No eligible insurance or government-scheme payments without an existing claim.
            </p>
          )}
          {claimError && <p className="text-xs text-red-600 dark:text-red-400">{claimError}</p>}
        </div>
      </Modal>
    </div>
  );
}