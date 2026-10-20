import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createPatient, createUser, signin } from './factories';
import { Message } from '../src/models';

const as = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Signs in a created account. `email` is optional on the model, so it is coerced here. */
async function token(user: { email?: string }): Promise<string> {
  return signin(app, String(user.email), 'Password@123');
}

/** A facility-scoped staff account that holds MESSAGES_SEND. */
async function createStaff(facility: { _id: unknown }) {
  return createUser({ role: 'receptionist', facilityId: String(facility._id) });
}

describe('Patient messaging threads', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  it('opens a thread when staff send the first message', async () => {
    const facility = await createFacility();
    const { patient } = await createPatient({}, { facilityId: facility._id });
    const staffUser = await createStaff(facility);
    const staffToken = await token(staffUser);

    const res = await request(app)
      .post('/api/messages')
      .set(as(staffToken))
      .send({ patientId: String(patient._id), subject: 'Results ready', body: 'Your report is available.' });

    expect(res.status).toBe(201);

    const stored = await Message.findById(res.body.data._id).lean();
    // The opening message is its own thread root.
    expect(String(stored?.threadId)).toBe(String(stored?._id));
    expect(stored?.direction).toBe('to_patient');
  });

  it('lists a thread for the patient with an unread count', async () => {
    const facility = await createFacility();
    const { user, patient } = await createPatient({}, { facilityId: facility._id });
    const staffUser = await createStaff(facility);
    const staffToken = await token(staffUser);

    await request(app)
      .post('/api/messages')
      .set(as(staffToken))
      .send({ patientId: String(patient._id), subject: 'Results ready', body: 'Report available.' })
      .expect(201);

    const patientToken = await token(user);
    const res = await request(app).get('/api/messages/threads').set(as(patientToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].unreadCount).toBe(1);
    expect(res.body.data[0].messageCount).toBe(1);
    expect(res.body.data[0].subject).toBe('Results ready');
  });

  it('lets a patient reply and keeps the reply in the same thread', async () => {
    const facility = await createFacility();
    const { user, patient } = await createPatient({ fullName: 'Pat Rep' }, { facilityId: facility._id });
    const staffUser = await createStaff(facility);
    const staffToken = await token(staffUser);

    const opened = await request(app)
      .post('/api/messages')
      .set(as(staffToken))
      .send({ patientId: String(patient._id), subject: 'Question', body: 'Can you reschedule?' })
      .expect(201);

    const threadId = opened.body.data._id;
    const patientToken = await token(user);

    const reply = await request(app)
      .post(`/api/messages/threads/${threadId}/replies`)
      .set(as(patientToken))
      .send({ body: 'Yes please, next week works.' });

    expect(reply.status).toBe(201);
    expect(reply.body.data.direction).toBe('to_staff');
    expect(String(reply.body.data.threadId)).toBe(threadId);
    expect(reply.body.data.senderName).toBe('Pat Rep');

    const thread = await request(app).get(`/api/messages/threads/${threadId}`).set(as(patientToken));
    expect(thread.status).toBe(200);
    expect(thread.body.data).toHaveLength(2);
    // Oldest first, so it reads top to bottom.
    expect(thread.body.data[0].body).toBe('Can you reschedule?');
    expect(thread.body.data[1].body).toBe('Yes please, next week works.');
  });

  it('marks the patient side read when the thread is opened', async () => {
    const facility = await createFacility();
    const { user, patient } = await createPatient({}, { facilityId: facility._id });
    const staffUser = await createStaff(facility);
    const staffToken = await token(staffUser);

    const opened = await request(app)
      .post('/api/messages')
      .set(as(staffToken))
      .send({ patientId: String(patient._id), subject: 'Hi', body: 'Hello there.' })
      .expect(201);

    const patientToken = await token(user);
    await request(app).get(`/api/messages/threads/${opened.body.data._id}`).set(as(patientToken)).expect(200);

    const unread = await Message.findOne({ _id: opened.body.data._id }).lean();
    expect(unread?.isRead).toBe(true);
  });

  it('counts a patient reply as unread for the hospital, not for the patient', async () => {
    const facility = await createFacility();
    const { user, patient } = await createPatient({}, { facilityId: facility._id });
    const staffUser = await createStaff(facility);
    const staffToken = await token(staffUser);
    const patientToken = await token(user);

    const opened = await request(app)
      .post('/api/messages')
      .set(as(staffToken))
      .send({ patientId: String(patient._id), subject: 'Hi', body: 'Hello.' })
      .expect(201);
    const threadId = opened.body.data._id;

    // Read the hospital's message first, so the only thing left to count is the reply.
    await request(app).get(`/api/messages/threads/${threadId}`).set(as(patientToken)).expect(200);

    await request(app)
      .post(`/api/messages/threads/${threadId}/replies`)
      .set(as(patientToken))
      .send({ body: 'Any update?' })
      .expect(201);

    const staffView = await request(app).get('/api/messages/threads').set(as(staffToken));
    expect(staffView.body.data[0].unreadCount).toBe(1);

    // The patient wrote the reply, so it must not be reported back to them as unread.
    const patientView = await request(app).get('/api/messages/threads').set(as(patientToken));
    expect(patientView.body.data[0].unreadCount).toBe(0);
    expect(patientView.body.data[0].messageCount).toBe(2);
  });

  it("hides another patient's thread from a patient", async () => {
    const facility = await createFacility();
    const { user: owner, patient } = await createPatient({}, { facilityId: facility._id });
    const { user: stranger } = await createPatient({}, { facilityId: facility._id });
    const staffUser = await createStaff(facility);
    const staffToken = await token(staffUser);

    const opened = await request(app)
      .post('/api/messages')
      .set(as(staffToken))
      .send({ patientId: String(patient._id), subject: 'Private', body: 'For your eyes only.' })
      .expect(201);

    const ownerToken = await token(owner);
    const strangerToken = await token(stranger);

    expect((await request(app).get(`/api/messages/threads/${opened.body.data._id}`).set(as(ownerToken))).status).toBe(200);

    const leak = await request(app).get(`/api/messages/threads/${opened.body.data._id}`).set(as(strangerToken));
    expect(leak.status).toBe(404);

    const replyLeak = await request(app)
      .post(`/api/messages/threads/${opened.body.data._id}/replies`)
      .set(as(strangerToken))
      .send({ body: 'let me in' });
    expect(replyLeak.status).toBe(404);
  });

  it('hides a thread from staff at a different hospital', async () => {
    const facilityA = await createFacility({ name: 'A' });
    const facilityB = await createFacility({ name: 'B' });
    const { patient } = await createPatient({}, { facilityId: facilityA._id });
    const staffA = await createStaff(facilityA);

    const opened = await request(app)
      .post('/api/messages')
      .set(as(await token(staffA)))
      .send({ patientId: String(patient._id), subject: 'A only', body: 'Hospital A news.' })
      .expect(201);

    const staffB = await createStaff(facilityB);
    const crossTenant = await request(app)
      .get(`/api/messages/threads/${opened.body.data._id}`)
      .set(as(await token(staffB)));

    expect(crossTenant.status).toBe(404);
  });

  it('treats a pre-threading message as its own single-message thread', async () => {
    const facility = await createFacility();
    const { user, patient } = await createPatient({}, { facilityId: facility._id });

    // A row written before threads existed: no threadId at all.
    const legacy = await Message.create({
      facilityId: facility._id,
      patientId: patient._id,
      direction: 'to_patient',
      senderName: 'Clinic',
      subject: 'Archived note',
      body: 'From before threading.',
      isRead: true,
    });

    const patientToken = await token(user);
    const res = await request(app).get('/api/messages/threads').set(as(patientToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(String(res.body.data[0].threadId)).toBe(String(legacy._id));
    expect(res.body.data[0].messageCount).toBe(1);
  });

  it('lets an auditor read a thread but not post into it', async () => {
    const facility = await createFacility();
    const { patient } = await createPatient({}, { facilityId: facility._id });
    const staffUser = await createStaff(facility);
    const staffToken = await token(staffUser);

    const opened = await request(app)
      .post('/api/messages')
      .set(as(staffToken))
      .send({ patientId: String(patient._id), subject: 'Audit me', body: 'Read only.' })
      .expect(201);
    const threadId = opened.body.data._id;

    // `auditor` holds MESSAGES_SEND in the catalog, so the reply route must exclude it by role.
    const auditor = await createUser({ role: 'auditor', facilityId: String(facility._id) });
    const auditorToken = await token(auditor);

    expect((await request(app).get(`/api/messages/threads/${threadId}`).set(as(auditorToken))).status).toBe(200);

    const post = await request(app)
      .post(`/api/messages/threads/${threadId}/replies`)
      .set(as(auditorToken))
      .send({ body: 'should not land' });
    expect(post.status).toBe(403);
  });

  it('paginates threads', async () => {
    const facility = await createFacility();
    const { user, patient } = await createPatient({}, { facilityId: facility._id });
    const staffUser = await createStaff(facility);
    const staffToken = await token(staffUser);

    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/messages')
        .set(as(staffToken))
        .send({ patientId: String(patient._id), subject: `Note ${i}`, body: 'Body' })
        .expect(201);
    }

    const patientToken = await token(user);
    const res = await request(app).get('/api/messages/threads?page=2&limit=2').set(as(patientToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(3);
    expect(res.body.meta.page).toBe(2);
  });
});
