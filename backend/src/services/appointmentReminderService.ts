import { Appointment, Notification, type IAppointment } from '../models';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  const start = startOfUtcDay(date);
  return new Date(start.getTime() + DAY_MS - 1);
}

function appointmentStart(appointment: IAppointment): Date {
  const [hours, minutes] = appointment.timeSlot.split(':').map(Number);
  const date = new Date(appointment.appointmentDate);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes),
  );
}

function formatAppointmentDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function populatedName(value: unknown): string {
  const record = value as {
    patientNumber?: string;
    userId?: { fullName?: string };
    fullName?: string;
  };
  return record?.userId?.fullName ?? record?.fullName ?? record?.patientNumber ?? 'Patient';
}

type ReminderWindow = '24h' | '1h';

async function notifyReminder(appointment: IAppointment, window: ReminderWindow): Promise<void> {
  const start = appointmentStart(appointment);
  const when = `${formatAppointmentDate(start)} at ${appointment.timeSlot}`;
  const patientName = populatedName(appointment.patientId);
  const doctorName = populatedName(appointment.doctorId);
  const timing = window === '24h' ? 'in less than 24 hours' : 'in less than 1 hour';

  await Promise.all([
    Notification.create({
      patientId: appointment.patientId,
      facilityId: appointment.facilityId,
      appointmentId: appointment._id,
      recipientType: 'patient',
      type: 'appointment',
      title: 'Appointment reminder',
      body: `Your appointment with ${doctorName} is ${timing}: ${when}.`,
      link: `/appointments/${appointment._id}`,
    }),
    Notification.create({
      doctorId: appointment.doctorId,
      facilityId: appointment.facilityId,
      appointmentId: appointment._id,
      recipientType: 'doctor',
      type: 'appointment',
      title: 'Appointment reminder',
      body: `Your appointment with ${patientName} is ${timing}: ${when}.`,
      link: `/doctor/appointments/${appointment._id}`,
    }),
  ]);
}

export interface ReminderRunResult {
  sent24h: number;
  sent1h: number;
}

/**
 * Sends patient and doctor reminders for confirmed appointments that fall inside the next
 * 24 hours. Appointments already inside the final hour receive the 1-hour reminder instead of
 * both, so a late scheduler start does not produce two notifications at once.
 *
 * The sent timestamps make repeated runs idempotent. They are written only after both
 * notifications succeed, so a transient notification failure is retried on the next run.
 */
export async function runAppointmentReminders(now = new Date()): Promise<ReminderRunResult> {
  const appointments = await Appointment.find({
    status: 'Confirmed',
    appointmentDate: {
      $gte: startOfUtcDay(now),
      $lte: endOfUtcDay(new Date(now.getTime() + DAY_MS + HOUR_MS)),
    },
  })
    .populate({
      path: 'patientId',
      select: 'patientNumber userId',
      populate: { path: 'userId', select: 'fullName' },
    })
    .populate({
      path: 'doctorId',
      select: 'userId',
      populate: { path: 'userId', select: 'fullName' },
    });

  const result: ReminderRunResult = { sent24h: 0, sent1h: 0 };

  for (const appointment of appointments) {
    const startsIn = appointmentStart(appointment).getTime() - now.getTime();
    if (startsIn <= 0 || startsIn > DAY_MS) continue;

    const window: ReminderWindow = startsIn <= HOUR_MS ? '1h' : '24h';
    const alreadySent =
      window === '1h' ? appointment.reminder1hSentAt : appointment.reminder24hSentAt;
    if (alreadySent) continue;

    try {
      await notifyReminder(appointment, window);
      if (window === '1h') {
        appointment.reminder1hSentAt = now;
        result.sent1h += 1;
      } else {
        appointment.reminder24hSentAt = now;
        result.sent24h += 1;
      }
      await appointment.save();
    } catch (err) {
      console.error(
        `[notification] ${window} reminder failed for appointment ${appointment._id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return result;
}

export function startAppointmentReminderScheduler(intervalMs = 15 * 60 * 1000) {
  const timer = setInterval(() => {
    void runAppointmentReminders().catch((err) => {
      console.error(
        '[notification] appointment reminder run failed:',
        err instanceof Error ? err.message : err,
      );
    });
  }, intervalMs);

  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}
