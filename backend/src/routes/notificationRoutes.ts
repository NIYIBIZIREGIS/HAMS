import { Router } from 'express';
import * as ctrl from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission, requireAnyPermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { notificationSchema, paginationQuery } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * GET /api/notifications
 * List notifications (patient-scoped for patients, facility-scoped for staff).
 */
router.get(
  '/',
  authenticate,
  requireRole('patient', 'receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'insurance_verifier', 'auditor', 'super_admin'),
  requireAnyPermission(PERMISSIONS.NOTIFICATIONS_SEND, PERMISSIONS.SELF_NOTIFICATIONS),
  validate(paginationQuery, 'query'),
  asyncHandler(ctrl.listNotifications)
);

/**
 * GET /api/notifications/:id
 */
router.get(
  '/:id',
  authenticate,
  requireRole('patient', 'receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'insurance_verifier', 'auditor', 'super_admin'),
  requireAnyPermission(PERMISSIONS.NOTIFICATIONS_SEND, PERMISSIONS.SELF_NOTIFICATIONS),
  validateObjectId('id'),
  asyncHandler(ctrl.getNotification)
);

/**
 * POST /api/notifications
 * Staff push a notification to a patient.
 */
router.post(
  '/',
  authenticate,
  requireRole('receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.NOTIFICATIONS_SEND),
  validate(notificationSchema),
  auditLog({ entity: 'Notification', entityId: () => undefined }),
  asyncHandler(ctrl.createNotification)
);

/**
 * PATCH /api/notifications/:id/read
 */
router.patch(
  '/:id/read',
  authenticate,
  requireRole('patient', 'receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'super_admin'),
  requireAnyPermission(PERMISSIONS.NOTIFICATIONS_SEND, PERMISSIONS.SELF_NOTIFICATIONS),
  validateObjectId('id'),
  asyncHandler(ctrl.markNotificationRead)
);

/**
 * PATCH /api/notifications/read-all
 * Mark all the caller's notifications as read.
 */
router.patch(
  '/read-all',
  authenticate,
  requireRole('patient', 'receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'super_admin'),
  requireAnyPermission(PERMISSIONS.NOTIFICATIONS_SEND, PERMISSIONS.SELF_NOTIFICATIONS),
  asyncHandler(ctrl.markAllNotificationsRead)
);

export default router;