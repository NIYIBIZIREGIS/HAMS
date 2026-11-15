import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createDoctorWithSchedule, createPatient } from './factories';
import { Appointment, AppointmentHistory, Notification } from '../src/models';

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function currentUtcSlot(): string {
  const now = new Date();
  return `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
}

function tomorrowUtc(): Date {
  return new Date(todayUtc().getTime() + 24 * 60 * 60 * 1000);
}

describe('Patient self check-in and waiting room', () => {
  let facility: Awaited<ReturnType<typeof createFacility>>;
  let doctor: Awaited<ReturnType<typeof createDoctorWithSchedule>>;
  let patient: Awaited<ReturnType<typeof createPatient>>;
  let otherPatient: Awaited<ReturnType<typeof createPatient>>;

  const deptId = '000000000000000000000001';

  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    facility = await createFacility();
    doctor = await createDoctorWithSchedule(String(facility._id), deptId);
    patient = await createPatient({ fullName: 'Aline Patient' });
    otherPatient = await createPatient({ fullName: 'Other Patient' });
  });

  afterAll(async () => {
    await closeTestDB();
  });

  const asPatient = (req: request.Test, user = patient.user) =>
    req.set('x-test-user', user.email as string);

  async function createAppointment(overrides: Record<string, unknown> = {}) {
    return Appointment.create({
      facilityId: facility._id,
      patientId: patient.patient._id,
      doctorId: doctor.doctor._id,
      departmentId: deptId,
      appointmentDate: todayUtc(),
      timeSlot: currentUtcSlot(),
      reason: 'Follow-up visit',
      visitType: 'follow-up',
      bookingChannel: 'web',
      status: 'Confirmed',
      queueNumber: 4,
      ...overrides,
    });
  }

  it('lets the owner check in and exposes live queue details', async () => {
    const appointment = await createAppointment();

    const checkedIn = await asPatient(
      request(app).post(`/api/appointments/${appointment._id}/self-check-in`)
    );

    expect(checkedIn.status).toBe(200);
    expect(checkedIn.body.data.status).toBe('Checked In');
    expect(checkedIn.body.data.queueNumber).toBe(4);
    expect(checkedIn.body.data.checkInTime).toBeTruthy();

    const history = await AppointmentHistory.findOne({ appointmentId: appointment._id }).lean();
    expect(history?.fromStatus).toBe('Confirmed');
    expect(history?.toStatus).toBe('Checked In');
    expect(history?.note).toBe('Patient self check-in');

    const doctorNotification = await Notification.findOne({ doctorId: doctor.doctor._id }).lean();
    expect(doctorNotification?.appointmentId?.toString()).toBe(String(appointment._id));

    const detail = await asPatient(request(app).get(`/api/appointments/${appointment._id}`));
    expect(detail.status).toBe(200);
    expect(detail.body.data.waitingRoom).toMatchObject({
      status: 'Checked In',
      checkInAvailable: false,
      queueNumber: 4,
      position: 1,
      peopleAhead: 0,
    });
  });

  it('counts earlier checked-in patients in the same doctor queue', async () => {
    await createAppointment({ queueNumber: 1, status: 'Checked In' });
    const current = await createAppointment({ queueNumber: 2, status: 'Checked In' });

    const detail = await asPatient(request(app).get(`/api/appointments/${current._id}`));

    expect(detail.status).toBe(200);
    expect(detail.body.data.waitingRoom.position).toBe(2);
    expect(detail.body.data.waitingRoom.peopleAhead).toBe(1);
  });

  it('is idempotent for an appointment that is already checked in', async () => {
    const appointment = await createAppointment({
      status: 'Checked In',
      checkInTime: new Date(),
    });

    const checkedIn = await asPatient(
      request(app).post(`/api/appointments/${appointment._id}/self-check-in`)
    );

    expect(checkedIn.status).toBe(200);
    expect(checkedIn.body.data.status).toBe('Checked In');
    expect(await AppointmentHistory.countDocuments({ appointmentId: appointment._id })).toBe(0);
    expect(await Notification.countDocuments({ doctorId: doctor.doctor._id })).toBe(0);
  });

  it('rejects another patient, a non-confirmed appointment, and an early check-in', async () => {
    const appointment = await createAppointment();
    const pending = await createAppointment({ status: 'Pending' });
    const future = await createAppointment({ appointmentDate: tomorrowUtc(), timeSlot: '09:00' });

    const forbidden = await asPatient(
      request(app).post(`/api/appointments/${appointment._id}/self-check-in`),
      otherPatient.user
    );
    expect(forbidden.status).toBe(403);

    const wrongStatus = await asPatient(
      request(app).post(`/api/appointments/${pending._id}/self-check-in`)
    );
    expect(wrongStatus.status).toBe(409);

    const tooEarly = await asPatient(
      request(app).post(`/api/appointments/${future._id}/self-check-in`)
    );
    expect(tooEarly.status).toBe(409);
  });

  it('returns check-in availability before the visit', async () => {
    const appointment = await createAppointment();

    const detail = await asPatient(request(app).get(`/api/appointments/${appointment._id}`));

    expect(detail.status).toBe(200);
    expect(detail.body.data.waitingRoom.checkInAvailable).toBe(true);
    expect(detail.body.data.waitingRoom.position).toBeNull();
    expect(detail.body.data.waitingRoom.peopleAhead).toBeNull();
    expect(new Date(detail.body.data.waitingRoom.checkInOpensAt).getTime()).toBeLessThan(
      Date.now() + 60 * 60 * 1000
    );
  });
});
