import { Router } from 'express';
import * as ctrl from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission, requireAnyPermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { paymentSchema, paymentRequestSchema, paymentsQuery } from '../validators/schemas';

const router = Router();

/**
 * POST /api/payments
 * Receptionist/verifier records a payment; the bill auto-generates from the
 * appointment's consultation + lab + pharmacy charges.
 */
router.post(
  '/',
  authenticate,
  requireRole('receptionist', 'facility_admin', 'insurance_verifier', 'super_admin'),
  requirePermission(PERMISSIONS.PAYMENTS_RECORD),
  validate(paymentSchema),
  auditLog({ entity: 'Payment', entityId: () => undefined }),
  asyncHandler(ctrl.createPayment)
);

/**
 * GET /api/payments
 * Staff/super_admin list with filters.
 */
router.get(
  '/',
  authenticate,
  requireRole('receptionist', 'facility_admin', 'insurance_verifier', 'auditor', 'super_admin'),
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  validate(paymentsQuery, 'query'),
  asyncHandler(ctrl.listPayments)
);

/**
 * GET /api/payments/me
 * Self-scoped payments for the authenticated patient (declared before /:id).
 */
router.get(
  '/me',
  authenticate,
  requireRole('patient'),
  requirePermission(PERMISSIONS.SELF_BILLING),
  validate(paymentsQuery, 'query'),
  asyncHandler(ctrl.listMyPayments)
);

/**
 * GET /api/payments/me/outstanding
 * Bills the signed-in patient still owes, with the balance after settled payments.
 * Declared before `/patient/:patientId` so `me` is not read as an id.
 */
router.get(
  '/me/outstanding',
  authenticate,
  requireRole('patient'),
  requirePermission(PERMISSIONS.SELF_BILLING),
  asyncHandler(ctrl.listMyOutstandingBills)
);

/**
 * POST /api/payments/me/requests
 * The patient asks to settle one of their own outstanding visits.
 *
 * Records an intent to pay as `Pending`; it does not capture money. Funds are received when
 * staff confirm the request, because no payment processor is integrated.
 */
router.post(
  '/me/requests',
  authenticate,
  requireRole('patient'),
  requirePermission(PERMISSIONS.SELF_BILLING),
  validate(paymentRequestSchema),
  auditLog({ entity: 'Payment', entityId: () => undefined }),
  asyncHandler(ctrl.requestPayment)
);

/**
 * POST /api/payments/me/requests/:id/cancel
 * Withdraw an unconfirmed request.
 */
router.post(
  '/me/requests/:id/cancel',
  authenticate,
  requireRole('patient'),
  requirePermission(PERMISSIONS.SELF_BILLING),
  validateObjectId('id'),
  auditLog({ entity: 'Payment', entityId: (req) => req.params.id }),
  asyncHandler(ctrl.cancelPaymentRequest)
);

/**
 * POST /api/payments/:id/confirm
 * Staff confirms the funds behind a pending request were received, issuing the receipt.
 * Declared before `/:id/receipt` usage that could shadow it; both are id-scoped.
 */
router.post(
  '/:id/confirm',
  authenticate,
  requireRole('receptionist', 'facility_admin', 'insurance_verifier', 'super_admin'),
  requirePermission(PERMISSIONS.PAYMENTS_RECORD),
  validateObjectId('id'),
  auditLog({ entity: 'Payment', entityId: (req) => req.params.id }),
  asyncHandler(ctrl.confirmPaymentRequest)
);

/**
 * GET /api/payments/patient/:patientId
 * Listed before /:id so "patient" is not captured as an ObjectId.
 */
router.get(
  '/patient/:patientId',
  authenticate,
  requireRole('patient', 'receptionist', 'facility_admin', 'insurance_verifier', 'auditor', 'super_admin'),
  requireAnyPermission(PERMISSIONS.PAYMENTS_VIEW, PERMISSIONS.SELF_BILLING),
  validateObjectId('patientId'),
  validate(paymentsQuery, 'query'),
  asyncHandler(ctrl.listPatientPayments)
);

/**
 * POST /api/payments/:id/receipt
 * Issue/regenerate the printable receipt.
 */
router.post(
  '/:id/receipt',
  authenticate,
  requireRole('patient', 'receptionist', 'facility_admin', 'insurance_verifier', 'super_admin'),
  requireAnyPermission(PERMISSIONS.PAYMENTS_VIEW, PERMISSIONS.SELF_BILLING),
  validateObjectId('id'),
  auditLog({ entity: 'Payment', entityId: (req) => req.params.id }),
  asyncHandler(ctrl.issueReceipt)
);

/**
 * GET /api/payments/bill/:appointmentId
 * Preview the itemized bill (defined before /:id).
 */
router.get(
  '/bill/:appointmentId',
  authenticate,
  requireRole('patient', 'receptionist', 'facility_admin', 'insurance_verifier', 'auditor', 'super_admin'),
  requireAnyPermission(PERMISSIONS.PAYMENTS_VIEW, PERMISSIONS.SELF_BILLING),
  validateObjectId('appointmentId'),
  asyncHandler(ctrl.previewBill)
);

/**
 * GET /api/payments/:id
 */
router.get(
  '/:id',
  authenticate,
  requireRole('patient', 'receptionist', 'facility_admin', 'insurance_verifier', 'auditor', 'super_admin'),
  requireAnyPermission(PERMISSIONS.PAYMENTS_VIEW, PERMISSIONS.SELF_BILLING),
  validateObjectId('id'),
  asyncHandler(ctrl.getPayment)
);

export default router;