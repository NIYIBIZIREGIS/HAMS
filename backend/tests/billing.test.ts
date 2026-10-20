import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createDoctorWithSchedule, createPatient, createUser, signin } from './factories';
import { Appointment, Department, Payment } from '../src/models';

const as = (token: string) => ({ Authorization: `Bearer ${token}` });

async function token(user: { email?: string }): Promise<string> {
  return signin(app, String(user.email), 'Password@123');
}

describe('Patient billing visibility', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  /** A facility, a department and a doctor with a known consultation fee. */
  async function seed() {
    const facility = await createFacility();
    const department = await Department.create({
      facilityId: facility._id,
      name: 'General',
      defaultConsultationFee: 20000,
      isActive: true,
    });
    const { doctor } = await createDoctorWithSchedule(String(facility._id), String(department._id));
    // The factory hardcodes its own fee and only takes schedule overrides, so set the
    // consultation fee explicitly to keep the arithmetic in these tests predictable.
    doctor.consultationFee = { newVisit: 15000, followUp: 7500 };
    await doctor.save();
    return { facility, department, doctor };
  }

  async function bookVisit(patientId: unknown, doctor: { _id: unknown }, department: { _id: unknown }, facility: { _id: unknown }, status: string) {
    return Appointment.create({
      facilityId: facility._id,
      patientId,
      doctorId: doctor._id,
      departmentId: department._id,
      appointmentDate: new Date(),
      timeSlot: '09:00',
      visitType: 'new',
      bookingChannel: 'web',
      status,
    });
  }

  it('shows a patient the bill for their own appointment', async () => {
    const { facility, department, doctor } = await seed();
    const { user, patient } = await createPatient({}, { facilityId: facility._id });
    const appointment = await bookVisit(patient._id, doctor, department, facility, 'Completed');

    const res = await request(app)
      .get(`/api/payments/bill/${appointment._id}`)
      .set(as(await token(user)));

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(15000);
    expect(res.body.data.lines.length).toBeGreaterThan(0);
  });

  it("refuses a patient another patient's bill", async () => {
    const { facility, department, doctor } = await seed();
    const { patient } = await createPatient({}, { facilityId: facility._id });
    const { user: stranger } = await createPatient({}, { facilityId: facility._id });
    const appointment = await bookVisit(patient._id, doctor, department, facility, 'Completed');

    const res = await request(app)
      .get(`/api/payments/bill/${appointment._id}`)
      .set(as(await token(stranger)));

    // 404 rather than 403 so the patient cannot probe for other patients' appointments.
    expect(res.status).toBe(404);
  });

  it('reports an unpaid visit as outstanding', async () => {
    const { facility, department, doctor } = await seed();
    const { user, patient } = await createPatient({}, { facilityId: facility._id });
    await bookVisit(patient._id, doctor, department, facility, 'Completed');

    const res = await request(app).get('/api/payments/me/outstanding').set(as(await token(user)));

    expect(res.status).toBe(200);
    expect(res.body.data.bills).toHaveLength(1);
    expect(res.body.data.bills[0].balance).toBe(15000);
    expect(res.body.data.bills[0].paid).toBe(0);
    expect(res.body.data.totalOutstanding).toBe(15000);
  });

  it('excludes a visit once it is settled in full', async () => {
    const { facility, department, doctor } = await seed();
    const { user, patient } = await createPatient({}, { facilityId: facility._id });
    const appointment = await bookVisit(patient._id, doctor, department, facility, 'Completed');

    await Payment.create({
      facilityId: facility._id,
      patientId: patient._id,
      appointmentId: appointment._id,
      amount: 15000,
      method: 'cash',
      status: 'Paid',
      paidAt: new Date(),
    });

    const res = await request(app).get('/api/payments/me/outstanding').set(as(await token(user)));

    expect(res.status).toBe(200);
    expect(res.body.data.bills).toHaveLength(0);
    expect(res.body.data.totalOutstanding).toBe(0);
  });

  it('does not treat a failed payment as settling a balance', async () => {
    const { facility, department, doctor } = await seed();
    const { user, patient } = await createPatient({}, { facilityId: facility._id });
    const appointment = await bookVisit(patient._id, doctor, department, facility, 'Completed');

    await Payment.create({
      facilityId: facility._id,
      patientId: patient._id,
      appointmentId: appointment._id,
      amount: 15000,
      method: 'online',
      status: 'Failed',
    });

    const res = await request(app).get('/api/payments/me/outstanding').set(as(await token(user)));

    expect(res.body.data.bills).toHaveLength(1);
    expect(res.body.data.totalOutstanding).toBe(15000);
  });

  it('nets a part payment against the balance', async () => {
    const { facility, department, doctor } = await seed();
    const { user, patient } = await createPatient({}, { facilityId: facility._id });
    const appointment = await bookVisit(patient._id, doctor, department, facility, 'Completed');

    await Payment.create({
      facilityId: facility._id,
      patientId: patient._id,
      appointmentId: appointment._id,
      amount: 5000,
      method: 'cash',
      status: 'Partially Paid',
    });

    const res = await request(app).get('/api/payments/me/outstanding').set(as(await token(user)));

    expect(res.body.data.bills[0].paid).toBe(5000);
    expect(res.body.data.bills[0].balance).toBe(10000);
    expect(res.body.data.totalOutstanding).toBe(10000);
  });

  it('ignores a cancelled visit', async () => {
    const { facility, department, doctor } = await seed();
    const { user, patient } = await createPatient({}, { facilityId: facility._id });
    await bookVisit(patient._id, doctor, department, facility, 'Cancelled');

    const res = await request(app).get('/api/payments/me/outstanding').set(as(await token(user)));

    expect(res.status).toBe(200);
    expect(res.body.data.bills).toHaveLength(0);
  });

  it('scopes outstanding bills to the signed-in patient', async () => {
    const { facility, department, doctor } = await seed();
    const { patient: owner } = await createPatient({}, { facilityId: facility._id });
    const { user: stranger } = await createPatient({}, { facilityId: facility._id });
    await bookVisit(owner._id, doctor, department, facility, 'Completed');

    const res = await request(app).get('/api/payments/me/outstanding').set(as(await token(stranger)));

    expect(res.status).toBe(200);
    expect(res.body.data.bills).toHaveLength(0);
  });

  it('refuses the outstanding route to staff', async () => {
    await createFacility();
    const receptionist = await createUser({ role: 'receptionist' });
    const res = await request(app).get('/api/payments/me/outstanding').set(as(await token(receptionist)));
    expect(res.status).toBe(403);
  });

  it('still refuses cross-facility bill access to staff', async () => {
    const a = await createFacility({ name: 'A' });
    const b = await createFacility({ name: 'B' });
    const { department, doctor } = await seed();
    const { patient } = await createPatient({}, { facilityId: a._id });
    const appointment = await bookVisit(patient._id, doctor, department, a, 'Completed');
    void b;

    const staffB = await createUser({ role: 'facility_admin', facilityId: String(b._id) });
    const res = await request(app).get(`/api/payments/bill/${appointment._id}`).set(as(await token(staffB)));
    expect(res.status).toBe(403);
  });
});
