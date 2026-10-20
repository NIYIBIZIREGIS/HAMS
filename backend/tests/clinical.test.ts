/**
 * Phase 2 — Clinical: MedicalRecords, Prescriptions, LabTests
 * Tests: record creation, RBAC enforcement, allergy warnings, lab status machine.
 */
import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import {
  createFacility,
  createUser,
  createDoctorWithSchedule,
  createPatient,
  signin,
  monday,
} from './factories';
import { Department, Appointment, Patient } from '../src/models';

beforeAll(async () => {
  await connectTestDB();
}, 60000);
afterEach(async () => {
  await clearTestDB();
});
afterAll(async () => {
  await closeTestDB();
});

// ── shared setup helper ──────────────────────────────────────────────────────

async function setupClinical() {
  const facility = await createFacility();
  const dept = await Department.create({
    facilityId: facility._id,
    name: 'General',
    defaultConsultationFee: 5000,
  });
  const { user: doctorUser, doctor } = await createDoctorWithSchedule(
    String(facility._id),
    String(dept._id)
  );
  const { user: patientUser, patient } = await createPatient();

  // Assign allergy to patient for allergy-warning tests
  await Patient.findByIdAndUpdate(patient._id, { allergies: ['Penicillin', 'Aspirin'] });

  const labUser = await createUser({
    role: 'lab_technician',
    facilityId: facility._id,
    email: `lab${Date.now()}@test.local`,
  });

  // Create appointment on a Monday (doctor has Monday schedule)
  const aptDate = monday(new Date());
  aptDate.setHours(9, 0, 0, 0);
  const appointment = await Appointment.create({
    facilityId: facility._id,
    patientId: patient._id,
    doctorId: doctor._id,
    departmentId: dept._id,
    appointmentDate: aptDate,
    timeSlot: '09:00',
    visitType: 'new',
    bookingChannel: 'web',
    status: 'In Progress',
  });

  const doctorToken = await signin(app, doctorUser.email!, 'Password@123');
  const patientToken = await signin(app, patientUser.email!, 'Password@123');
  const labToken = await signin(app, labUser.email!, 'Password@123');

  return {
    facility,
    dept,
    doctor,
    doctorUser,
    doctorToken,
    patient,
    patientUser,
    patientToken,
    appointment,
    labUser,
    labToken,
  };
}

// ── Medical Records ──────────────────────────────────────────────────────────

describe('Medical Records', () => {
  it('doctor can create a medical record for their appointment', async () => {
    const { doctorToken, appointment } = await setupClinical();

    const res = await request(app)
      .post('/api/medical-records')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        appointmentId: String(appointment._id),
        vitals: { temperature: 37.0, pulse: 72, oxygenSaturation: 98 },
        symptoms: ['Headache', 'Fever'],
        diagnosis: 'Acute viral syndrome',
        treatment: 'Rest and fluids',
        notes: 'Follow up in 5 days',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.diagnosis).toBe('Acute viral syndrome');
    expect(res.body.data.vitals.pulse).toBe(72);
    expect(res.body.data.symptoms).toContain('Headache');
  });

  it('patient cannot create a medical record', async () => {
    const { patientToken, appointment } = await setupClinical();

    const res = await request(app)
      .post('/api/medical-records')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        appointmentId: String(appointment._id),
        diagnosis: 'Self-diagnosis',
      });

    expect(res.status).toBe(403);
  });

  it('duplicate record for same appointment is rejected', async () => {
    const { doctorToken, appointment } = await setupClinical();

    await request(app)
      .post('/api/medical-records')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        appointmentId: String(appointment._id),
        diagnosis: 'First record',
      });

    const res = await request(app)
      .post('/api/medical-records')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        appointmentId: String(appointment._id),
        diagnosis: 'Duplicate record',
      });

    expect(res.status).toBe(409);
  });

  it('patient can fetch their own medical records', async () => {
    const { doctorToken, patientToken, appointment, patient } = await setupClinical();

    await request(app)
      .post('/api/medical-records')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ appointmentId: String(appointment._id), diagnosis: 'Test diagnosis' });

    const res = await request(app)
      .get(`/api/medical-records/${String(patient._id)}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('get record by appointment returns the correct record', async () => {
    const { doctorToken, appointment } = await setupClinical();

    await request(app)
      .post('/api/medical-records')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ appointmentId: String(appointment._id), diagnosis: 'Hypertension stage 1' });

    const res = await request(app)
      .get(`/api/medical-records/by-appointment/${String(appointment._id)}`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.diagnosis).toBe('Hypertension stage 1');
  });

  it('unauthenticated request is rejected', async () => {
    const res = await request(app)
      .post('/api/medical-records')
      .send({ appointmentId: '000000000000000000000001', diagnosis: 'Test' });

    expect(res.status).toBe(401);
  });
});

// ── Prescriptions ────────────────────────────────────────────────────────────

describe('Prescriptions', () => {
  async function createRecord(doctorToken: string, appointmentId: string) {
    const res = await request(app)
      .post('/api/medical-records')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        appointmentId,
        diagnosis: 'Bacterial infection',
        symptoms: ['Sore throat'],
      });
    return res.body.data._id as string;
  }

  it('doctor can create a prescription for a medical record', async () => {
    const { doctorToken, appointment } = await setupClinical();
    const recordId = await createRecord(doctorToken, String(appointment._id));

    const res = await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        medicalRecordId: recordId,
        medicines: [
          { name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', durationDays: 7 },
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Twice daily', durationDays: 5, instructions: 'Take with food' },
        ],
        instructions: 'Complete the full antibiotic course',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.prescription.medicines).toHaveLength(2);
    expect(res.body.data.allergyWarnings).toEqual([]); // Amoxicillin and Ibuprofen don't match Penicillin/Aspirin exactly
  });

  it('allergy warning is returned when prescribed medicine matches patient allergy', async () => {
    const { doctorToken, appointment } = await setupClinical();
    const recordId = await createRecord(doctorToken, String(appointment._id));

    const res = await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        medicalRecordId: recordId,
        medicines: [
          { name: 'Penicillin V', dosage: '250mg', frequency: 'Four times daily', durationDays: 5 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.allergyWarnings.length).toBeGreaterThan(0);
    expect(res.body.data.allergyWarnings[0]).toMatch(/Penicillin/i);
  });

  it('patient cannot create a prescription', async () => {
    const { patientToken } = await setupClinical();

    const res = await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        medicalRecordId: '000000000000000000000001',
        medicines: [{ name: 'Test', dosage: '1', frequency: 'Daily', durationDays: 1 }],
      });

    expect(res.status).toBe(403);
  });

  it('patient can fetch their own prescription', async () => {
    const { doctorToken, patientToken, appointment } = await setupClinical();
    const recordId = await createRecord(doctorToken, String(appointment._id));

    const createRes = await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        medicalRecordId: recordId,
        medicines: [{ name: 'Paracetamol', dosage: '500mg', frequency: 'As needed', durationDays: 3 }],
      });
    const prescriptionId = createRes.body.data.prescription._id as string;

    const getRes = await request(app)
      .get(`/api/prescriptions/${prescriptionId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.medicines[0].name).toBe('Paracetamol');
  });

  it('prescription PDF endpoint returns HTML content', async () => {
    const { doctorToken, appointment } = await setupClinical();
    const recordId = await createRecord(doctorToken, String(appointment._id));

    const createRes = await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        medicalRecordId: recordId,
        medicines: [{ name: 'Metronidazole', dosage: '400mg', frequency: 'Twice daily', durationDays: 5 }],
      });
    const prescriptionId = createRes.body.data.prescription._id as string;

    const pdfRes = await request(app)
      .get(`/api/prescriptions/${prescriptionId}/pdf`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('text/html');
    expect(pdfRes.text).toContain('Metronidazole');
    expect(pdfRes.text).toContain('Prescription');
  });
});

// ── Laboratory Tests ─────────────────────────────────────────────────────────

describe('Laboratory Tests', () => {
  it('doctor can request a lab test', async () => {
    const { doctorToken, appointment } = await setupClinical();

    const res = await request(app)
      .post('/api/lab-tests')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        appointmentId: String(appointment._id),
        testName: 'Full Blood Count',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.testName).toBe('Full Blood Count');
    expect(res.body.data.status).toBe('Requested');
  });

  it('patient cannot request a lab test', async () => {
    const { patientToken, appointment } = await setupClinical();

    const res = await request(app)
      .post('/api/lab-tests')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ appointmentId: String(appointment._id), testName: 'Illegal self-request' });

    expect(res.status).toBe(403);
  });

  it('lab technician can update test to In Progress then Completed with result', async () => {
    const { doctorToken, labToken, appointment } = await setupClinical();

    const createRes = await request(app)
      .post('/api/lab-tests')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ appointmentId: String(appointment._id), testName: 'Malaria RDT' });
    const testId = createRes.body.data._id as string;

    const startRes = await request(app)
      .put(`/api/lab-tests/${testId}`)
      .set('Authorization', `Bearer ${labToken}`)
      .send({ status: 'In Progress' });
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe('In Progress');

    const completeRes = await request(app)
      .put(`/api/lab-tests/${testId}`)
      .set('Authorization', `Bearer ${labToken}`)
      .send({
        status: 'Completed',
        result: 'Negative',
        referenceRange: 'Negative',
        isAbnormal: false,
      });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe('Completed');
    expect(completeRes.body.data.result).toBe('Negative');
    expect(completeRes.body.data.completedAt).toBeTruthy();
  });

  it('invalid status transition is rejected', async () => {
    const { doctorToken, labToken, appointment } = await setupClinical();

    const createRes = await request(app)
      .post('/api/lab-tests')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ appointmentId: String(appointment._id), testName: 'Urine Analysis' });
    const testId = createRes.body.data._id as string;

    // Jump from Requested directly to Completed (allowed by our model), then try In Progress again
    await request(app)
      .put(`/api/lab-tests/${testId}`)
      .set('Authorization', `Bearer ${labToken}`)
      .send({ status: 'Completed', result: 'Normal' });

    const invalidRes = await request(app)
      .put(`/api/lab-tests/${testId}`)
      .set('Authorization', `Bearer ${labToken}`)
      .send({ status: 'In Progress' });

    expect(invalidRes.status).toBe(409);
  }, 60000);

  it('patient can list their own lab tests', async () => {
    const { doctorToken, patientToken, appointment } = await setupClinical();

    await request(app)
      .post('/api/lab-tests')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ appointmentId: String(appointment._id), testName: 'HIV Rapid Test' });

    const res = await request(app)
      .get('/api/lab-tests')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].testName).toBe('HIV Rapid Test');
  });

  it('lab technician from another facility cannot update test', async () => {
    const { doctorToken, appointment } = await setupClinical();

    const createRes = await request(app)
      .post('/api/lab-tests')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ appointmentId: String(appointment._id), testName: 'Liver Function Test' });
    const testId = createRes.body.data._id as string;

    // Create a lab tech at a *different* facility
    const otherFacility = await createFacility({ name: 'Other Hospital' });
    const otherLabUser = await createUser({
      role: 'lab_technician',
      facilityId: otherFacility._id,
      email: `otherlab${Date.now()}@test.local`,
    });
    const otherLabToken = await signin(app, otherLabUser.email!, 'Password@123');

    const res = await request(app)
      .put(`/api/lab-tests/${testId}`)
      .set('Authorization', `Bearer ${otherLabToken}`)
      .send({ status: 'In Progress' });

    expect(res.status).toBe(403);
  }, 60000);
});
