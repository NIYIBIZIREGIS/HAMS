import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models';
import { assignFacilitySchema, reassignFacilitySchema } from '../validators/schemas';

const router = Router();

router.get(
  '/analytics',
  authenticate,
  requireRole('super_admin'),
  asyncHandler(adminController.getGlobalAnalytics)
);

router.get(
  '/facilities/stats',
  authenticate,
  requireRole('super_admin'),
  asyncHandler(adminController.getFacilityStatsList)
);

router.post(
  '/assign-facility',
  authenticate,
  requireRole('super_admin'),
  requirePermission(PERMISSIONS.PLATFORM_STAFF_ASSIGN),
  validate(assignFacilitySchema),
  auditLog({
    entity: 'User',
    entityId: (req) => req.body.adminId,
    before: async (req) => User.findById(req.body.adminId).select('-passwordHash').lean(),
    // This grants someone access to a hospital they are not part of, so the entry belongs to
    // the target hospital, not to the platform owner who performed the grant.
    targetFacility: (req) => (req.body as { facilityId?: string }).facilityId,
    metadata: (req) => ({ role: (req.body as { role?: string }).role }),
    summary: (req) => `Granted ${(req.body as { role?: string }).role ?? 'access'} in hospital`,
  }),
  asyncHandler(adminController.assignFacility)
);

router.put(
  '/reassign-facility',
  authenticate,
  requireRole('super_admin'),
  requirePermission(PERMISSIONS.PLATFORM_STAFF_ASSIGN),
  validate(reassignFacilitySchema),
  auditLog({
    entity: 'User',
    entityId: (req) => req.body.adminId,
    before: async (req) => User.findById(req.body.adminId).select('-passwordHash').lean(),
    targetFacility: (req) => (req.body as { facilityId?: string }).facilityId,
    metadata: (req) => ({ newRole: (req.body as { role?: string }).role }),
    summary: 'Hospital assignment changed',
  }),
  asyncHandler(adminController.reassignFacility)
);

router.delete(
  '/remove-facility/:adminId',
  authenticate,
  requireRole('super_admin'),
  requirePermission(PERMISSIONS.PLATFORM_STAFF_ASSIGN),
  validateObjectId('adminId'),
  auditLog({
    entity: 'User',
    entityId: (req) => req.params.adminId,
    before: async (req) => User.findById(req.params.adminId).select('-passwordHash').lean(),
    // The request names the staff member, not the hospital, so the hospital they are being
    // removed from has to be read from the user record itself.
    targetFacility: async (req) =>
      (await User.findById(req.params.adminId).select('facilityId').lean())?.facilityId,
    summary: 'Hospital assignment revoked',
  }),
  asyncHandler(adminController.removeFacilityAssignment)
);

export default router;