import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createDoctorWithSchedule, createPatient } from './factories';
import { Appointment, AppointmentHistory, Notification } from '../src/models';

describe('Doctor appointment workflow', () => {
  let facility: Awaited<ReturnType<typeof createFacility>>;
  let doctor: Awaited<ReturnType<typeof createDoctorWithSchedule>>;
  let otherDoctor: Awaited<ReturnType<typeof createDoctorWithSchedule>>;
  let patient: Awaited<ReturnType<typeof createPatient>>;
  let appointment: { _id: Types.ObjectId };

  const deptId = '000000000000000000000001';

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

  it('accepts a pending appointment, records history, and notifies the patient', async () => {
    const res = await asDoctor(request(app).patch(`/api/appointments/${appointment._id}/accept`));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Confirmed');
    expect(res.body.data.decidedAt).toBeTruthy();

    const history = await AppointmentHistory.find({ appointmentId: appointment._id }).lean();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromStatus: 'Pending',
      toStatus: 'Confirmed',
      changedBy: doctor.user._id,
    });

    const notification = await Notification.findOne({
      patientId: patient.patient._id,
      appointmentId: appointment._id,
    }).lean();
    expect(notification).toBeTruthy();
    expect(notification?.link).toBe(`/appointments/${appointment._id}`);
    expect(notification?.title).toBe('Appointment confirmed');
  });

  it('deep-links the doctor notification to the new appointment detail', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('x-test-user', patient.user.email as string)
      .send({
        facilityId: String(facility._id),
        doctorId: String(doctor.doctor._id),
        departmentId: deptId,
        appointmentDate: '2026-11-02T00:00:00.000Z',
        timeSlot: '09:15',
        reason: 'Follow-up consultation',
        visitType: 'follow-up',
      });

    expect(res.status).toBe(201);

    const notification = await Notification.findOne({
      doctorId: doctor.doctor._id,
      appointmentId: res.body.data._id,
    }).lean();
    expect(notification?.title).toBe('New appointment request');
    expect(notification?.link).toBe(`/doctor/appointments/${res.body.data._id}`);
  });

  it('blocks a doctor from acting on another doctor\'s appointment', async () => {
    const res = await asDoctor(
      request(app).patch(`/api/appointments/${appointment._id}/accept`),
      otherDoctor.user
    );

    expect(res.status).toBe(403);
    const unchanged = await Appointment.findById(appointment._id).lean();
    expect(unchanged?.status).toBe('Pending');
    expect(await AppointmentHistory.countDocuments({ appointmentId: appointment._id })).toBe(0);
  });

  it('requires a reason before declining', async () => {
    const res = await asDoctor(
      request(app).patch(`/api/appointments/${appointment._id}/decline`).send({ reason: '  ' })
    );

    expect(res.status).toBe(400);
    const unchanged = await Appointment.findById(appointment._id).lean();
    expect(unchanged?.status).toBe('Pending');
    expect(unchanged?.declineReason).toBeUndefined();
  });

  it('declines with a reason, records it, and notifies the patient', async () => {
    const res = await asDoctor(
      request(app)
        .patch(`/api/appointments/${appointment._id}/decline`)
        .send({ reason: 'Emergency surgery scheduled' })
    );

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Declined');
    expect(res.body.data.declineReason).toBe('Emergency surgery scheduled');

    const history = await AppointmentHistory.findOne({
      appointmentId: appointment._id,
    }).lean();
    expect(history?.toStatus).toBe('Declined');
    expect(history?.note).toBe('Emergency surgery scheduled');

    const notification = await Notification.findOne({
      patientId: patient.patient._id,
      appointmentId: appointment._id,
    }).lean();
    expect(notification?.body).toContain('Emergency surgery scheduled');
    expect(notification?.link).toBe(`/appointments/${appointment._id}`);
  });

  it('rejects a second decision after the request has been handled', async () => {
    await asDoctor(request(app).patch(`/api/appointments/${appointment._id}/decline`).send({ reason: 'Unavailable' }));

    const res = await asDoctor(request(app).patch(`/api/appointments/${appointment._id}/accept`));

    expect(res.status).toBe(409);
    expect(await AppointmentHistory.countDocuments({ appointmentId: appointment._id })).toBe(1);
  });

  it('lists only the doctor\'s appointments and supports name search and ordering', async () => {
    const otherPatient = await createPatient({ fullName: 'Blaise Other' });
    await Appointment.create({
      facilityId: facility._id,
      patientId: otherPatient.patient._id,
      doctorId: doctor.doctor._id,
      departmentId: deptId,
      appointmentDate: new Date('2026-11-01T00:00:00.000Z'),
      timeSlot: '10:00',
      visitType: 'new',
      bookingChannel: 'web',
      status: 'Pending',
    });
    await Appointment.create({
      facilityId: facility._id,
      patientId: patient.patient._id,
      doctorId: otherDoctor.doctor._id,
      departmentId: deptId,
      appointmentDate: new Date('2026-11-03T00:00:00.000Z'),
      timeSlot: '11:00',
      visitType: 'new',
      bookingChannel: 'web',
      status: 'Pending',
    });

    const searched = await asDoctor(
      request(app).get('/api/appointments').query({ search: 'Aline', sort: 'asc' })
    );
    expect(searched.status).toBe(200);
    expect(searched.body.data).toHaveLength(1);
    expect(searched.body.data[0].patientId.userId.fullName).toBe('Aline Patient');

    const ordered = await asDoctor(
      request(app).get('/api/appointments').query({ sort: 'asc', limit: 10 })
    );
    expect(ordered.status).toBe(200);
    expect(ordered.body.data).toHaveLength(2);
    expect(ordered.body.data[0].appointmentDate.slice(0, 10)).toBe('2026-11-01');
    expect(
      ordered.body.data.every((row: { doctorId: { _id: string } }) =>
        String(row.doctorId._id) === String(doctor.doctor._id)
      )
    ).toBe(true);
  });

  it('blocks non-doctors from using the decision endpoints', async () => {
    const unauthorized = await request(app)
      .patch(`/api/appointments/${appointment._id}/accept`)
      .set('x-test-user', patient.user.email as string);

    expect(unauthorized.status).toBe(403);
  });

  it('accepts with a valid ObjectId route parameter shape', async () => {
    const missing = await asDoctor(
      request(app).patch(`/api/appointments/${new Types.ObjectId()}/accept`)
    );
    expect(missing.status).toBe(404);
  });
});
