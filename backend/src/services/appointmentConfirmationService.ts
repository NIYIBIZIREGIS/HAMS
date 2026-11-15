import {
  Appointment,
  Department,
  Doctor,
  Facility,
  Message,
  Notification,
  type IAppointment,
} from '../models';

function formatAppointmentDate(value: Date | string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

async function confirmationContext(appointment: IAppointment) {
  const [doctor, department, facility] = await Promise.all([
    Doctor.findById(appointment.doctorId)
      .populate('userId', 'fullName')
      .lean<{ userId?: { _id?: unknown; fullName?: string } }>(),
    Department.findById(appointment.departmentId).select('name').lean<{ name?: string }>(),
    Facility.findById(appointment.facilityId).select('name address district').lean<{
      name?: string;
      address?: string;
      district?: string;
    }>(),
  ]);

  const doctorName = doctor?.userId?.fullName ?? 'your doctor';
  const departmentName = department?.name ?? 'your department';
  const facilityName = facility?.name ?? 'the hospital';
  const location = [facility?.name, facility?.address ?? facility?.district]
    .filter(Boolean)
    .join(', ') || facilityName;

  return {
    doctorName,
    doctorUserId: doctor?.userId?._id,
    departmentName,
    facilityName,
    location,
  };
}

function confirmationBody(
  appointment: IAppointment,
  context: Awaited<ReturnType<typeof confirmationContext>>
): { when: string; body: string } {
  const when = `${formatAppointmentDate(appointment.appointmentDate)} at ${appointment.timeSlot}`;
  const isOnline = Boolean(appointment.meetingLink);
  const location = isOnline
    ? `Online consultation - join using this link: ${appointment.meetingLink}`
    : `In person at ${context.location}`;
  const preparation = isOnline
    ? 'Please join 5 minutes before your appointment and test your camera and microphone.'
    : 'Please arrive 15 minutes early and bring your ID, insurance details, and any relevant medical records or test results.';

  const body = [
    `Your appointment with ${context.doctorName} in ${context.departmentName} is confirmed for ${when}.`,
    `Location: ${location}.`,
    `Preparation: ${preparation}`,
    'You can reply to this conversation if you have questions before your visit.',
  ].join('\n');

  return { when, body };
}

/**
 * Creates the appointment-linked conversation once. Re-running confirmation opens the existing
 * thread rather than creating a second one, which keeps duplicate confirm clicks harmless.
 */
async function ensureConfirmationConversation(
  appointment: IAppointment,
  context: Awaited<ReturnType<typeof confirmationContext>>,
  when: string,
  body: string
): Promise<void> {
  const existing = await Message.exists({
    appointmentId: appointment._id,
    patientId: appointment.patientId,
    facilityId: appointment.facilityId,
  });
  if (existing) return;

  const message = await Message.create({
    facilityId: appointment.facilityId,
    patientId: appointment.patientId,
    appointmentId: appointment._id,
    direction: 'to_patient',
    senderUserId: context.doctorUserId,
    senderName: context.doctorName,
    subject: `Appointment confirmed - ${when}`,
    body,
    isRead: false,
  });
  message.threadId = message._id;
  await message.save();
}

/**
 * Confirmation side effects that are safe to retry:
 * - one appointment-linked conversation,
 * - one detailed patient notification,
 * - reminder polling already picks up the Confirmed status and writes its own sent timestamps.
 *
 * Slot reservation is already implied by the existing non-cancelled appointment, so no separate
 * reservation record is needed.
 */
export async function applyConfirmationEffects(appointment: IAppointment): Promise<void> {
  try {
    const context = await confirmationContext(appointment);
    const { when, body } = confirmationBody(appointment, context);

    await ensureConfirmationConversation(appointment, context, when, body);

    if (!appointment.confirmationNotificationSentAt) {
      await Notification.create({
        patientId: appointment.patientId,
        facilityId: appointment.facilityId,
        appointmentId: appointment._id,
        recipientType: 'patient',
        type: 'appointment',
        title: 'Appointment confirmed',
        body,
        link: `/appointments/${appointment._id}`,
      });

      const sentAt = new Date();
      await Appointment.updateOne(
        { _id: appointment._id, confirmationNotificationSentAt: null },
        { $set: { confirmationNotificationSentAt: sentAt } }
      );
      appointment.confirmationNotificationSentAt = sentAt;
    }
  } catch (err) {
    console.error(
      '[appointment-confirmation] side effects failed:',
      err instanceof Error ? err.message : err
    );
  }
}
