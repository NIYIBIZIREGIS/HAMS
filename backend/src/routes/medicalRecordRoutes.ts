import { Router } from 'express';
import * as ctrl from '../controllers/medicalRecordController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import {
  medicalRecordSchema,
  medicalRecordUpdateSchema,
  patientIdQuery,
} from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { MedicalRecord } from '../models';

const router = Router();

/**
 * POST /api/medical-records
 * Doctor creates a consultation record; nurse creates vitals-only preliminary record.
 */
router.post(
  '/',
  authenticate,
  requireRole('doctor', 'nurse'),
  requirePermission(PERMISSIONS.RECORDS_WRITE),
  validate(medicalRecordSchema),
  auditLog({ entity: 'MedicalRecord', entityId: () => undefined }),
  asyncHandler(ctrl.createMedicalRecord)
);

/**
 * GET /api/medical-records/by-appointment/:appointmentId
 * Fetch the record tied to an appointment.
 */
router.get(
  '/by-appointment/:appointmentId',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'doctor', 'nurse', 'patient', 'receptionist'),
  validateObjectId('appointmentId'),
  asyncHandler(ctrl.getRecordByAppointment)
);

/**
 * GET /api/medical-records/:patientId/timeline
 * Records, prescriptions and lab results as one reverse-chronological feed.
 * Declared before `/:patientId` so `timeline` is not read as an id.
 */
router.get(
  '/:patientId/timeline',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'doctor', 'nurse', 'patient', 'receptionist'),
  validateObjectId('patientId'),
  validate(patientIdQuery, 'query'),
  asyncHandler(ctrl.getPatientTimeline)
);

/**
 * GET /api/medical-records/:patientId
 * Paginated medical history for a patient.
 */
router.get(
  '/:patientId',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'doctor', 'nurse', 'patient', 'receptionist'),
  validateObjectId('patientId'),
  validate(patientIdQuery, 'query'),
  asyncHandler(ctrl.getPatientRecords)
);

/**
 * PUT /api/medical-records/:id
 * Doctor updates their own record; facility_admin/super_admin can update any.
 */
router.put(
  '/:id',
  authenticate,
  requireRole('doctor', 'facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.RECORDS_WRITE),
  validateObjectId('id'),
  validate(medicalRecordUpdateSchema),
  auditLog({
    entity: 'MedicalRecord',
    entityId: (req) => req.params.id,
    before: async (req) => MedicalRecord.findById(req.params.id).lean(),
  }),
  asyncHandler(ctrl.updateMedicalRecord)
);

export default router;
