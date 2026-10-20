import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Doctor, DoctorSchedule, DoctorLeave, User } from '../models';
import { generateSlots } from '../services/slotService';
import { success, paginate } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import {
  assertFacilityAccess,
  hasRole,
  resolveAssignmentTarget,
  tenantFilter,
  toObjectId,
  ROLE_DOCTOR,
  ROLE_FACILITY_ADMIN,
  ROLE_PATIENT,
  ROLE_SUPER_ADMIN,
} from '../utils/tenancy';

/**
 * Read access to the doctor directory and to rostering.
 *
 * A doctor's public profile (name, specialisation, fees, departments) is the information
 * a patient needs in order to book, so patients may read it across hospitals. Everything
 * that is not a public profile - writes, and any record tied to a hospital - is restricted
 * to that hospital's staff below.
 */
function canReadDirectory(req: AuthRequest): boolean {
  return hasRole(req.user, ROLE_PATIENT);
}

export async function listDoctors(req: AuthRequest, res: Response) {
  const page = parseInt(String(req.query.page ?? '1'), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);

  const filter: Record<string, unknown> = {};
  if (req.query.departmentId) filter.departmentId = req.query.departmentId;

  if (canReadDirectory(req) && !hasRole(req.user, ROLE_FACILITY_ADMIN, ROLE_SUPER_ADMIN)) {
    // Patients browse the directory to choose where to book. They may narrow it to a
    // hospital but never see another hospital's staff-only listings.
    if (req.query.facilityId) filter.facilityId = toObjectId(req.query.facilityId);
  } else {
    // `tenantFilter` rejects a `facilityId` that names a different hospital rather than
    // honouring it, so a hospital's staff cannot read another hospital's roster.
    Object.assign(filter, tenantFilter(req, req.query.facilityId));
  }

  const total = await Doctor.countDocuments(filter);
  const doctors = await Doctor.find(filter)
    .populate('userId', 'fullName email phone status profileImageUrl nationalId')
    .populate('departmentId', 'name')
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();
  success(res, 200, doctors, paginate(page, limit, total));
}

export async function getDoctor(req: AuthRequest, res: Response) {
  const doctor = await Doctor.findById(req.params.id)
    .populate('userId', 'fullName email phone status profileImageUrl nationalId')
    .populate('departmentId', 'name')
    .lean();
  if (!doctor) throw new AppError(404, 'Doctor not found');

  if (hasRole(req.user, ROLE_DOCTOR) && String(doctor.userId) === req.user?.id) {
    // own profile
  } else if (canReadDirectory(req) && !hasRole(req.user, ROLE_FACILITY_ADMIN, ROLE_SUPER_ADMIN)) {
    // directory read for booking
  } else {
    assertFacilityAccess(req, doctor.facilityId);
  }

  success(res, 200, doctor);
}

export async function createDoctor(req: AuthRequest, res: Response) {
  const body = req.body as {
    userId: string;
    departmentId?: string[];
    facilityId?: string;
    licenseNumber?: string;
    specialization?: string[];
    qualification?: string[];
    experienceYears?: number;
    consultationFee?: { newVisit?: number; followUp?: number };
    bio?: string;
  };
  const user = await User.findById(body.userId);
  if (!user) throw new AppError(400, 'User not found');
  if (user.role !== 'doctor') {
    throw new AppError(400, 'The user must have the "doctor" role');
  }
  if (await Doctor.exists({ userId: body.userId })) {
    throw new AppError(409, 'Doctor profile already exists for this user');
  }

  // A hospital admin can only ever attach a doctor to their own hospital; a platform
  // admin must name the hospital explicitly.
  const facilityId = resolveAssignmentTarget(req, body.facilityId);
  if (!facilityId) throw new AppError(400, 'Facility context required');

  if (user.facilityId && String(user.facilityId) !== String(facilityId)) {
    throw new AppError(400, 'User belongs to a different facility');
  }

  // A doctor account with no hospital must not be silently adopted by a hospital admin.
  if (!user.facilityId && !hasRole(req.user, ROLE_SUPER_ADMIN)) {
    throw new AppError(400, 'User is not assigned to a facility');
  }

  const doctor = await Doctor.create({
    userId: body.userId,
    facilityId,
    departmentId: body.departmentId ?? [],
    licenseNumber: body.licenseNumber,
    specialization: body.specialization ?? [],
    qualification: body.qualification ?? [],
    experienceYears: body.experienceYears,
    consultationFee: body.consultationFee,
    bio: body.bio,
  });
  success(res, 201, doctor);
}

/**
 * Loads a doctor for mutation. A doctor may act on their own record; anyone else needs a
 * hospital-admin role *and* must belong to the same hospital.
 */
async function loadDoctorForWrite(req: AuthRequest, id: string) {
  const doctor = await Doctor.findById(id);
  if (!doctor) throw new AppError(404, 'Doctor not found');

  const isSelf = hasRole(req.user, ROLE_DOCTOR) && String(doctor.userId) === req.user?.id;
  if (isSelf) return doctor;

  if (!hasRole(req.user, ROLE_FACILITY_ADMIN, ROLE_SUPER_ADMIN)) {
    throw new AppError(403, 'Forbidden');
  }
  assertFacilityAccess(req, doctor.facilityId);
  return doctor;
}

export async function deleteDoctor(req: AuthRequest, res: Response) {
  if (!hasRole(req.user, ROLE_FACILITY_ADMIN, ROLE_SUPER_ADMIN)) {
    throw new AppError(403, 'Forbidden');
  }
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw new AppError(404, 'Doctor not found');
  assertFacilityAccess(req, doctor.facilityId);

  await doctor.deleteOne();
  success(res, 200, { message: 'Doctor profile deleted' });
}

export async function updateDoctor(req: AuthRequest, res: Response) {
  await loadDoctorForWrite(req, req.params.id);

  const updates: Record<string, unknown> = { ...req.body };
  // Ownership and hospital placement are never editable through this endpoint.
  delete updates.userId;
  delete updates.facilityId;
  delete updates._id;
  delete updates.id;
  delete updates.createdAt;
  delete updates.updatedAt;

  // A doctor editing their own profile may not re-assign themselves to a department or
  // rewrite their consultation fees; that is a management action.
  const isSelf = hasRole(req.user, ROLE_DOCTOR) && !hasRole(req.user, ROLE_FACILITY_ADMIN, ROLE_SUPER_ADMIN);
  if (isSelf) {
    delete updates.departmentId;
    delete updates.consultationFee;
    delete updates.rating;
  }

  const updated = await Doctor.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  success(res, 200, updated);
}

export async function getDoctorSchedule(req: AuthRequest, res: Response) {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw new AppError(404, 'Doctor not found');
  assertDirectoryRead(req, doctor);
  const schedules = await DoctorSchedule.find({ doctorId: req.params.id }).sort({ dayOfWeek: 1 }).lean();
  success(res, 200, schedules);
}

export async function upsertSchedule(req: AuthRequest, res: Response) {
  await loadDoctorForWrite(req, req.params.id);

  const body = req.body as {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    breakStart?: string;
    breakEnd?: string;
    slotDurationMinutes?: number;
    maxPatientsPerSlot?: number;
    isActive?: boolean;
  };

  if (body.startTime >= body.endTime) {
    throw new AppError(400, 'startTime must be before endTime');
  }

  const schedule = await DoctorSchedule.findOneAndUpdate(
    { doctorId: req.params.id, dayOfWeek: body.dayOfWeek },
    {
      startTime: body.startTime,
      endTime: body.endTime,
      breakStart: body.breakStart ?? '',
      breakEnd: body.breakEnd ?? '',
      slotDurationMinutes: body.slotDurationMinutes ?? 15,
      maxPatientsPerSlot: body.maxPatientsPerSlot ?? 1,
      isActive: body.isActive ?? true,
    },
    { new: true, upsert: true, runValidators: true }
  );
  success(res, 200, schedule);
}

export async function deleteSchedule(req: AuthRequest, res: Response) {
  const schedule = await DoctorSchedule.findById(req.params.scheduleId);
  if (!schedule) throw new AppError(404, 'Schedule entry not found');
  await loadDoctorForWrite(req, String(schedule.doctorId));
  await schedule.deleteOne();
  success(res, 200, { message: 'Schedule entry deleted' });
}

export async function getDoctorAvailability(req: AuthRequest, res: Response) {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw new AppError(404, 'Doctor not found');
  assertDirectoryRead(req, doctor);
  const date = (req.query.date as string) ?? new Date().toISOString();
  const slots = await generateSlots({ doctorId: req.params.id, date });
  success(res, 200, { date, doctorId: req.params.id, slots });
}

export async function createLeave(req: AuthRequest, res: Response) {
  await loadDoctorForWrite(req, req.params.id);

  const date = new Date((req.body as { date: string }).date);
  const leave = await DoctorLeave.create({
    doctorId: req.params.id,
    date,
    reason: (req.body as { reason?: string }).reason,
  });
  success(res, 201, leave);
}

export async function deleteLeave(req: AuthRequest, res: Response) {
  const leave = await DoctorLeave.findById(req.params.leaveId);
  if (!leave) throw new AppError(404, 'Leave entry not found');
  await loadDoctorForWrite(req, String(leave.doctorId));
  await leave.deleteOne();
  success(res, 200, { message: 'Leave entry deleted' });
}

/** Rostering is readable by directory readers (patients need it to book) and by own-hospital staff. */
function assertDirectoryRead(req: AuthRequest, doctor: { userId: unknown; facilityId: unknown }) {
  if (hasRole(req.user, ROLE_DOCTOR) && String(doctor.userId) === req.user?.id) return;
  if (canReadDirectory(req) && !hasRole(req.user, ROLE_FACILITY_ADMIN, ROLE_SUPER_ADMIN)) return;
  assertFacilityAccess(req, doctor.facilityId);
}
