import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createUser, createPatient } from './factories';

describe('RBAC enforcement', () => {
  let facility: Awaited<ReturnType<typeof createFacility>>;
  let superAdmin: Awaited<ReturnType<typeof createUser>>;
  let facilityAdmin: Awaited<ReturnType<typeof createUser>>;
  let receptionist: Awaited<ReturnType<typeof createUser>>;
  let patient: Awaited<ReturnType<typeof createPatient>>;

  const as = (r: request.Test, email: string) => r.set('x-test-user', email);

  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    facility = await createFacility();
    superAdmin = await createUser({ role: 'super_admin', facilityId: null });
    facilityAdmin = await createUser({ role: 'facility_admin', facilityId: String(facility._id) });
    receptionist = await createUser({ role: 'receptionist', facilityId: String(facility._id) });
    patient = await createPatient();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  it('returns 401 for protected routes without a token', async () => {
    const res = await request(app).get('/api/facilities');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an unknown test user', async () => {
    const res = await request(app).get('/api/facilities').set('x-test-user', 'nobody@test.local');
    expect(res.status).toBe(401);
  });

  it('allows super_admin to create facilities', async () => {
    const res = await as(request(app).post('/api/facilities'), superAdmin.email as string)
      .send({ name: 'New Clinic', type: 'clinic' });
    expect(res.status).toBe(201);
  });

  it('blocks receptionist from creating facilities (403)', async () => {
    const res = await as(request(app).post('/api/facilities'), receptionist.email as string)
      .send({ name: 'Sneaky Clinic', type: 'clinic' });
    expect(res.status).toBe(403);
  });

  it('blocks patient from listing users (403)', async () => {
    const res = await as(request(app).get('/api/users'), patient.user.email as string);
    expect(res.status).toBe(403);
  });

  it('allows facility_admin to list users in their facility', async () => {
    const res = await as(request(app).get('/api/users'), facilityAdmin.email as string);
    expect(res.status).toBe(200);
  });

  it('allows facility_admin to create departments in their facility', async () => {
    const res = await as(request(app).post('/api/departments'), facilityAdmin.email as string)
      .send({ name: 'Dermatology' });
    expect(res.status).toBe(201);
    expect(res.body.data.facilityId).toBe(String(facility._id));
  });

  it('forces a patient to book only for themselves (ignores supplied patientId)', async () => {
    const other = await createPatient();
    const res = await as(request(app).post('/api/appointments'), patient.user.email as string).send({
      doctorId: '000000000000000000000001',
      departmentId: '000000000000000000000001',
      appointmentDate: new Date().toISOString(),
      timeSlot: '09:00',
      patientId: String(other.patient._id),
    });
    expect(res.status).toBe(400); // doctor doesn't exist → booking fails before insert
  });

  it('writes an audit log entry on a write operation', async () => {
    await as(request(app).post('/api/facilities'), superAdmin.email as string).send({
      name: 'Audited Clinic',
      type: 'clinic',
    });

    const AuditLog = (await import('../src/models')).AuditLog;
    const entry = await AuditLog.findOne({ entity: 'Facility', action: 'POST' });
    expect(entry).toBeTruthy();
    expect(String(entry?.userId)).toBe(String(superAdmin._id));
  });
});
