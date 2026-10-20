import { Response } from 'express';
import { Types, type PipelineStage } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import {
  MedicalRecord,
  Appointment,
  Doctor,
  Patient,
  Prescription,
  LaboratoryTest,
  Facility,
  User,
} from '../models';

/**
 * Stages accepted inside a `$unionWith` sub-pipeline. Mongoose's `UnionWithPipelineStage`
 * excludes `$merge`/`$out`, so the broader `PipelineStage` is not assignable here.
 */
type TimelineBranch = Array<
  PipelineStage.Match | PipelineStage.Project | PipelineStage.Lookup | PipelineStage.Unwind
>;

/** Escapes regex metacharacters so a user-typed term is matched literally. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
import { success, paginate } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { assertPatientAccess } from '../services/patientAccess';
import {
  assertFacilityAccess,
  hasRole,
  isSuperAdmin,
  populatedId,
  tenantFilter,
  toObjectId,
  ROLE_PATIENT,
} from '../utils/tenancy';

/**
 * POST /api/medical-records
 * Doctor creates a consultation record for a completed / in-progress appointment.
 * Nurses can create vitals-only preliminary records (with placeholder diagnosis).
 * If a nurse-created record exists, the doctor can update it via PUT instead.
 */
export async function createMedicalRecord(req: AuthRequest, res: Response) {
  const body = req.body as {
    appointmentId: string;
    vitals?: Record<string, unknown>;
    symptoms?: string[];
    diagnosis: string;
    treatment?: string;
    notes?: string;
    followUpDate?: string;
  };

  const isNurse = hasRole(req.user, 'nurse');
  const isDoctor = hasRole(req.user, 'doctor');

  // Resolve profile from logged-in user
  let facilityId: string;
  let profileId: string;

  if (isDoctor) {
    const doctor = await Doctor.findOne({ userId: req.user?.id }).select('_id facilityId');
    if (!doctor) throw new AppError(403, 'Doctor profile not found');
    facilityId = String(doctor.facilityId);
    profileId = String(doctor._id);
  } else if (isNurse) {
    // Nurses don't have a separate profile; use their facilityId from the user
    facilityId = req.user?.facilityId ?? '';
    profileId = req.user?.id ?? '';
  } else {
    throw new AppError(403, 'Only doctors and nurses can create medical records');
  }

  // Validate appointment
  const appointment = await Appointment.findById(body.appointmentId);
  if (!appointment) throw new AppError(404, 'Appointment not found');

  // Facility scope
  if (facilityId !== String(appointment.facilityId)) {
    throw new AppError(403, 'Appointment belongs to a different facility');
  }

  // Appointment must be in a clinical state
  const allowedStatuses = ['Confirmed', 'Checked In', 'In Progress', 'Completed'];
  if (!allowedStatuses.includes(appointment.status)) {
    throw new AppError(409, `Cannot create a record for an appointment with status "${appointment.status}"`);
  }

  // Check if a record already exists for this appointment
  const existing = await MedicalRecord.findOne({ appointmentId: body.appointmentId });
  if (existing) {
    // Nurses cannot overwrite existing records
    if (isNurse) {
      throw new AppError(409, 'A medical record already exists for this appointment');
    }
    // Doctors updating a nurse-created placeholder record: update instead of creating new
    if (isDoctor && existing.notes?.startsWith('Vitals recorded by nurse')) {
      const updated = await MedicalRecord.findByIdAndUpdate(
        existing._id,
        {
          doctorId: profileId,
          vitals: body.vitals ?? existing.vitals,
          symptoms: body.symptoms ?? existing.symptoms,
          diagnosis: body.diagnosis,
          treatment: body.treatment,
          notes: body.notes,
          followUpDate: body.followUpDate ? new Date(body.followUpDate) : existing.followUpDate,
        },
        { new: true, runValidators: true }
      );
      return success(res, 200, updated);
    }
    throw new AppError(409, 'A medical record already exists for this appointment');
  }

  const record = await MedicalRecord.create({
    patientId: appointment.patientId,
    doctorId: isDoctor ? profileId : undefined,
    appointmentId: body.appointmentId,
    facilityId: appointment.facilityId,
    vitals: body.vitals ?? {},
    symptoms: body.symptoms ?? [],
    diagnosis: isNurse ? 'Vitals recorded by nurse — awaiting doctor consultation' : body.diagnosis,
    treatment: body.treatment,
    notes: body.notes,
    followUpDate: body.followUpDate ? new Date(body.followUpDate) : undefined,
  });

  success(res, 201, record);
}

/**
 * GET /api/medical-records/:patientId
 * Returns paginated medical records for a given patient.
 * Accessible to: doctor, nurse, facility_admin, super_admin, and the patient themselves.
 */
export async function getPatientRecords(req: AuthRequest, res: Response) {
  const { patientId } = req.params;

  const patient = await Patient.findById(patientId).select('_id userId facilityId');
  if (!patient) throw new AppError(404, 'Patient not found');

  // A patient reads only their own records; hospital staff read patients they can reach,
  // which covers portal-registered patients treated at their hospital.
  await assertPatientAccess(req, patient);

  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));

  const filter: Record<string, unknown> = { patientId };

  if (!isSuperAdmin(req.user) && !hasRole(req.user, ROLE_PATIENT)) {
    Object.assign(filter, tenantFilter(req));
  }

  const total = await MedicalRecord.countDocuments(filter);
  const records = await MedicalRecord.find(filter)
    .populate('doctorId', 'specialization')
    .populate({ path: 'doctorId', populate: { path: 'userId', select: 'fullName' } })
    .populate('appointmentId', 'appointmentDate timeSlot visitType')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  success(res, 200, records, paginate(page, limit, total));
}

/**
 * GET /api/medical-records/by-appointment/:appointmentId
 * Returns the single medical record tied to an appointment (if any).
 */
export async function getRecordByAppointment(req: AuthRequest, res: Response) {
  const { appointmentId } = req.params;

  const record = await MedicalRecord.findOne({ appointmentId })
    .populate('doctorId', 'specialization')
    .populate({ path: 'doctorId', populate: { path: 'userId', select: 'fullName' } })
    .populate('appointmentId', 'appointmentDate timeSlot visitType status')
    .populate('patientId', 'patientNumber allergies chronicConditions')
    .populate({ path: 'patientId', populate: { path: 'userId', select: 'fullName phone' } })
    .lean();

  if (!record) throw new AppError(404, 'No medical record found for this appointment');

  await assertRecordAccess(req, record);
  success(res, 200, record);
}

/**
 * PUT /api/medical-records/:id
 * Doctor updates a record (same doctor who created it or facility admin).
 */
export async function updateMedicalRecord(req: AuthRequest, res: Response) {
  const record = await MedicalRecord.findById(req.params.id);
  if (!record) throw new AppError(404, 'Medical record not found');

  await assertRecordAccess(req, record);

  // Doctors can edit their own records, or nurse-created placeholder records
  if (hasRole(req.user, 'doctor')) {
    const doctor = await Doctor.findOne({ userId: req.user!.id }).select('_id');
    if (!doctor) throw new AppError(403, 'Doctor profile not found');
    const isOwnRecord = String(doctor._id) === String(record.doctorId);
    const isNursePlaceholder = !record.doctorId && record.notes?.startsWith('Vitals recorded by nurse');
    if (!isOwnRecord && !isNursePlaceholder) {
      throw new AppError(403, 'You can only edit your own records');
    }
  }

  // Explicit allow-list rather than spreading `req.body`. The Zod schema currently strips
  // `facilityId`/`patientId`/`doctorId`, but relying on that is fragile: adding any field
  // to the schema would silently become a record-reassignment or cross-hospital bug.
  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const field of [
    'vitals',
    'symptoms',
    'diagnosis',
    'treatment',
    'notes',
    'followUpDate',
  ] as const) {
    if (field in body) updates[field] = body[field];
  }

  const updated = await MedicalRecord.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  success(res, 200, updated);
}

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * `record.patientId` is a populated document on the `.lean()` + `populate()` read paths and
 * a bare ObjectId on document paths, so it is unwrapped with `populatedId` before use.
 * Comparing a populated document with `String()` yields "[object Object]", which never
 * matches and made the patient self-check throw a CastError instead of authorising.
 */
async function assertRecordAccess(
  req: AuthRequest,
  record: { facilityId: unknown; patientId: unknown }
) {
  if (isSuperAdmin(req.user)) return;

  if (hasRole(req.user, ROLE_PATIENT)) {
    const patientId = toObjectId(populatedId(record.patientId));
    const patient = patientId
      ? await Patient.findById(patientId).select('userId')
      : null;
    if (!patient || String(patient.userId) !== req.user?.id) throw new AppError(403, 'Forbidden');
    return;
  }

  assertFacilityAccess(req, record.facilityId);
}

/**
 * GET /api/medical-records/:patientId/timeline
 *
 * One reverse-chronological feed across records, prescriptions and lab results.
 *
 * The portal previously fetched all three lists separately and merged them in the browser.
 * That is unbounded — a long-term patient has thousands of rows — and a single page size is
 * meaningless, because the page is a merge of three collections rather than one. Unioning in
 * the database lets the feed be paged honestly.
 */
export async function getPatientTimeline(req: AuthRequest, res: Response) {
  const { patientId } = req.params;

  const patient = await Patient.findById(patientId).select('_id userId facilityId');
  if (!patient) throw new AppError(404, 'Patient not found');

  await assertPatientAccess(req, patient);

  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
  const type = typeof req.query.type === 'string' ? req.query.type : 'all';

  const patientObjectId = new Types.ObjectId(String(patient._id));

  // Prescriptions hang off a medical record rather than the patient directly.
  const recordIds = await MedicalRecord.find({ patientId: patientObjectId }).distinct('_id');

  // Escaped so a user-typed value is matched literally, never interpreted as a regex.
  const rawSearch = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const searchPattern = rawSearch ? new RegExp(escapeRegExp(rawSearch), 'i') : null;

  const recordBase: Record<string, unknown> = { patientId: patientObjectId };
  const prescriptionBase: Record<string, unknown> = { medicalRecordId: { $in: recordIds } };
  const labBase: Record<string, unknown> = { patientId: patientObjectId };

  const recordSearch: Record<string, unknown> = searchPattern
    ? {
        $or: [
          { diagnosis: searchPattern },
          { treatment: searchPattern },
          { notes: searchPattern },
          { symptoms: searchPattern },
        ],
      }
    : {};
  const prescriptionSearch: Record<string, unknown> = searchPattern
    ? { $or: [{ 'medicines.name': searchPattern }, { instructions: searchPattern }] }
    : {};
  const labSearch: Record<string, unknown> = searchPattern
    ? { $or: [{ testName: searchPattern }, { result: searchPattern }] }
    : {};

  // The portal timeline shows the clinician and facility for each entry, so those names are
  // resolved here. Previously `.populate()` did this after a full in-browser merge.
  const lookupClinician: TimelineBranch = [
    {
      $lookup: { from: Doctor.collection.name, localField: 'doctorId', foreignField: '_id', as: '__doctor' },
    },
    { $unwind: { path: '$__doctor', preserveNullAndEmptyArrays: true } },
    {
      $lookup: { from: User.collection.name, localField: '__doctor.userId', foreignField: '_id', as: '__doctorUser' },
    },
    { $unwind: { path: '$__doctorUser', preserveNullAndEmptyArrays: true } },
    {
      $lookup: { from: Facility.collection.name, localField: 'facilityId', foreignField: '_id', as: '__facility' },
    },
    { $unwind: { path: '$__facility', preserveNullAndEmptyArrays: true } },
  ];

  // Each branch projects a common shape so the client renders one list.
  // Only `$match`/`$lookup`/`$unwind`/`$project` are used, which is the stage set
  // `$unionWith` accepts (it rejects `$merge`/`$out`).
  const recordBranch: TimelineBranch = [
    { $match: { ...recordBase, ...recordSearch } },
    ...lookupClinician,
    {
      $project: {
        _id: 0,
        id: '$_id',
        type: { $literal: 'record' },
        date: '$createdAt',
        title: { $ifNull: ['$diagnosis', 'Consultation'] },
        status: '$status',
        appointmentId: '$appointmentId',
        doctorName: '$__doctorUser.fullName',
        facilityName: '$__facility.name',
        payload: '$$ROOT',
      },
    },
  ];

  const prescriptionBranch: TimelineBranch = [
    { $match: { ...prescriptionBase, ...prescriptionSearch } },
    ...lookupClinician,
    {
      $project: {
        _id: 0,
        id: '$_id',
        type: { $literal: 'prescription' },
        date: { $ifNull: ['$issuedAt', '$createdAt'] },
        title: { $ifNull: ['$medicines.0.name', 'Prescription'] },
        status: { $literal: null },
        appointmentId: { $literal: null },
        doctorName: '$__doctorUser.fullName',
        facilityName: '$__facility.name',
        payload: '$$ROOT',
      },
    },
  ];

  const labBranch: TimelineBranch = [
    { $match: { ...labBase, ...labSearch } },
    ...lookupClinician,
    {
      $project: {
        _id: 0,
        id: '$_id',
        type: { $literal: 'lab' },
        date: { $ifNull: ['$requestedAt', '$createdAt'] },
        title: '$testName',
        status: '$status',
        appointmentId: '$appointmentId',
        doctorName: '$__doctorUser.fullName',
        facilityName: '$__facility.name',
        payload: '$$ROOT',
      },
    },
  ];

  const pipeline: PipelineStage[] = [];
  const includeRecord = type === 'all' || type === 'record';
  const includePrescription = type === 'all' || type === 'prescription';
  const includeLab = type === 'all' || type === 'lab';

  if (includeRecord) pipeline.push(...recordBranch);
  if (includePrescription) {
    if (pipeline.length > 0) {
      // Resolved from the model rather than hardcoded: the default collection name is
      // lowercased plural, and a wrong name makes `$unionWith` silently return nothing.
      pipeline.push({
        $unionWith: { coll: Prescription.collection.name, pipeline: prescriptionBranch },
      });
    } else {
      pipeline.push(...prescriptionBranch);
    }
  }
  if (includeLab) {
    if (pipeline.length > 0) {
      pipeline.push({
        $unionWith: { coll: LaboratoryTest.collection.name, pipeline: labBranch },
      });
    } else {
      pipeline.push(...labBranch);
    }
  }

  // Counted per collection rather than off the union, which cannot be counted after a sort.
  // Each count reuses that branch's filters so the total matches what the query returns.
  const counts = await Promise.all([
    includeRecord ? MedicalRecord.countDocuments({ ...recordBase, ...recordSearch }) : 0,
    includePrescription ? Prescription.countDocuments({ ...prescriptionBase, ...prescriptionSearch }) : 0,
    includeLab ? LaboratoryTest.countDocuments({ ...labBase, ...labSearch }) : 0,
  ]);
  const total = counts.reduce((sum, count) => sum + count, 0);

  pipeline.push({ $sort: { date: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit });

  const entries = await MedicalRecord.aggregate(pipeline);

  success(res, 200, entries, paginate(page, limit, total));
}
