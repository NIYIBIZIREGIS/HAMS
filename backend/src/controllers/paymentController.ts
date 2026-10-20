import { Response } from 'express';
import { Types } from 'mongoose';
import { Payment, Appointment, Patient, Facility } from '../models';
import {
  buildReceipt,
  computeBill,
  findGovernmentProviderId,
  generateReceiptNumber,
  isIndigentPatient,
  roundMoney,
} from '../services/billingService';
import {
  computeOutstandingBills,
  createPaymentRequest,
  settledPaymentsByAppointment,
} from '../services/paymentRequestService';
import { badRequest, conflict, forbidden, notFound } from '../utils/AppError';
import { success, paginate } from '../utils/apiResponse';
import { AuthRequest } from '../middleware/auth';
import {
  assertFacilityAccess,
  hasRole,
  isSuperAdmin,
  tenantFilter,
  ROLE_PATIENT,
} from '../utils/tenancy';

async function getPatientIdForUser(userId: string): Promise<string | null> {
  const patient = await Patient.findOne({ userId }).select('_id').lean();
  return patient ? String(patient._id) : null;
}

async function assertPaymentReadAccess(req: AuthRequest, payment: { patientId: unknown; facilityId: unknown }) {
  if (hasRole(req.user, ROLE_PATIENT)) {
    const patientId = await getPatientIdForUser(req.user!.id);
    if (!patientId || patientId !== String(payment.patientId)) {
      throw forbidden('Forbidden: you can only view your own payments');
    }
    return;
  }
  // `assertFacilityAccess` from the tenancy module fails closed when the caller's account
  // has no hospital assigned, so a misconfigured account cannot read every payment.
  assertFacilityAccess(req, payment.facilityId);
}

/**
 * POST /api/payments
 * Auto-generates the itemized bill for an appointment and records the payment.
 */
export async function createPayment(req: AuthRequest, res: Response) {
  const { appointmentId, method, discount, tax, schemeSubsidy } = req.body;

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw badRequest('Appointment not found');

  assertFacilityAccess(req, appointment.facilityId);

  const existing = await Payment.findOne({
    appointmentId,
    status: { $in: ['Pending', 'Partially Paid', 'Paid'] },
  }).select('_id');
  if (existing) throw conflict('A payment already exists for this appointment');

  const indigent = await isIndigentPatient(String(appointment.patientId));

  let effectiveMethod: string = method;
  let effectiveSubsidy = schemeSubsidy;
  if (indigent) {
    effectiveMethod = 'government_scheme';
    const base = await computeBill(String(appointment._id), { discount, tax });
    effectiveSubsidy = base.subtotal - discount + tax;
  }

  const bill = await computeBill(String(appointment._id), {
    discount,
    tax,
    schemeSubsidy: effectiveSubsidy,
  });

  const payment = await Payment.create({
    appointmentId: appointment._id,
    patientId: appointment.patientId,
    facilityId: appointment.facilityId,
    amount: indigent ? 0 : bill.total,
    breakdown: {
      consultationFee: bill.consultationFee,
      labCharges: bill.labCharges,
      pharmacyCharges: bill.pharmacyCharges,
      discount: bill.discount,
      tax: bill.tax,
      schemeSubsidy: bill.schemeSubsidy,
    },
    method: effectiveMethod,
    status: 'Paid',
    receiptNumber: await generateReceiptNumber(),
    paidAt: new Date(),
  });

  const receipt = await buildReceipt(payment, bill.lines);

  let autoClaim: unknown;
  if (indigent) {
    const providerId = await findGovernmentProviderId();
    if (providerId) {
      autoClaim = { providerId, claimAmount: bill.total };
    }
  }

  success(res, 201, {
    payment: payment.toObject(),
    bill,
    receipt,
    ...(autoClaim ? { autoClaim } : {}),
  });
}

/**
 * GET /api/payments/bill/:appointmentId
 * Preview the auto-generated itemized bill without recording a payment.
 */
export async function previewBill(req: AuthRequest, res: Response) {
  const appointment = await Appointment.findById(req.params.appointmentId);
  if (!appointment) throw badRequest('Appointment not found');

  // A patient may see the bill for their own visit. `assertPatientAccess` compares the
  // appointment's patient against the signed-in account, so this cannot be used to read
  // another patient's charges.
  if (hasRole(req.user, ROLE_PATIENT)) {
    const selfPatientId = await getPatientIdForUser(req.user?.id ?? '');
    if (!selfPatientId || selfPatientId !== String(appointment.patientId)) {
      throw notFound('Appointment not found');
    }
  } else {
    assertFacilityAccess(req, appointment.facilityId);
  }

  const bill = await computeBill(String(appointment._id));
  const indigent = await isIndigentPatient(String(appointment.patientId));

  success(res, 200, { ...bill, indigent });
}

/**
 * GET /api/payments/me/outstanding
 *
 * What the signed-in patient still owes, per appointment.
 *
 * The patient billing screen previously had nothing to show for an appointment that had not
 * been paid, because a payment row only exists once someone records one. An unpaid visit was
 * therefore invisible rather than outstanding. The balance is computed per billable visit
 * instead, so the patient can see the debt and start paying it from the portal.
 */
export async function listMyOutstandingBills(req: AuthRequest, res: Response) {
  const patientId = await getPatientIdForUser(req.user?.id ?? '');
  if (!patientId) throw forbidden('Forbidden: patient profile not found');

  const { totalOutstanding, bills } = await computeOutstandingBills(patientId);

  success(res, 200, { totalOutstanding, currency: 'UGX', bills });
}

/**
 * POST /api/payments/me/requests
 *
 * The patient asks to settle one of their own outstanding visits from the portal.
 *
 * This records an intent to pay, not a capture. The amount is recomputed server-side from the
 * bill and the payments already settled, and the row is written as `Pending`. No payment
 * processor is integrated, so this endpoint must never mark a request `Paid` — funds are
 * received when a staff member confirms the request (`POST /api/payments/:id/confirm`) or when
 * a gateway webhook settles it. Card details are deliberately never accepted here.
 */
export async function requestPayment(req: AuthRequest, res: Response) {
  const patientId = await getPatientIdForUser(req.user?.id ?? '');
  if (!patientId) throw forbidden('Forbidden: patient profile not found');

  const { appointmentId, method } = req.body as { appointmentId: string; method: 'cash' | 'card' | 'online' };

  const { payment, balance, bill } = await createPaymentRequest({
    patientId,
    requestedBy: req.user!.id,
    appointmentId,
    method,
  });

  success(res, 201, {
    payment: payment.toObject(),
    amountDue: balance,
    bill,
    // Surfaced so the client can explain what happens next without hardcoding copy.
    status: 'awaiting_confirmation',
  });
}

/**
 * POST /api/payments/me/requests/:id/cancel
 *
 * Withdraws a request the patient raised. Only an unconfirmed request can be withdrawn; once
 * staff have confirmed funds the row is a real receipt and must be refunded, not cancelled.
 */
export async function cancelPaymentRequest(req: AuthRequest, res: Response) {
  const patientId = await getPatientIdForUser(req.user?.id ?? '');
  if (!patientId) throw forbidden('Forbidden: patient profile not found');

  const payment = await Payment.findById(req.params.id);
  if (!payment) throw notFound('Payment not found');

  if (String(payment.patientId) !== patientId) {
    throw notFound('Payment not found');
  }
  if (payment.source !== 'portal' || payment.status !== 'Pending') {
    throw badRequest('Only a pending payment request can be cancelled');
  }

  payment.status = 'Failed';
  await payment.save();

  success(res, 200, { payment: payment.toObject() });
}

/**
 * POST /api/payments/:id/confirm
 *
 * Staff confirms that the funds behind a pending request were actually received (cash handed
 * over, card taken at the terminal, or a transfer matched). This is the step that turns a
 * request into a paid receipt, so it is restricted to PAYMENTS_RECORD and tenant-scoped.
 */
export async function confirmPaymentRequest(req: AuthRequest, res: Response) {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw notFound('Payment not found');

  assertFacilityAccess(req, payment.facilityId);

  if (payment.status !== 'Pending') {
    throw badRequest('Only a pending payment request can be confirmed');
  }

  // Charges can be added after the patient asked to pay, so the request is checked against the
  // bill as it stands now. `settledPaymentsByAppointment` deliberately excludes this request,
  // since it is still `Pending`, so the outstanding balance here is what the request must cover.
  const bill = await computeBill(String(payment.appointmentId));
  const paidByAppointment = await settledPaymentsByAppointment(String(payment.patientId));
  const alreadyPaid = paidByAppointment.get(String(payment.appointmentId)) ?? 0;
  const amountDue = roundMoney(Math.max(0, bill.total - alreadyPaid));
  if (amountDue > payment.amount) {
    throw conflict('The balance changed; the patient must submit a new request');
  }

  // Conditional on the row still being pending, so two receptionists confirming at the same
  // moment cannot both stamp a receipt: the loser's update matches nothing and is rejected.
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: 'Pending' },
    {
      $set: {
        status: 'Paid',
        confirmedBy: new Types.ObjectId(req.user!.id),
        confirmedAt: new Date(),
        paidAt: new Date(),
        receiptNumber: await generateReceiptNumber(),
      },
    },
    { new: true }
  );
  if (!updated) throw conflict('This payment was already confirmed');

  const settledPayment = updated as typeof payment;

  const receipt = await buildReceipt(settledPayment, bill.lines);

  success(res, 200, { payment: updated.toObject(), receipt });
}

/**
 * GET /api/payments/:id
 */
export async function getPayment(req: AuthRequest, res: Response) {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw notFound('Payment not found');

  await assertPaymentReadAccess(req, payment);

  const [appointment, patient, facility] = await Promise.all([
    Appointment.findById(payment.appointmentId)
      .select('appointmentDate timeSlot status visitType doctorId departmentId')
      .lean(),
    Patient.findById(payment.patientId).select('userId patientNumber nationalHealthId gender').lean(),
    Facility.findById(payment.facilityId).select('name type').lean(),
  ]);

  success(res, 200, { payment: payment.toObject(), appointment, patient, facility });
}

/**
 * GET /api/payments/patient/:patientId
 */
export async function listPatientPayments(req: AuthRequest, res: Response) {
  const patientId = req.params.patientId as string;

  if (hasRole(req.user, ROLE_PATIENT)) {
    const selfPatientId = await getPatientIdForUser(req.user!.id);
    if (!selfPatientId || selfPatientId !== patientId) {
      throw forbidden('Forbidden: you can only view your own payments');
    }
  }

  const patientDoc = await Patient.findById(patientId).select('_id').lean();
  if (!patientDoc) throw badRequest('Invalid patient id');

  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const filter: Record<string, unknown> = { patientId };

  if (!isSuperAdmin(req.user) && !hasRole(req.user, ROLE_PATIENT)) {
    // Always pin staff to their own hospital. The previous version applied a facility
    // filter only when `facilityId` was set, so a tenant role with no hospital assigned
    // fell through to an unscoped query and saw this patient's payments platform-wide.
    Object.assign(filter, tenantFilter(req, req.query.facilityId));
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.method) filter.method = req.query.method;

  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  success(res, 200, payments, paginate(page, limit, total));
}

/**
 * GET /api/payments/me
 * Self-scoped payments for the authenticated patient.
 */
export async function listMyPayments(req: AuthRequest, res: Response) {
  const patientId = await getPatientIdForUser(req.user?.id ?? '');
  if (!patientId) throw forbidden('Forbidden: patient profile not found');

  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 50);
  const filter: Record<string, unknown> = { patientId };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.method) filter.method = req.query.method;

  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  success(res, 200, payments, paginate(page, limit, total));
}

/**
 * POST /api/payments
 * List payments (staff/super_admin). Additive helper for billing screens.
 */
export async function listPayments(req: AuthRequest, res: Response) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);

  const filter: Record<string, unknown> = {};
  if (req.query.patientId) filter.patientId = req.query.patientId;
  if (req.query.appointmentId) filter.appointmentId = req.query.appointmentId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.method) filter.method = req.query.method;

  // Validate the hospital before it is used as a filter. The previous version wrote
  // `req.query.facilityId` into the filter first and checked afterwards, so a rejected
  // request still built an attacker-chosen filter before throwing.
  Object.assign(filter, tenantFilter(req, req.query.facilityId));

  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  success(res, 200, payments, paginate(page, limit, total));
}

/**
 * POST /api/payments/:id/receipt
 * Regenerate/issue the printable receipt (stamps a receiptNumber if missing).
 */
export async function issueReceipt(req: AuthRequest, res: Response) {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw notFound('Payment not found');

  await assertPaymentReadAccess(req, payment);

  if (!payment.receiptNumber) {
    payment.receiptNumber = await generateReceiptNumber();
    await payment.save();
  }

  const bill = await computeBill(String(payment.appointmentId));
  const receipt = await buildReceipt(payment, bill.lines);

  success(res, 200, { payment: payment.toObject(), receipt });
}