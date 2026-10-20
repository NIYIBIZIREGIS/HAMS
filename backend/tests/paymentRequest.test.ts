import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createDoctorWithSchedule, createPatient, createUser, signin } from './factories';
import { Appointment, Department, Payment } from '../src/models';

const as = (token: string) => ({ Authorization: `Bearer ${token}` });

async function token(user: { email?: string }): Promise<string> {
  return signin(app, String(user.email), 'Password@123');
}

describe('Self-service payment requests', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  /** Facility + department + doctor with a known 15000 consultation fee. */
  async function seed() {
    const facility = await createFacility();
    const department = await Department.create({
      facilityId: facility._id,
      name: 'General',
      defaultConsultationFee: 20000,
      isActive: true,
    });
    const { doctor } = await createDoctorWithSchedule(String(facility._id), String(department._id));
    doctor.consultationFee = { newVisit: 15000, followUp: 7500 };
    await doctor.save();
    return { facility, department, doctor };
  }

  async function bookVisit(
    ctx: Awaited<ReturnType<typeof seed>>,
    patientId: unknown,
    status: string,
  ) {
    return Appointment.create({
      facilityId: ctx.facility._id,
      patientId,
      doctorId: ctx.doctor._id,
      departmentId: ctx.department._id,
      appointmentDate: new Date(),
      timeSlot: '09:00',
      visitType: 'new',
      bookingChannel: 'web',
      status,
    });
  }

  async function patientWithVisit(status = 'Completed') {
    const ctx = await seed();
    const { user, patient } = await createPatient({}, { facilityId: ctx.facility._id });
    const appointment = await bookVisit(ctx, patient._id, status);
    return { ctx, user, patient, appointment };
  }

  it('records a request as pending with a server-computed amount', async () => {
    const { user, appointment } = await patientWithVisit();

    const res = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });

    expect(res.status).toBe(201);
    expect(res.body.data.payment.status).toBe('Pending');
    expect(res.body.data.payment.source).toBe('portal');
    // The whole bill is owed, and nothing was charged.
    expect(res.body.data.amountDue).toBe(15000);
    expect(res.body.data.payment.amount).toBe(15000);
    expect(res.body.data.status).toBe('awaiting_confirmation');
    expect(res.body.data.payment.requestReference).toMatch(/^PAY-[0-9A-F]{8}$/);
    expect(res.body.data.payment.receiptNumber).toBeUndefined();
  });

  it('ignores an amount supplied by the client', async () => {
    const { user, appointment } = await patientWithVisit();

    const res = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'cash', amount: 1 });

    expect(res.status).toBe(201);
    // A client-supplied amount would let a patient settle a 15000 bill for 1.
    expect(res.body.data.amountDue).toBe(15000);
    const stored = await Payment.findById(res.body.data.payment._id);
    expect(stored?.amount).toBe(15000);
  });

  it('never stores card details sent by the client', async () => {
    const { user, appointment } = await patientWithVisit();

    const res = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({
        appointmentId: String(appointment._id),
        method: 'card',
        cardNumber: '4242424242424242',
        cvv: '123',
      });

    expect(res.status).toBe(201);
    const stored = await Payment.findById(res.body.data.payment._id).lean();
    expect(JSON.stringify(stored)).not.toContain('4242424242424242');
    expect(JSON.stringify(stored)).not.toContain('cvv');
    expect(stored?.method).toBe('card');
  });

  it('refuses a request against another patient visit', async () => {
    const { appointment } = await patientWithVisit();
    const stranger = await createPatient();

    const res = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(stranger.user)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });

    expect(res.status).toBe(404);
    expect(await Payment.countDocuments()).toBe(0);
  });

  it('refuses a duplicate request for the same visit', async () => {
    const { user, appointment } = await patientWithVisit();
    const body = { appointmentId: String(appointment._id), method: 'cash' };

    const first = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send(body);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send(body);
    expect(second.status).toBe(409);
    expect(await Payment.countDocuments()).toBe(1);
  });

  it('refuses a visit that is not billable', async () => {
    const { user, appointment } = await patientWithVisit('Cancelled');

    const res = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });

    expect(res.status).toBe(400);
  });

  it('refuses a visit that is already settled', async () => {
    const { ctx, user, patient, appointment } = await patientWithVisit();
    await Payment.create({
      appointmentId: appointment._id,
      patientId: patient._id,
      facilityId: ctx.facility._id,
      amount: 15000,
      breakdown: { consultationFee: 15000, labCharges: 0, pharmacyCharges: 0, discount: 0, tax: 0, schemeSubsidy: 0 },
      method: 'cash',
      status: 'Paid',
      source: 'staff',
    });

    const res = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });

    expect(res.status).toBe(400);
  });

  it('rejects a staff-only method', async () => {
    const { user, appointment } = await patientWithVisit();

    const res = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'insurance' });

    expect(res.status).toBe(400);
  });

  it('refuses non-patient callers', async () => {
    const { user, appointment } = await patientWithVisit();
    const receptionist = await createUser({ role: 'receptionist' });

    const res = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(receptionist)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });

    expect(res.status).toBe(403);
    void user;
  });

  it('reports the open request on the outstanding balance', async () => {
    const { user, appointment } = await patientWithVisit();

    await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });

    const res = await request(app).get('/api/payments/me/outstanding').set(as(await token(user)));

    expect(res.status).toBe(200);
    const bill = res.body.data.bills.find(
      (b: { appointmentId: string }) => b.appointmentId === String(appointment._id),
    );
    expect(bill.hasOpenRequest).toBe(true);
    expect(bill.requestReference).toMatch(/^PAY-/);
    // Still owed: nothing was captured.
    expect(res.body.data.totalOutstanding).toBe(15000);
  });

  it('lets the patient withdraw an unconfirmed request', async () => {
    const { user, appointment } = await patientWithVisit();
    const created = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });

    const res = await request(app)
      .post(`/api/payments/me/requests/${created.body.data.payment._id}/cancel`)
      .set(as(await token(user)));

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('Failed');

    // Withdrawn, so the visit can be requested again.
    const again = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });
    expect(again.status).toBe(201);
  });

  it('will not let a patient cancel somebody else request', async () => {
    const { user, appointment } = await patientWithVisit();
    const created = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });
    const stranger = await createPatient();

    const res = await request(app)
      .post(`/api/payments/me/requests/${created.body.data.payment._id}/cancel`)
      .set(as(await token(stranger.user)));

    expect(res.status).toBe(404);
    const still = await Payment.findById(created.body.data.payment._id);
    expect(still?.status).toBe('Pending');
  });

  it('settles the request when staff confirm the funds', async () => {
    const { ctx, user, appointment } = await patientWithVisit();
    const created = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });
    const paymentId = created.body.data.payment._id;

    const receptionist = await createUser({ role: 'receptionist', facilityId: ctx.facility._id });
    const res = await request(app)
      .post(`/api/payments/${paymentId}/confirm`)
      .set(as(await token(receptionist)));

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('Paid');
    expect(res.body.data.payment.receiptNumber).toMatch(/^RCPT-/);
    expect(res.body.data.payment.paidAt).toBeTruthy();
    expect(res.body.data.receipt.receiptNumber).toBe(res.body.data.payment.receiptNumber);

    // The balance is now cleared on the patient's side.
    const outstanding = await request(app)
      .get('/api/payments/me/outstanding')
      .set(as(await token(user)));
    expect(outstanding.body.data.totalOutstanding).toBe(0);
    expect(outstanding.body.data.bills).toHaveLength(0);
  });

  it('will not confirm the same request twice', async () => {
    const { ctx, user, appointment } = await patientWithVisit();
    const created = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });
    const paymentId = created.body.data.payment._id;
    const receptionist = await createUser({ role: 'receptionist', facilityId: ctx.facility._id });

    const first = await request(app)
      .post(`/api/payments/${paymentId}/confirm`)
      .set(as(await token(receptionist)));
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/payments/${paymentId}/confirm`)
      .set(as(await token(receptionist)));
    expect(second.status).toBe(400);
  });

  it('refuses confirmation by a patient', async () => {
    const { user, appointment } = await patientWithVisit();
    const created = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });

    const res = await request(app)
      .post(`/api/payments/${created.body.data.payment._id}/confirm`)
      .set(as(await token(user)));

    expect(res.status).toBe(403);
    const stored = await Payment.findById(created.body.data.payment._id);
    expect(stored?.status).toBe('Pending');
  });

  it('refuses confirmation by staff at another hospital', async () => {
    const { user, appointment } = await patientWithVisit();
    const created = await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });

    const other = await createFacility({ name: 'Other' });
    const elsewhere = await createUser({ role: 'receptionist', facilityId: other._id });
    const res = await request(app)
      .post(`/api/payments/${created.body.data.payment._id}/confirm`)
      .set(as(await token(elsewhere)));

    expect(res.status).toBe(403);
    const stored = await Payment.findById(created.body.data.payment._id);
    expect(stored?.status).toBe('Pending');
  });

  it('lists the request among the patient payments', async () => {
    const { user, appointment } = await patientWithVisit();
    await request(app)
      .post('/api/payments/me/requests')
      .set(as(await token(user)))
      .send({ appointmentId: String(appointment._id), method: 'cash' });

    const res = await request(app).get('/api/payments/me').set(as(await token(user)));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('Pending');
    expect(res.body.data[0].source).toBe('portal');
  });
});