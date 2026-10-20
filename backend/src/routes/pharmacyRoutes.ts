import { Router } from 'express';
import * as ctrl from '../controllers/pharmacyController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import {
  pharmacyInventorySchema,
  pharmacyInventoryUpdateSchema,
  pharmacyDispenseSchema,
  pharmacyWriteOffSchema,
  paginationQuery,
} from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { PharmacyInventory } from '../models';

const router = Router();

/**
 * GET /api/pharmacy/inventory
 * List inventory for the facility.
 */
router.get(
  '/inventory',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'pharmacist'),
  requirePermission(PERMISSIONS.PHARMACY_VIEW),
  validate(paginationQuery, 'query'),
  asyncHandler(ctrl.listInventory),
);

/**
 * POST /api/pharmacy/inventory
 * Add a new inventory item.
 */
router.post(
  '/inventory',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'pharmacist'),
  requirePermission(PERMISSIONS.PHARMACY_INVENTORY),
  validate(pharmacyInventorySchema),
  auditLog({ entity: 'PharmacyInventory', entityId: () => undefined }),
  asyncHandler(ctrl.createInventoryItem),
);

/**
 * PUT /api/pharmacy/inventory/:id
 * Update an inventory item.
 */
router.put(
  '/inventory/:id',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'pharmacist'),
  requirePermission(PERMISSIONS.PHARMACY_INVENTORY),
  validateObjectId('id'),
  validate(pharmacyInventoryUpdateSchema),
  auditLog({
    entity: 'PharmacyInventory',
    entityId: (req) => req.params.id,
    before: async (req) => PharmacyInventory.findById(req.params.id).lean(),
  }),
  asyncHandler(ctrl.updateInventoryItem),
);

/**
 * POST /api/pharmacy/dispense
 * Dispense medication from inventory.
 */
router.post(
  '/dispense',
  authenticate,
  requireRole('pharmacist'),
  requirePermission(PERMISSIONS.PHARMACY_DISPENSE),
  validate(pharmacyDispenseSchema),
  auditLog({ entity: 'PharmacyDispense', entityId: () => undefined }),
  asyncHandler(ctrl.dispenseMedication),
);

/**
 * GET /api/pharmacy/low-stock
 * Items below reorder threshold.
 */
router.get(
  '/low-stock',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'pharmacist'),
  requirePermission(PERMISSIONS.PHARMACY_VIEW),
  asyncHandler(ctrl.listLowStock),
);

/**
 * GET /api/pharmacy/pending-prescriptions
 * Prescriptions pending dispensing.
 */
router.get(
  '/pending-prescriptions',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'pharmacist'),
  requirePermission(PERMISSIONS.PRESCRIPTIONS_VIEW),
  validate(paginationQuery, 'query'),
  asyncHandler(ctrl.listPendingPrescriptions),
);

/**
 * POST /api/pharmacy/write-off
 * Write off expired or damaged stock.
 */
router.post(
  '/write-off',
  authenticate,
  requireRole('pharmacist'),
  requirePermission(PERMISSIONS.PHARMACY_INVENTORY),
  validate(pharmacyWriteOffSchema),
  auditLog({ entity: 'PharmacyInventory', entityId: (req) => (req.body as { inventoryId: string }).inventoryId }),
  asyncHandler(ctrl.writeOffStock),
);

export default router;
