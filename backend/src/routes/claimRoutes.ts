import { Router } from 'express';
import * as ctrl from '../controllers/claimController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { claimSchema, claimStatusSchema, claimsQuery } from '../validators/schemas';
import { InsuranceClaim } from '../models';

const router = Router();

/**
 * POST /api/claims
 * Submit a claim for an insurance / government-scheme payment.
 */
router.post(
  '/',
  authenticate,
  requireRole('insurance_verifier', 'receptionist', 'facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.CLAIMS_SUBMIT),
  validate(claimSchema),
  auditLog({ entity: 'InsuranceClaim', entityId: () => undefined }),
  asyncHandler(ctrl.createClaim)
);

/**
 * GET /api/claims/reconciliation
 * Reconciliation report. Defined before /:id.
 */
router.get(
  '/reconciliation',
  authenticate,
  requireRole('insurance_verifier', 'receptionist', 'facility_admin', 'auditor', 'super_admin'),
  requirePermission(PERMISSIONS.CLAIMS_VIEW),
  validate(claimsQuery, 'query'),
  asyncHandler(ctrl.reconciliation)
);

/**
 * PATCH /api/claims/:id/status
 * Insurance verifier advances a claim through its lifecycle.
 */
router.patch(
  '/:id/status',
  authenticate,
  requireRole('insurance_verifier', 'facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.CLAIMS_VERIFY),
  validateObjectId('id'),
  validate(claimStatusSchema),
  auditLog({
    entity: 'InsuranceClaim',
    entityId: (req) => req.params.id,
    before: async (req) => InsuranceClaim.findById(req.params.id).lean(),
  }),
  asyncHandler(ctrl.updateClaimStatus)
);

/**
 * GET /api/claims/:id
 */
router.get(
  '/:id',
  authenticate,
  requireRole('insurance_verifier', 'receptionist', 'facility_admin', 'auditor', 'super_admin'),
  requirePermission(PERMISSIONS.CLAIMS_VIEW),
  validateObjectId('id'),
  asyncHandler(ctrl.getClaim)
);

export default router;