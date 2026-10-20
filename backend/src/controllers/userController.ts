import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models';
import { success, paginate } from '../utils/apiResponse';
import { AppError, badRequest } from '../utils/AppError';
import { hashPassword } from '../utils/password';
import {
  assertCanAssignRole,
  assertCanManageUser,
  assertFacilityAccess,
  canonicalRole,
  hasRole,
  isSuperAdmin,
  resolveAssignmentTarget,
  ROLE_FACILITY_ADMIN,
  ROLE_SUPER_ADMIN,
  tenantFilter,
} from '../utils/tenancy';

const PUBLIC_FIELDS = '-passwordHash';

/** Fields a caller may never set directly, regardless of their role. */
const PROTECTED_FIELDS = [
  '_id',
  'id',
  'password',
  'passwordHash',
  'emailVerifiedAt',
  'phoneVerifiedAt',
  'lastLoginAt',
  'createdAt',
  'updatedAt',
] as const;

export async function listUsers(req: AuthRequest, res: Response) {
  const page = parseInt(String(req.query.page ?? '1'), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
  // `tenantFilter` rejects a `facilityId` naming another hospital rather than honouring
  // it, so a hospital admin cannot widen the listing with a query parameter.
  const filter: Record<string, unknown> = { ...tenantFilter(req, req.query.facilityId) };
  if (req.query.role) filter.role = canonicalRole(String(req.query.role));
  if (req.query.status) filter.status = req.query.status;

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select(PUBLIC_FIELDS)
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();
  success(res, 200, users, paginate(page, limit, total));
}

export async function getUser(req: AuthRequest, res: Response) {
  const user = await User.findById(req.params.id).select(PUBLIC_FIELDS).lean();
  if (!user) throw new AppError(404, 'User not found');

  // Hospital staff may only read accounts inside their own hospital. Accounts with no
  // hospital (self-registered patients) are not readable by hospital staff.
  assertFacilityAccess(req, user.facilityId);

  success(res, 200, user);
}

export async function createStaffUser(req: AuthRequest, res: Response) {
  const body = req.body as {
    fullName: string;
    email: string;
    phone?: string;
    nationalId?: string;
    password: string;
    role: string;
    preferredLanguage?: string;
    facilityId?: string;
  };

  if (!hasRole(req.user, ROLE_SUPER_ADMIN, ROLE_FACILITY_ADMIN)) {
    throw new AppError(403, 'Forbidden');
  }

  // Blocks a hospital admin from minting a platform admin or a peer hospital admin.
  assertCanAssignRole(req, body.role);

  const facilityId = resolveAssignmentTarget(req, body.facilityId);

  const existing = await User.findOne({
    $or: [
      { email: body.email.toLowerCase() },
      ...(body.phone ? [{ phone: body.phone }] : []),
      ...(body.nationalId ? [{ nationalId: body.nationalId }] : []),
    ],
  });
  if (existing) throw new AppError(409, 'A user with that email/phone/national ID already exists');

  const user = await User.create({
    fullName: body.fullName,
    email: body.email.toLowerCase(),
    phone: body.phone,
    nationalId: body.nationalId,
    passwordHash: await hashPassword(body.password),
    role: canonicalRole(body.role),
    facilityId,
    preferredLanguage: body.preferredLanguage ?? 'en',
  });

  // Re-read through the public projection so the password hash is never returned.
  const created = await User.findById(user._id).select(PUBLIC_FIELDS).lean();
  success(res, 201, created);
}

export async function updateUser(req: AuthRequest, res: Response) {
  const existing = await User.findById(req.params.id);
  if (!existing) throw new AppError(404, 'User not found');

  assertCanManageUser(req, existing);

  const updates: Record<string, unknown> = { ...req.body };
  for (const field of PROTECTED_FIELDS) delete updates[field];

  // Role changes and hospital moves are platform-level operations. A hospital admin may
  // adjust role only within the set it is allowed to grant, and can never move a user to
  // a different hospital.
  if ('role' in updates && updates.role !== existing.role) {
    assertCanAssignRole(req, String(updates.role));
  }
  if ('facilityId' in updates) {
    if (!isSuperAdmin(req.user)) {
      throw new AppError(403, 'Forbidden: only platform admins may move accounts between hospitals');
    }
    const requested = updates.facilityId;
    updates.facilityId = requested === null || requested === '' || requested === undefined
      ? null
      : requested;
  }

  // An empty profile image clears it and falls back to the default avatar.
  if (updates.profileImageUrl === '' || updates.profileImageUrl === null) {
    updates.profileImageUrl = null;
  }

  if ('status' in updates && updates.status === 'inactive') {
    if (String(existing._id) === req.user?.id) {
      throw badRequest('You cannot deactivate your own account');
    }
    if (!isSuperAdmin(req.user) && canonicalRole(String(existing.role)) === ROLE_FACILITY_ADMIN) {
      throw new AppError(403, 'Forbidden: only platform admins may deactivate a hospital admin');
    }
  }

  const updated = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).select(PUBLIC_FIELDS);
  if (!updated) throw new AppError(404, 'User not found');

  success(res, 200, updated);
}

export async function deleteUser(req: AuthRequest, res: Response) {
  const existing = await User.findById(req.params.id);
  if (!existing) throw new AppError(404, 'User not found');

  assertCanManageUser(req, existing);

  if (String(existing._id) === req.user?.id) {
    throw badRequest('You cannot deactivate your own account');
  }

  await User.findByIdAndUpdate(req.params.id, { status: 'inactive' });
  success(res, 200, { message: 'User deactivated' });
}
