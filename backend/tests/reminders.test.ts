import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createDoctorWithSchedule, createPatient } from './factories';
import { Appointment, Department, Notification } from '../src/models';
import { runAppointmentReminders } from '../src/services/appointmentReminderService';

function utcDatePart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function setupAppointment(startsAt: Date, status = 'Confirmed') {
  const facility = await createFacility();
  const department = await Department.create({
    facilityId: facility._id,
    name: 'General Medicine',
    defaultConsultationFee: 5000,
  });
  const doctor = await createDoctorWithSchedule(String(facility._id), String(department._id));
  const patient = await createPatient({ fullName: 'Reminder Patient' });
  const timeSlot = startsAt.toISOString().slice(11, 16);

  const appointment = await Appointment.create({
    facilityId: facility._id,
    patientId: patient.patient._id,
    doctorId: doctor.doctor._id,
    departmentId: department._id,
    appointmentDate: utcDatePart(startsAt),
    timeSlot,
    reason: 'Routine review',
    visitType: 'new',
    bookingChannel: 'web',
    status,
  });

  return { appointment, patient, doctor };
}

beforeAll(async () => {
  await connectTestDB();
}, 60000);

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

describe('Appointment reminders', () => {
  it('notifies both roles once for an appointment less than 24 hours away', async () => {
    const now = new Date('2026-11-03T08:00:00.000Z');
    const startsAt = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const { appointment } = await setupAppointment(startsAt);

    const result = await runAppointmentReminders(now);

    expect(result).toEqual({ sent24h: 1, sent1h: 0 });
    const notifications = await Notification.find({ appointmentId: appointment._id }).lean();
    expect(notifications).toHaveLength(2);
    expect(notifications.map((entry) => entry.recipientType).sort()).toEqual([
      'doctor',
      'patient',
    ]);
    expect(notifications[0].body).toContain('in less than 24 hours');

    const saved = await Appointment.findById(appointment._id).lean();
    expect(saved?.reminder24hSentAt).toBeInstanceOf(Date);
    expect(saved?.reminder1hSentAt).toBeUndefined();
  });

  it('does not send the same reminder twice', async () => {
    const now = new Date('2026-11-03T08:00:00.000Z');
    const startsAt = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    await setupAppointment(startsAt);

    await runAppointmentReminders(now);
    const secondRun = await runAppointmentReminders(now);

    expect(secondRun).toEqual({ sent24h: 0, sent1h: 0 });
    expect(await Notification.countDocuments()).toBe(2);
  });

  it('sends the 1-hour reminder instead of both when the visit is imminent', async () => {
    const now = new Date('2026-11-03T08:00:00.000Z');
    const startsAt = new Date(now.getTime() + 30 * 60 * 1000);
    const { appointment } = await setupAppointment(startsAt);

    const result = await runAppointmentReminders(now);

    expect(result).toEqual({ sent24h: 0, sent1h: 1 });
    const notifications = await Notification.find({ appointmentId: appointment._id }).lean();
    expect(notifications).toHaveLength(2);
    expect(notifications[0].body).toContain('in less than 1 hour');

    const saved = await Appointment.findById(appointment._id).lean();
    expect(saved?.reminder1hSentAt).toBeInstanceOf(Date);
    expect(saved?.reminder24hSentAt).toBeUndefined();
  });

  it('ignores non-confirmed and past appointments', async () => {
    const now = new Date('2026-11-03T08:00:00.000Z');
    await setupAppointment(new Date(now.getTime() + 2 * 60 * 60 * 1000), 'Pending');
    await setupAppointment(new Date(now.getTime() - 2 * 60 * 60 * 1000));

    const result = await runAppointmentReminders(now);

    expect(result).toEqual({ sent24h: 0, sent1h: 0 });
    expect(await Notification.countDocuments()).toBe(0);
  });
});
