import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Notification, Patient } from '../models';
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

/** Patients are scoped by identity only; everyone else by hospital. */
export async function listNotifications(req: AuthRequest, res: Response) {
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
    type: body.type ?? 'general',
    title: body.title,
    body: body.body,
    link: body.link ?? null,
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
  } else {
    assertFacilityAccess(req, notification.facilityId);
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  success(res, 200, notification);
}

export async function markAllNotificationsRead(req: AuthRequest, res: Response) {
  const isPatient = hasRole(req.user, ROLE_PATIENT);
  const filter: Record<string, unknown> = { isRead: false };

  if (isPatient) {
    const patient = await Patient.findOne({ userId: req.user!.id }).select('_id');
    if (!patient) throw new AppError(403, 'Patient profile not found');
    filter.patientId = patient._id;
  } else {
    Object.assign(filter, tenantFilter(req, req.query.facilityId));
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
  } else {
    assertFacilityAccess(req, populatedId(notification.facilityId));
  }

  success(res, 200, notification);
}
