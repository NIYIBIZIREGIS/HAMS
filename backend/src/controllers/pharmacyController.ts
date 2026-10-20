import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PharmacyInventory, PharmacyDispense, Prescription } from '../models';
import { success, paginate } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import {
  assertFacilityAccess,
  resolveAssignmentTarget,
  tenantFilter,
  toObjectId,
} from '../utils/tenancy';

/**
 * GET /api/pharmacy/inventory
 * List pharmacy inventory for the facility.
 */
export async function listInventory(req: AuthRequest, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));

  const filter: Record<string, unknown> = { ...tenantFilter(req) };

  if (req.query.search) {
    filter.drugName = { $regex: req.query.search, $options: 'i' };
  }
  if (req.query.form) {
    filter.form = req.query.form;
  }
  if (req.query.lowStock === 'true') {
    filter.$expr = { $lte: ['$quantityOnHand', '$reorderThreshold'] };
  }

  const total = await PharmacyInventory.countDocuments(filter);
  const items = await PharmacyInventory.find(filter)
    .sort({ drugName: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  success(res, 200, items, paginate(page, limit, total));
}

/**
 * POST /api/pharmacy/inventory
 * Add a new inventory item.
 */
export async function createInventoryItem(req: AuthRequest, res: Response) {
  const body = req.body as {
    drugName: string;
    form?: string;
    strength?: string;
    batchNumber?: string;
    expiryDate: string;
    quantityOnHand?: number;
    reorderThreshold?: number;
    unitCost?: number;
    facilityId?: string;
  };

  // Pins a hospital admin to their own hospital and requires a platform admin to name one.
  const facilityId = resolveAssignmentTarget(req, body.facilityId);

  const item = await PharmacyInventory.create({
    facilityId,
    drugName: body.drugName,
    form: body.form ?? 'tablet',
    strength: body.strength ?? '',
    batchNumber: body.batchNumber ?? '',
    expiryDate: new Date(body.expiryDate),
    quantityOnHand: body.quantityOnHand ?? 0,
    reorderThreshold: body.reorderThreshold ?? 10,
    unitCost: body.unitCost ?? 0,
  });

  success(res, 201, item);
}

/**
 * PUT /api/pharmacy/inventory/:id
 * Update an inventory item.
 */
export async function updateInventoryItem(req: AuthRequest, res: Response) {
  const item = await PharmacyInventory.findById(req.params.id);
  if (!item) throw new AppError(404, 'Inventory item not found');
  assertFacilityAccess(req, item.facilityId);

  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  const allowed = ['drugName', 'form', 'strength', 'batchNumber', 'expiryDate', 'quantityOnHand', 'reorderThreshold', 'unitCost'];
  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates[key] = key === 'expiryDate' ? new Date(body[key] as string) : body[key];
    }
  }

  const updated = await PharmacyInventory.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  success(res, 200, updated);
}

/**
 * POST /api/pharmacy/dispense
 * Dispense medication from inventory. Atomically decrements stock.
 */
export async function dispenseMedication(req: AuthRequest, res: Response) {
  const body = req.body as {
    prescriptionId: string;
    inventoryId: string;
    quantity: number;
    notes?: string;
  };

  const prescription = await Prescription.findById(body.prescriptionId);
  if (!prescription) throw new AppError(404, 'Prescription not found');

  // The prescription, the stock item and the caller must all belong to the same hospital.
  // Deriving the hospital from the prescription and then trusting it (as this handler
  // previously did) let a pharmacist decrement another hospital's stock by id.
  assertFacilityAccess(req, prescription.facilityId);

  const item = await PharmacyInventory.findById(body.inventoryId);
  if (!item) throw new AppError(404, 'Inventory item not found');
  assertFacilityAccess(req, item.facilityId);

  const facilityId = prescription.facilityId;

  // Atomic decrement scoped to the caller's own hospital — prevents race conditions and
  // stops a cross-tenant stock write even if the checks above are ever loosened.
  const decremented = await PharmacyInventory.findOneAndUpdate(
    { _id: body.inventoryId, facilityId: toObjectId(facilityId), quantityOnHand: { $gte: body.quantity } },
    { $inc: { quantityOnHand: -body.quantity } },
    { new: true },
  );
  if (!decremented) throw new AppError(409, 'Insufficient stock or item not found');

  const dispense = await PharmacyDispense.create({
    prescriptionId: body.prescriptionId,
    inventoryId: body.inventoryId,
    dispensedBy: req.user?.id,
    facilityId,
    quantity: body.quantity,
    notes: body.notes ?? '',
    dispensedAt: new Date(),
  });

  // Notify if stock is now low
  if (decremented.quantityOnHand <= decremented.reorderThreshold) {
    void notifyLowStockStub(String(decremented._id), decremented.drugName, decremented.quantityOnHand);
  }

  success(res, 201, { dispense, remainingStock: decremented.quantityOnHand });
}

/**
 * GET /api/pharmacy/low-stock
 * Items at or below reorder threshold.
 */
export async function listLowStock(req: AuthRequest, res: Response) {
  const filter: Record<string, unknown> = { ...tenantFilter(req) };
  filter.$expr = { $lte: ['$quantityOnHand', '$reorderThreshold'] };

  const items = await PharmacyInventory.find(filter).sort({ quantityOnHand: 1 }).lean();
  success(res, 200, items);
}

/**
 * GET /api/pharmacy/pending-prescriptions
 * Prescriptions not yet fully dispensed.
 */
export async function listPendingPrescriptions(req: AuthRequest, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));

  // Without this scope the endpoint returned every hospital's prescriptions along with
  // their populated medical records (diagnosis, notes, vitals).
  const filter: Record<string, unknown> = { ...tenantFilter(req) };

  // Only sum dispenses belonging to the same scope, otherwise the totals mix hospitals.
  const dispensedAgg = await PharmacyDispense.aggregate([
    { $match: filter },
    { $group: { _id: '$prescriptionId', totalDispensed: { $sum: '$quantity' } } },
  ]);
  const dispensedMap = new Map(dispensedAgg.map((d) => [String(d._id), d.totalDispensed]));

  // Get prescriptions and calculate pending
  const prescriptions = await Prescription.find(filter)
    .populate('medicalRecordId')
    .sort({ issuedAt: -1 })
    .lean();

  const pending = prescriptions.filter((p) => {
    const dispensed = dispensedMap.get(String(p._id)) ?? 0;
    const totalRequired = (p.medicines as Array<{ durationDays: number }>).reduce(
      (sum, m) => sum + (m.durationDays || 1),
      0,
    );
    return dispensed < totalRequired;
  });

  const total = pending.length;
  const paginated = pending.slice((page - 1) * limit, page * limit);

  success(res, 200, paginated, paginate(page, limit, total));
}

/**
 * POST /api/pharmacy/write-off
 * Write off expired or damaged stock.
 */
export async function writeOffStock(req: AuthRequest, res: Response) {
  const body = req.body as {
    inventoryId: string;
    quantity: number;
    reason: string;
  };

  const item = await PharmacyInventory.findById(body.inventoryId);
  if (!item) throw new AppError(404, 'Inventory item not found');
  assertFacilityAccess(req, item.facilityId);

  if (item.quantityOnHand < body.quantity) {
    throw new AppError(409, `Insufficient stock. Available: ${item.quantityOnHand}`);
  }

  const updated = await PharmacyInventory.findByIdAndUpdate(
    body.inventoryId,
    { $inc: { quantityOnHand: -body.quantity } },
    { new: true },
  );

  // Create an audit-style dispense record for write-off tracking
  await PharmacyDispense.create({
    prescriptionId: item._id, // reference the inventory item
    inventoryId: item._id,
    dispensedBy: req.user?.id,
    facilityId: item.facilityId,
    quantity: body.quantity,
    notes: `[WRITE-OFF] ${body.reason}`,
    dispensedAt: new Date(),
  });

  void notifyWriteOffStub(String(item._id), item.drugName, body.quantity, body.reason);

  success(res, 200, { item: updated, message: `Wrote off ${body.quantity} units of ${item.drugName}` });
}

// ── stubs (Phase 5 will implement real notifications) ────────────────────────

async function notifyLowStockStub(itemId: string, drugName: string, qty: number) {
  console.log(`[notify-stub] Low stock alert: ${drugName} (${itemId}) — ${qty} remaining`);
}

async function notifyWriteOffStub(itemId: string, drugName: string, qty: number, reason: string) {
  console.log(`[notify-stub] Stock write-off: ${drugName} (${itemId}) — ${qty} units — ${reason}`);
}
