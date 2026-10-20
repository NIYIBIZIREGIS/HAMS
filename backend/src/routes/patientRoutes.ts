import { Router } from 'express';
import * as patientController from '../controllers/patientController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission, requireAnyPermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { registerPatientSchema, patientSchema, patientLookupQuery, paginationQuery } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { Patient, PatientFacility } from '../models';

const router = Router();

router.get(
  '/lookup',
  authenticate,
  requireRole('facility_admin', 'receptionist', 'super_admin'),
  requirePermission(PERMISSIONS.PATIENT_VIEW),
  validate(patientLookupQuery, 'query'),
  asyncHandler(patientController.lookupPatient)
);

router.get(
  '/',
  authenticate,
  requireRole('facility_admin', 'receptionist', 'super_admin', 'doctor', 'nurse'),
  requirePermission(PERMISSIONS.PATIENT_VIEW),
  validate(paginationQuery, 'query'),
  asyncHandler(patientController.listPatients)
);

router.post(
  '/',
  authenticate,
  requireRole('facility_admin', 'receptionist', 'super_admin'),
  requirePermission(PERMISSIONS.PATIENT_CREATE),
  validate(registerPatientSchema),
  auditLog({
    entity: 'Patient',
    entityId: () => undefined,
    before: async () => null,
  }),
  asyncHandler(patientController.createPatient)
);

// Declared ahead of `/:id` so the literal `me` segment is never read as a patient id.
router.get(
  '/me/facilities',
  authenticate,
  requireRole('patient'),
  asyncHandler(patientController.listMyFacilities)
);

// Every hospital a patient belongs to. A clinic that already treats the patient may read
// this, which is why it is `PATIENT_VIEW` rather than a self-records-only grant.
router.get(
  '/:id/facilities',
  authenticate,
  requireRole('facility_admin', 'receptionist', 'super_admin', 'doctor', 'nurse'),
  requirePermission(PERMISSIONS.PATIENT_VIEW),
  validateObjectId('id'),
  asyncHandler(patientController.listPatientFacilities)
);

// Registers the patient at the *caller's own* hospital. No facility is accepted in the body,
// so this cannot be aimed at another tenant. `auditLog` records the actor's own facility as
// `actorFacilityId`, which is the hospital this membership belongs to.
router.post(
  '/:id/facilities',
  authenticate,
  requireRole('facility_admin', 'receptionist', 'super_admin'),
  requirePermission(PERMISSIONS.PATIENT_CREATE),
  validateObjectId('id'),
  auditLog({
    entity: 'Patient',
    entityId: (req) => req.params.id,
    before: async (req) =>
      PatientFacility.find({ patientId: req.params.id }).select('facilityId status isPrimary').lean(),
  }),
  asyncHandler(patientController.registerPatientAtFacility)
);

// Ends the caller's own hospital's membership. The row is kept for audit.
router.delete(
  '/:id/facilities',
  authenticate,
  requireRole('facility_admin', 'receptionist', 'super_admin'),
  requirePermission(PERMISSIONS.PATIENT_UPDATE),
  validateObjectId('id'),
  auditLog({
    entity: 'Patient',
    entityId: (req) => req.params.id,
    before: async (req) =>
      PatientFacility.find({ patientId: req.params.id }).select('facilityId status isPrimary').lean(),
  }),
  asyncHandler(patientController.endPatientFacility)
);

router.get('/:id', authenticate, validateObjectId('id'), asyncHandler(patientController.getPatient));

router.put(
  '/:id',
  authenticate,
  requireRole('facility_admin', 'receptionist', 'super_admin', 'doctor', 'nurse', 'patient'),
  requireAnyPermission(PERMISSIONS.PATIENT_UPDATE, PERMISSIONS.SELF_RECORDS),
  validateObjectId('id'),
  validate(patientSchema.partial()),
  auditLog({
    entity: 'Patient',
    entityId: (req) => req.params.id,
    before: async (req) => Patient.findById(req.params.id).lean(),
  }),
  asyncHandler(patientController.updatePatient)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('facility_admin', 'receptionist', 'super_admin'),
  requirePermission(PERMISSIONS.PATIENT_UPDATE),
  validateObjectId('id'),
  auditLog({
    entity: 'Patient',
    entityId: (req) => req.params.id,
    before: async (req) => Patient.findById(req.params.id).lean(),
  }),
  asyncHandler(patientController.deletePatient)
);

export default router;
