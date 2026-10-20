import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PatientDocument, Patient } from '../models';
import { success, paginate } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { assertPatientReachable } from '../services/patientAccess';
import {
  assertFacilityAccess,
  hasRole,
  populatedId,
  resolveAssignmentTarget,
  tenantFilter,
  ROLE_PATIENT,
} from '../utils/tenancy';

export async function listPatientDocuments(req: AuthRequest, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));

  const isPatient = hasRole(req.user, ROLE_PATIENT);
  const filter: Record<string, unknown> = {};

  if (isPatient) {
    const patient = await Patient.findOne({ userId: req.user!.id }).select('_id');
    if (!patient) throw new AppError(403, 'Patient profile not found');
    filter.patientId = patient._id;
  } else {
    Object.assign(filter, tenantFilter(req, req.query.facilityId));
  }

  if (req.query.patientId && !isPatient) filter.patientId = req.query.patientId;
  if (req.query.category) filter.category = req.query.category;

  const total = await PatientDocument.countDocuments(filter);
  const documents = await PatientDocument.find(filter)
    .populate('uploadedBy', 'fullName')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  success(res, 200, documents, paginate(page, limit, total));
}

export async function getPatientDocument(req: AuthRequest, res: Response) {
  const document = await PatientDocument.findById(req.params.id)
    .populate('uploadedBy', 'fullName')
    .populate('facilityId', 'name')
    .populate('patientId', 'patientNumber userId')
    .lean();

  if (!document) throw new AppError(404, 'Document not found');

  if (hasRole(req.user, ROLE_PATIENT)) {
    const patient = await Patient.findOne({ userId: req.user!.id }).select('_id');
    if (!patient || String(patient._id) !== String((document.patientId as { _id?: unknown })?._id ?? document.patientId)) {
      throw new AppError(403, 'Forbidden');
    }
  } else {
    assertFacilityAccess(req, populatedId(document.facilityId));
  }

  success(res, 200, document);
}

export async function createPatientDocument(req: AuthRequest, res: Response) {
  const body = req.body as {
    patientId: string;
    category?: string;
    title: string;
    fileName: string;
    fileUrl: string;
    mimeType?: string;
    sizeBytes?: number;
    facilityId?: string;
  };

  if (!req.user) throw new AppError(401, 'Unauthenticated');

  // A platform admin must name the hospital; a hospital admin is pinned to their own.
  const facilityId = resolveAssignmentTarget(req, body.facilityId);

  const patient = await Patient.findById(body.patientId).select('_id facilityId');
  if (!patient) throw new AppError(404, 'Patient not found');

  // Stamping the caller's hospital on a document attached to an arbitrary patient
  // produced internally inconsistent rows and handed hospital A's uploads to hospital B's
  // patient, because patient reads are scoped by patientId rather than by hospital.
  await assertPatientReachable(req, patient, facilityId);

  const document = await PatientDocument.create({
    facilityId,
    patientId: patient._id,
    category: body.category ?? 'general',
    title: body.title,
    fileName: body.fileName,
    fileUrl: body.fileUrl,
    mimeType: body.mimeType ?? null,
    sizeBytes: body.sizeBytes ?? null,
    uploadedBy: req.user.id,
  });

  success(res, 201, document);
}
