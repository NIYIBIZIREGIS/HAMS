import { useCallback, useEffect, useState } from 'react';
import { Wallet, Clock, BadgeCheck, XCircle, BadgeDollarSign, ArrowDownUp } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { MetricCard } from '../../components/ui/MetricCard';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { ClaimStatusBadge } from '../../components/ui/ClaimStatusBadge';
import {
  getClaimReconciliation,
  listInsuranceProviders,
  type ClaimRow,
  type InsuranceProvider,
  type ClaimStatus,
  type PaymentMethod,
} from '../../services/api';
import { formatMoney, formatDate } from '../../lib/format';

const STATUS_OPTIONS: { value: ClaimStatus | ''; label: string }[] = [
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

export function ClaimReconciliationPage() {
  const [summary, setSummary] = useState<ClaimRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<ClaimStatus | ''>('');
  const [providerFilter, setProviderFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);

  const loadSummary = useCallback(async () => {
    try {
      const all = await getClaimReconciliation({ limit: 200 });
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
      const params: Record<string, unknown> = { limit: 200 };
      if (status) params.status = status;
      if (providerFilter) params.providerId = providerFilter;
      if (from) params.from = from;
      if (to) params.to = to;
      setRows(await getClaimReconciliation(params));
    } catch {
      setError('Unable to load reconciliation data.');
    } finally {
      setLoading(false);
    }
  }, [status, providerFilter, from, to]);

  useEffect(() => {
    void loadSummary();
    void listInsuranceProviders()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, [loadSummary]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const count = (c: ClaimStatus) => summary.filter((r) => r.claim.status === c).length;
  const sumBy = (c: ClaimStatus[]) =>
    summary.filter((r) => c.includes(r.claim.status)).reduce((acc, r) => acc + r.claim.claimAmount, 0);
  const filteredTotal = rows.reduce((acc, r) => acc + r.claim.claimAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Claim reconciliation</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Financial overview of insurance claims per provider, status, and time range.
        </p>
      </div>

      {summaryLoading ? (
        <div className="py-8">
          <Spinner size="sm" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            icon={Wallet}
            label="Total claimed"
            value={summary.length}
            iconBg="bg-slate-100"
            iconColor="text-slate-700"
            action={
              <p className="text-xs font-medium text-slate-900 dark:text-white">
                {formatMoney(sumBy(['Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid']))}
              </p>
            }
          />
          <MetricCard
            icon={Clock}
            label="Pending"
            value={count('Submitted') + count('Under Review')}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            action={<p className="text-xs text-slate-500">{formatMoney(sumBy(['Submitted', 'Under Review']))}</p>}
          />
          <MetricCard
            icon={BadgeCheck}
            label="Approved"
            value={count('Approved') + count('Paid')}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            action={<p className="text-xs text-slate-500">{formatMoney(sumBy(['Approved', 'Paid']))}</p>}
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
        <CardHeader title="Claims register" subtitle="Filter by status, provider, or submission date" icon={BadgeDollarSign} />
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ClaimStatus | '')}
            options={STATUS_OPTIONS}
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
          <Input label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
                  <th className="px-2 py-2.5">Provider</th>
                  <th className="px-2 py-2.5">Receipt</th>
                  <th className="px-2 py-2.5">Method</th>
                  <th className="px-2 py-2.5 text-right">Claim amount</th>
                  <th className="px-2 py-2.5">Submitted</th>
                  <th className="px-2 py-2.5">Resolved</th>
                  <th className="px-2 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.claim._id}>
                    <td className="px-2 py-3">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {r.provider?.name ?? 'Unknown provider'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {r.provider?.type === 'government_scheme' ? 'Government scheme' : 'Private insurance'}
                      </p>
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {r.payment?.receiptNumber ?? '—'}
                    </td>
                    <td className="px-2 py-3 text-slate-600 dark:text-slate-300">
                      {r.payment ? METHOD_LABEL[r.payment.method] : '—'}
                    </td>
                    <td className="px-2 py-3 text-right font-medium text-slate-900 dark:text-white">
                      {formatMoney(r.claim.claimAmount)}
                    </td>
                    <td className="px-2 py-3 text-slate-600 dark:text-slate-300">{formatDate(r.claim.submittedAt)}</td>
                    <td className="px-2 py-3 text-slate-600 dark:text-slate-300">
                      {r.claim.resolvedAt ? formatDate(r.claim.resolvedAt) : '—'}
                    </td>
                    <td className="px-2 py-3">
                      <ClaimStatusBadge status={r.claim.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900 dark:border-white">
                  <td className="px-2 py-2.5 font-semibold text-slate-900 dark:text-white" colSpan={2}>
                    Filtered total
                  </td>
                  <td className="px-2 py-2.5 text-slate-600 dark:text-slate-300">{rows.length} claims</td>
                  <td className="px-2 py-2.5 text-right font-bold text-slate-900 dark:text-white">
                    {formatMoney(filteredTotal)}
                  </td>
                  <td className="px-2 py-2.5" colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <div className="flex items-center gap-2 text-right text-xs text-slate-400">
        <ArrowDownUp className="h-3.5 w-3.5" />
        Recalculate: adjust filters above to narrow the register by provider, status, or date range.
      </div>
    </div>
  );
}