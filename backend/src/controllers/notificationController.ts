import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Notification, Patient, Doctor } from '../models';
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
  ROLE_DOCTOR,
} from '../utils/tenancy';

function buildRecipientFilter(req: AuthRequest): Record<string, unknown> {
  if (hasRole(req.user, ROLE_PATIENT)) {
    // Prefer patient-scoped notifications; still allow user-scoped if present
    return {};
  }
  return tenantFilter(req, req.query.facilityId);
}

export async function listNotifications(req: AuthRequest, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));

  const isPatient = hasRole(req.user, ROLE_PATIENT);
  const isDoctor = hasRole(req.user, ROLE_DOCTOR);
  const filter: Record<string, unknown> = {};

  if (isPatient) {
    const patient = await Patient.findOne({ userId: req.user!.id }).select('_id');
    if (!patient) throw new AppError(403, 'Patient profile not found');
    filter.patientId = patient._id;
  } else if (isDoctor) {
    const doctor = await Doctor.findOne({ userId: req.user!.id }).select('_id');
    if (!doctor) throw new AppError(403, 'Doctor profile not found');
    filter.doctorId = doctor._id;
  } else {
    Object.assign(filter, buildRecipientFilter(req));
    if (req.user?.id) {
      filter.$or = [{ userId: req.user.id }, { facilityId: filter.facilityId }].filter(Boolean) as any;
      // Simplify: also allow user-scoped
      delete (filter as any).$or;
      filter.$or = [{ userId: req.user.id }, ...(filter.facilityId ? [{ facilityId: filter.facilityId }] : [])];
    }
  }

  if (req.query.patientId && !isPatient && !isDoctor) filter.patientId = req.query.patientId;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.unread === 'true') filter.isRead = false;

  const total = await Notification.countDocuments(filter);
  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  success(res, 200, notifications, paginate(page, limit, total));
}

export async function createNotification(req: AuthRequest, res: Response) {
  const body = req.body as {
    patientId: string;
    type?: string;
    title: string;
    body: string;
    link?: string;
    facilityId?: string;
  };

  // A platform admin must name the hospital; a hospital admin is pinned to their own.
  const facilityId = resolveAssignmentTarget(req, body.facilityId);

  const patient = await Patient.findById(body.patientId).select('_id facilityId');
  if (!patient) throw new AppError(404, 'Patient not found');

  // Guards against writing into another hospital's patient inbox, which the recipient
  // could read because patient reads are scoped by patientId rather than by hospital.
  await assertPatientReachable(req, patient, facilityId);

  const notification = await Notification.create({
    facilityId,
    patientId: patient._id,
    recipientType: 'patient',
    type: body.type ?? 'general',
    title: body.title,
    body: body.body,
    link: body.link ?? undefined,
    isRead: false,
  });

  success(res, 201, notification);
}

export async function markNotificationRead(req: AuthRequest, res: Response) {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw new AppError(404, 'Notification not found');

  if (hasRole(req.user, ROLE_PATIENT)) {
    const patient = await Patient.findOne({ userId: req.user!.id }).select('_id');
    if (!patient || String(patient._id) !== String(notification.patientId)) {
      throw new AppError(403, 'Forbidden');
    }
  } else if (hasRole(req.user, ROLE_DOCTOR)) {
    const doctor = await Doctor.findOne({ userId: req.user!.id }).select('_id');
    if (!doctor || String(doctor._id) !== String(notification.doctorId)) {
      throw new AppError(403, 'Forbidden');
    }
  } else {
    // Allow if scoped to user or facility
    if (notification.userId && String(notification.userId) === req.user?.id) {
      // ok
    } else if (notification.facilityId) {
      assertFacilityAccess(req, notification.facilityId);
    } else if (!notification.userId && !notification.patientId && !notification.doctorId) {
      // global? unlikely
    } else {
      throw new AppError(403, 'Forbidden');
    }
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  success(res, 200, notification);
}

export async function markAllNotificationsRead(req: AuthRequest, res: Response) {
  const isPatient = hasRole(req.user, ROLE_PATIENT);
  const isDoctor = hasRole(req.user, ROLE_DOCTOR);
  const filter: Record<string, unknown> = { isRead: false };

  if (isPatient) {
    const patient = await Patient.findOne({ userId: req.user!.id }).select('_id');
    if (!patient) throw new AppError(403, 'Patient profile not found');
    filter.patientId = patient._id;
  } else if (isDoctor) {
    const doctor = await Doctor.findOne({ userId: req.user!.id }).select('_id');
    if (!doctor) throw new AppError(403, 'Doctor profile not found');
    filter.doctorId = doctor._id;
  } else {
    if (req.user?.id) {
      filter.$or = [{ userId: req.user.id }];
      try {
        const tf = tenantFilter(req, req.query.facilityId);
        if ((tf as any).facilityId) (filter.$or as any[]).push({ facilityId: (tf as any).facilityId });
      } catch {}
    } else {
      Object.assign(filter, tenantFilter(req, req.query.facilityId));
    }
  }

  await Notification.updateMany(filter, { isRead: true, readAt: new Date() });

  const remaining = await Notification.countDocuments({ ...filter, isRead: false });

  success(res, 200, { remainingUnread: remaining });
}

export async function getNotification(req: AuthRequest, res: Response) {
  const notification = await Notification.findById(req.params.id).populate('facilityId', 'name').lean();

  if (!notification) throw new AppError(404, 'Notification not found');

  if (hasRole(req.user, ROLE_PATIENT)) {
    const patient = await Patient.findOne({ userId: req.user!.id }).select('_id');
    if (!patient || String(patient._id) !== String((notification.patientId as { _id?: unknown })?._id ?? notification.patientId)) {
      throw new AppError(403, 'Forbidden');
    }
  } else if (hasRole(req.user, ROLE_DOCTOR)) {
    const doctor = await Doctor.findOne({ userId: req.user!.id }).select('_id');
    if (!doctor || String(doctor._id) !== String((notification.doctorId as any)?._id ?? notification.doctorId)) {
      throw new AppError(403, 'Forbidden');
    }
  } else {
    if (notification.userId && String(notification.userId) === req.user?.id) {
      // ok
    } else if (notification.facilityId) {
      assertFacilityAccess(req, populatedId(notification.facilityId));
    } else {
      throw new AppError(403, 'Forbidden');
    }
  }

  success(res, 200, notification);
}
