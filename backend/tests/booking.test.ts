import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import {
  createFacility,
  createDoctorWithSchedule,
  createPatient,
  createUser,
  monday,
} from './factories';
import { DoctorLeave } from '../src/models';

describe('Appointment booking — double-booking prevention', () => {
  let facility: Awaited<ReturnType<typeof createFacility>>;
  let doctor: Awaited<ReturnType<typeof createDoctorWithSchedule>>;
  let patient: Awaited<ReturnType<typeof createPatient>>;
  let receptionist: Awaited<ReturnType<typeof createUser>>;
  let target: Date;

  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    facility = await createFacility();
    const deptId = '000000000000000000000001';
    doctor = await createDoctorWithSchedule(String(facility._id), deptId, {
      startTime: '09:00',
      endTime: '11:00',
      slotDurationMinutes: 60,
      maxPatientsPerSlot: 1,
    });
    patient = await createPatient();
    receptionist = await createUser({
      role: 'receptionist',
      facilityId: String(facility._id),
    });
    target = monday(new Date());
  });

  afterAll(async () => {
    await closeTestDB();
  });

  const bookPayload = () => ({
    doctorId: String(doctor.doctor._id),
    departmentId: '000000000000000000000001',
    appointmentDate: target.toISOString(),
    timeSlot: '09:00',
    patientId: String(patient.patient._id),
  });

  const asReceptionist = (r: request.Test) => r.set('x-test-user', receptionist.email as string);

  it('books the same slot twice → second request returns 409', async () => {
    const first = await asReceptionist(request(app).post('/api/appointments')).send(bookPayload());
    expect(first.status).toBe(201);

    const second = await asReceptionist(request(app).post('/api/appointments')).send(bookPayload());
    expect(second.status).toBe(409);
  });

  it('allows booking a different slot in the same day', async () => {
    await asReceptionist(request(app).post('/api/appointments')).send(bookPayload());

    const second = await asReceptionist(request(app).post('/api/appointments'))
      .send({ ...bookPayload(), timeSlot: '10:00' });
    expect(second.status).toBe(201);
  });

  it('rejects a slot outside the doctor schedule', async () => {
    const res = await asReceptionist(request(app).post('/api/appointments'))
      .send({ ...bookPayload(), timeSlot: '07:00' });
    expect(res.status).toBe(400);
  });

  it('rejects booking on a doctor leave day', async () => {
    await DoctorLeave.create({ doctorId: doctor.doctor._id, date: target, reason: 'Leave' });

    const res = await asReceptionist(request(app).post('/api/appointments')).send(bookPayload());
    expect(res.status).toBe(400);
  });
});
