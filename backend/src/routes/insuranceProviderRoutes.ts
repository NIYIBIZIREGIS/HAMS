import { Router } from 'express';
import * as ctrl from '../controllers/providerController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { insuranceProviderSchema } from '../validators/schemas';

const router = Router();

router.get(
  '/',
  authenticate,
  requireRole('receptionist', 'facility_admin', 'insurance_verifier', 'auditor', 'super_admin'),
  asyncHandler(ctrl.listProviders)
);

router.post(
  '/',
  authenticate,
  requireRole('super_admin'),
  validate(insuranceProviderSchema),
  auditLog({ entity: 'InsuranceProvider', entityId: () => undefined }),
  asyncHandler(ctrl.createProvider)
);

export default router;