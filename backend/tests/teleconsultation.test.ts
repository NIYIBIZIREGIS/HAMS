import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createDoctorWithSchedule, createPatient } from './factories';
import { Appointment } from '../src/models';

describe('Teleconsultation meeting links', () => {
  let facility: Awaited<ReturnType<typeof createFacility>>;
  let doctor: Awaited<ReturnType<typeof createDoctorWithSchedule>>;
  let otherDoctor: Awaited<ReturnType<typeof createDoctorWithSchedule>>;
  let patient: Awaited<ReturnType<typeof createPatient>>;
  let appointment: { _id: Types.ObjectId };

  const deptId = '000000000000000000000001';
  const meetingLink = 'https://meet.example.com/consultation-room';

  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    facility = await createFacility();
    doctor = await createDoctorWithSchedule(String(facility._id), deptId);
    otherDoctor = await createDoctorWithSchedule(String(facility._id), deptId);
    patient = await createPatient({ fullName: 'Aline Patient' });
    appointment = await Appointment.create({
      facilityId: facility._id,
      patientId: patient.patient._id,
      doctorId: doctor.doctor._id,
      departmentId: deptId,
      appointmentDate: new Date('2026-11-02T00:00:00.000Z'),
      timeSlot: '09:00',
      reason: 'Persistent headache',
      visitType: 'new',
      bookingChannel: 'web',
      status: 'Pending',
    });
  });

  afterAll(async () => {
    await closeTestDB();
  });

  const asDoctor = (req: request.Test, user = doctor.user) =>
    req.set('x-test-user', user.email as string);

  const asPatient = (req: request.Test) =>
    req.set('x-test-user', patient.user.email as string);

  it('lets the assigned doctor set, replace, and clear a meeting link', async () => {
    const created = await asDoctor(
      request(app)
        .patch(`/api/appointments/${appointment._id}/meeting-link`)
        .send({ meetingLink })
    );

    expect(created.status).toBe(200);
    expect(created.body.data.meetingLink).toBe(meetingLink);

    const replacement = 'https://meet.example.com/updated-room';
    const replaced = await asDoctor(
      request(app)
        .patch(`/api/appointments/${appointment._id}/meeting-link`)
        .send({ meetingLink: replacement })
    );

    expect(replaced.status).toBe(200);
    expect(replaced.body.data.meetingLink).toBe(replacement);

    const cleared = await asDoctor(
      request(app)
        .patch(`/api/appointments/${appointment._id}/meeting-link`)
        .send({ meetingLink: null })
    );

    expect(cleared.status).toBe(200);
    expect(cleared.body.data.meetingLink).toBeUndefined();
    const stored = await Appointment.findById(appointment._id).lean();
    expect(stored?.meetingLink).toBeUndefined();
  });

  it('hides a pending meeting link from the patient until confirmation', async () => {
    await asDoctor(
      request(app)
        .patch(`/api/appointments/${appointment._id}/meeting-link`)
        .send({ meetingLink })
    );

    const pending = await asPatient(request(app).get(`/api/appointments/${appointment._id}`));
    expect(pending.status).toBe(200);
    expect(pending.body.data.meetingLink).toBeUndefined();

    await Appointment.updateOne({ _id: appointment._id }, { status: 'Confirmed' });

    const confirmed = await asPatient(request(app).get(`/api/appointments/${appointment._id}`));
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.meetingLink).toBe(meetingLink);
  });

  it('rejects invalid and non-http meeting links', async () => {
    for (const invalid of ['not-a-url', 'javascript:alert(1)', 'ftp://example.com/room']) {
      const res = await asDoctor(
        request(app)
          .patch(`/api/appointments/${appointment._id}/meeting-link`)
          .send({ meetingLink: invalid })
      );

      expect(res.status).toBe(400);
    }
  });

  it('blocks another doctor and the patient from setting the link', async () => {
    const byOtherDoctor = await asDoctor(
      request(app)
        .patch(`/api/appointments/${appointment._id}/meeting-link`)
        .send({ meetingLink }),
      otherDoctor.user
    );
    expect(byOtherDoctor.status).toBe(403);

    const byPatient = await asPatient(
      request(app)
        .patch(`/api/appointments/${appointment._id}/meeting-link`)
        .send({ meetingLink })
    );
    expect(byPatient.status).toBe(403);

    const stored = await Appointment.findById(appointment._id).lean();
    expect(stored?.meetingLink).toBeUndefined();
  });
});
