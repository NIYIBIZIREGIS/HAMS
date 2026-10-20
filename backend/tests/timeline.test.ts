import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createDoctorWithSchedule, createPatient, signin } from './factories';
import { Appointment, Department, LaboratoryTest, MedicalRecord, Prescription } from '../src/models';

const as = (token: string) => ({ Authorization: `Bearer ${token}` });

async function token(user: { email?: string }): Promise<string> {
  return signin(app, String(user.email), 'Password@123');
}

describe('Patient medical history timeline', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  /**
   * One facility/department/doctor plus a patient, and a helper to seed a record together
   * with its prescription and lab result.
   */
  async function seed() {
    const facility = await createFacility();
    const department = await Department.create({
      facilityId: facility._id,
      name: 'General',
      defaultConsultationFee: 20000,
      isActive: true,
    });
    const { doctor } = await createDoctorWithSchedule(String(facility._id), String(department._id));
    const { user, patient } = await createPatient({}, { facilityId: facility._id });
    return { facility, department, doctor, user, patient };
  }

  async function bookVisit(patientId: unknown, doctor: { _id: unknown }, department: { _id: unknown }, facility: { _id: unknown }) {
    return Appointment.create({
      facilityId: facility._id,
      patientId,
      doctorId: doctor._id,
      departmentId: department._id,
      appointmentDate: new Date(),
      timeSlot: '09:00',
      visitType: 'new',
      bookingChannel: 'web',
      status: 'Completed',
    });
  }

  /** A consultation plus the prescription and lab result that hang off it. */
  async function seedVisit(ctx: Awaited<ReturnType<typeof seed>>, diagnosis: string, testName: string) {
    const { facility, department, doctor, patient } = ctx;
    const appointment = await bookVisit(patient._id, doctor, department, facility);
    const record = await MedicalRecord.create({
      patientId: patient._id,
      doctorId: doctor._id,
      appointmentId: appointment._id,
      facilityId: facility._id,
      diagnosis,
      treatment: 'Rest and fluids',
    });
    await Prescription.create({
      medicalRecordId: record._id,
      patientId: patient._id,
      doctorId: doctor._id,
      facilityId: facility._id,
      medicines: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TDS', durationDays: 5 }],
    });
    await LaboratoryTest.create({
      appointmentId: appointment._id,
      medicalRecordId: record._id,
      facilityId: facility._id,
      patientId: patient._id,
      requestedBy: doctor._id,
      testName,
      status: 'Completed',
      result: 'Normal',
    });
    return { appointment, record };
  }

  it('merges records, prescriptions and lab results into one reverse-chronological feed', async () => {
    const ctx = await seed();
    const { record } = await seedVisit(ctx, 'Malaria', 'Malaria RDT');

    const res = await request(app)
      .get(`/api/medical-records/${ctx.patient._id}/timeline`)
      .set(as(await token(ctx.user)));

    expect(res.status).toBe(200);
    const types = res.body.data.map((e: { type: string }) => e.type).sort();
    expect(types).toEqual(['lab', 'prescription', 'record']);
    expect(res.body.meta.total).toBe(3);
    // The prescription is reached through its record, so it must belong to this patient.
    expect(res.body.data.some((e: { id: string }) => e.id === String(record._id))).toBe(true);
  });

  it('resolves the clinician and facility names the portal header shows', async () => {
    const ctx = await seed();
    await seedVisit(ctx, 'Malaria', 'Malaria RDT');

    const res = await request(app)
      .get(`/api/medical-records/${ctx.patient._id}/timeline?type=record`)
      .set(as(await token(ctx.user)));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].doctorName).toBeTruthy();
    expect(res.body.data[0].facilityName).toBeTruthy();
  });

  it('filters by branch without leaking the other types', async () => {
    const ctx = await seed();
    await seedVisit(ctx, 'Malaria', 'Malaria RDT');

    const res = await request(app)
      .get(`/api/medical-records/${ctx.patient._id}/timeline?type=lab`)
      .set(as(await token(ctx.user)));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe('lab');
    // The total must reflect the filtered branch, not the whole feed.
    expect(res.body.meta.total).toBe(1);
  });

  it('searches across the branches it includes', async () => {
    const ctx = await seed();
    await seedVisit(ctx, 'Malaria', 'Malaria RDT');

    const hit = await request(app)
      .get(`/api/medical-records/${ctx.patient._id}/timeline?search=amox`)
      .set(as(await token(ctx.user)));
    expect(hit.status).toBe(200);
    expect(hit.body.data).toHaveLength(1);
    expect(hit.body.data[0].type).toBe('prescription');
    expect(hit.body.meta.total).toBe(1);

    const miss = await request(app)
      .get(`/api/medical-records/${ctx.patient._id}/timeline?search=zzz`)
      .set(as(await token(ctx.user)));
    expect(miss.status).toBe(200);
    expect(miss.body.data).toHaveLength(0);
    expect(miss.body.meta.total).toBe(0);
  });

  it('treats a regex metacharacter in search as a literal', async () => {
    const ctx = await seed();
    await seedVisit(ctx, 'Malaria', 'Malaria RDT');

    const res = await request(app)
      .get(`/api/medical-records/${ctx.patient._id}/timeline?search=.*`)
      .set(as(await token(ctx.user)));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('pages the feed and reports a total larger than the page', async () => {
    const ctx = await seed();
    for (let i = 0; i < 4; i += 1) {
      await seedVisit(ctx, `Diagnosis ${i}`, `Test ${i}`);
    }

    const res = await request(app)
      .get(`/api/medical-records/${ctx.patient._id}/timeline?page=1&limit=5`)
      .set(as(await token(ctx.user)));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.meta.total).toBe(12);
    expect(res.body.meta.pages).toBe(3);
    // Newest first.
    const dates = res.body.data.map((e: { date: string }) => new Date(e.date).getTime());
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });

  it('rejects another patient reading the feed', async () => {
    const ctx = await seed();
    await seedVisit(ctx, 'Malaria', 'Malaria RDT');
    const other = await createPatient({}, { facilityId: ctx.facility._id });

    const res = await request(app)
      .get(`/api/medical-records/${ctx.patient._id}/timeline`)
      .set(as(await token(other.user)));

    expect(res.status).toBe(403);
  });
});

describe('Appointment list filters', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  async function seed() {
    const facility = await createFacility();
    const department = await Department.create({
      facilityId: facility._id,
      name: 'General',
      defaultConsultationFee: 20000,
      isActive: true,
    });
    const { doctor } = await createDoctorWithSchedule(String(facility._id), String(department._id));
    const { user, patient } = await createPatient({}, { facilityId: facility._id });
    return { facility, department, doctor, user, patient };
  }

  async function book(ctx: Awaited<ReturnType<typeof seed>>, status: string, appointmentDate: Date) {
    return Appointment.create({
      facilityId: ctx.facility._id,
      patientId: ctx.patient._id,
      doctorId: ctx.doctor._id,
      departmentId: ctx.department._id,
      appointmentDate,
      timeSlot: '09:00',
      visitType: 'new',
      bookingChannel: 'web',
      status,
    });
  }

  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  };

  it('accepts a comma-separated status list', async () => {
    const ctx = await seed();
    await book(ctx, 'Confirmed', day(1));
    await book(ctx, 'Completed', day(2));
    await book(ctx, 'Cancelled', day(3));

    const res = await request(app)
      .get('/api/appointments?status=Confirmed,Completed')
      .set(as(await token(ctx.user)));

    expect(res.status).toBe(200);
    const statuses = res.body.data.map((a: { status: string }) => a.status).sort();
    expect(statuses).toEqual(['Completed', 'Confirmed']);
  });

  it('ignores an unknown status rather than returning an empty page', async () => {
    const ctx = await seed();
    await book(ctx, 'Confirmed', day(1));

    const res = await request(app)
      .get('/api/appointments?status=Confirmed,Bogus')
      .set(as(await token(ctx.user)));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('filters by an inclusive date range', async () => {
    const ctx = await seed();
    await book(ctx, 'Confirmed', day(0));
    await book(ctx, 'Confirmed', day(5));
    await book(ctx, 'Confirmed', day(10));

    const from = day(3).toISOString().slice(0, 10);
    const to = day(7).toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/appointments?dateFrom=${from}&dateTo=${to}`)
      .set(as(await token(ctx.user)));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const expected = day(5).toISOString().slice(0, 10);
    expect(res.body.data[0].appointmentDate.slice(0, 10)).toBe(expected);
  });

  it('rejects a malformed date filter instead of ignoring it', async () => {
    const ctx = await seed();
    await book(ctx, 'Confirmed', day(1));

    const res = await request(app)
      .get('/api/appointments?dateFrom=not-a-date')
      .set(as(await token(ctx.user)));

    // Silently dropping a bad filter would widen the result set the caller did not ask for.
    expect(res.status).toBe(400);
  });
});
