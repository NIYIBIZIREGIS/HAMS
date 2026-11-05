import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  Appointment,
  AppointmentHistory,
  Doctor,
  Patient,
  User,
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
  type IAppointment,
  Notification,
  MedicalRecord,
  LaboratoryTest,
  PatientDocument,
  Message,
} from '../models';
import { success, paginate } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { bookAppointment, assertValidTransition, nextQueueNumber } from '../services/bookingService';
import { assertSlotIsAvailable } from '../services/appointmentConflictService';
import { grantMembership } from '../services/patientFacilityService';
import {
  assertFacilityAccess,
  hasRole,
  isSuperAdmin,
  tenantFilter,
  ROLE_DOCTOR,
  ROLE_PATIENT,
} from '../utils/tenancy';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatAppointmentDate(value: Date | string): string {
  return new Date(value).toLocaleDateString();
}

function appointmentLinks(id: string) {
  return {
    patient: `/appointments/${id}`,
    doctor: `/doctor/appointments/${id}`,
  };
}

const PATIENT_VISIBLE_MEETING_LINK_STATUSES: AppointmentStatus[] = [
  'Confirmed',
  'Checked In',
  'In Progress',
  'Completed',
];

const MEETING_LINK_EDITABLE_STATUSES: AppointmentStatus[] = [
  'Pending',
  'Confirmed',
  'Checked In',
  'In Progress',
  'Reschedule Proposed',
];

function redactMeetingLink<T extends { status?: AppointmentStatus; meetingLink?: string | null }>(
  req: AuthRequest,
  appointment: T
): T {
  if (!hasRole(req.user, ROLE_PATIENT) || !appointment.meetingLink) return appointment;
  if (appointment.status && PATIENT_VISIBLE_MEETING_LINK_STATUSES.includes(appointment.status)) {
    return appointment;
  }
  return { ...appointment, meetingLink: undefined };
}

async function recordTransition(
  appointment: IAppointment,
  toStatus: AppointmentStatus,
  changedBy: string,
  note?: string
): Promise<void> {
  try {
    await AppointmentHistory.create({
      appointmentId: appointment._id,
      facilityId: appointment.facilityId,
      fromStatus: appointment.status,
      toStatus,
      changedBy,
      note,
    });
  } catch (err) {
    // The status change is already committed; do not turn a successful clinical action
    // into an error merely because the audit row could not be written.
    console.error('[appointment-history] write failed:', err instanceof Error ? err.message : err);
  }
}

async function transitionAtomically(
  existing: IAppointment,
  toStatus: AppointmentStatus,
  updates: Record<string, unknown>
): Promise<IAppointment> {
  const updated = await Appointment.findOneAndUpdate(
    { _id: existing._id, status: existing.status },
    { $set: { ...updates, status: toStatus } },
    { new: true, runValidators: true }
  );
  if (!updated) {
    throw new AppError(409, 'This appointment changed while you were acting on it. Refresh and try again.');
  }
  return updated;
}

async function doctorDisplayName(doctorId: unknown): Promise<string> {
  const doctor = await Doctor.findById(doctorId)
    .populate('userId', 'fullName')
    .lean<{ userId?: { fullName?: string } }>();
  return doctor?.userId?.fullName ?? 'your doctor';
}

async function notifyPatientAboutAppointment(
  appointment: { _id: unknown; patientId: unknown; facilityId: unknown },
  title: string,
  body: string
): Promise<void> {
  try {
    await Notification.create({
      patientId: appointment.patientId,
      facilityId: appointment.facilityId,
      appointmentId: appointment._id,
      recipientType: 'patient',
      type: 'appointment',
      title,
      body,
      link: appointmentLinks(String(appointment._id)).patient,
    });
  } catch (err) {
    console.error('[notification] appointment notify failed:', err instanceof Error ? err.message : err);
  }
}

async function notifyDoctorAboutAppointment(
  appointment: { _id: unknown; doctorId: unknown; facilityId: unknown },
  title: string,
  body: string
): Promise<void> {
  try {
    await Notification.create({
      doctorId: appointment.doctorId,
      facilityId: appointment.facilityId,
      appointmentId: appointment._id,
      recipientType: 'doctor',
      type: 'appointment',
      title,
      body,
      link: appointmentLinks(String(appointment._id)).doctor,
    });
  } catch (err) {
    console.error('[notification] doctor appointment notify failed:', err instanceof Error ? err.message : err);
  }
}

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

  if (req.query.search) {
    const term = String(req.query.search).trim();
    if (term) {
      const pattern = new RegExp(escapeRegex(term), 'i');
      const matchingUsers = await User.find({ fullName: pattern }).select('_id').lean();
      const matchingPatients = await Patient.find({
        $or: [
          { userId: { $in: matchingUsers.map((user) => user._id) } },
          { patientNumber: pattern },
        ],
      })
        .select('_id')
        .lean();
      filter.patientId = { $in: matchingPatients.map((patient) => patient._id) };
    }
  }

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

  // An explicit single day wins when both `date` and a range are sent.
  if (!req.query.date && (req.query.dateFrom || req.query.dateTo)) {
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

  const sortDirection = req.query.sort === 'asc' ? 1 : -1;
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
    .sort({ appointmentDate: sortDirection, timeSlot: 1 })
    .lean();
  const visible = isPatient
    ? appointments.map((appointment) => redactMeetingLink(req, appointment))
    : appointments;
  success(res, 200, visible, paginate(page, limit, total));
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
  success(res, 200, redactMeetingLink(req, appointment));
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
        appointmentId: appointment._id,
        recipientType: 'doctor',
        type: 'appointment',
        title: 'New appointment request',
        body: `A patient has requested an appointment on ${new Date(body.appointmentDate).toLocaleDateString()} at ${body.timeSlot}.`,
        link: appointmentLinks(String(appointment._id)).doctor,
      });
    }
    // Notify patient
    await Notification.create({
      patientId,
      facilityId,
      appointmentId: appointment._id,
      recipientType: 'patient',
      type: 'appointment',
      title: 'Appointment requested',
      body: `Your appointment request has been submitted for ${new Date(body.appointmentDate).toLocaleDateString()} at ${body.timeSlot}.`,
      link: appointmentLinks(String(appointment._id)).patient,
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
  const changedSlot = String(updates.timeSlot || existing.timeSlot);
  const changedDoctor = String(updates.doctorId || existing.doctorId);

  if (updates.timeSlot || updates.appointmentDate || updates.doctorId) {
    await assertSlotIsAvailable({
      doctorId: changedDoctor,
      appointmentDate: new Date(changedDate as string),
      timeSlot: changedSlot,
      excludeAppointmentId: String(existing._id),
    });
  }

  const updated = await Appointment.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  success(res, 200, updated);
}

export async function updateAppointmentMeetingLink(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  if (!MEETING_LINK_EDITABLE_STATUSES.includes(existing.status)) {
    throw new AppError(
      409,
      `A meeting link cannot be set for an appointment with status "${existing.status}"`
    );
  }

  const raw = req.body.meetingLink as string | null;
  const meetingLink = typeof raw === 'string' ? raw.trim() : null;
  const updated = await Appointment.findByIdAndUpdate(
    req.params.id,
    meetingLink ? { $set: { meetingLink } } : { $unset: { meetingLink: 1 } },
    { new: true, runValidators: true }
  );
  if (!updated) throw new AppError(404, 'Appointment not found');

  if (meetingLink && PATIENT_VISIBLE_MEETING_LINK_STATUSES.includes(updated.status)) {
    await notifyPatientAboutAppointment(
      updated,
      'Teleconsultation link available',
      `A video meeting link is now available for your appointment on ${formatAppointmentDate(updated.appointmentDate)} at ${updated.timeSlot}.`
    );
  }

  success(res, 200, updated);
}

async function notifyPatientAboutChatMessage(
  appointment: IAppointment,
  body: string
): Promise<void> {
  try {
    await Notification.create({
      patientId: appointment.patientId,
      facilityId: appointment.facilityId,
      recipientType: 'patient',
      type: 'message',
      title: 'New message from your doctor',
      body,
      link: '/messages',
    });
  } catch (err) {
    console.error(
      '[notification] consultation chat notify failed:',
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Consultation chat is scoped to one appointment rather than the general inbox. It is only
 * available once the doctor has moved the visit to "In Progress", which keeps the conversation
 * tied to an active consultation and gives the backend the same gate the UI shows.
 */
export async function getAppointmentChat(req: AuthRequest, res: Response) {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, appointment);

  if (appointment.status !== 'In Progress') {
    throw new AppError(409, 'Chat is available once the consultation has started');
  }

  const root = await Message.findOne({
    appointmentId: appointment._id,
    patientId: appointment.patientId,
    facilityId: appointment.facilityId,
  }).sort({ createdAt: 1 });

  if (!root) {
    success(res, 200, { threadId: null, messages: [] });
    return;
  }

  const threadId = root.threadId ?? root._id;
  const messages = await Message.find({
    appointmentId: appointment._id,
    $or: [{ threadId }, { _id: threadId }],
  })
    .sort({ createdAt: 1 })
    .lean();

  await Message.updateMany(
    {
      _id: { $in: messages.map((message) => message._id) },
      direction: 'to_staff',
      isRead: false,
    },
    { $set: { isRead: true, readAt: new Date() } }
  );

  success(res, 200, { threadId, messages });
}

export async function sendAppointmentChatMessage(req: AuthRequest, res: Response) {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, appointment);

  if (appointment.status !== 'In Progress') {
    throw new AppError(409, 'Chat is available once the consultation has started');
  }

  const { body } = req.body as { body: string };
  const sender = await User.findById(req.user!.id).select('fullName').lean();
  const senderName = sender?.fullName ?? 'Doctor';

  const root = await Message.findOne({
    appointmentId: appointment._id,
    patientId: appointment.patientId,
    facilityId: appointment.facilityId,
  }).sort({ createdAt: 1 });

  let message;
  if (root) {
    message = await Message.create({
      facilityId: appointment.facilityId,
      patientId: appointment.patientId,
      appointmentId: appointment._id,
      threadId: root.threadId ?? root._id,
      direction: 'to_patient',
      senderUserId: req.user!.id,
      senderName,
      subject: root.subject,
      body,
      isRead: false,
    });
  } else {
    message = await Message.create({
      facilityId: appointment.facilityId,
      patientId: appointment.patientId,
      appointmentId: appointment._id,
      direction: 'to_patient',
      senderUserId: req.user!.id,
      senderName,
      subject: `Consultation chat - ${formatAppointmentDate(appointment.appointmentDate)}`,
      body,
      isRead: false,
    });
    message.threadId = message._id;
    await message.save();
  }

  await notifyPatientAboutChatMessage(
    appointment,
    `You have a new consultation message from ${senderName}.`
  );

  success(res, 201, message);
}

export async function acceptAppointment(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  if (existing.status !== 'Pending') {
    throw new AppError(409, `Only pending appointments can be accepted (current status: ${existing.status})`);
  }
  assertValidTransition(existing.status, 'Confirmed');

  const decidedAt = new Date();
  const updated = await transitionAtomically(existing, 'Confirmed', {
    decidedBy: req.user!.id,
    decidedAt,
  });
  await recordTransition(existing, 'Confirmed', req.user!.id);

  const doctorName = await doctorDisplayName(updated.doctorId);
  await notifyPatientAboutAppointment(
    updated,
    'Appointment confirmed',
    `Your appointment on ${formatAppointmentDate(updated.appointmentDate)} at ${updated.timeSlot} with ${doctorName} has been confirmed.`
  );
  success(res, 200, updated);
}

export async function declineAppointment(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  if (existing.status !== 'Pending') {
    throw new AppError(409, `Only pending appointments can be declined (current status: ${existing.status})`);
  }
  assertValidTransition(existing.status, 'Declined');

  const reason = String((req.body as { reason?: string }).reason ?? '').trim();
  if (!reason) throw new AppError(400, 'A decline reason is required');

  const decidedAt = new Date();
  const updated = await transitionAtomically(existing, 'Declined', {
    declineReason: reason,
    decidedBy: req.user!.id,
    decidedAt,
  });
  await recordTransition(existing, 'Declined', req.user!.id, reason);

  const doctorName = await doctorDisplayName(updated.doctorId);
  await notifyPatientAboutAppointment(
    updated,
    'Appointment declined',
    `Your appointment on ${formatAppointmentDate(updated.appointmentDate)} at ${updated.timeSlot} with ${doctorName} was declined. Reason: ${reason}`
  );
  success(res, 200, updated);
}

export async function proposeReschedule(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  if (existing.status !== 'Pending') {
    throw new AppError(409, `Only pending appointments can be rescheduled (current status: ${existing.status})`);
  }
  assertValidTransition(existing.status, 'Reschedule Proposed');

  const body = req.body as { appointmentDate: string; timeSlot: string; note?: string };
  const proposedDate = new Date(body.appointmentDate);
  await assertSlotIsAvailable({
    doctorId: String(existing.doctorId),
    appointmentDate: proposedDate,
    timeSlot: body.timeSlot,
    excludeAppointmentId: String(existing._id),
  });

  const proposedAt = new Date();
  const updated = await transitionAtomically(existing, 'Reschedule Proposed', {
    proposedDate,
    proposedTimeSlot: body.timeSlot,
    proposedNote: body.note ?? '',
    proposedBy: req.user!.id,
    proposedAt,
  });
  await recordTransition(
    existing,
    'Reschedule Proposed',
    req.user!.id,
    body.note || `Proposed ${formatAppointmentDate(proposedDate)} at ${body.timeSlot}`
  );

  await notifyPatientAboutAppointment(
    updated,
    'New appointment time proposed',
    `${await doctorDisplayName(updated.doctorId)} proposed ${formatAppointmentDate(proposedDate)} at ${body.timeSlot}.${body.note ? ` Note: ${body.note}` : ''} Please accept or reject this new time.`
  );
  success(res, 200, updated);
}

export async function respondToProposal(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  if (existing.status !== 'Reschedule Proposed') {
    throw new AppError(409, `Only a proposed reschedule can be answered (current status: ${existing.status})`);
  }
  if (!existing.proposedDate || !existing.proposedTimeSlot) {
    throw new AppError(409, 'This appointment does not have a proposed time');
  }

  const decision = String((req.params.decision ?? '').toLowerCase());
  if (decision !== 'accept' && decision !== 'reject') {
    throw new AppError(400, 'Decision must be accept or reject');
  }

  if (decision === 'accept') {
    await assertSlotIsAvailable({
      doctorId: String(existing.doctorId),
      appointmentDate: existing.proposedDate,
      timeSlot: existing.proposedTimeSlot,
      excludeAppointmentId: String(existing._id),
    });

    const updated = await transitionAtomically(existing, 'Confirmed', {
      appointmentDate: existing.proposedDate,
      timeSlot: existing.proposedTimeSlot,
      decidedBy: req.user!.id,
      decidedAt: new Date(),
    });
    await recordTransition(
      existing,
      'Confirmed',
      req.user!.id,
      `Patient accepted the proposed time: ${formatAppointmentDate(existing.proposedDate)} at ${existing.proposedTimeSlot}`
    );
    await notifyDoctorAboutAppointment(
      updated,
      'Reschedule accepted',
      `The patient accepted the proposed time on ${formatAppointmentDate(existing.proposedDate)} at ${existing.proposedTimeSlot}.`
    );
    return success(res, 200, updated);
  }

  const patientReason = String((req.body as { reason?: string }).reason ?? '').trim();
  const declineReason = patientReason
    ? `Patient rejected the proposed time: ${patientReason}`
    : 'Patient rejected the proposed time.';
  const updated = await transitionAtomically(existing, 'Declined', {
    declineReason,
    decidedBy: req.user!.id,
    decidedAt: new Date(),
  });
  await recordTransition(existing, 'Declined', req.user!.id, declineReason);
  await notifyDoctorAboutAppointment(
    updated,
    'Reschedule rejected',
    `The patient rejected the proposed time on ${formatAppointmentDate(existing.proposedDate)} at ${existing.proposedTimeSlot}.`
  );
  return success(res, 200, updated);
}

export async function rescheduleAppointment(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  if (existing.status !== 'Confirmed') {
    throw new AppError(409, `Only confirmed appointments can be rescheduled (current status: ${existing.status})`);
  }

  const body = req.body as {
    appointmentDate: string;
    timeSlot: string;
    reason?: string;
    note?: string;
  };
  const newDate = new Date(body.appointmentDate);
  await assertSlotIsAvailable({
    doctorId: String(existing.doctorId),
    appointmentDate: newDate,
    timeSlot: body.timeSlot,
    excludeAppointmentId: String(existing._id),
  });

  const updated = await transitionAtomically(existing, 'Confirmed', {
    appointmentDate: newDate,
    timeSlot: body.timeSlot,
  });
  const note = body.reason || body.note || `Rescheduled to ${formatAppointmentDate(newDate)} at ${body.timeSlot}`;
  await recordTransition(existing, 'Confirmed', req.user!.id, note);

  await notifyPatientAboutAppointment(
    updated,
    'Appointment rescheduled',
    `Your appointment has been moved to ${formatAppointmentDate(newDate)} at ${body.timeSlot}.${body.reason ? ` Reason: ${body.reason}` : ''}`
  );
  success(res, 200, updated);
}

export async function getAppointmentPatientSummary(req: AuthRequest, res: Response) {
  const appointment = await Appointment.findById(req.params.id)
    .select('patientId doctorId facilityId')
    .lean();
  if (!appointment) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, appointment);

  const scope = {
    patientId: appointment.patientId,
    facilityId: appointment.facilityId,
  };

  const [patient, medicalHistory, previousVisits, labResults, documents] = await Promise.all([
    Patient.findById(appointment.patientId)
      .populate('userId', 'fullName email phone profileImageUrl')
      .lean(),
    MedicalRecord.find({ ...scope })
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'fullName' } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    Appointment.find({
      ...scope,
      _id: { $ne: appointment._id },
      status: { $in: ['Completed', 'Checked In', 'In Progress'] },
    })
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'fullName' } })
      .populate('departmentId', 'name')
      .sort({ appointmentDate: -1 })
      .limit(10)
      .lean(),
    LaboratoryTest.find({ ...scope })
      .populate({ path: 'requestedBy', populate: { path: 'userId', select: 'fullName' } })
      .sort({ requestedAt: -1 })
      .limit(20)
      .lean(),
    PatientDocument.find({ ...scope })
      .populate('uploadedBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  if (!patient) throw new AppError(404, 'Patient not found');
  success(res, 200, { patient, medicalHistory, previousVisits, labResults, documents });
}

export async function updateStatus(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  const body = req.body as { status: AppointmentStatus; cancellationReason?: string };
  assertValidTransition(existing.status, body.status);
  if (body.status === 'Declined' && !body.cancellationReason) {
    throw new AppError(400, 'A decline reason is required');
  }

  const updates: Record<string, unknown> = {};
  const now = new Date();
  if (body.status === 'Checked In') updates.checkInTime = now;
  if (body.status === 'Completed') updates.completedAt = now;
  if (body.status === 'Confirmed' || body.status === 'Declined') {
    updates.decidedBy = req.user!.id;
    updates.decidedAt = now;
  }
  if (body.cancellationReason) updates.cancellationReason = body.cancellationReason;
  if (body.status === 'Declined') updates.declineReason = body.cancellationReason;

  const updated = await transitionAtomically(existing, body.status, updates);
  await recordTransition(existing, body.status, req.user!.id, body.cancellationReason);

  try {
    const p = updated.patientId as any;
    const d = updated.doctorId as any;
    if (p && p._id) {
      const suffix =
        body.status === 'Declined' || body.status === 'Cancelled'
          ? ` Reason: ${body.cancellationReason ?? 'No reason provided.'}`
          : '';
      await Notification.create({
        patientId: p._id,
        facilityId: updated.facilityId,
        appointmentId: updated._id,
        recipientType: 'patient',
        type: 'appointment',
        title: `Appointment ${body.status}`,
        body: `Your appointment status has been updated to ${body.status}.${suffix}`,
        link: appointmentLinks(String(updated._id)).patient,
      });
    }
    if (d && d._id) {
      await Notification.create({
        doctorId: d._id,
        facilityId: updated.facilityId,
        appointmentId: updated._id,
        recipientType: 'doctor',
        type: 'appointment',
        title: `Appointment ${body.status}`,
        body: `An appointment status has been updated to ${body.status}.`,
        link: appointmentLinks(String(updated._id)).doctor,
      });
    }
  } catch (err) {
    console.error('[notification] appointment status notify failed:', err instanceof Error ? err.message : err);
  }
  success(res, 200, updated);
}

async function doctorDayAction(
  req: AuthRequest,
  res: Response,
  toStatus: AppointmentStatus,
  allowedFrom: AppointmentStatus[],
  notificationTitle: string,
  notificationBody: string
) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  if (!allowedFrom.includes(existing.status)) {
    throw new AppError(
      409,
      `Cannot move this appointment to "${toStatus}" from "${existing.status}"`
    );
  }
  assertValidTransition(existing.status, toStatus);

  const updates: Record<string, unknown> = {};
  if (toStatus === 'Completed') updates.completedAt = new Date();

  const updated = await transitionAtomically(existing, toStatus, updates);
  await recordTransition(existing, toStatus, req.user!.id);
  await notifyPatientAboutAppointment(updated, notificationTitle, notificationBody);
  success(res, 200, updated);
}

export async function startConsultation(req: AuthRequest, res: Response) {
  await doctorDayAction(
    req,
    res,
    'In Progress',
    ['Confirmed', 'Checked In'],
    'Consultation started',
    'Your consultation has started.'
  );
}

export async function completeConsultation(req: AuthRequest, res: Response) {
  await doctorDayAction(
    req,
    res,
    'Completed',
    ['In Progress'],
    'Consultation completed',
    'Your consultation has been completed.'
  );
}

export async function markNoShow(req: AuthRequest, res: Response) {
  await doctorDayAction(
    req,
    res,
    'Missed',
    ['Confirmed', 'Checked In'],
    'Appointment marked as missed',
    'Your appointment was marked as a no-show because it was not attended.'
  );
}

export async function bookFollowUp(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  const clinicalStatuses: AppointmentStatus[] = ['Confirmed', 'Checked In', 'In Progress', 'Completed'];
  if (!clinicalStatuses.includes(existing.status)) {
    throw new AppError(409, `Cannot book a follow-up for an appointment with status "${existing.status}"`);
  }

  const body = req.body as {
    appointmentDate: string;
    timeSlot: string;
    note?: string;
    autoConfirm?: boolean;
  };

  const followUp = await bookAppointment({
    facilityId: String(existing.facilityId),
    patientId: String(existing.patientId),
    doctorId: String(existing.doctorId),
    departmentId: String(existing.departmentId),
    appointmentDate: new Date(body.appointmentDate),
    timeSlot: body.timeSlot,
    reason: body.note || `Follow-up for visit on ${formatAppointmentDate(existing.appointmentDate)}`,
    visitType: 'follow-up',
    bookingChannel: 'web',
  });

  let finalAppointment = followUp;
  if (body.autoConfirm !== false) {
    const confirmed = await Appointment.findByIdAndUpdate(
      followUp._id,
      { status: 'Confirmed', decidedBy: req.user!.id, decidedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (confirmed) {
      finalAppointment = confirmed;
      await recordTransition(followUp, 'Confirmed', req.user!.id, 'Follow-up auto-confirmed');
    }
  }

  const when = `${formatAppointmentDate(finalAppointment.appointmentDate)} at ${finalAppointment.timeSlot}`;
  if (finalAppointment.status === 'Confirmed') {
    await notifyPatientAboutAppointment(
      finalAppointment,
      'Follow-up booked',
      `Your follow-up appointment is confirmed for ${when}.`
    );
  } else {
    await notifyPatientAboutAppointment(
      finalAppointment,
      'Follow-up proposed',
      `A follow-up appointment is proposed for ${when}.`
    );
  }
  await notifyDoctorAboutAppointment(
    finalAppointment,
    finalAppointment.status === 'Confirmed' ? 'Follow-up booked' : 'Follow-up proposed',
    `A follow-up visit is ${finalAppointment.status.toLowerCase()} for ${when}.`
  );

  success(res, 201, finalAppointment);
}

export async function referPatient(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  const body = req.body as {
    targetDoctorId: string;
    note: string;
    appointmentDate?: string;
    timeSlot?: string;
  };

  if (String(existing.doctorId) === body.targetDoctorId) {
    throw new AppError(400, 'Choose a different doctor for the referral');
  }

  const targetDoctor = await Doctor.findById(body.targetDoctorId).select('_id facilityId departmentId');
  if (!targetDoctor) throw new AppError(404, 'Target doctor not found');
  if (String(targetDoctor.facilityId) !== String(existing.facilityId)) {
    throw new AppError(400, 'Referrals must be to a doctor at the same facility');
  }
  if (!targetDoctor.departmentId?.length) {
    throw new AppError(400, 'Target doctor has no department assigned');
  }

  const note = body.note.trim();
  let referralAppointment: IAppointment | null = null;
  if (body.appointmentDate && body.timeSlot) {
    referralAppointment = await bookAppointment({
      facilityId: String(existing.facilityId),
      patientId: String(existing.patientId),
      doctorId: String(targetDoctor._id),
      departmentId: String(targetDoctor.departmentId[0]),
      appointmentDate: new Date(body.appointmentDate),
      timeSlot: body.timeSlot,
      reason: `Referral: ${note}`,
      visitType: 'referral',
      bookingChannel: 'referral',
    });
  }

  const doctorLink = referralAppointment
    ? appointmentLinks(String(referralAppointment._id)).doctor
    : appointmentLinks(String(existing._id)).doctor;

  try {
    await Notification.create({
      doctorId: targetDoctor._id,
      facilityId: existing.facilityId,
      appointmentId: referralAppointment?._id ?? existing._id,
      recipientType: 'doctor',
      type: 'general',
      title: 'Patient referral',
      body: `A patient has been referred to you. Note: ${note}`,
      link: doctorLink,
    });
    await Notification.create({
      patientId: existing.patientId,
      facilityId: existing.facilityId,
      appointmentId: referralAppointment?._id ?? existing._id,
      recipientType: 'patient',
      type: 'general',
      title: referralAppointment ? 'Referral appointment created' : 'Referral created',
      body: referralAppointment
        ? `You have been referred to another doctor. A pending appointment was created for ${formatAppointmentDate(referralAppointment.appointmentDate)} at ${referralAppointment.timeSlot}.`
        : `You have been referred to another doctor. ${note}`,
      link: referralAppointment
        ? appointmentLinks(String(referralAppointment._id)).patient
        : appointmentLinks(String(existing._id)).patient,
    });
  } catch (err) {
    console.error('[notification] referral notify failed:', err instanceof Error ? err.message : err);
  }

  success(res, referralAppointment ? 201 : 200, {
    note,
    targetDoctorId: targetDoctor._id,
    appointment: referralAppointment,
  });
}

export async function checkIn(req: AuthRequest, res: Response) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) throw new AppError(404, 'Appointment not found');
  await assertAccess(req, existing);

  if (['Cancelled', 'Declined', 'Rejected', 'Completed', 'Missed'].includes(existing.status)) {
    throw new AppError(409, `Cannot check in an appointment with status "${existing.status}"`);
  }

  const queueNumber = existing.queueNumber ?? (await nextQueueNumber(String(existing.facilityId), existing.appointmentDate));
  const updated = await transitionAtomically(existing, 'Checked In', {
    checkInTime: new Date(),
    queueNumber,
  });
  await recordTransition(existing, 'Checked In', req.user!.id);
  await notifyPatientAboutAppointment(updated, 'Appointment checked in', 'Your appointment has been checked in.');
  try {
    const d = updated.doctorId as any;
    if (d && d._id) {
      await Notification.create({
        doctorId: d._id,
        facilityId: updated.facilityId,
        appointmentId: updated._id,
        recipientType: 'doctor',
        type: 'appointment',
        title: 'Appointment checked in',
        body: 'An appointment has been checked in.',
        link: appointmentLinks(String(updated._id)).doctor,
      });
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
  const body = req.body as { cancellationReason?: string; reason?: string };
  const cancellationReason = String(body.cancellationReason ?? body.reason ?? '').trim();
  if (hasRole(req.user, ROLE_DOCTOR) && !cancellationReason) {
    throw new AppError(400, 'A cancellation reason is required');
  }

  const updated = await transitionAtomically(existing, 'Cancelled', {
    cancellationReason,
  });
  await recordTransition(existing, 'Cancelled', req.user!.id, cancellationReason);
  await notifyPatientAboutAppointment(
    updated,
    'Appointment cancelled',
    `Your appointment has been cancelled.${cancellationReason ? ` Reason: ${cancellationReason}` : ''}`
  );
  try {
    const d = updated.doctorId as any;
    if (d && d._id) {
      await Notification.create({
        doctorId: d._id,
        facilityId: updated.facilityId,
        appointmentId: updated._id,
        recipientType: 'doctor',
        type: 'appointment',
        title: 'Appointment cancelled',
        body: 'An appointment has been cancelled.',
        link: appointmentLinks(String(updated._id)).doctor,
      });
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
