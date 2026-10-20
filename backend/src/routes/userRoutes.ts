import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { userUpdateSchema, createStaffUserSchema, paginationQuery } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models';

const router = Router();

router.get(
  '/',
  authenticate,
  requireRole('facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.FACILITY_STAFF_READ),
  validate(paginationQuery, 'query'),
  asyncHandler(userController.listUsers)
);

router.post(
  '/',
  authenticate,
  requireRole('facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.FACILITY_STAFF_MANAGE),
  validate(createStaffUserSchema),
  auditLog({
    entity: 'User',
    entityId: (_req, body) => (body as { _id?: string } | undefined)?._id,
    before: async () => null,
    // A hospital admin can only create staff in their own hospital, so the actor's hospital
    // is already correct — except for a platform owner creating cross-tenant staff.
    targetFacility: (_req, body) =>
      (body as { facilityId?: string } | undefined)?.facilityId ?? undefined,
    metadata: (req) => ({ role: (req.body as { role?: string }).role }),
    summary: (req) => `Created staff account with role ${(req.body as { role?: string }).role ?? 'unknown'}`,
  }),
  asyncHandler(userController.createStaffUser)
);

router.get('/:id', authenticate, validateObjectId('id'), asyncHandler(userController.getUser));

router.put(
  '/:id',
  authenticate,
  requireRole('facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.FACILITY_STAFF_MANAGE),
  validateObjectId('id'),
  validate(userUpdateSchema),
  auditLog({
    entity: 'User',
    entityId: (req) => req.params.id,
    before: async (req) => User.findById(req.params.id).select('-passwordHash').lean(),
    // Privilege escalation is the change an auditor searches for; it is called out explicitly
    // so it is queryable instead of having to diff two user documents by eye.
    metadata: (_req, { before, body }) => {
      const from = (before as { role?: string } | undefined)?.role;
      const to = (body as { role?: string } | undefined)?.role;
      const previousFacility = (before as { facilityId?: unknown } | undefined)?.facilityId;
      const nextFacility = (body as { facilityId?: unknown } | undefined)?.facilityId;
      const changed: Record<string, unknown> = {};
      if (from && to && from !== to) changed.roleChanged = { from, to };
      if (previousFacility && nextFacility && String(previousFacility) !== String(nextFacility)) {
        changed.facilityChanged = { from: previousFacility, to: nextFacility };
      }
      return changed;
    },
    summary: (_req, { before, body }) => {
      const from = (before as { role?: string } | undefined)?.role;
      const to = (body as { role?: string } | undefined)?.role;
      if (from && to && from !== to) return `Role escalated: ${from} to ${to}`;
      return 'Staff account updated';
    },
  }),
  asyncHandler(userController.updateUser)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.FACILITY_STAFF_MANAGE),
  validateObjectId('id'),
  auditLog({
    entity: 'User',
    entityId: (req) => req.params.id,
    before: async (req) => User.findById(req.params.id).select('-passwordHash').lean(),
    metadata: (_req, { before }) => ({
      roleAtDeletion: (before as { role?: string } | undefined)?.role,
    }),
    summary: 'Staff account deleted',
  }),
  asyncHandler(userController.deleteUser)
);

export default router;
