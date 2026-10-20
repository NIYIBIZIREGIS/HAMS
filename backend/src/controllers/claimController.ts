import { Response } from 'express';
import { InsuranceClaim, InsuranceProvider, Payment, Patient, Facility, Appointment } from '../models';
import { badRequest, conflict, notFound } from '../utils/AppError';
import { success, paginate } from '../utils/apiResponse';
import { AuthRequest } from '../middleware/auth';
import { assertFacilityAccess, isSuperAdmin, resolveTenantScope, toObjectId } from '../utils/tenancy';
import type { ClaimStatus } from '../models/index';

const TERMINAL: ClaimStatus[] = ['Approved', 'Rejected', 'Paid'];

const TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  Submitted: ['Under Review', 'Approved', 'Rejected'],
  'Under Review': ['Approved', 'Rejected', 'Paid'],
  Approved: ['Paid'],
  Rejected: [],
  Paid: [],
};

export function assertClaimStatusTransition(current: ClaimStatus, next: ClaimStatus) {
  if (current === next) return;
  if (!TRANSITIONS[current].includes(next)) {
    throw badRequest(
      `Invalid claim status transition: ${current} -> ${next}. Allowed: ${TRANSITIONS[current].join(', ') || 'none'}`
    );
  }
}

async function loadPayment(facilityScoped: boolean, req: AuthRequest) {
  const payment = await Payment.findById(req.body.paymentId ?? req.params.paymentId);
  if (!payment) throw notFound('Payment not found');
  if (facilityScoped) {
    // Was `if (req.user?.facilityId && ...)`, which accepted every hospital when the
    // caller's account had no hospital assigned.
    assertFacilityAccess(req, payment.facilityId);
  }
  return payment;
}

async function assertClaimAccess(req: AuthRequest, claim: { paymentId: unknown }) {
  if (isSuperAdmin(req.user)) return;
  const payment = await Payment.findById(claim.paymentId).select('facilityId').lean();
  if (!payment) throw notFound('Payment not found');
  assertFacilityAccess(req, payment.facilityId);
}

/**
 * POST /api/claims
 * Submit an insurance/government-scheme claim for a payment.
 */
export async function createClaim(req: AuthRequest, res: Response) {
  const { paymentId, providerId, claimAmount } = req.body;

  const payment = await loadPayment(true, req);
  if (payment.method !== 'insurance' && payment.method !== 'government_scheme') {
    throw badRequest('Claims can only be filed for insurance or government-scheme payments');
  }

  const existing = await InsuranceClaim.findOne({ paymentId }).select('_id');
  if (existing) throw conflict('A claim already exists for this payment');

  const provider = await InsuranceProvider.findOne({ _id: providerId, isActive: true }).select('_id');
  if (!provider) throw badRequest('Insurance provider not found or inactive');

  const claim = await InsuranceClaim.create({
    paymentId,
    providerId,
    claimAmount: claimAmount !== undefined ? claimAmount : payment.amount,
    status: 'Submitted',
    submittedAt: new Date(),
  });

  success(res, 201, claim.toObject());
}

/**
 * GET /api/claims/:id
 */
export async function getClaim(req: AuthRequest, res: Response) {
  const claim = await InsuranceClaim.findById(req.params.id);
  if (!claim) throw notFound('Claim not found');

  await assertClaimAccess(req, claim);

  const [payment, provider] = await Promise.all([
    Payment.findById(claim.paymentId).lean(),
    InsuranceProvider.findById(claim.providerId).select('name type').lean(),
  ]);

  let patient;
  let facility;
  let appointment;
  if (payment) {
    [patient, facility, appointment] = await Promise.all([
      Patient.findById(payment.patientId).select('userId patientNumber nationalHealthId gender').lean(),
      Facility.findById(payment.facilityId).select('name type').lean(),
      Appointment.findById(payment.appointmentId)
        .select('appointmentDate timeSlot status visitType')
        .lean(),
    ]);
  }

  success(res, 200, { claim: claim.toObject(), payment, provider, patient, facility, appointment });
}

/**
 * PATCH /api/claims/:id/status
 * Insurance verifier advances a claim through its lifecycle.
 */
export async function updateClaimStatus(req: AuthRequest, res: Response) {
  const { status, rejectionReason } = req.body;

  const claim = await InsuranceClaim.findById(req.params.id);
  if (!claim) throw notFound('Claim not found');

  await assertClaimAccess(req, claim);

  assertClaimStatusTransition(claim.status, status);
  if (status === 'Rejected' && !rejectionReason) {
    throw badRequest('A rejection reason is required when rejecting a claim');
  }

  claim.status = status;
  if (status === 'Rejected') claim.rejectionReason = rejectionReason;
  else claim.rejectionReason = undefined;
  if (TERMINAL.includes(status)) claim.resolvedAt = new Date();

  await claim.save();

  success(res, 200, claim.toObject());
}

/**
 * GET /api/claims/reconciliation
 * Insurer/claim status report for facility administrators and verifiers.
 */
export async function reconciliation(req: AuthRequest, res: Response) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);

  const filter: Record<string, unknown> = {};
  if (req.query.providerId) filter.providerId = req.query.providerId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from) filter.submittedAt = { $gte: new Date(String(req.query.from)) };
  if (req.query.to) {
    const to = new Date(String(req.query.to));
    if (req.query.from) {
      (filter.submittedAt as Record<string, unknown>).$lte = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    } else {
      filter.submittedAt = { $lte: new Date(to.getTime() + 24 * 60 * 60 * 1000) };
    }
  }

  if (!isSuperAdmin(req.user)) {
    // `tenantFilter` throws when the caller has no hospital assigned and rejects a
    // `facilityId` naming a different one, so the claim list can never span hospitals.
    const { facilityId } = resolveTenantScope(req, req.query.facilityId);
    const payments = await Payment.find({ facilityId: toObjectId(facilityId) }).select('_id');
    filter.paymentId = { $in: payments.map((p) => p._id) };
  } else if (req.query.facilityId) {
    const payments = await Payment.find({ facilityId: String(req.query.facilityId) }).select('_id');
    filter.paymentId = { $in: payments.map((p) => p._id) };
  }

  const total = await InsuranceClaim.countDocuments(filter);
  const claims = await InsuranceClaim.find(filter)
    .sort({ submittedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const providerIds = [...new Set(claims.map((c) => c.providerId))];
  const paymentIds = [...new Set(claims.map((c) => c.paymentId))];
  const [providers, payments] = await Promise.all([
    InsuranceProvider.find({ _id: { $in: providerIds } }).select('name type').lean(),
    Payment.find({ _id: { $in: paymentIds } })
      .select('facilityId appointmentId patientId amount method breakdown status')
      .lean(),
  ]);

  const providerById = new Map(providers.map((p) => [String(p._id), p]));
  const paymentById = new Map(payments.map((p) => [String(p._id), p]));

  const rows = claims.map((claim) => ({
    claim,
    provider: providerById.get(String(claim.providerId)) ?? null,
    payment: paymentById.get(String(claim.paymentId)) ?? null,
  }));

  success(res, 200, rows, paginate(page, limit, total));
}