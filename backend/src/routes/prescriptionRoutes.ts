import { Router } from 'express';
import * as ctrl from '../controllers/prescriptionController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { prescriptionSchema, paginationQuery } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * POST /api/prescriptions
 * Doctor creates a prescription, with allergy checking.
 */
router.post(
  '/',
  authenticate,
  requireRole('doctor'),
  requirePermission(PERMISSIONS.PRESCRIPTIONS_WRITE),
  validate(prescriptionSchema),
  auditLog({ entity: 'Prescription', entityId: () => undefined }),
  asyncHandler(ctrl.createPrescription)
);

/**
 * GET /api/prescriptions
 * List prescriptions scoped by role.
 */
router.get(
  '/',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'doctor', 'pharmacist', 'patient', 'nurse'),
  validate(paginationQuery, 'query'),
  asyncHandler(ctrl.listPrescriptions)
);

/**
 * GET /api/prescriptions/:id
 */
router.get(
  '/:id',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'doctor', 'pharmacist', 'patient', 'nurse'),
  validateObjectId('id'),
  asyncHandler(ctrl.getPrescription)
);

/**
 * GET /api/prescriptions/:id/pdf
 * Returns an HTML prescription document (print-to-PDF).
 */
router.get(
  '/:id/pdf',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'doctor', 'pharmacist', 'patient', 'nurse'),
  validateObjectId('id'),
  asyncHandler(ctrl.getPrescriptionPdf)
);

export default router;
