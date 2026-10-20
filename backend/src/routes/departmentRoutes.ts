import { Router } from 'express';
import * as departmentController from '../controllers/departmentController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { departmentSchema, paginationQuery } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { Department } from '../models';

const router = Router();

router.get(
  '/',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist', 'doctor', 'patient'),
  validate(paginationQuery, 'query'),
  asyncHandler(departmentController.listDepartments)
);

router.post(
  '/',
  authenticate,
  requireRole('facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.FACILITY_DEPARTMENT_MANAGE),
  validate(departmentSchema),
  auditLog({
    entity: 'Department',
    entityId: () => undefined,
    before: async () => null,
  }),
  asyncHandler(departmentController.createDepartment)
);

router.get('/:id', authenticate, validateObjectId('id'), asyncHandler(departmentController.getDepartment));

router.put(
  '/:id',
  authenticate,
  requireRole('facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.FACILITY_DEPARTMENT_MANAGE),
  validateObjectId('id'),
  validate(departmentSchema.partial()),
  auditLog({
    entity: 'Department',
    entityId: (req) => req.params.id,
    before: async (req) => Department.findById(req.params.id).lean(),
  }),
  asyncHandler(departmentController.updateDepartment)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('facility_admin', 'super_admin'),
  requirePermission(PERMISSIONS.FACILITY_DEPARTMENT_MANAGE),
  validateObjectId('id'),
  auditLog({
    entity: 'Department',
    entityId: (req) => req.params.id,
    before: async (req) => Department.findById(req.params.id).lean(),
  }),
  asyncHandler(departmentController.deleteDepartment)
);

export default router;
