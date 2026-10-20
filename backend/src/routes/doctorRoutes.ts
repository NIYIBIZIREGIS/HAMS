import { Router } from 'express';
import * as doctorController from '../controllers/doctorController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission, requireAnyPermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import {
  doctorSchema,
  doctorUpdateSchema,
  scheduleSchema,
  leaveSchema,
  availabilityQuery,
  paginationQuery,
} from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { Doctor, DoctorSchedule, DoctorLeave } from '../models';

const router = Router();

router.get(
  '/',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist', 'doctor', 'patient'),
  validate(paginationQuery, 'query'),
  asyncHandler(doctorController.listDoctors)
);

router.get('/:id/availability', authenticate, validateObjectId('id'), validate(availabilityQuery, 'query'), asyncHandler(doctorController.getDoctorAvailability));
router.get('/:id/schedule', authenticate, validateObjectId('id'), asyncHandler(doctorController.getDoctorSchedule));
router.get('/:id', authenticate, validateObjectId('id'), asyncHandler(doctorController.getDoctor));

router.post(
  '/',
  authenticate,
  requireRole('facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.FACILITY_STAFF_MANAGE),
  validate(doctorSchema),
  auditLog({
    entity: 'Doctor',
    entityId: () => undefined,
    before: async () => null,
  }),
  asyncHandler(doctorController.createDoctor)
);

router.put(
  '/:id',
  authenticate,
  requireRole('facility_admin', 'super_admin', 'doctor'),
  requireAnyPermission(PERMISSIONS.FACILITY_STAFF_MANAGE, PERMISSIONS.PROFILE_SELF_MANAGE),
  validateObjectId('id'),
  validate(doctorUpdateSchema),
  auditLog({
    entity: 'Doctor',
    entityId: (req) => req.params.id,
    before: async (req) => Doctor.findById(req.params.id).lean(),
  }),
  asyncHandler(doctorController.updateDoctor)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.FACILITY_STAFF_MANAGE),
  validateObjectId('id'),
  auditLog({
    entity: 'Doctor',
    entityId: (req) => req.params.id,
    before: async (req) => Doctor.findById(req.params.id).lean(),
  }),
  asyncHandler(doctorController.deleteDoctor)
);

router.post(
  '/:id/schedule',
  authenticate,
  requireRole('facility_admin', 'super_admin', 'doctor'),
  requireAnyPermission(PERMISSIONS.FACILITY_STAFF_MANAGE, PERMISSIONS.PROFILE_SELF_MANAGE),
  validateObjectId('id'),
  validate(scheduleSchema),
  auditLog({
    entity: 'DoctorSchedule',
    entityId: () => undefined,
    before: async () => null,
  }),
  asyncHandler(doctorController.upsertSchedule)
);

router.delete(
  '/:id/schedule/:scheduleId',
  authenticate,
  requireRole('facility_admin', 'super_admin', 'doctor'),
  requireAnyPermission(PERMISSIONS.FACILITY_STAFF_MANAGE, PERMISSIONS.PROFILE_SELF_MANAGE),
  validateObjectId('id'),
  validateObjectId('scheduleId'),
  auditLog({
    entity: 'DoctorSchedule',
    entityId: (req) => req.params.scheduleId,
    before: async (req) => DoctorSchedule.findById(req.params.scheduleId).lean(),
  }),
  asyncHandler(doctorController.deleteSchedule)
);

router.post(
  '/:id/leaves',
  authenticate,
  requireRole('facility_admin', 'super_admin', 'doctor'),
  requireAnyPermission(PERMISSIONS.FACILITY_STAFF_MANAGE, PERMISSIONS.PROFILE_SELF_MANAGE),
  validateObjectId('id'),
  validate(leaveSchema),
  auditLog({
    entity: 'DoctorLeave',
    entityId: () => undefined,
    before: async () => null,
  }),
  asyncHandler(doctorController.createLeave)
);

router.delete(
  '/:id/leaves/:leaveId',
  authenticate,
  requireRole('facility_admin', 'super_admin', 'doctor'),
  requireAnyPermission(PERMISSIONS.FACILITY_STAFF_MANAGE, PERMISSIONS.PROFILE_SELF_MANAGE),
  validateObjectId('id'),
  validateObjectId('leaveId'),
  auditLog({
    entity: 'DoctorLeave',
    entityId: (req) => req.params.leaveId,
    before: async (req) => DoctorLeave.findById(req.params.leaveId).lean(),
  }),
  asyncHandler(doctorController.deleteLeave)
);

export default router;
