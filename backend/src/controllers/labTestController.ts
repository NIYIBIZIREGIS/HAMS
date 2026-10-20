import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { LaboratoryTest, Appointment, Doctor, Patient, MedicalRecord } from '../models';
import { success, paginate } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import {
  assertFacilityAccess,
  hasRole,
  populatedId,
  tenantFilter,
  toObjectId,
  ROLE_DOCTOR,
  ROLE_PATIENT,
} from '../utils/tenancy';

/**
 * POST /api/lab-tests
 * Doctor requests a laboratory test for a patient via an appointment.
 */
export async function createLabTest(req: AuthRequest, res: Response) {
  const body = req.body as {
    appointmentId: string;
    medicalRecordId?: string;
    testName: string;
  };

  const doctor = await Doctor.findOne({ userId: req.user?.id }).select('_id facilityId');
  if (!doctor) throw new AppError(403, 'Doctor profile not found');

  const appointment = await Appointment.findById(body.appointmentId);
  if (!appointment) throw new AppError(404, 'Appointment not found');

  if (String(doctor.facilityId) !== String(appointment.facilityId)) {
    throw new AppError(403, 'Appointment belongs to a different facility');
  }

  const allowedStatuses = ['Confirmed', 'Checked In', 'In Progress', 'Completed'];
  if (!allowedStatuses.includes(appointment.status)) {
    throw new AppError(409, `Cannot request a lab test for an appointment with status "${appointment.status}"`);
  }

  // A supplied `medicalRecordId` must belong to the same appointment. Accepting it
  // unchecked let a doctor bind their test to another hospital's medical record, creating
  // a cross-tenant foreign key.
  if (body.medicalRecordId) {
    const record = await MedicalRecord.findById(body.medicalRecordId).select('appointmentId patientId');
    if (!record) throw new AppError(404, 'Medical record not found');
    if (String(record.appointmentId) !== String(appointment._id)) {
      throw new AppError(400, 'Medical record does not belong to this appointment');
    }
  }

  const labTest = await LaboratoryTest.create({
    appointmentId: body.appointmentId,
    medicalRecordId: body.medicalRecordId ?? null,
    facilityId: appointment.facilityId,
    patientId: appointment.patientId,
    requestedBy: doctor._id,
    testName: body.testName,
    status: 'Requested',
    requestedAt: new Date(),
  });

  // Stub notification — Phase 5 will send a real alert to the lab
  void notifyLabStub(String(labTest._id), body.testName);

  success(res, 201, labTest);
}

/**
 * PUT /api/lab-tests/:id
 * Lab technician updates the test status and enters results.
 */
export async function updateLabTest(req: AuthRequest, res: Response) {
  const labTest = await LaboratoryTest.findById(req.params.id);
  if (!labTest) throw new AppError(404, 'Lab test not found');

  // Facility scope
  assertFacilityAccess(req, labTest.facilityId);

  const body = req.body as {
    result?: string;
    resultFileUrl?: string;
    referenceRange?: string;
    isAbnormal?: boolean;
    status: 'Requested' | 'In Progress' | 'Completed';
  };

  // Validate status transitions: Requested → In Progress → Completed
  const validNext: Record<string, string[]> = {
    Requested: ['In Progress', 'Completed'],
    'In Progress': ['Completed'],
    Completed: [],
  };
  if (!validNext[labTest.status]?.includes(body.status) && body.status !== labTest.status) {
    throw new AppError(409, `Cannot transition lab test from "${labTest.status}" to "${body.status}"`);
  }

  const updates: Record<string, unknown> = {
    status: body.status,
  };
  if (body.result !== undefined) updates.result = body.result;
  if (body.resultFileUrl !== undefined) updates.resultFileUrl = body.resultFileUrl;
  if (body.referenceRange !== undefined) updates.referenceRange = body.referenceRange;
  if (body.isAbnormal !== undefined) updates.isAbnormal = body.isAbnormal;
  if (body.status === 'Completed') updates.completedAt = new Date();

  const updated = await LaboratoryTest.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  // Stub notification for abnormal results — Phase 5 will send a real alert
  if (body.isAbnormal && body.status === 'Completed') {
    void notifyAbnormalResultStub(String(labTest._id), labTest.testName);
  }

  success(res, 200, updated);
}

/**
 * GET /api/lab-tests
 * Lists lab tests, scoped by role.
 * - lab_technician / facility staff: facility-scoped
 * - doctor: their own requests
 * - patient: their own
 * - super_admin: all
 */
export async function listLabTests(req: AuthRequest, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));

  const filter: Record<string, unknown> = {};
  const isPatient = hasRole(req.user, ROLE_PATIENT);

  if (isPatient) {
    const patient = await Patient.findOne({ userId: req.user!.id }).select('_id');
    if (!patient) throw new AppError(403, 'Patient profile not found');
    filter.patientId = patient._id;
  } else if (hasRole(req.user, ROLE_DOCTOR)) {
    const doctor = await Doctor.findOne({ userId: req.user!.id }).select('_id');
    if (!doctor) throw new AppError(403, 'Doctor profile not found');
    filter.requestedBy = doctor._id;
  } else {
    Object.assign(filter, tenantFilter(req, req.query.facilityId));
  }

  if (req.query.status) filter.status = req.query.status;
  if (req.query.appointmentId) filter.appointmentId = req.query.appointmentId;
  // A caller already pinned to one patient must not be able to choose another.
  if (req.query.patientId && !isPatient) filter.patientId = req.query.patientId;

  const total = await LaboratoryTest.countDocuments(filter);
  const tests = await LaboratoryTest.find(filter)
    .populate({ path: 'requestedBy', populate: { path: 'userId', select: 'fullName' } })
    .populate({ path: 'patientId', select: 'patientNumber', populate: { path: 'userId', select: 'fullName' } })
    .populate('appointmentId', 'appointmentDate timeSlot')
    .sort({ requestedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  success(res, 200, tests, paginate(page, limit, total));
}

/**
 * GET /api/lab-tests/:id
 */
export async function getLabTest(req: AuthRequest, res: Response) {
  const labTest = await LaboratoryTest.findById(req.params.id)
    .populate({ path: 'requestedBy', populate: { path: 'userId', select: 'fullName' } })
    .populate({ path: 'patientId', select: 'patientNumber allergies', populate: { path: 'userId', select: 'fullName phone' } })
    .populate('appointmentId', 'appointmentDate timeSlot status')
    .populate('facilityId', 'name')
    .lean();

  if (!labTest) throw new AppError(404, 'Lab test not found');

  // Access check
  if (hasRole(req.user, ROLE_PATIENT)) {
    const patient = await Patient.findOne({ userId: req.user!.id }).select('_id');
    if (!patient || String(patient._id) !== String(toObjectId(populatedId(labTest.patientId)))) {
      throw new AppError(403, 'Forbidden');
    }
  } else {
    assertFacilityAccess(req, populatedId(labTest.facilityId));
  }

  success(res, 200, labTest);
}

// ── stubs (Phase 5 will implement real notifications) ────────────────────────

async function notifyLabStub(testId: string, testName: string) {
  console.log(`[notify-stub] Lab test requested: ${testId} — ${testName}`);
}

async function notifyAbnormalResultStub(testId: string, testName: string) {
  console.log(`[notify-stub] Abnormal result flagged: ${testId} — ${testName} — doctor/patient to be notified`);
}
