import { Router } from 'express';
import * as auditLogController from '../controllers/auditLogController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/rbac';
import { validateObjectId } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { PERMISSIONS } from '../utils/permissions';

const router = Router();

/**
 * Read-only by design. Nothing in this file mutates the audit collection: an auditor who could
 * edit or delete entries could remove their own tracks, which would defeat the point of having
 * them. The trail is written only by the `auditLog` middleware on the routes it protects.
 */
router.get(
  '/',
  authenticate,
  requireRole('auditor', 'facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  asyncHandler(auditLogController.listAuditLogs)
);

router.get(
  '/:id',
  authenticate,
  requireRole('auditor', 'facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  validateObjectId('id'),
  asyncHandler(auditLogController.getAuditLog)
);

export default router;
