import { useCallback, useEffect, useState } from 'react';
import { Search, UserRound, ReceiptText, Printer, FileCheck2, AlertTriangle, Banknote } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import {
  listPatients,
  listAppointments,
  listPatientPayments,
  previewBill,
  createPayment,
  issueReceipt,
  type Patient,
  type Appointment,
  type Payment,
  type Receipt,
  type Bill,
  type PaymentMethod,
} from '../../services/api';
import { formatMoney, formatDate } from '../../lib/format';

function patientName(p: Patient): string {
  const u = p.userId as { fullName?: string } | string | undefined;
  return typeof u === 'object' && u ? u.fullName ?? '' : 'Patient';
}

function doctorName(a: Appointment): string {
  const d = a.doctorId as { userId?: { fullName?: string }; specialization?: string[] } | string | undefined;
  if (typeof d === 'object' && d) {
    const name = typeof d.userId === 'object' && d.userId ? d.userId.fullName ?? '' : '';
    return name || (d.specialization?.[0] ?? 'Doctor');
  }
  return 'Doctor';
}

function appointmentLabel(a: Appointment): string {
  const dept = a.departmentId as { name?: string } | string | undefined;
  const deptName = typeof dept === 'object' && dept ? dept.name ?? '' : '';
  return `${formatDate(a.appointmentDate)} · ${a.timeSlot} · ${a.visitType ?? 'visit'}${deptName ? ` · ${deptName}` : ''}`;
}

const METHOD_OPTIONS: { value: PaymentMethod | ''; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online transfer' },
  { value: 'insurance', label: 'Insurance' },
];

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  online: 'Online transfer',
  insurance: 'Insurance',
  government_scheme: 'Government scheme',
};

export function BillingPage() {
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);

  const [selected, setSelected] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [paidMap, setPaidMap] = useState<Record<string, { receiptNumber?: string; paymentId: string }>>({});
  const [payments, setPayments] = useState<Payment[]>([]);

  const [billAppointment, setBillAppointment] = useState<Appointment | null>(null);
  const [bill, setBill] = useState<(Bill & { indigent: boolean }) | null>(null);
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState('');

  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [processing, setProcessing] = useState(false);
  const [payError, setPayError] = useState('');

  const [receipt, setReceipt] = useState<{
    receipt: Receipt;
    payment: Payment;
    autoClaim?: { providerId: string; claimAmount: number };
  } | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await listPatients(q.trim());
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!searchQ.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => void runSearch(searchQ), 350);
    return () => clearTimeout(t);
  }, [searchQ, runSearch]);

  const loadPatient = useCallback(async (patient: Patient) => {
    setSelected(patient);
    setBillAppointment(null);
    setBill(null);
    setReceipt(null);
    setAppointmentsLoading(true);
    try {
      const [appts, pays] = await Promise.all([
        listAppointments({ patientId: patient._id }),
        listPatientPayments(patient._id),
      ]);
      setAppointments(appts);
      setPayments(pays);
      const map: Record<string, { receiptNumber?: string; paymentId: string }> = {};
      for (const p of pays) {
        map[p.appointmentId] = { receiptNumber: p.receiptNumber, paymentId: p._id };
      }
      setPaidMap(map);
    } catch {
      setAppointments([]);
      setPayments([]);
      setPaidMap({});
    } finally {
      setAppointmentsLoading(false);
    }
  }, []);

  const loadBill = useCallback(async (a: Appointment) => {
    setBillAppointment(a);
    setBill(null);
    setBillError('');
    setReceipt(null);
    setBillLoading(true);
    try {
      const b = await previewBill(a._id);
      setBill(b);
      if (b.indigent) setMethod('government_scheme');
      else if (method === 'government_scheme') setMethod('cash');
    } catch {
      setBillError('Unable to load the bill for this appointment.');
    } finally {
      setBillLoading(false);
    }
  }, [method]);

  const handlePay = async () => {
    if (!billAppointment || !bill) return;
    setPayError('');
    setProcessing(true);
    try {
      const result = await createPayment({
        appointmentId: billAppointment._id,
        method: bill.indigent ? 'government_scheme' : method,
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
      });
      setReceipt(result);
      setBillAppointment(null);
      setBill(null);
      setMethod('cash');
      setDiscount('');
      setTax('');
      if (selected) void loadPatient(selected);
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setPayError(msg ?? 'Payment could not be recorded. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const openReceipt = async (paymentId: string) => {
    try {
      const res = await issueReceipt(paymentId);
      setReceipt({ receipt: res.receipt, payment: res.payment });
    } catch {
      // silently ignore
    }
  };

  const offersCoverage = (p: Patient) =>
    p.insurance?.provider || (p.governmentScheme?.schemeName && !p.governmentScheme?.indigentStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Billing & Payment</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Generate itemized bills, record payments, and issue receipts.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Patient picker */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Find patient" subtitle="Search by name or patient number" icon={UserRound} />
            <Input
              icon={Search}
              placeholder="Name or patient number…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            {searching && (
              <div className="mt-3">
                <Spinner size="sm" />
              </div>
            )}
            {results.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {results.slice(0, 8).map((p) => (
                  <li key={p._id}>
                    <button
                      type="button"
                      onClick={() => loadPatient(p)}
                      className="flex w-full items-center justify-between gap-2 px-1 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                          {patientName(p)}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{p.patientNumber}</span>
                      </span>
                      {offersCoverage(p) && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {p.governmentScheme?.schemeName && !p.governmentScheme?.indigentStatus
                            ? p.governmentScheme.schemeName
                            : p.insurance?.provider}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {selected && (
            <Card>
              <CardHeader
                title={patientName(selected)}
                subtitle={`${selected.patientNumber}${selected.gender ? ` · ${selected.gender}` : ''}`}
                icon={UserRound}
              />
              <div className="flex flex-wrap gap-2">
                {selected.governmentScheme?.indigentStatus ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white">
                    <Banknote className="h-3.5 w-3.5" />
                    Indigent — government scheme
                  </span>
                ) : selected.insurance?.provider ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Insurance · {selected.insurance.provider}
                    {selected.insurance.policyNumber ? ` · ${selected.insurance.policyNumber}` : ''}
                  </span>
                ) : selected.governmentScheme?.schemeName ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {selected.governmentScheme.schemeName}
                    {selected.governmentScheme.beneficiaryNumber
                      ? ` · ${selected.governmentScheme.beneficiaryNumber}`
                      : ''}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    No insurance on record
                  </span>
                )}
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Appointments
                </p>
                {appointmentsLoading ? (
                  <Spinner size="sm" />
                ) : appointments.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No appointments on record.</p>
                ) : (
                  <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                    {appointments.map((a) => {
                      const paid = paidMap[a._id];
                      return (
                        <li key={a._id}>
                          <button
                            type="button"
                            onClick={() => (paid ? openReceipt(paid.paymentId) : loadBill(a))}
                            className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                              billAppointment?._id === a._id
                                ? 'border-primary bg-primary text-white dark:border-primary dark:bg-primary dark:text-white'
                                : 'border-slate-200 bg-card hover:border-primary/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-500'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{appointmentLabel(a)}</span>
                              <span className="block text-xs text-slate-500 dark:text-slate-400">
                                {doctorName(a)} · {a.status}
                              </span>
                            </span>
                            {paid ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                <FileCheck2 className="h-3 w-3" />
                                Paid
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                Bill
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Billing panel */}
        <div className="space-y-4 lg:col-span-3">
          {!billAppointment ? (
            <Card>
              <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <ReceiptText className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                </span>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Select a patient and an appointment to generate its itemized bill.
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title={appointmentLabel(billAppointment)}
                subtitle={doctorName(billAppointment)}
                icon={ReceiptText}
              />
              {billLoading ? (
                <div className="py-8">
                  <Spinner size="sm" />
                </div>
              ) : billError ? (
                <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  {billError}
                </p>
              ) : bill ? (
                <div className="space-y-5">
                  {bill.indigent && (
                    <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
                      <Banknote className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Indigent patient — the full bill is billed to a government scheme. A claim is submitted
                        automatically and the patient pays nothing.
                      </span>
                    </div>
                  )}

                  <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                          <th className="px-3 py-2.5">Item</th>
                          <th className="px-3 py-2.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {bill.lines.map((line, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-slate-900 dark:text-slate-100">
                              <span className="font-medium">{line.label}</span>
                              {line.detail && (
                                <span className="block text-xs text-slate-500 dark:text-slate-400">{line.detail}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                              {formatMoney(line.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="text-slate-900 dark:text-slate-100">
                        <tr className="border-t border-slate-200 dark:border-slate-800">
                          <td className="px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400">Subtotal</td>
                          <td className="px-3 py-2 text-right">{formatMoney(bill.subtotal)}</td>
                        </tr>
                        {bill.discount > 0 && (
                          <tr>
                            <td className="px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400">Discount</td>
                            <td className="px-3 py-2 text-right">− {formatMoney(bill.discount)}</td>
                          </tr>
                        )}
                        {bill.tax > 0 && (
                          <tr>
                            <td className="px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400">Tax</td>
                            <td className="px-3 py-2 text-right">+ {formatMoney(bill.tax)}</td>
                          </tr>
                        )}
                        {bill.schemeSubsidy > 0 && (
                          <tr>
                            <td className="px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                              Scheme subsidy
                            </td>
                            <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">
                              − {formatMoney(bill.schemeSubsidy)}
                            </td>
                          </tr>
                        )}
                        <tr className="border-t-2 border-slate-900 dark:border-white">
                          <td className="px-3 py-2 text-sm font-semibold">Total due</td>
                          <td className="px-3 py-2 text-right text-lg font-bold">{formatMoney(bill.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Select
                      label="Payment method"
                      value={bill.indigent ? 'government_scheme' : method}
                      disabled={bill.indigent}
                      onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                      options={[
                        ...METHOD_OPTIONS,
                        { value: 'government_scheme', label: 'Government scheme' },
                      ]}
                    />
                    <Input
                      label="Discount (RWF)"
                      type="number"
                      min={0}
                      value={bill.indigent ? '0' : discount}
                      disabled={bill.indigent}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0"
                    />
                    <Input
                      label="Tax (RWF)"
                      type="number"
                      min={0}
                      value={bill.indigent ? '0' : tax}
                      disabled={bill.indigent}
                      onChange={(e) => setTax(e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  {payError && (
                    <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      {payError}
                    </p>
                  )}

                  <Button
                    onClick={handlePay}
                    loading={processing}
                    icon={Banknote}
                    className="w-full sm:w-auto"
                  >
                    Record payment & issue receipt
                  </Button>
                </div>
              ) : null}
            </Card>
          )}

          {/* Payment history */}
          {selected && payments.length > 0 && (
            <Card>
              <CardHeader title="Payment history" subtitle="Recent receipts for this patient" icon={ReceiptText} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="px-2 py-2">Receipt</th>
                      <th className="px-2 py-2">Method</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payments.slice(0, 6).map((p) => (
                      <tr key={p._id}>
                        <td className="px-2 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {p.receiptNumber ?? '—'}
                        </td>
                        <td className="px-2 py-2.5 text-slate-700 dark:text-slate-300">{METHOD_LABEL[p.method]}</td>
                        <td className="px-2 py-2.5 text-right font-medium text-slate-900 dark:text-white">
                          {formatMoney(p.amount)}
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            {p.status}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => openReceipt(p._id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-primary dark:text-slate-300 dark:hover:text-white"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Receipt modal */}
      <Modal
        open={!!receipt}
        onClose={() => setReceipt(null)}
        title="Payment receipt"
        width="lg"
      >
        {receipt && (
          <div className="space-y-3">
            <div className="print-area rounded-lg border border-slate-200 p-5 dark:border-slate-800">
              <div className="flex items-start justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <div>
                  <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {receipt.receipt.facilityName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{receipt.receipt.facilityType}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                    {receipt.receipt.receiptNumber}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(receipt.receipt.receiptDate)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 py-3 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Patient</p>
                  <p className="text-slate-900 dark:text-white">{receipt.receipt.patient.name ?? '—'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {receipt.receipt.patient.patientNumber ?? ''}
                    {receipt.receipt.patient.nationalHealthId
                      ? ` · ${receipt.receipt.patient.nationalHealthId}`
                      : ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Appointment</p>
                  <p className="text-slate-900 dark:text-white">{receipt.receipt.appointment.date ?? '—'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {receipt.receipt.appointment.timeSlot ?? ''}
                    {receipt.receipt.appointment.doctorName ? ` · ${receipt.receipt.appointment.doctorName}` : ''}
                  </p>
                </div>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {receipt.receipt.lines.map((line, i) => (
                    <tr key={i}>
                      <td className="py-1 text-slate-700 dark:text-slate-300">
                        {line.label}
                        {line.detail && (
                          <span className="block text-xs text-slate-500 dark:text-slate-400">{line.detail}</span>
                        )}
                      </td>
                      <td className="py-1 text-right text-slate-900 dark:text-white">{formatMoney(line.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-1 text-sm text-slate-500 dark:text-slate-400">Subtotal</td>
                    <td className="py-1 text-right text-slate-900 dark:text-white">{formatMoney(receipt.receipt.subtotal)}</td>
                  </tr>
                  {receipt.receipt.discount > 0 && (
                    <tr>
                      <td className="py-1 text-sm text-slate-500 dark:text-slate-400">Discount</td>
                      <td className="py-1 text-right text-slate-900 dark:text-white">− {formatMoney(receipt.receipt.discount)}</td>
                    </tr>
                  )}
                  {receipt.receipt.tax > 0 && (
                    <tr>
                      <td className="py-1 text-sm text-slate-500 dark:text-slate-400">Tax</td>
                      <td className="py-1 text-right text-slate-900 dark:text-white">+ {formatMoney(receipt.receipt.tax)}</td>
                    </tr>
                  )}
                  {receipt.receipt.schemeSubsidy > 0 && (
                    <tr>
                      <td className="py-1 text-sm text-emerald-600 dark:text-emerald-400">Scheme subsidy</td>
                      <td className="py-1 text-right text-emerald-600 dark:text-emerald-400">
                        − {formatMoney(receipt.receipt.schemeSubsidy)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-1.5 font-semibold text-slate-900 dark:text-white">Total</td>
                    <td className="py-1.5 text-right text-base font-bold text-slate-900 dark:text-white">
                      {formatMoney(receipt.receipt.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span>Paid via {METHOD_LABEL[receipt.receipt.method]}</span>
                <span>{receipt.receipt.status}</span>
              </div>
            </div>

            {receipt.autoClaim && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
                Claim auto-submitted to the government scheme for {formatMoney(receipt.autoClaim.claimAmount)} — track
                it in the Claims screen.
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setReceipt(null)}>
                Close
              </Button>
              <Button icon={Printer} onClick={() => window.print()}>
                Print receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}