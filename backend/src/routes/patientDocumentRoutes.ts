import { Router } from 'express';
import * as ctrl from '../controllers/patientDocumentController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission, requireAnyPermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { patientDocumentSchema, paginationQuery } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * GET /api/patient-documents
 * List documents (patient-scoped for patients, facility-scoped for staff).
 */
router.get(
  '/',
  authenticate,
  requireRole('patient', 'receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'insurance_verifier', 'auditor', 'super_admin'),
  requireAnyPermission(PERMISSIONS.DOCUMENTS_VIEW, PERMISSIONS.SELF_DOCUMENTS),
  validate(paginationQuery, 'query'),
  asyncHandler(ctrl.listPatientDocuments)
);

/**
 * GET /api/patient-documents/:id
 */
router.get(
  '/:id',
  authenticate,
  requireRole('patient', 'receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'insurance_verifier', 'auditor', 'super_admin'),
  requireAnyPermission(PERMISSIONS.DOCUMENTS_VIEW, PERMISSIONS.SELF_DOCUMENTS),
  validateObjectId('id'),
  asyncHandler(ctrl.getPatientDocument)
);

/**
 * POST /api/patient-documents
 * Staff attach a document to a patient's record.
 */
router.post(
  '/',
  authenticate,
  requireRole('receptionist', 'nurse', 'doctor', 'lab_technician', 'pharmacist', 'facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.DOCUMENTS_UPLOAD),
  validate(patientDocumentSchema),
  auditLog({ entity: 'PatientDocument', entityId: () => undefined }),
  asyncHandler(ctrl.createPatientDocument)
);

export default router;