import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listMyPaymentsPage,
  listMyOutstandingBills,
  requestPayment,
  cancelPaymentRequest,
  getErrorMessage,
  type OutstandingSummary,
  type OutstandingBill,
  type PaymentRequestResult,
  issueReceipt,
  type Payment,
  type Receipt,
} from '../../services/api';
import { Card } from '../../components/ui/Card';
import { MetricCard } from '../../components/ui/MetricCard';
import { Modal } from '../../components/ui/Modal';
import { PageSpinner } from '../../components/ui/Spinner';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import {
  Search,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Undo2,
  ChevronDown,
  ChevronUp,
  ReceiptText,
  Printer,
  Inbox,
  CreditCard,
  Building2,
  Banknote,
  Globe,
  ShieldAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const STATUS_TONES: Record<string, string> = {
  Pending: 'bg-status-pending-bg text-status-pending-text border-status-pending-bg',
  'Partially Paid': 'bg-primary-50 text-primary-700 border-primary-50',
  Paid: 'bg-status-confirmed-bg text-status-confirmed-text border-status-confirmed-bg',
  Refunded: 'bg-surface text-text-muted border-slate-200',
  Failed: 'bg-status-cancelled-bg text-status-cancelled-text border-status-cancelled-bg',
};

const METHOD_META: Record<string, { icon: LucideIcon; labelK: string }> = {
  cash: { icon: Banknote, labelK: 'billing.methods.cash' },
  card: { icon: CreditCard, labelK: 'billing.methods.card' },
  online: { icon: Globe, labelK: 'billing.methods.online' },
  insurance: { icon: Building2, labelK: 'billing.methods.insurance' },
  government_scheme: { icon: ShieldAlert, labelK: 'billing.methods.governmentScheme' },
};

function currency(n: number) {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} RWF`;
}

const PAGE_SIZE = 10;

export function BillingPage() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [outstanding, setOutstanding] = useState<OutstandingSummary | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [method, setMethod] = useState<'cash' | 'card' | 'online'>('cash');
  const [payBusy, setPayBusy] = useState<string | null>(null);
  const [payResult, setPayResult] = useState<PaymentRequestResult | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const refreshOutstanding = useCallback(() => {
    listMyOutstandingBills()
      .then(setOutstanding)
      .catch(() => setOutstanding(null));
  }, []);

  const handlePay = async (bill: OutstandingBill) => {
    if (payBusy) return;
    setPayBusy(bill.appointmentId);
    setPayError(null);
    setPayResult(null);
    try {
      const result = await requestPayment({ appointmentId: bill.appointmentId, method });
      setPayResult(result);
      refreshOutstanding();
    } catch (err) {
      setPayError(getErrorMessage(err));
    } finally {
      setPayBusy(null);
    }
  };

  const handleCancel = async (bill: OutstandingBill) => {
    if (payBusy) return;
    // The open request is identified by its visit here, but cancellation acts on the
    // payment id, so it is resolved from the patient's own payments list.
    const pending = payments.find(
      (p) => p.appointmentId === bill.appointmentId && p.status === 'Pending' && p.source === 'portal',
    );
    if (!pending) {
      refreshOutstanding();
      return;
    }
    setPayBusy(bill.appointmentId);
    setPayError(null);
    setPayResult(null);
    try {
      await cancelPaymentRequest(pending._id);
      refreshOutstanding();
    } catch (err) {
      setPayError(getErrorMessage(err));
    } finally {
      setPayBusy(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listMyPaymentsPage({ page, limit: PAGE_SIZE })
      .then((result) => {
        if (!mounted) return;
        setPayments(result.items);
        setPages(result.pages);
        setPage(result.page);
        setTotal(result.total);
      })
      .catch(() => mounted && setPayments([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [page]);

  // Loaded separately: a visit with no payment row never appears in the payments list, so
  // without this the page reported a clean account even when a balance was owed.
  useEffect(() => {
    let mounted = true;
    listMyOutstandingBills()
      .then((summary) => mounted && setOutstanding(summary))
      .catch(() => mounted && setOutstanding(null));
    return () => {
      mounted = false;
    };
  }, []);

  const totals = useMemo(() => {
    return payments.reduce(
      (acc, p) => {
        acc.paid += p.status === 'Paid' || p.status === 'Partially Paid' ? p.amount : 0;
        acc.pending += p.status === 'Pending' ? p.amount : 0;
        acc.refunded += p.status === 'Refunded' ? p.amount : 0;
        return acc;
      },
      { paid: 0, pending: 0, refunded: 0 },
    );
  }, [payments]);

  const filtered = payments.filter((p) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return `${p.receiptNumber ?? ''} ${p.method} ${p.status} ${p.amount}`.toLowerCase().includes(q);
  });

  const openReceipt = async (p: Payment) => {
    setReceiptBusy(true);
    try {
      const { receipt: rc } = await issueReceipt(p._id);
      setReceipt(rc);
    } catch {
      setReceipt(null);
    } finally {
      setReceiptBusy(false);
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-main">{t('billing.title')}</h1>
        <p className="mt-1 text-sm text-text-muted">{t('billing.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={CheckCircle2}
          label={t('billing.totalPaid')}
          value={currency(totals.paid)}
          iconBg="bg-status-confirmed-bg"
          iconColor="text-status-confirmed-text"
        />
        <MetricCard
          icon={Clock}
          label={t('billing.totalPending')}
          value={currency(totals.pending)}
          iconBg="bg-status-pending-bg"
          iconColor="text-status-pending-text"
        />
        <MetricCard
          icon={Undo2}
          label={t('billing.totalRefunded')}
          value={currency(totals.refunded)}
          iconBg="bg-surface"
          iconColor="text-text-muted"
        />
      </div>

      {outstanding && outstanding.bills.length > 0 && (
        <Card className="border-status-pending-border bg-status-pending-bg/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-status-pending-text" />
              <h2 className="text-sm font-semibold text-text-main">{t('billing.outstandingTitle')}</h2>
            </div>
            <span className="text-lg font-bold text-status-pending-text">
              {currency(outstanding.totalOutstanding)}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">{t('billing.outstandingHint')}</p>

          <div className="mt-4 space-y-3">
            {outstanding.bills.map((bill) => (
              <div
                key={bill.appointmentId}
                className="rounded-xl border border-slate-200 bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-text-muted">
                    {new Date(bill.appointmentDate).toLocaleDateString()} · {bill.timeSlot}
                  </span>
                  <span className="text-sm font-semibold text-danger">
                    {t('billing.balanceDue')}: {currency(bill.balance)}
                  </span>                </div>
                <ul className="mt-2 space-y-1">
                  {bill.lines.map((line, index) => (
                    <li
                      key={`${bill.appointmentId}-${index}`}
                      className="flex justify-between text-xs text-text-muted"
                    >
                      <span>{line.description}</span>
                      <span>{currency(line.amount)}</span>
                    </li>
                  ))}
                </ul>
                {bill.paid > 0 && (
                  <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-text-muted">
                    {t('billing.alreadyPaid')}: {currency(bill.paid)}
                  </p>
                )}

                <div className="mt-3 border-t border-slate-100 pt-3">
                  {bill.hasOpenRequest ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-text-muted">
                        {t('billing.requestAwaiting')}
                        {bill.requestReference && (
                          <span className="ml-1 font-mono font-semibold text-text-main">
                            {bill.requestReference}
                          </span>
                        )}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={payBusy === bill.appointmentId}
                        onClick={() => handleCancel(bill)}
                      >
                        {t('billing.cancelRequest')}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <select
                        aria-label={t('billing.paymentMethod')}
                        value={method}
                        onChange={(e) => setMethod(e.target.value as 'cash' | 'card' | 'online')}
                        className="rounded-lg border border-slate-300 bg-card px-2.5 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="cash">{t('billing.methods.cash')}</option>
                        <option value="card">{t('billing.methods.card')}</option>
                        <option value="online">{t('billing.methods.online')}</option>
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        disabled={payBusy === bill.appointmentId}
                        onClick={() => handlePay(bill)}
                      >
                        {payBusy === bill.appointmentId
                          ? t('billing.submitting')
                          : `${t('billing.payNow')} · ${currency(bill.balance)}`}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {payResult && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-status-confirmed-bg bg-status-confirmed-bg px-3 py-2.5 text-xs text-status-confirmed-text">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {t('billing.requestSubmitted', { reference: payResult.payment.requestReference ?? '' })}
                {payResult.status === 'awaiting_confirmation' && ` ${t('billing.awaitingConfirmation')}`}
              </p>
            </div>
          )}
          {payError && (
            <p className="mt-4 rounded-xl border border-status-cancelled-border bg-status-cancelled-bg px-3 py-2.5 text-xs text-status-cancelled-text">
              {payError}
            </p>
          )}
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${t('common.search')}...`}
          className="w-full rounded-xl border border-slate-300 bg-card py-2 pl-9 pr-3 text-sm text-text-main placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Inbox className="mx-auto h-12 w-12 text-text-muted/40" />
          <h3 className="mt-4 text-base font-semibold text-text-main">{t('billing.noPayments')}</h3>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const meta = METHOD_META[p.method] ?? { icon: Wallet, labelK: 'billing.methods.cash' };
            const MethodIcon = meta.icon;
            const expanded = expandedId === p._id;
            return (
              <Card key={p._id} className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <MethodIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-text-main">
                        {p.receiptNumber ?? '—'}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          STATUS_TONES[p.status] ?? 'bg-surface text-text-muted border-slate-200'
                        }`}
                      >
                        {t(`billing.statuses.${p.status}`)}
                      </span>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {t(meta.labelK)}
                      </span>
                      <span>{new Date(p.createdAt).toLocaleString()}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-text-main">{currency(p.amount)}</p>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : p._id)}
                      className="rounded-xl p-1.5 text-text-muted hover:bg-slate-100 hover:text-text-main"
                      aria-label={expanded ? 'Collapse' : 'Expand'}
                    >
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between text-text-muted">
                        <span>{t('billing.breakdown.consultation')}</span>
                        <span className="text-text-main">{currency(p.breakdown.consultationFee)}</span>
                      </div>
                      <div className="flex items-center justify-between text-text-muted">
                        <span>{t('billing.breakdown.lab')}</span>
                        <span className="text-text-main">{currency(p.breakdown.labCharges)}</span>
                      </div>
                      <div className="flex items-center justify-between text-text-muted">
                        <span>{t('billing.breakdown.pharmacy')}</span>
                        <span className="text-text-main">{currency(p.breakdown.pharmacyCharges)}</span>
                      </div>
                      <div className="flex items-center justify-between text-text-muted">
                        <span>{t('billing.breakdown.discount')}</span>
                        <span className="text-text-main">-{currency(p.breakdown.discount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-text-muted">
                        <span>{t('billing.breakdown.tax')}</span>
                        <span className="text-text-main">{currency(p.breakdown.tax)}</span>
                      </div>
                      <div className="flex items-center justify-between text-text-muted">
                        <span>{t('billing.breakdown.subsidy')}</span>
                        <span className="text-text-main">-{currency(p.breakdown.schemeSubsidy)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 font-semibold text-text-main">
                        <span>{t('billing.total')}</span>
                        <span>{currency(p.amount)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-start justify-end gap-3">
                      {p.paidAt && (
                        <p className="text-xs text-text-muted">
                          {t('billing.paidAt')}: {new Date(p.paidAt).toLocaleString()}
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={receiptBusy}
                        onClick={() => openReceipt(p)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                      >
                        <ReceiptText className="h-3.5 w-3.5" />
                        {t('billing.viewReceipt')}
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        pages={pages}
        total={total}
        itemLabel="pagination.payments"
        disabled={loading}
        onChange={setPage}
      />

      <Modal open={!!receipt} onClose={() => setReceipt(null)} title={t('billing.receipt')} width="lg">
        {receipt && (
          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <p className="text-sm font-bold text-text-main">{receipt.facilityName}</p>
              {receipt.facilityType && <p className="text-xs text-text-muted">{receipt.facilityType}</p>}
              <p className="mt-2 text-xs text-text-muted">
                {t('billing.receiptNumber')}: {receipt.receiptNumber}
              </p>
              <p className="text-xs text-text-muted">{new Date(receipt.receiptDate).toLocaleString()}</p>
            </div>

            {receipt.patient?.name && (
              <div className="text-sm">
                <p className="text-xs uppercase tracking-wide text-text-muted">{t('billing.patient')}</p>
                <p className="mt-0.5 font-medium text-text-main">{receipt.patient.name}</p>
                {receipt.patient.patientNumber && (
                  <p className="text-xs text-text-muted">{receipt.patient.patientNumber}</p>
                )}
              </div>
            )}

            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {receipt.lines.map((line, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3">
                      <p className="text-text-main">{line.label}</p>
                      {line.detail && <p className="text-xs text-text-muted">{line.detail}</p>}
                    </td>
                    <td className="py-2 text-right text-text-muted">
                      {currency(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1.5 border-t border-slate-100 pt-3 text-sm">
              <div className="flex items-center justify-between text-text-muted">
                <span>{t('billing.breakdown.discount')}</span>
                <span>-{currency(receipt.discount)}</span>
              </div>
              <div className="flex items-center justify-between text-text-muted">
                <span>{t('billing.breakdown.tax')}</span>
                <span>{currency(receipt.tax)}</span>
              </div>
              <div className="flex items-center justify-between text-text-muted">
                <span>{t('billing.breakdown.subsidy')}</span>
                <span>-{currency(receipt.schemeSubsidy)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-base font-bold text-text-main">
                <span>{t('billing.total')}</span>
                <span>{currency(receipt.total)}</span>
              </div>
            </div>

            <p className="text-xs text-text-muted">{t('billing.receiptNote')}</p>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <Printer className="h-3.5 w-3.5" />
              {t('billing.print')}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}