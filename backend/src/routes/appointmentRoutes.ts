import { Router } from 'express';
import * as appointmentController from '../controllers/appointmentController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission, requireAnyPermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { verifySmsSignature } from '../middleware/smsWebhook';
import {
  appointmentSchema,
  appointmentUpdateSchema,
  appointmentStatusSchema,
  paginationQuery,
} from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { Appointment } from '../models';

const router = Router();

router.get(
  '/',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist', 'doctor', 'patient', 'nurse'),
  requireAnyPermission(PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.SELF_APPOINTMENTS),
  validate(paginationQuery, 'query'),
  asyncHandler(appointmentController.listAppointments)
);

router.post(
  '/sms',
  // The gateway has no account with us, so the signature is the only thing that establishes
  // the request came from the provider. It must run before any handler and before any parsing
  // that would trust the payload.
  verifySmsSignature,
  asyncHandler(appointmentController.smsWebhook)
);

router.post(
  '/',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist', 'doctor', 'patient'),
  requireAnyPermission(PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.SELF_APPOINTMENTS),
  validate(appointmentSchema),
  auditLog({
    entity: 'Appointment',
    entityId: () => undefined,
    before: async () => null,
  }),
  asyncHandler(appointmentController.createAppointment)
);

router.get('/:id', authenticate, validateObjectId('id'), asyncHandler(appointmentController.getAppointment));

router.put(
  '/:id',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist', 'patient'),
  requireAnyPermission(PERMISSIONS.APPOINTMENTS_UPDATE, PERMISSIONS.SELF_APPOINTMENTS),
  validateObjectId('id'),
  validate(appointmentUpdateSchema),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
  }),
  asyncHandler(appointmentController.updateAppointment)
);

router.patch(
  '/:id/status',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist', 'doctor'),
  requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE),
  validateObjectId('id'),
  validate(appointmentStatusSchema),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
  }),
  asyncHandler(appointmentController.updateStatus)
);

router.post(
  '/:id/check-in',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist'),
  requirePermission(PERMISSIONS.APPOINTMENTS_CHECKIN),
  validateObjectId('id'),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
  }),
  asyncHandler(appointmentController.checkIn)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist', 'patient'),
  requireAnyPermission(PERMISSIONS.APPOINTMENTS_CANCEL, PERMISSIONS.SELF_APPOINTMENTS),
  validateObjectId('id'),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
  }),
  asyncHandler(appointmentController.cancelAppointment)
);

export default router;
