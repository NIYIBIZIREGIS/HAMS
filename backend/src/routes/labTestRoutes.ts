import { Router } from 'express';
import * as ctrl from '../controllers/labTestController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { labTestSchema, labTestResultSchema, paginationQuery } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { LaboratoryTest } from '../models';

const router = Router();

/**
 * POST /api/lab-tests
 * Doctor requests a lab test.
 */
router.post(
  '/',
  authenticate,
  requireRole('doctor'),
  requirePermission(PERMISSIONS.LAB_ORDER),
  validate(labTestSchema),
  auditLog({ entity: 'LaboratoryTest', entityId: () => undefined }),
  asyncHandler(ctrl.createLabTest)
);

/**
 * GET /api/lab-tests
 * List tests, scoped by role.
 */
router.get(
  '/',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'doctor', 'lab_technician', 'nurse', 'patient'),
  validate(paginationQuery, 'query'),
  asyncHandler(ctrl.listLabTests)
);

/**
 * GET /api/lab-tests/:id
 */
router.get(
  '/:id',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'doctor', 'lab_technician', 'nurse', 'patient'),
  validateObjectId('id'),
  asyncHandler(ctrl.getLabTest)
);

/**
 * PUT /api/lab-tests/:id
 * Lab technician enters results and updates status.
 */
router.put(
  '/:id',
  authenticate,
  requireRole('lab_technician', 'facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.LAB_RESULTS_WRITE),
  validateObjectId('id'),
  validate(labTestResultSchema),
  auditLog({
    entity: 'LaboratoryTest',
    entityId: (req) => req.params.id,
    before: async (req) => LaboratoryTest.findById(req.params.id).lean(),
  }),
  asyncHandler(ctrl.updateLabTest)
);

export default router;
