import { Router } from 'express';
import * as ctrl from '../controllers/messageController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission, requireAnyPermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { messageSchema, replySchema, paginationQuery } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * GET /api/messages
 * List messages (patient-scoped for patients, facility-scoped for staff).
 */
router.get(
  '/',
  authenticate,
  requireRole('patient', 'receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'insurance_verifier', 'auditor', 'super_admin'),
  requireAnyPermission(PERMISSIONS.MESSAGES_SEND, PERMISSIONS.SELF_MESSAGES),
  validate(paginationQuery, 'query'),
  asyncHandler(ctrl.listMessages)
);

/**
 * GET /api/messages/threads
 * One row per conversation, newest activity first, with the caller's unread count.
 * Declared before `/:id` so the literal path is not captured as an id.
 */
router.get(
  '/threads',
  authenticate,
  requireRole('patient', 'receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'insurance_verifier', 'auditor', 'super_admin'),
  requireAnyPermission(PERMISSIONS.MESSAGES_SEND, PERMISSIONS.SELF_MESSAGES),
  validate(paginationQuery, 'query'),
  asyncHandler(ctrl.listThreads)
);

/**
 * GET /api/messages/threads/:threadId
 * Full conversation, oldest first. Opening it marks the caller's side as read.
 */
router.get(
  '/threads/:threadId',
  authenticate,
  requireRole('patient', 'receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'insurance_verifier', 'auditor', 'super_admin'),
  requireAnyPermission(PERMISSIONS.MESSAGES_SEND, PERMISSIONS.SELF_MESSAGES),
  validateObjectId('threadId'),
  asyncHandler(ctrl.getThread)
);

/**
 * POST /api/messages/threads/:threadId/replies
 * Append to a conversation. Patients answer hospital mail here.
 *
 * `auditor` is deliberately excluded even though it holds MESSAGES_SEND: reading a thread for
 * an audit is legitimate, posting into a patient's conversation with the hospital is not.
 */
router.post(
  '/threads/:threadId/replies',
  authenticate,
  requireRole('patient', 'receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'super_admin'),
  requireAnyPermission(PERMISSIONS.MESSAGES_SEND, PERMISSIONS.SELF_MESSAGES),
  validateObjectId('threadId'),
  validate(replySchema),
  auditLog({ entity: 'Message', entityId: () => undefined }),
  asyncHandler(ctrl.replyToThread)
);

/**
 * GET /api/messages/:id
 */
router.get(
  '/:id',
  authenticate,
  requireRole('patient', 'receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'insurance_verifier', 'auditor', 'super_admin'),
  requireAnyPermission(PERMISSIONS.MESSAGES_SEND, PERMISSIONS.SELF_MESSAGES),
  validateObjectId('id'),
  asyncHandler(ctrl.getMessage)
);

/**
 * POST /api/messages
 * Facility staff send a message to a patient.
 */
router.post(
  '/',
  authenticate,
  requireRole('receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.MESSAGES_SEND),
  validate(messageSchema),
  auditLog({ entity: 'Message', entityId: () => undefined }),
  asyncHandler(ctrl.createMessage)
);

/**
 * PATCH /api/messages/:id/read
 * Mark a message as read (patient marks their own).
 */
router.patch(
  '/:id/read',
  authenticate,
  requireRole('patient', 'receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'super_admin'),
  requireAnyPermission(PERMISSIONS.MESSAGES_SEND, PERMISSIONS.SELF_MESSAGES),
  validateObjectId('id'),
  asyncHandler(ctrl.markMessageRead)
);

export default router;