import { Router } from 'express';
import * as facilityController from '../controllers/facilityController';
import { authenticate } from '../middleware/auth';
import { requireRole, requireOwnedParam, requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import {
  facilitySchema,
  createFacilityWithAdminSchema,
  updateFacilitySubscriptionSchema,
  paginationQuery,
} from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { Facility } from '../models';

const router = Router();

// `patient` browses the public directory to choose where to book; `super_admin` manages the
// network; `facility_admin` is pinned to its own record. No other role needs the list.
router.get(
  '/',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'patient'),
  validate(paginationQuery, 'query'),
  asyncHandler(facilityController.listFacilities)
);

router.post(
  '/',
  authenticate,
  requireRole('super_admin'),
  requirePermission(PERMISSIONS.PLATFORM_FACILITY_CREATE),
  // Accepts either a bare hospital or a hospital plus its first admin. The optional
  // `admin` block is stripped by `facilitySchema`, so this is the only way to onboard one.
  validate(createFacilityWithAdminSchema),
  auditLog({
    entity: 'Facility',
    entityId: (_req, body) => (body as { _id?: string } | undefined)?._id,
    before: async () => null,
    // A newly created hospital has no id in the request, so it is identified by its own id
    // out of the response. Without this, every hospital-creation entry would be filed under
    // no hospital at all and the trail could not be filtered per tenant.
    targetFacility: (_req, body) => (body as { _id?: string } | undefined)?._id,
    metadata: (req) => ({
      withFirstAdmin: Boolean((req.body as { admin?: unknown })?.admin),
    }),
    summary: (req) => `Registered hospital ${(req.body as { name?: string }).name ?? ''}`.trim(),
  }),
  asyncHandler(facilityController.createFacility)
);

router.get(
  '/:id',
  authenticate,
  requireRole('super_admin', 'facility_admin'),
  // Without this the whole tenant record - subscription status, expiry, hierarchy, who
  // deleted it - was readable by any authenticated caller who guessed or harvested an id.
  requireOwnedParam('id'),
  validateObjectId('id'),
  asyncHandler(facilityController.getFacility)
);

router.get(
  '/:id/staff',
  authenticate,
  requireRole('facility_admin', 'super_admin'),
  requireOwnedParam('id'),
  validateObjectId('id'),
  asyncHandler(facilityController.listFacilityStaff)
);

router.get(
  '/:id/departments',
  authenticate,
  requireRole('facility_admin', 'super_admin'),
  requireOwnedParam('id'),
  validateObjectId('id'),
  asyncHandler(facilityController.listFacilityDepartments)
);

router.get(
  '/:id/doctors',
  authenticate,
  requireRole('facility_admin', 'super_admin'),
  requireOwnedParam('id'),
  validateObjectId('id'),
  asyncHandler(facilityController.listFacilityDoctors)
);

router.get(
  '/:id/stats',
  authenticate,
  requireRole('facility_admin', 'super_admin'),
  requireOwnedParam('id'),
  validateObjectId('id'),
  asyncHandler(facilityController.getFacilityStats)
);

router.put(
  '/:id',
  authenticate,
  requireRole('super_admin'),
  requirePermission(PERMISSIONS.PLATFORM_FACILITY_EDIT),
  validateObjectId('id'),
  validate(facilitySchema.partial()),
  auditLog({
    entity: 'Facility',
    entityId: (req) => req.params.id,
    before: async (req) => Facility.findById(req.params.id).lean(),
    // A platform owner has no hospital of their own, so without this every cross-tenant
    // lifecycle change would be filed under `null` and be unfilterable per hospital.
    targetFacility: (req) => req.params.id,
  }),
  asyncHandler(facilityController.updateFacility)
);

router.patch(
  '/:id/subscription',
  authenticate,
  requireRole('super_admin'),
  requirePermission(PERMISSIONS.PLATFORM_FACILITY_SUBSCRIPTION),
  validateObjectId('id'),
  validate(updateFacilitySubscriptionSchema),
  auditLog({
    entity: 'Facility',
    entityId: (req) => req.params.id,
    before: async (req) => Facility.findById(req.params.id).lean(),
    // A platform owner has no hospital of their own, so without this every cross-tenant
    // lifecycle change would be filed under `null` and be unfilterable per hospital.
    targetFacility: (req) => req.params.id,
    // The subscription drives whether a hospital's staff can work at all, so the new state is
    // the single most audit-relevant fact here — `before`/`after` alone would bury it.
    metadata: (req) => ({
      status: (req.body as { status?: string }).status,
      subscriptionPlan: (req.body as { subscriptionPlan?: string }).subscriptionPlan,
      subscriptionEndDate: (req.body as { subscriptionEndDate?: string }).subscriptionEndDate,
    }),
    summary: (req) => `Subscription set to ${(req.body as { status?: string }).status ?? 'unknown'}`,
  }),
  asyncHandler(facilityController.updateSubscription)
);

router.patch(
  '/:id/activate',
  authenticate,
  requireRole('super_admin'),
  requirePermission(PERMISSIONS.PLATFORM_FACILITY_SUBSCRIPTION),
  validateObjectId('id'),
  auditLog({
    entity: 'Facility',
    entityId: (req) => req.params.id,
    before: async (req) => Facility.findById(req.params.id).lean(),
    // A platform owner has no hospital of their own, so without this every cross-tenant
    // lifecycle change would be filed under `null` and be unfilterable per hospital.
    targetFacility: (req) => req.params.id,
    summary: 'Hospital deactivated',
  }),
  asyncHandler(facilityController.activateFacility)
);

router.patch(
  '/:id/deactivate',
  authenticate,
  requireRole('super_admin'),
  requirePermission(PERMISSIONS.PLATFORM_FACILITY_SUBSCRIPTION),
  validateObjectId('id'),
  auditLog({
    entity: 'Facility',
    entityId: (req) => req.params.id,
    before: async (req) => Facility.findById(req.params.id).lean(),
    // A platform owner has no hospital of their own, so without this every cross-tenant
    // lifecycle change would be filed under `null` and be unfilterable per hospital.
    targetFacility: (req) => req.params.id,
    summary: 'Hospital deactivated',
  }),
  asyncHandler(facilityController.deactivateFacility)
);

/**
 * Soft delete. Rows are retained so tenant history stays referentially intact, and staff
 * accounts are suspended; `restore` reverses both.
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('super_admin'),
  requirePermission(PERMISSIONS.PLATFORM_FACILITY_DELETE),
  validateObjectId('id'),
  auditLog({
    entity: 'Facility',
    entityId: (req) => req.params.id,
    before: async (req) => Facility.findById(req.params.id).lean(),
    // A platform owner has no hospital of their own, so without this every cross-tenant
    // lifecycle change would be filed under `null` and be unfilterable per hospital.
    targetFacility: (req) => req.params.id,
    summary: 'Hospital soft deleted; staff suspended',
  }),
  asyncHandler(facilityController.deleteFacility)
);

router.post(
  '/:id/restore',
  authenticate,
  requireRole('super_admin'),
  requirePermission(PERMISSIONS.PLATFORM_FACILITY_RESTORE),
  validateObjectId('id'),
  auditLog({
    entity: 'Facility',
    entityId: (req) => req.params.id,
    before: async (req) => Facility.findById(req.params.id).lean(),
    // A platform owner has no hospital of their own, so without this every cross-tenant
    // lifecycle change would be filed under `null` and be unfilterable per hospital.
    targetFacility: (req) => req.params.id,
    summary: 'Hospital restored',
  }),
  asyncHandler(facilityController.restoreFacility)
);

export default router;
