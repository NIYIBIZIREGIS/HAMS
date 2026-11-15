import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createDoctorWithSchedule, createPatient } from './factories';
import { Appointment, Message, Notification } from '../src/models';

describe('Appointment conversation', () => {
  let facility: Awaited<ReturnType<typeof createFacility>>;
  let doctor: Awaited<ReturnType<typeof createDoctorWithSchedule>>;
  let otherDoctor: Awaited<ReturnType<typeof createDoctorWithSchedule>>;
  let patient: Awaited<ReturnType<typeof createPatient>>;
  let otherPatient: Awaited<ReturnType<typeof createPatient>>;
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
    otherPatient = await createPatient({ fullName: 'Other Patient' });
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
      status: 'Confirmed',
    });
  });

  afterAll(async () => {
    await closeTestDB();
  });

  const asDoctor = (req: request.Test, user = doctor.user) =>
    req.set('x-test-user', user.email as string);

  const asPatient = (req: request.Test, user = patient.user) =>
    req.set('x-test-user', user.email as string);

  it('lets the patient and assigned doctor exchange secure messages', async () => {
    const empty = await asDoctor(request(app).get(`/api/appointments/${appointment._id}/conversation`));
    expect(empty.status).toBe(200);
    expect(empty.body.data).toEqual({ threadId: null, messages: [] });

    const sent = await asDoctor(
      request(app)
        .post(`/api/appointments/${appointment._id}/conversation`)
        .send({ body: 'Please bring your previous lab results.' })
    );

    expect(sent.status).toBe(201);
    expect(sent.body.data.direction).toBe('to_patient');
    expect(sent.body.data.appointmentId).toBe(String(appointment._id));
    expect(sent.body.data.threadId).toBe(String(sent.body.data._id));

    const threads = await asPatient(request(app).get('/api/messages/threads'));
    expect(threads.status).toBe(200);
    expect(threads.body.data).toHaveLength(1);
    expect(threads.body.data[0].appointmentId).toBe(String(appointment._id));
    expect(threads.body.data[0].unreadCount).toBe(1);

    const patientView = await asPatient(
      request(app).get(`/api/appointments/${appointment._id}/conversation`)
    );
    expect(patientView.status).toBe(200);
    expect(patientView.body.data.threadId).toBe(String(sent.body.data._id));
    expect(patientView.body.data.messages).toHaveLength(1);

    const grounded = await Message.findById(sent.body.data._id).lean();
    expect(grounded?.isRead).toBe(true);

    const reply = await asPatient(
      request(app)
        .post(`/api/appointments/${appointment._id}/conversation`)
        .send({ body: 'I have them ready.' })
    );
    expect(reply.status).toBe(201);
    expect(reply.body.data.direction).toBe('to_staff');
    expect(reply.body.data.threadId).toBe(String(sent.body.data._id));

    const doctorView = await asDoctor(
      request(app).get(`/api/appointments/${appointment._id}/conversation`)
    );
    expect(doctorView.status).toBe(200);
    expect(doctorView.body.data.messages).toHaveLength(2);
    expect(doctorView.body.data.messages[1].body).toBe('I have them ready.');

    const groundedReply = await Message.findById(reply.body.data._id).lean();
    expect(groundedReply?.isRead).toBe(true);
  });

  it('notifies only the assigned doctor when the patient starts the conversation', async () => {
    const sent = await asPatient(
      request(app)
        .post(`/api/appointments/${appointment._id}/conversation`)
        .send({ body: 'I need to ask about preparation.' })
    );
    expect(sent.status).toBe(201);

    const assigned = await Notification.countDocuments({ doctorId: doctor.doctor._id });
    const unrelated = await Notification.countDocuments({ doctorId: otherDoctor.doctor._id });
    expect(assigned).toBe(1);
    expect(unrelated).toBe(0);

    const notification = await Notification.findOne({ doctorId: doctor.doctor._id }).lean();
    expect(notification?.appointmentId?.toString()).toBe(String(appointment._id));
    expect(notification?.link).toBe(`/messages?appointment=${appointment._id}`);
  });

  it('blocks another doctor and another patient from the conversation', async () => {
    const byOtherDoctor = await asDoctor(
      request(app)
        .post(`/api/appointments/${appointment._id}/conversation`)
        .send({ body: 'Let me in' }),
      otherDoctor.user
    );
    expect(byOtherDoctor.status).toBe(403);

    const byOtherPatientRead = await asPatient(
      request(app).get(`/api/appointments/${appointment._id}/conversation`),
      otherPatient.user
    );
    expect(byOtherPatientRead.status).toBe(403);

    const byOtherPatientSend = await asPatient(
      request(app)
        .post(`/api/appointments/${appointment._id}/conversation`)
        .send({ body: 'Let me in' }),
      otherPatient.user
    );
    expect(byOtherPatientSend.status).toBe(403);

    expect(await Message.countDocuments({ appointmentId: appointment._id })).toBe(0);
  });

  it('requires a confirmed appointment before messages can be sent', async () => {
    await Appointment.updateOne({ _id: appointment._id }, { status: 'Pending' });

    const read = await asPatient(
      request(app).get(`/api/appointments/${appointment._id}/conversation`)
    );
    expect(read.status).toBe(200);
    expect(read.body.data).toEqual({ threadId: null, messages: [] });

    const blocked = await asPatient(
      request(app)
        .post(`/api/appointments/${appointment._id}/conversation`)
        .send({ body: 'Are you there?' })
    );
    expect(blocked.status).toBe(409);

    await Appointment.updateOne({ _id: appointment._id }, { status: 'Confirmed' });
    const allowed = await asPatient(
      request(app)
        .post(`/api/appointments/${appointment._id}/conversation`)
        .send({ body: 'I am ready for the visit.' })
    );
    expect(allowed.status).toBe(201);

    await Appointment.updateOne({ _id: appointment._id }, { status: 'Cancelled' });
    const afterCancel = await asPatient(
      request(app)
        .post(`/api/appointments/${appointment._id}/conversation`)
        .send({ body: 'One more thing.' })
    );
    expect(afterCancel.status).toBe(409);

    const history = await asPatient(
      request(app).get(`/api/appointments/${appointment._id}/conversation`)
    );
    expect(history.status).toBe(200);
    expect(history.body.data.messages).toHaveLength(1);
  });
});
