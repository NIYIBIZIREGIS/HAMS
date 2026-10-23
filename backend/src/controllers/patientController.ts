import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Patient, User, Facility, nextSeq } from '../models';
import { success, paginate } from '../utils/apiResponse';
import { AppError, forbidden } from '../utils/AppError';
import { hashPassword } from '../utils/password';
import { assertPatientAccess, visiblePatientCondition } from '../services/patientAccess';
import { grantMembership, listMemberships, endMembership } from '../services/patientFacilityService';
import {
  hasRole,
  isTenantScoped,
  resolveAssignmentTarget,
  resolveTenantScope,
  toObjectId,
  ROLE_FACILITY_ADMIN,
  ROLE_PATIENT,
  ROLE_RECEPTIONIST,
  ROLE_SUPER_ADMIN,
} from '../utils/tenancy';

export async function listPatients(req: AuthRequest, res: Response) {
  const page = parseInt(String(req.query.page ?? '1'), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);

  const conditions: Record<string, unknown>[] = [];

  if (hasRole(req.user, ROLE_PATIENT)) {
    // A patient only ever sees their own record.
    const self = await Patient.findOne({ userId: req.user?.id }).select('_id');
    if (!self) throw new AppError(403, 'Patient profile not found');
    conditions.push({ _id: self._id });
  } else {
    // `resolveTenantScope` rejects a `facilityId` naming a different hospital.
    const { facilityId } = resolveTenantScope(req, req.query.facilityId);
    if (facilityId) conditions.push(await visiblePatientCondition(facilityId));
  }

  if (req.query.search) {
    const search = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({ fullName: { $regex: search, $options: 'i' } }).select('_id');
    conditions.push({
      $or: [
        { patientNumber: { $regex: search, $options: 'i' } },
        { userId: { $in: users.map((u) => u._id) } },
      ],
    });
  }

  const filter = conditions.length ? { $and: conditions } : {};

  const total = await Patient.countDocuments(filter);
  const patients = await Patient.find(filter)
    .populate('userId', 'fullName email phone nationalId status profileImageUrl')
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();
  success(res, 200, patients, paginate(page, limit, total));
}

export async function getPatient(req: AuthRequest, res: Response) {
  const patient = await Patient.findById(req.params.id)
    .populate('userId', 'fullName email phone nationalId status preferredLanguage profileImageUrl')
    .lean();
  if (!patient) throw new AppError(404, 'Patient not found');
  await assertPatientAccess(req, patient);
  success(res, 200, patient);
}

export async function lookupPatient(req: AuthRequest, res: Response) {
  const { nationalId } = req.query as { nationalId: string };
  const user = await User.findOne({ nationalId }).select('_id fullName email phone nationalId');
  if (!user) throw new AppError(404, 'No patient found with that national ID');
  const patient = await Patient.findOne({ userId: user._id }).lean();
  if (!patient) throw new AppError(404, 'No patient record found for that national ID');
  await assertPatientAccess(req, patient);
  success(res, 200, { user, patient });
}

export async function createPatient(req: AuthRequest, res: Response) {
  const body = req.body as {
    fullName: string;
    email?: string;
    phone?: string;
    nationalId?: string;
    password: string;
    preferredLanguage?: string;
    facilityId?: string;
    dob?: string;
    gender?: string;
    bloodGroup?: string;
    allergies?: string[];
    chronicConditions?: string[];
    insurance?: unknown;
    governmentScheme?: unknown;
    emergencyContact?: unknown;
  };

  // The patient is registered into the receptionist's own hospital; a platform admin must
  // name the hospital. `User.facilityId` is intentionally left null so patients never
  // appear in staff listings - `Patient.facilityId` is the tenancy link.
  const facilityId = resolveAssignmentTarget(req, body.facilityId);

  const existing = await User.findOne({
    $or: [
      ...(body.email ? [{ email: body.email.toLowerCase() }] : []),
      ...(body.phone ? [{ phone: body.phone }] : []),
      ...(body.nationalId ? [{ nationalId: body.nationalId }] : []),
    ],
  });
  if (existing) throw new AppError(409, 'A user with that email/phone/national ID already exists');

  const user = await User.create({
    fullName: body.fullName,
    email: body.email?.toLowerCase(),
    phone: body.phone,
    nationalId: body.nationalId,
    passwordHash: await hashPassword(body.password),
    role: 'patient',
    preferredLanguage: body.preferredLanguage ?? 'en',
  });

  const nextNumber = await nextSeq('patientNumber');
  const patient = await Patient.create({
    userId: user._id,
    facilityId,
    patientNumber: `PT-${String(nextNumber).padStart(5, '0')}`,
    dob: body.dob,
    gender: body.gender,
    bloodGroup: body.bloodGroup,
    allergies: body.allergies ?? [],
    chronicConditions: body.chronicConditions ?? [],
    insurance: body.insurance,
    governmentScheme: body.governmentScheme,
    emergencyContact: body.emergencyContact,
  });

  if (facilityId) {
    // Registering a patient at a hospital is a membership, flagged as their home so it stays
    // in step with `Patient.facilityId` and the patient directory agrees with both.
    await grantMembership(patient._id, facilityId, {
      isPrimary: true,
      registeredBy: req.user?.id,
    });
  }

  success(res, 201, { patient, user: { id: user._id, fullName: user.fullName } });
}

export async function updatePatient(req: AuthRequest, res: Response) {
  const patient = await Patient.findById(req.params.id);
  if (!patient) throw new AppError(404, 'Patient not found');

  const isPatientSelf = hasRole(req.user, ROLE_PATIENT) && String(patient.userId) === req.user?.id;
  if (!isPatientSelf) await assertPatientAccess(req, patient);

  const updates: Record<string, unknown> = { ...req.body };
  // Identity, numbering and hospital ownership are never editable here. Leaving
  // `facilityId` writable would let a caller move a patient into another hospital.
  delete updates.userId;
  delete updates.patientNumber;
  delete updates.nationalHealthId;
  delete updates.facilityId;
  delete updates._id;
  delete updates.id;

  const updated = await Patient.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).populate('userId', 'fullName email phone nationalId status');
  success(res, 200, updated);
}

export async function deletePatient(req: AuthRequest, res: Response) {
  if (!hasRole(req.user, ROLE_FACILITY_ADMIN, ROLE_RECEPTIONIST, ROLE_SUPER_ADMIN)) {
    throw forbidden('Forbidden');
  }

  const patient = await Patient.findById(req.params.id);
  if (!patient) throw new AppError(404, 'Patient not found');
  await assertPatientAccess(req, patient);

  // Soft-delete: deactivate the linked user account
  await User.findByIdAndUpdate(patient.userId, { status: 'inactive' });
  success(res, 200, { message: 'Patient deactivated' });
}

/**
 * The signed-in patient's own hospitals.
 *
 * Distinct from the staff-facing read below: this is the "where am I treated" list a patient
 * sees, so it needs no reachability assertion beyond proving the patient profile belongs to
 * the caller.
 */
export async function listMyFacilities(req: AuthRequest, res: Response) {
  const selfPatient = await Patient.findOne({ userId: req.user?.id }).select('_id');
  if (!selfPatient) throw new AppError(404, 'Patient profile not found');

  const memberships = await listMemberships(selfPatient._id);
  success(res, 200, memberships);
}

/**
 * Every hospital a patient belongs to, for staff.
 *
 * Readable by staff at any hospital that already treats the patient, not only their home
 * hospital, because a clinic that has seen the patient has a legitimate reason to know where
 * else they are treated.
 */
export async function listPatientFacilities(req: AuthRequest, res: Response) {
  const patient = await Patient.findById(req.params.id);
  if (!patient) throw new AppError(404, 'Patient not found');
  await assertPatientAccess(req, patient);

  success(res, 200, await listMemberships(patient._id));
}

/**
 * Registers a patient at the caller's own hospital.
 *
 * The hospital is never taken from the request: it is always the caller's tenant, so a
 * receptionist cannot enrol a patient into a competitor's directory by passing an id.
 */
export async function registerPatientAtFacility(req: AuthRequest, res: Response) {
  if (!isTenantScoped(req.user)) throw forbidden('Forbidden');

  const own = toObjectId(req.user?.facilityId);
  if (!own) throw forbidden('Account is not assigned to a hospital');

  const patient = await Patient.findById(req.params.id);
  if (!patient) throw new AppError(404, 'Patient not found');

  const facility = await Facility.findOne({ _id: own, deletedAt: null, isActive: true }).lean();
  if (!facility) throw new AppError(409, 'This hospital is not accepting registrations');

  await grantMembership(patient._id, own, { registeredBy: req.user?.id });

  success(res, 201, await listMemberships(patient._id));
}

/** Ends the caller's own hospital's membership of a patient, keeping the audit row. */
export async function endPatientFacility(req: AuthRequest, res: Response) {
  if (!isTenantScoped(req.user)) throw forbidden('Forbidden');

  const own = toObjectId(req.user?.facilityId);
  if (!own) throw forbidden('Account is not assigned to a hospital');

  const patient = await Patient.findById(req.params.id);
  if (!patient) throw new AppError(404, 'Patient not found');

  await endMembership(patient._id, own);

  success(res, 200, await listMemberships(patient._id));
}
