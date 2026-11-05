import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createDoctorWithSchedule, createPatient } from './factories';
import { Appointment, Message } from '../src/models';

describe('Appointment consultation chat', () => {
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
      status: 'In Progress',
    });
  });

  afterAll(async () => {
    await closeTestDB();
  });

  const asDoctor = (req: request.Test, user = doctor.user) =>
    req.set('x-test-user', user.email as string);

  const asPatient = (req: request.Test) =>
    req.set('x-test-user', patient.user.email as string);

  it('lets the assigned doctor start an appointment chat and keeps it thread-scoped', async () => {
    const empty = await asDoctor(request(app).get(`/api/appointments/${appointment._id}/chat`));
    expect(empty.status).toBe(200);
    expect(empty.body.data).toEqual({ threadId: null, messages: [] });

    const sent = await asDoctor(
      request(app)
        .post(`/api/appointments/${appointment._id}/chat`)
        .send({ body: 'How are you feeling after the medication?' })
    );

    expect(sent.status).toBe(201);
    expect(sent.body.data.body).toBe('How are you feeling after the medication?');
    expect(sent.body.data.appointmentId).toBe(String(appointment._id));

    const stored = await Message.findById(sent.body.data._id).lean();
    expect(stored?.appointmentId?.toString()).toBe(String(appointment._id));
    expect(stored?.threadId?.toString()).toBe(String(sent.body.data._id));

    const chat = await asDoctor(request(app).get(`/api/appointments/${appointment._id}/chat`));
    expect(chat.status).toBe(200);
    expect(chat.body.data.messages).toHaveLength(1);
    expect(chat.body.data.threadId).toBe(String(sent.body.data._id));
  });

  it('shows the chat to the patient in their inbox and lets them reply', async () => {
    const sent = await asDoctor(
      request(app)
        .post(`/api/appointments/${appointment._id}/chat`)
        .send({ body: 'Please confirm your pharmacy pickup time.' })
    );

    const threads = await asPatient(request(app).get('/api/messages/threads'));
    expect(threads.status).toBe(200);
    expect(threads.body.data).toHaveLength(1);
    expect(threads.body.data[0].subject).toContain('Consultation chat');
    expect(threads.body.data[0].unreadCount).toBe(1);

    const threadId = sent.body.data.threadId;
    const reply = await asPatient(
      request(app)
        .post(`/api/messages/threads/${threadId}/replies`)
        .send({ body: 'I can collect them at 4pm.' })
    );
    expect(reply.status).toBe(201);
    expect(reply.body.data.appointmentId).toBe(String(appointment._id));

    const chat = await asDoctor(request(app).get(`/api/appointments/${appointment._id}/chat`));
    expect(chat.status).toBe(200);
    expect(chat.body.data.messages).toHaveLength(2);
    expect(chat.body.data.messages[1].body).toBe('I can collect them at 4pm.');

    const stored = await Message.findById(reply.body.data._id).lean();
    expect(stored?.isRead).toBe(true);
  });

  it('lets the doctor accept, start, and then chat', async () => {
    await Appointment.updateOne({ _id: appointment._id }, { status: 'Pending' });

    const accepted = await asDoctor(
      request(app).patch(`/api/appointments/${appointment._id}/accept`)
    );
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe('Confirmed');

    const started = await asDoctor(
      request(app).patch(`/api/appointments/${appointment._id}/start`)
    );
    expect(started.status).toBe(200);
    expect(started.body.data.status).toBe('In Progress');

    const sent = await asDoctor(
      request(app)
        .post(`/api/appointments/${appointment._id}/chat`)
        .send({ body: 'Your consultation has started.' })
    );
    expect(sent.status).toBe(201);
  });

  it('refuses chat before the consultation starts', async () => {
    await Appointment.updateOne({ _id: appointment._id }, { status: 'Confirmed' });

    const read = await asDoctor(request(app).get(`/api/appointments/${appointment._id}/chat`));
    expect(read.status).toBe(409);

    const send = await asDoctor(
      request(app)
        .post(`/api/appointments/${appointment._id}/chat`)
        .send({ body: 'Are you there?' })
    );
    expect(send.status).toBe(409);
    expect(await Message.countDocuments({ appointmentId: appointment._id })).toBe(0);
  });

  it('blocks another doctor and the patient from using the appointment chat', async () => {
    const byOtherDoctor = await asDoctor(
      request(app)
        .post(`/api/appointments/${appointment._id}/chat`)
        .send({ body: 'Let me in' }),
      otherDoctor.user
    );
    expect(byOtherDoctor.status).toBe(403);

    const byPatient = await asPatient(
      request(app)
        .post(`/api/appointments/${appointment._id}/chat`)
        .send({ body: 'Let me in' })
    );
    expect(byPatient.status).toBe(403);

    expect(await Message.countDocuments({ appointmentId: appointment._id })).toBe(0);
  });
});
