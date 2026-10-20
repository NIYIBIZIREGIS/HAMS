import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Prescription, MedicalRecord, Doctor, Patient } from '../models';
import { success } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { buildPrescriptionHtml } from '../services/pdfService';
import {
  assertFacilityAccess,
  hasRole,
  isSuperAdmin,
  tenantFilter,
  ROLE_DOCTOR,
  ROLE_PATIENT,
} from '../utils/tenancy';

/**
 * POST /api/prescriptions
 * Doctor creates a prescription linked to a medical record.
 * Checks patient allergies and warns if a prescribed medicine matches.
 */
export async function createPrescription(req: AuthRequest, res: Response) {
  const body = req.body as {
    medicalRecordId: string;
    medicines: { name: string; dosage: string; frequency: string; durationDays: number; instructions?: string }[];
    instructions?: string;
  };

  const doctor = await Doctor.findOne({ userId: req.user?.id }).select('_id facilityId');
  if (!doctor) throw new AppError(403, 'Doctor profile not found');

  const medicalRecord = await MedicalRecord.findById(body.medicalRecordId)
    .populate('patientId', 'allergies')
    .lean();
  if (!medicalRecord) throw new AppError(404, 'Medical record not found');

  if (String(medicalRecord.facilityId) !== String(doctor.facilityId)) {
    throw new AppError(403, 'Medical record belongs to a different facility');
  }

  // Allergy check — case-insensitive partial match
  const patientAllergies: string[] =
    (medicalRecord.patientId as unknown as { allergies?: string[] })?.allergies ?? [];

  const allergyWarnings: string[] = [];
  for (const med of body.medicines) {
    const hit = patientAllergies.find((a) =>
      med.name.toLowerCase().includes(a.toLowerCase()) ||
      a.toLowerCase().includes(med.name.toLowerCase())
    );
    if (hit) allergyWarnings.push(`${med.name} (patient allergic to: ${hit})`);
  }

  // One prescription per medical record
  const existing = await Prescription.findOne({ medicalRecordId: body.medicalRecordId });
  if (existing) throw new AppError(409, 'A prescription already exists for this medical record');

  const prescription = await Prescription.create({
    medicalRecordId: body.medicalRecordId,
    patientId: medicalRecord.patientId,
    doctorId: doctor._id,
    facilityId: doctor.facilityId,
    medicines: body.medicines,
    instructions: body.instructions,
    issuedAt: new Date(),
  });

  // Include allergy warnings in the response (non-blocking)
  success(res, 201, { prescription, allergyWarnings });
}

/**
 * GET /api/prescriptions/:id
 * View a prescription. Accessible to: doctor (own), patient (own), facility admin, super_admin.
 */
export async function getPrescription(req: AuthRequest, res: Response) {
  const prescription = await Prescription.findById(req.params.id)
    .populate('medicalRecordId', 'diagnosis symptoms')
    .populate('doctorId', 'specialization')
    .populate({ path: 'doctorId', populate: { path: 'userId', select: 'fullName' } })
    .populate('patientId', 'patientNumber allergies')
    .populate({ path: 'patientId', populate: { path: 'userId', select: 'fullName' } })
    .populate('facilityId', 'name')
    .lean();

  if (!prescription) throw new AppError(404, 'Prescription not found');
  await assertPrescriptionAccess(req, prescription);

  success(res, 200, prescription);
}

/**
 * GET /api/prescriptions/:id/pdf
 * Returns an HTML document (print-to-PDF) for the prescription.
 */
export async function getPrescriptionPdf(req: AuthRequest, res: Response) {
  const prescription = await Prescription.findById(req.params.id)
    .populate('doctorId', 'specialization')
    .populate({ path: 'doctorId', populate: { path: 'userId', select: 'fullName' } })
    .populate('patientId', 'patientNumber allergies')
    .populate({ path: 'patientId', populate: { path: 'userId', select: 'fullName' } })
    .populate('facilityId', 'name')
    .lean();

  if (!prescription) throw new AppError(404, 'Prescription not found');
  await assertPrescriptionAccess(req, prescription);

  const patientUser = (prescription.patientId as unknown as { userId?: { fullName?: string } })?.userId;
  const doctorUser = (prescription.doctorId as unknown as { userId?: { fullName?: string } })?.userId;
  const facilityName = (prescription.facilityId as unknown as { name?: string })?.name ?? 'HAS';
  const patientNumber = (prescription.patientId as unknown as { patientNumber?: string })?.patientNumber ?? '';
  const allergies = (prescription.patientId as unknown as { allergies?: string[] })?.allergies ?? [];

  const html = buildPrescriptionHtml({
    prescription: prescription as never,
    patientName: patientUser?.fullName ?? 'Patient',
    patientNumber,
    doctorName: doctorUser?.fullName ?? 'Doctor',
    facilityName,
    allergies,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="prescription-${String(prescription._id)}.html"`
  );
  res.send(html);
}

/**
 * GET /api/prescriptions — list prescriptions for the current user's context.
 * Patients see their own; doctors see their own; admins see facility-wide.
 */
export async function listPrescriptions(req: AuthRequest, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));

  const filter: Record<string, unknown> = {};
  const identity: Record<string, unknown> = {};

  if (hasRole(req.user, ROLE_PATIENT)) {
    const patient = await Patient.findOne({ userId: req.user!.id }).select('_id');
    if (!patient) throw new AppError(403, 'Patient profile not found');
    identity.patientId = patient._id;
  } else if (hasRole(req.user, ROLE_DOCTOR)) {
    const doctor = await Doctor.findOne({ userId: req.user!.id }).select('_id');
    if (!doctor) throw new AppError(403, 'Doctor profile not found');
    identity.doctorId = doctor._id;
  } else {
    Object.assign(filter, tenantFilter(req));
  }

  // Only a caller who is not already pinned to a single patient may choose one. Applying
  // this unconditionally overwrote the self-scope above, so `?patientId=<other>` let any
  // patient read somebody else's prescriptions.
  if (req.query.patientId && !hasRole(req.user, ROLE_PATIENT)) {
    filter.patientId = req.query.patientId;
  }

  // Identity constraints win over caller-supplied filters.
  Object.assign(filter, identity);

  const total = await Prescription.countDocuments(filter);
  const prescriptions = await Prescription.find(filter)
    .populate({ path: 'doctorId', populate: { path: 'userId', select: 'fullName' } })
    .populate({ path: 'patientId', select: 'patientNumber', populate: { path: 'userId', select: 'fullName' } })
    .sort({ issuedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  success(res, 200, prescriptions, { page, limit, total, pages: Math.ceil(total / limit) });
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function assertPrescriptionAccess(
  req: AuthRequest,
  prescription: { facilityId: { toString(): string }; patientId: unknown; doctorId: unknown }
) {
  if (isSuperAdmin(req.user)) return;

  if (hasRole(req.user, ROLE_PATIENT)) {
    const patient = await Patient.findOne({ userId: req.user!.id }).select('_id');
    if (!patient) throw new AppError(403, 'Patient profile not found');
    const patientDoc = prescription.patientId as { _id?: { toString(): string }; toString(): string };
    const prescriptionPatientId = patientDoc?._id?.toString?.() ?? patientDoc?.toString?.();
    if (String(patient._id) !== prescriptionPatientId) throw new AppError(403, 'Forbidden');
    return;
  }

  assertFacilityAccess(req, prescription.facilityId);
}
