import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Department } from '../models';
import { success, paginate } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import {
  assertFacilityAccess,
  hasRole,
  resolveAssignmentTarget,
  tenantFilter,
  toObjectId,
  ROLE_FACILITY_ADMIN,
  ROLE_PATIENT,
  ROLE_SUPER_ADMIN,
} from '../utils/tenancy';

export async function listDepartments(req: AuthRequest, res: Response) {
  const page = parseInt(String(req.query.page ?? '1'), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
  const filter: Record<string, unknown> = {};

  if (hasRole(req.user, ROLE_PATIENT) && !hasRole(req.user, ROLE_FACILITY_ADMIN, ROLE_SUPER_ADMIN)) {
    // Patients browse departments to find where to book; they may narrow to a hospital.
    if (req.query.facilityId) {
      filter.facilityId = toObjectId(req.query.facilityId);
    }
  } else {
    Object.assign(filter, tenantFilter(req, req.query.facilityId));
  }

  const total = await Department.countDocuments(filter);
  const departments = await Department.find(filter)
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ name: 1 })
    .lean();
  success(res, 200, departments, paginate(page, limit, total));
}

export async function getDepartment(req: AuthRequest, res: Response) {
  const department = await Department.findById(req.params.id).lean();
  if (!department) throw new AppError(404, 'Department not found');

  if (hasRole(req.user, ROLE_PATIENT) && !hasRole(req.user, ROLE_FACILITY_ADMIN, ROLE_SUPER_ADMIN)) {
    // Directory read, needed to book.
  } else {
    assertFacilityAccess(req, department.facilityId);
  }

  success(res, 200, department);
}

export async function createDepartment(req: AuthRequest, res: Response) {
  const body = req.body as Record<string, unknown>;
  const facilityId = resolveAssignmentTarget(req, body.facilityId);

  const updates = { ...body };
  delete updates.facilityId;

  const department = await Department.create({ ...updates, facilityId });
  success(res, 201, department);
}

export async function updateDepartment(req: AuthRequest, res: Response) {
  const department = await Department.findById(req.params.id);
  if (!department) throw new AppError(404, 'Department not found');
  assertFacilityAccess(req, department.facilityId);

  const updates: Record<string, unknown> = { ...req.body };
  // A department cannot be moved between hospitals through this endpoint.
  delete updates.facilityId;
  delete updates._id;
  delete updates.id;

  const updated = await Department.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  success(res, 200, updated);
}

export async function deleteDepartment(req: AuthRequest, res: Response) {
  const department = await Department.findById(req.params.id);
  if (!department) throw new AppError(404, 'Department not found');
  assertFacilityAccess(req, department.facilityId);
  await department.deleteOne();
  success(res, 200, { message: 'Department deleted' });
}
