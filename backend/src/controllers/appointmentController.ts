import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Appointment, Doctor, Patient, APPOINTMENT_STATUSES, type AppointmentStatus, Notification, User } from '../models';
import { success, paginate } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { bookAppointment, assertValidTransition, nextQueueNumber } from '../services/bookingService';
import { grantMembership } from '../services/patientFacilityService';
import {
  assertFacilityAccess,
  hasRole,
  isSuperAdmin,
  tenantFilter,
  ROLE_DOCTOR,
  ROLE_PATIENT,
} from '../utils/tenancy';

export async function listAppointments(req: AuthRequest, res: Response) {
  const page = parseInt(String(req.query.page ?? '1'), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
  const filter: Record<string, unknown> = {};

  // Constraints derived from who is asking. These are computed from the authenticated
  // principal and are re-applied after the query filters below, so a `patientId` or
  // `doctorId` query parameter can never widen what the caller is allowed to see.
  const identity: Record<string, unknown> = {};
  const isPatient = hasRole(req.user, ROLE_PATIENT);

  if (isPatient) {
    const patient = await Patient.findOne({ userId: req.user?.id }).select('_id');
    if (!patient) throw new AppError(403, 'Patient profile not found');
    identity.patientId = patient._id;
  } else if (hasRole(req.user, ROLE_DOCTOR)) {
    const doctor = await Doctor.findOne({ userId: req.user?.id }).select('_id');
    if (!doctor) throw new AppError(403, 'Doctor profile not found');
    identity.doctorId = doctor._id;
  }

  if (req.query.patientId) filter.patientId = req.query.patientId;

  // A comma-separated status is matched as a set so the portal can drive its tabs from the
  // server. A single value still works, and the values are checked against the enum so this
  // cannot be used to smuggle in an arbitrary field.
  if (req.query.status) {
    const requested = String(req.query.status)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const known = requested.filter((value) => APPOINTMENT_STATUSES.includes(value as AppointmentStatus));
    if (known.length > 0) {
      filter.status = known.length === 1 ? known[0] : { $in: known };
    }
  }

  if (req.query.doctorId) filter.doctorId = req.query.doctorId;
  if (req.query.departmentId) filter.departmentId = req.query.departmentId;
  if (req.query.date) {
    const start = new Date(req.query.date as string);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    filter.appointmentDate = { $gte: start, $lte: end };
  }

  // Range filter, applied after `date` so an explicit single day still wins when both are sent.
  if (req.query.dateFrom || req.query.dateTo) {
    const range: Record<string, Date> = {};
    if (req.query.dateFrom) {
      const from = new Date(req.query.dateFrom as string);
      from.setHours(0, 0, 0, 0);
      range.$gte = from;
    }
    if (req.query.dateTo) {
      const to = new Date(req.query.dateTo as string);
      to.setHours(23, 59, 59, 999);
      range.$lte = to;
    }
    filter.appointmentDate = range;
  }

  // Patients attend several hospitals, so they are scoped by patient identity alone.
  // Everyone else is pinned to their own hospital: `tenantFilter` rejects a
  // `facilityId` that names a different hospital instead of honouring it.
  if (!isPatient) {
    Object.assign(filter, tenantFilter(req, req.query.facilityId));
  }

  // Identity constraints win over anything the caller supplied.
  Object.assign(filter, identity);

  const total = await Appointment.countDocuments(filter);
  const appointments = await Appointment.find(filter)
    .populate('patientId', 'patientNumber')
    .populate({
      path: 'patientId',
      populate: { path: 'userId', select: 'fullName phone' },
    })
    .populate('doctorId', 'specialization')
    .populate({ path: 'doctorId', populate: { path: 'userId', select: 'fullName' } })
    .populate('departmentId', 'name')
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ appointmentDate: -1, timeSlot: 1 })
    .lean();
  success(res, 200, appointments, paginate(page, limit, total));
}

export async function getAppointment(req: AuthRequest, res: Response) {
  const appointment = await Appointment.findById(req.params.id)
    .populate('patientId')
    .populate({ path: 'patientId', populate: { path: 'userId', select: 'fullName phone' } })
    .populate('doctorId')
    .populate({ path: 'doctorId', populate: { path: 'userId', select: 'fullName' } })
    .populate('departmentId', 'name')
    .populate('facilityId', 'name')
    .lean();
  if (!appointment) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, appointment);
  success(res, 200, appointment);
}

export async function createAppointment(req: AuthRequest, res: Response) {
  const body = req.body as {
    doctorId: string;
    departmentId: string;
    appointmentDate: string;
    timeSlot: string;
    reason?: string;
    visitType?: 'new' | 'follow-up' | 'referral';
    bookingChannel?: 'web' | 'mobile' | 'sms' | 'ussd' | 'walk_in' | 'referral';
    patientId?: string;
    facilityId?: string;
  };

  let patientId: string;
  if (hasRole(req.user, ROLE_PATIENT)) {
    // Patients can only book for themselves — ignore any supplied patientId.
    const selfPatient = await Patient.findOne({ userId: req.user!.id }).select('_id');
    if (!selfPatient) throw new AppError(400, 'Patient profile not found');
    patientId = String(selfPatient._id);
  } else {
    if (!body.patientId) throw new AppError(400, 'patientId is required for staff bookings');
    patientId = body.patientId;
  }

  // Hospital staff are pinned to their own hospital. A platform admin must name one, and
  // a patient chooses the hospital they are booking into.
  let facilityId: string | undefined;
  if (isSuperAdmin(req.user)) {
    facilityId = body.facilityId;
    if (!facilityId) throw new AppError(400, 'Facility context required');
  } else if (hasRole(req.user, ROLE_PATIENT)) {
    facilityId = body.facilityId ?? (req.user?.facilityId as string | undefined);
  } else {
    facilityId = req.user?.facilityId as string | undefined;
  }
  if (!facilityId) throw new AppError(400, 'Facility context required');

  const appointment = await bookAppointment({
    facilityId,
    patientId,
    doctorId: body.doctorId,
    departmentId: body.departmentId,
    appointmentDate: new Date(body.appointmentDate),
    timeSlot: body.timeSlot,
    reason: body.reason,
    visitType: body.visitType,
    bookingChannel: body.bookingChannel,
  });

  // Booking is how a patient joins a hospital. Recording the membership here means the
  // hospital can open that patient's record from the day they are treated, rather than only
  // inferring it from the appointment. Idempotent, and deliberately does not make the booked
  // hospital the patient's home unless they had none.
  await grantMembership(patientId, facilityId, { registeredBy: req.user?.id });

  try {
    const doc = await Doctor.findById(body.doctorId).select('userId facilityId');
    const doctorUserId = doc?.userId;
    // Notify doctor
    if (doc && doctorUserId) {
      await Notification.create({
        doctorId: doc._id,
        facilityId: doc.facilityId || facilityId,
        recipientType: 'doctor',
        type: 'appointment',
        title: 'New appointment request',
        body: `A patient has requested an appointment on ${new Date(body.appointmentDate).toLocaleDateString()} at ${body.timeSlot}.`,
        link: '/appointments',
      });
    }
    // Notify patient
    await Notification.create({
      patientId,
      facilityId,
      recipientType: 'patient',
      type: 'appointment',
      title: 'Appointment requested',
      body: `Your appointment request has been submitted for ${new Date(body.appointmentDate).toLocaleDateString()} at ${body.timeSlot}.`,
      link: '/appointments',
    });
  } catch (err) {
    console.error('[notification] appointment create notify failed:', err instanceof Error ? err.message : err);
  }

  success(res, 201, appointment);
}

export async function updateAppointment(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  // Whitelisted edits. Spreading `req.body` here would let a caller rewrite
  // `facilityId` and move an appointment into another hospital, or bypass the status
  // state machine by writing `status` directly.
  const updates: Record<string, unknown> = {};
  for (const field of ['appointmentDate', 'timeSlot', 'reason', 'visitType', 'doctorId', 'departmentId'] as const) {
    if (field in req.body) updates[field] = req.body[field];
  }
  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'No updatable fields supplied');
  }

  const changedDate = updates.appointmentDate || existing.appointmentDate;
  const changedSlot = updates.timeSlot || existing.timeSlot;
  const changedDoctor = updates.doctorId || String(existing.doctorId);

  if (updates.timeSlot || updates.appointmentDate || updates.doctorId) {
    const conflict = await Appointment.findOne({
      doctorId: changedDoctor,
      appointmentDate: new Date(changedDate as string),
      timeSlot: changedSlot,
      status: { $nin: ['Cancelled', 'Rejected'] },
      _id: { $ne: existing._id },
    });
    if (conflict) throw new AppError(409, 'That slot is already booked');
  }

  const updated = await Appointment.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  success(res, 200, updated);
}

export async function updateStatus(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  const body = req.body as { status: string; cancellationReason?: string };
  assertValidTransition(existing.status, body.status as never);

  const updates: Record<string, unknown> = { status: body.status };
  if (body.status === 'Checked In') updates.checkInTime = new Date();
  if (body.status === 'Completed') updates.completedAt = new Date();
  if (body.cancellationReason) updates.cancellationReason = body.cancellationReason;

  const updated = await Appointment.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  try {
    if (body.status) {
      const apptFull = await Appointment.findById(req.params.id).populate('patientId').populate('doctorId');
      if (apptFull) {
        const p = apptFull.patientId as any;
        const d = apptFull.doctorId as any;
        if (p && p._id) {
          await Notification.create({
            patientId: p._id,
            facilityId: apptFull.facilityId,
            recipientType: 'patient',
            type: 'appointment',
            title: `Appointment ${body.status}`,
            body: `Your appointment status has been updated to ${body.status}.`,
            link: '/appointments',
          });
        }
        if (d && d._id) {
          await Notification.create({
            doctorId: d._id,
            facilityId: apptFull.facilityId,
            recipientType: 'doctor',
            type: 'appointment',
            title: `Appointment ${body.status}`,
            body: `An appointment status has been updated to ${body.status}.`,
            link: '/appointments',
          });
        }
      }
    }
  } catch (err) {
    console.error('[notification] appointment status notify failed:', err instanceof Error ? err.message : err);
  }
  success(res, 200, updated);
}

export async function checkIn(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  if (['Cancelled', 'Rejected', 'Completed', 'Missed'].includes(existing.status)) {
    throw new AppError(409, `Cannot check in an appointment with status "${existing.status}"`);
  }

  const queueNumber = existing.queueNumber ?? (await nextQueueNumber(String(existing.facilityId), existing.appointmentDate));
  const updated = await Appointment.findByIdAndUpdate(
    req.params.id,
    { status: 'Checked In', checkInTime: new Date(), queueNumber },
    { new: true }
  );
  try {
    const apptFull = await Appointment.findById(req.params.id).populate('patientId').populate('doctorId');
    if (apptFull) {
      const p = apptFull.patientId as any;
      const d = apptFull.doctorId as any;
      if (p && p._id) {
        await Notification.create({
          patientId: p._id,
          facilityId: apptFull.facilityId,
          recipientType: 'patient',
          type: 'appointment',
          title: 'Appointment checked in',
          body: 'Your appointment has been checked in.',
          link: '/appointments',
        });
      }
      if (d && d._id) {
        await Notification.create({
          doctorId: d._id,
          facilityId: apptFull.facilityId,
          recipientType: 'doctor',
          type: 'appointment',
          title: 'Appointment checked in',
          body: 'An appointment has been checked in.',
          link: '/appointments',
        });
      }
    }
  } catch (err) {
    console.error('[notification] checkin notify failed:', err instanceof Error ? err.message : err);
  }
  success(res, 200, updated);
}

export async function cancelAppointment(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  assertValidTransition(existing.status, 'Cancelled');
  const body = req.body as { cancellationReason?: string };
  const updated = await Appointment.findByIdAndUpdate(
    req.params.id,
    { status: 'Cancelled', cancellationReason: body.cancellationReason ?? '' },
    { new: true }
  );
  try {
    const apptFull = await Appointment.findById(req.params.id).populate('patientId').populate('doctorId');
    if (apptFull) {
      const p = apptFull.patientId as any;
      const d = apptFull.doctorId as any;
      if (p && p._id) {
        await Notification.create({
          patientId: p._id,
          facilityId: apptFull.facilityId,
          recipientType: 'patient',
          type: 'appointment',
          title: 'Appointment cancelled',
          body: 'Your appointment has been cancelled.',
          link: '/appointments',
        });
      }
      if (d && d._id) {
        await Notification.create({
          doctorId: d._id,
          facilityId: apptFull.facilityId,
          recipientType: 'doctor',
          type: 'appointment',
          title: 'Appointment cancelled',
          body: 'An appointment has been cancelled.',
          link: '/appointments',
        });
      }
    }
  } catch (err) {
    console.error('[notification] cancel notify failed:', err instanceof Error ? err.message : err);
  }
  success(res, 200, updated);
}

/**
 * Inbound SMS/USSD gateway webhook.
 *
 * Reached only after `verifySmsSignature` has established that the gateway sent this, so the
 * body can be treated as provider data. It acknowledges rather than acting on the payload:
 * delivery receipts and inbound messages are a separate feature, and a webhook that starts
 * mutating appointments from a third party's field names is how unsolicited booking happens.
 * The payload is summarised rather than echoed wholesale so an oversized or unexpected body
 * cannot be reflected back at the caller.
 */
export async function smsWebhook(req: AuthRequest, res: Response) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const fields = Object.keys(body).slice(0, 20);
  success(res, 200, {
    received: true,
    fields,
    deliveryId: req.get('x-sms-delivery-id') ?? req.get('x-delivery-id') ?? null,
  });
}

async function assertAccess(
  req: AuthRequest,
  appointment: {
    facilityId: { toString(): string };
    doctorId: { toString(): string };
    patientId: { toString(): string };
  }
) {
  if (isSuperAdmin(req.user)) return;

  if (hasRole(req.user, ROLE_PATIENT)) {
    // Patients are not hospital staff, so the facility check does not apply to them; they
    // reach their appointments across hospitals and are instead checked for ownership.
    const patient = await Patient.findById(appointment.patientId).select('userId');
    if (!patient || String(patient.userId) !== req.user?.id) {
      throw new AppError(403, 'Forbidden');
    }
    return;
  }

  if (hasRole(req.user, ROLE_DOCTOR)) {
    const doctor = await Doctor.findById(appointment.doctorId).select('userId');
    if (doctor && String(doctor.userId) === req.user?.id) return;
    throw new AppError(403, 'Forbidden: appointment belongs to another doctor');
  }

  // `assertFacilityAccess` fails closed when the caller's account has no hospital
  // assigned, so a misconfigured account cannot fall through to an unscoped read.
  assertFacilityAccess(req, appointment.facilityId);
}
