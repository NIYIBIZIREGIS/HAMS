import { randomBytes } from 'crypto';
import { Types, type HydratedDocument } from 'mongoose';
import { Appointment, Payment, type IPayment } from '../models';
import { computeBill, roundMoney } from './billingService';
import { badRequest, conflict, notFound } from '../utils/AppError';

/** Visit states that generate a bill. A cancelled or missed visit is not owed for. */
export const BILLABLE_APPOINTMENT_STATUSES = ['Checked In', 'In Progress', 'Completed'] as const;

/** Only settled payments reduce a balance; the rest record an attempt, not money received. */
export const SETTLED_PAYMENT_STATUSES = ['Paid', 'Partially Paid'] as const;

export interface OutstandingBill {
  appointmentId: string;
  appointmentDate: Date;
  timeSlot?: string;
  status: string;
  visitType?: string;
  total: number;
  paid: number;
  balance: number;
  lines: Awaited<ReturnType<typeof computeBill>>['lines'];
  /** True when the patient has already asked to pay this visit and staff have not confirmed. */
  hasOpenRequest: boolean;
  requestReference?: string;
}

/**
 * Sums settled payments per appointment for a patient.
 *
 * Both the outstanding list and the payment-request path read balances through this, so the
 * amount a patient is shown and the amount a request records cannot drift apart.
 */
export async function settledPaymentsByAppointment(
  patientId: string,
): Promise<Map<string, number>> {
  const rows = await Payment.aggregate([
    { $match: { patientId: new Types.ObjectId(patientId), status: { $in: [...SETTLED_PAYMENT_STATUSES] } } },
    { $group: { _id: '$appointmentId', paid: { $sum: '$amount' } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.paid as number]));
}

/**
 * Computes what a patient still owes across their billable visits.
 *
 * A payment row only exists once someone records one, so an unpaid visit is invisible in the
 * payments list. This walks the billable visits and reports the balance after settled payments,
 * which is what makes an unpaid visit show up as outstanding rather than absent.
 */
export async function computeOutstandingBills(patientId: string): Promise<{
  totalOutstanding: number;
  bills: OutstandingBill[];
}> {
  const paidByAppointment = await settledPaymentsByAppointment(patientId);

  const appointments = await Appointment.find({
    patientId,
    status: { $in: [...BILLABLE_APPOINTMENT_STATUSES] },
  })
    .sort({ appointmentDate: -1 })
    .select('appointmentDate timeSlot status visitType doctorId departmentId facilityId')
    .lean();

  const openRequests = await Payment.find({
    patientId,
    source: 'portal',
    status: 'Pending',
  })
    .select('appointmentId requestReference')
    .lean();
  const requestByAppointment = new Map(
    openRequests.map((row) => [String(row.appointmentId), row.requestReference as string | undefined]),
  );

  const bills: OutstandingBill[] = [];
  let totalOutstanding = 0;

  for (const appointment of appointments) {
    const bill = await computeBill(String(appointment._id));
    const paid = paidByAppointment.get(String(appointment._id)) ?? 0;
    const balance = roundMoney(Math.max(0, bill.total - paid));
    if (balance <= 0) continue;

    totalOutstanding = roundMoney(totalOutstanding + balance);
    bills.push({
      appointmentId: String(appointment._id),
      appointmentDate: appointment.appointmentDate,
      timeSlot: appointment.timeSlot,
      status: appointment.status,
      visitType: appointment.visitType,
      total: bill.total,
      paid,
      balance,
      lines: bill.lines,
      hasOpenRequest: requestByAppointment.has(String(appointment._id)),
      requestReference: requestByAppointment.get(String(appointment._id)),
    });
  }

  return { totalOutstanding, bills };
}

/**
 * A short, non-sequential handle for a portal payment request.
 *
 * Sequential references would let a patient enumerate or guess other patients' references, so
 * this uses random bytes rather than a counter.
 */
export async function generateRequestReference(): Promise<string> {
  const random = randomBytes(4).toString('hex').toUpperCase();
  return `PAY-${random}`;
}

/**
 * Records a patient's request to pay for one of their own visits.
 *
 * The amount is computed here from the bill and the settled payments, never taken from the
 * request body: a client-supplied amount would let a patient settle a balance for one shilling.
 * The row is created as `Pending`, not `Paid`, because nothing is charged here — no payment
 * processor is integrated, so funds are only considered received once a staff member confirms
 * them, or once a gateway webhook settles the request.
 */
export async function createPaymentRequest(input: {
  patientId: string;
  requestedBy: string;
  appointmentId: string;
  method: 'cash' | 'card' | 'online';
}): Promise<{ payment: HydratedDocument<IPayment>; balance: number; bill: Awaited<ReturnType<typeof computeBill>> }> {
  const appointment = await Appointment.findById(input.appointmentId).select(
    '_id patientId facilityId status',
  );
  if (!appointment) throw notFound('Appointment not found');

  // Identity comes from the signed-in account, so a patient cannot request payment against
  // somebody else's visit.
  if (String(appointment.patientId) !== input.patientId) {
    throw notFound('Appointment not found');
  }
  if (!(BILLABLE_APPOINTMENT_STATUSES as readonly string[]).includes(appointment.status)) {
    throw badRequest('This visit cannot be paid online');
  }

  const bill = await computeBill(String(appointment._id));
  const paidByAppointment = await settledPaymentsByAppointment(input.patientId);
  const paid = paidByAppointment.get(String(appointment._id)) ?? 0;
  const balance = roundMoney(Math.max(0, bill.total - paid));

  // Settling in full is reported as "nothing owing" rather than a conflict, so a patient who
  // just paid at reception gets a clear reason instead of a bare 409.
  if (balance <= 0) throw badRequest('This visit has no outstanding balance');

  // Only checked after the balance, so an unconfirmed request is distinguished from a settled
  // one: this is a retry that has to be withdrawn first, not a bill that is already paid.
  const existing = await Payment.findOne({
    appointmentId: appointment._id,
    status: { $in: ['Pending', 'Partially Paid', 'Paid'] },
  }).select('_id status');
  if (existing) throw conflict('A payment is already recorded or in progress for this visit');

  const payment = await Payment.create({
    appointmentId: appointment._id,
    patientId: appointment.patientId,
    facilityId: appointment.facilityId,
    amount: balance,
    breakdown: {
      consultationFee: bill.consultationFee,
      labCharges: bill.labCharges,
      pharmacyCharges: bill.pharmacyCharges,
      discount: bill.discount,
      tax: bill.tax,
      schemeSubsidy: bill.schemeSubsidy,
    },
    method: input.method,
    status: 'Pending',
    source: 'portal',
    requestReference: await generateRequestReference(),
    requestedBy: new Types.ObjectId(input.requestedBy),
  });

  return { payment, balance, bill };
}
