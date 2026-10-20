import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Facility, Department, Doctor, Appointment, User, Patient } from '../models';
import { success, paginate } from '../utils/apiResponse';
import { AppError, forbidden } from '../utils/AppError';
import { generateTemporaryPassword, hashPassword } from '../utils/password';
import { isSuperAdmin, isTenantScoped, toObjectId } from '../utils/tenancy';

/** Fields the platform owner may edit on a hospital profile. */
const EDITABLE_FIELDS = [
  'name',
  'type',
  'region',
  'district',
  'address',
  'geoLocation',
  'contactInfo',
  'operatingHours',
  'logo',
  'parentFacilityId',
] as const;

/**
 * Loads a hospital that has not been deleted.
 *
 * A deleted hospital still exists in the database, so every read path has to exclude it
 * explicitly or removed tenants keep showing up in the directory and nested listings.
 */
async function loadLiveFacility(id: string) {
  const facility = await Facility.findOne({ _id: id, deletedAt: null });
  if (!facility) throw new AppError(404, 'Facility not found');
  return facility;
}

/**
 * Fields exposed to a patient browsing the public directory.
 *
 * The directory only needs the public-facing identity of a hospital. `subscriptionStatus`,
 * `subscriptionExpiresAt`, `parentFacilityId` and `deletedBy` are commercial and governance
 * data owned by the platform, so they are projected away from anyone who is not the platform
 * owner or the hospital's own staff.
 */
const DIRECTORY_FIELDS =
  'name type region district address geoLocation contactInfo operatingHours logo isActive createdAt updatedAt';

/**
 * GET /api/facilities
 *
 * Three callers, three scopes:
 *  - `super_admin` sees every hospital including the commercial fields, and may narrow with
 *    `?facilityId=`.
 *  - Tenant roles are pinned to the hospital they work for and read their own record in full.
 *  - `patient` is deliberately *not* tenant-scoped: they are a platform-level account that
 *    needs to browse every hospital's public directory to choose where to book, so they get
 *    the directory projection and nothing more.
 *
 * A tenant role is never handed a peer hospital's id, not even as a 403 that would confirm it
 * exists, which is why the pin happens before the query rather than as a post-filter.
 */
export async function listFacilities(req: AuthRequest, res: Response) {
  const page = parseInt(String(req.query.page ?? '1'), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
  const filter: Record<string, unknown> = { deletedAt: null };

  const platform = isSuperAdmin(req.user);
  const tenant = isTenantScoped(req.user);

  if (tenant) {
    const ownId = toObjectId(req.user?.facilityId);
    // Fails closed: a hospital role with no hospital assigned must not see the whole network.
    if (!ownId) throw forbidden('Account is not assigned to a hospital');
    filter._id = ownId;
  } else if (platform && req.query.facilityId) {
    const requested = toObjectId(req.query.facilityId);
    if (requested) filter._id = requested;
  }

  if (req.query.region) filter.region = req.query.region;
  if (req.query.district) filter.district = req.query.district;
  if (req.query.subscriptionStatus) filter.subscriptionStatus = req.query.subscriptionStatus;
  if (req.query.search) {
    // Escaped so a search term containing regex metacharacters cannot be compiled.
    const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = { $regex: escaped, $options: 'i' };
  }

  // A patient is the only caller who receives a view spanning hospitals it does not own, so
  // it is the only caller that gets the reduced projection.
  const projection = platform || tenant ? undefined : DIRECTORY_FIELDS;

  if (projection) {
    // "Available" means bookable, so a patient may only ever see hospitals that are currently
    // active. This is forced rather than read from the query so a patient cannot widen the
    // directory back to a suspended or deactivated hospital. The platform owner still needs to
    // see inactive hospitals, so for them `?isActive` stays caller-controlled.
    filter.isActive = true;
  } else if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  const total = await Facility.countDocuments(filter);
  const query = Facility.find(filter);
  if (projection) query.select(projection);
  const facilities = await query
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ name: 1 })
    .lean();
  success(res, 200, facilities, paginate(page, limit, total));
}

export async function getFacility(req: AuthRequest, res: Response) {
  const facility = await Facility.findOne({ _id: req.params.id, deletedAt: null }).lean();
  if (!facility) throw new AppError(404, 'Facility not found');
  success(res, 200, facility);
}

/**
 * POST /api/facilities
 *
 * Registers a hospital and, when an `admin` block is supplied, mints its first
 * facility_admin in the same request. The temporary password is generated here and
 * returned exactly once — it is never stored in plaintext, so it cannot be retrieved later.
 */
export async function createFacility(req: AuthRequest, res: Response) {
  const body = req.body as Record<string, unknown>;
  const { admin, ...facilityInput } = body;

  const duplicate = await Facility.findOne({ name: facilityInput.name, deletedAt: null });
  if (duplicate) {
    throw new AppError(409, 'A hospital with that name already exists');
  }

  const facility = await Facility.create(facilityInput);

  if (!admin) {
    success(res, 201, facility.toObject());
    return;
  }

  const adminInput = admin as { fullName: string; email: string; phone?: string; nationalId?: string };
  const email = adminInput.email.toLowerCase();
  const existing = await User.findOne({
    $or: [{ email }, ...(adminInput.phone ? [{ phone: adminInput.phone }] : []), ...(adminInput.nationalId ? [{ nationalId: adminInput.nationalId }] : [])],
  });
  if (existing) {
    // The hospital was created moments ago and has no admin, so roll it back rather than
    // leaving a half-onboarded tenant behind.
    await Facility.deleteOne({ _id: facility._id });
    throw new AppError(409, 'A user with that email/phone/national ID already exists');
  }

  const temporaryPassword = generateTemporaryPassword();
  let hospitalAdmin;
  try {
    hospitalAdmin = await User.create({
      fullName: adminInput.fullName,
      email,
      phone: adminInput.phone,
      nationalId: adminInput.nationalId,
      passwordHash: await hashPassword(temporaryPassword),
      role: 'facility_admin',
      facilityId: facility._id,
      status: 'active',
      mustChangePassword: true,
    });
  } catch (err) {
    await Facility.deleteOne({ _id: facility._id });
    throw err;
  }

  success(res, 201, {
    facility: facility.toObject(),
    admin: {
      id: String(hospitalAdmin._id),
      fullName: hospitalAdmin.fullName,
      email: hospitalAdmin.email,
      role: 'facility_admin',
    },
    // Shown once. The platform owner must hand it over out of band.
    temporaryPassword,
    mustChangePassword: true,
  });
}

export async function updateFacility(req: AuthRequest, res: Response) {
  const facility = await loadLiveFacility(req.params.id);

  // Explicit allow-list: spreading `req.body` would let a caller rewrite `deletedAt` and
  // un-delete a hospital through an ordinary profile edit.
  const updates: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in req.body) updates[field] = req.body[field];
  }
  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'No updatable fields supplied');
  }

  if (typeof updates.name === 'string') {
    const clash = await Facility.findOne({
      name: updates.name,
      deletedAt: null,
      _id: { $ne: facility._id },
    });
    if (clash) throw new AppError(409, 'A hospital with that name already exists');
  }

  const updated = await Facility.findByIdAndUpdate(facility._id, updates, {
    new: true,
    runValidators: true,
  });
  success(res, 200, updated);
}

/** PATCH /api/facilities/:id/subscription */
export async function updateSubscription(req: AuthRequest, res: Response) {
  const facility = await loadLiveFacility(req.params.id);
  const updates: Record<string, unknown> = {
    subscriptionStatus: req.body.subscriptionStatus,
  };
  if ('subscriptionExpiresAt' in req.body) {
    updates.subscriptionExpiresAt = req.body.subscriptionExpiresAt
      ? new Date(req.body.subscriptionExpiresAt)
      : null;
  }
  if (req.body.subscriptionStatus === 'suspended') {
    updates.isActive = false;
  } else if (req.body.subscriptionStatus === 'active' || req.body.subscriptionStatus === 'trial') {
    // Reactivating a subscription brings the hospital back, unless it was deleted.
    updates.isActive = true;
  }

  const updated = await Facility.findByIdAndUpdate(facility._id, updates, {
    new: true,
    runValidators: true,
  });
  success(res, 200, updated);
}

export async function deactivateFacility(req: AuthRequest, res: Response) {
  const facility = await loadLiveFacility(req.params.id);
  const updated = await Facility.findByIdAndUpdate(
    facility._id,
    { isActive: false },
    { new: true, runValidators: true }
  );
  success(res, 200, updated);
}

export async function activateFacility(req: AuthRequest, res: Response) {
  const facility = await loadLiveFacility(req.params.id);
  const updated = await Facility.findByIdAndUpdate(
    facility._id,
    { isActive: true },
    { new: true, runValidators: true }
  );
  success(res, 200, updated);
}

/**
 * DELETE /api/facilities/:id
 *
 * Soft delete. The hospital's rows are kept so patient, appointment, payment and claim
 * history stays referentially intact, and the hospital disappears from every directory.
 * Staff accounts are suspended so nobody can keep operating a removed tenant, and their
 * prior status is remembered so `restore` can put them back exactly as they were.
 */
export async function deleteFacility(req: AuthRequest, res: Response) {
  const facility = await loadLiveFacility(req.params.id);

  const suspension = await User.updateMany(
    { facilityId: facility._id, role: { $ne: 'patient' }, status: { $ne: 'suspended' } },
    [{ $set: { preFacilitySuspensionStatus: '$status', status: 'suspended' } }]
  );

  await Facility.updateOne(
    { _id: facility._id },
    { $set: { deletedAt: new Date(), deletedBy: req.user?.id ?? null, isActive: false } }
  );

  success(res, 200, {
    message: 'Hospital deleted',
    facilityId: String(facility._id),
    suspendedStaff: suspension.modifiedCount ?? 0,
  });
}

/** POST /api/facilities/:id/restore */
export async function restoreFacility(req: AuthRequest, res: Response) {
  const facility = await Facility.findById(req.params.id);
  if (!facility) throw new AppError(404, 'Facility not found');
  if (!facility.deletedAt) throw new AppError(400, 'Hospital is not deleted');

  const reactivation = await User.updateMany(
    { facilityId: facility._id, role: { $ne: 'patient' }, preFacilitySuspensionStatus: { $ne: null } },
    [{ $set: { status: '$preFacilitySuspensionStatus' } }, { $unset: 'preFacilitySuspensionStatus' }]
  );

  facility.deletedAt = null;
  facility.deletedBy = null;
  facility.isActive = true;
  await facility.save();

  success(res, 200, {
    facility: facility.toObject(),
    reactivatedStaff: reactivation.modifiedCount ?? 0,
  });
}

export async function listFacilityStaff(req: AuthRequest, res: Response) {
  const facility = await loadLiveFacility(req.params.id);
  const staff = await User.find({ facilityId: facility._id, role: { $ne: 'patient' } })
    .select('-passwordHash')
    .sort({ role: 1, createdAt: -1 })
    .lean();
  success(res, 200, staff);
}

export async function listFacilityDepartments(req: AuthRequest, res: Response) {
  const facility = await loadLiveFacility(req.params.id);
  const departments = await Department.find({ facilityId: facility._id })
    .sort({ name: 1 })
    .lean();
  success(res, 200, departments);
}

export async function listFacilityDoctors(req: AuthRequest, res: Response) {
  const facility = await loadLiveFacility(req.params.id);
  const doctors = await Doctor.find({ facilityId: facility._id })
    .populate('userId', 'fullName email phone status profileImageUrl nationalId')
    .populate('departmentId', 'name')
    .sort({ createdAt: -1 })
    .lean();
  success(res, 200, doctors);
}

export async function getFacilityStats(req: AuthRequest, res: Response) {
  const facility = await loadLiveFacility(req.params.id);
  const id = facility._id;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [totalDoctors, activeDepartments, todayAppointments, staffCount, patientRegistrations] =
    await Promise.all([
      Doctor.countDocuments({ facilityId: id }),
      Department.countDocuments({ facilityId: id }),
      Appointment.countDocuments({
        facilityId: id,
        appointmentDate: { $gte: startOfDay, $lte: endOfDay },
        // Matches the capitalised enum value, so cancelled visits are excluded.
        status: { $ne: 'Cancelled' },
      }),
      User.countDocuments({ facilityId: id, role: { $ne: 'patient' } }),
      // Patients are linked to a hospital on `Patient.facilityId`; counting
      // `User.facilityId` would miss walk-in registrations.
      Patient.countDocuments({ facilityId: id }),
    ]);

  success(res, 200, {
    totalDoctors,
    activeDepartments,
    todayAppointments,
    staffCount,
    patientRegistrations,
  });
}
