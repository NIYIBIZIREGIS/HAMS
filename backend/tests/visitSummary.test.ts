import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createDoctorWithSchedule, createPatient } from './factories';
import {
  Appointment,
  LaboratoryTest,
  MedicalRecord,
  Notification,
  Prescription,
} from '../src/models';

describe('After-visit summary', () => {
  let facility: Awaited<ReturnType<typeof createFacility>>;
  let doctor: Awaited<ReturnType<typeof createDoctorWithSchedule>>;
  let patient: Awaited<ReturnType<typeof createPatient>>;
  let otherPatient: Awaited<ReturnType<typeof createPatient>>;
  let otherDoctor: Awaited<ReturnType<typeof createDoctorWithSchedule>>;

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
  });

  afterAll(async () => {
    await closeTestDB();
  });

  const asUser = (req: request.Test, email?: string) => req.set('x-test-user', email as string);

  async function createAppointment(overrides: Record<string, unknown> = {}) {
    return Appointment.create({
      facilityId: facility._id,
      patientId: patient.patient._id,
      doctorId: doctor.doctor._id,
      departmentId: deptId,
      appointmentDate: new Date(),
      timeSlot: '09:00',
      reason: 'Follow-up visit',
      visitType: 'follow-up',
      bookingChannel: 'web',
      status: 'Completed',
      completedAt: new Date(),
      ...overrides,
    });
  }

  async function addClinicalData(appointmentId: unknown) {
    const record = await MedicalRecord.create({
      patientId: patient.patient._id,
      doctorId: doctor.doctor._id,
      appointmentId,
      facilityId: facility._id,
      vitals: { bloodPressure: '120/80', temperature: 37.2 },
      chiefComplaint: 'Fever and headache',
      symptoms: ['Fever', 'Headache'],
      diagnosis: 'Malaria',
      treatment: 'Artemether-lumefantrine',
      notes: 'Drink plenty of fluids.',
      followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await Prescription.create({
      medicalRecordId: record._id,
      appointmentId,
      patientId: patient.patient._id,
      doctorId: doctor.doctor._id,
      facilityId: facility._id,
      medicines: [
        {
          name: 'Artemether-lumefantrine',
          dosage: '20/120 mg',
          frequency: 'Twice daily',
          durationDays: 3,
        },
      ],
      instructions: 'Take with food.',
    });

    await LaboratoryTest.create({
      appointmentId,
      medicalRecordId: record._id,
      facilityId: facility._id,
      patientId: patient.patient._id,
      requestedBy: doctor.doctor._id,
      testName: 'Malaria test',
      result: 'Positive',
      isAbnormal: true,
      status: 'Completed',
      completedAt: new Date(),
    });

    return record;
  }

  it('returns the record, prescriptions, labs and appointment context to the patient owner', async () => {
    const appointment = await createAppointment();
    await addClinicalData(appointment._id);

    const res = await asUser(
      request(app).get(`/api/appointments/${appointment._id}/visit-summary`),
      patient.user.email
    );

    expect(res.status).toBe(200);
    expect(res.body.data.appointment.doctorId.userId.fullName).toBe(doctor.user.fullName);
    expect(res.body.data.appointment.facilityId.name).toBe(facility.name);
    expect(res.body.data.record.diagnosis).toBe('Malaria');
    expect(res.body.data.record.symptoms).toEqual(['Fever', 'Headache']);
    expect(res.body.data.prescriptions).toHaveLength(1);
    expect(res.body.data.prescriptions[0].medicines[0].name).toBe('Artemether-lumefantrine');
    expect(res.body.data.labTests).toHaveLength(1);
    expect(res.body.data.labTests[0]).toMatchObject({
      testName: 'Malaria test',
      result: 'Positive',
      isAbnormal: true,
      status: 'Completed',
    });
  });

  it('allows the treating doctor but blocks other patients, other doctors and unfinished visits', async () => {
    const appointment = await createAppointment();
    const inProgress = await createAppointment({ status: 'In Progress', completedAt: null });

    const doctorRes = await asUser(
      request(app).get(`/api/appointments/${appointment._id}/visit-summary`),
      doctor.user.email
    );
    expect(doctorRes.status).toBe(200);

    const otherPatientRes = await asUser(
      request(app).get(`/api/appointments/${appointment._id}/visit-summary`),
      otherPatient.user.email
    );
    expect(otherPatientRes.status).toBe(403);

    const otherDoctorRes = await asUser(
      request(app).get(`/api/appointments/${appointment._id}/visit-summary`),
      otherDoctor.user.email
    );
    expect(otherDoctorRes.status).toBe(403);

    const unfinishedRes = await asUser(
      request(app).get(`/api/appointments/${inProgress._id}/visit-summary`),
      patient.user.email
    );
    expect(unfinishedRes.status).toBe(409);
  });

  it('returns an empty summary when the visit has no clinical data', async () => {
    const appointment = await createAppointment();

    const res = await asUser(
      request(app).get(`/api/appointments/${appointment._id}/visit-summary`),
      patient.user.email
    );

    expect(res.status).toBe(200);
    expect(res.body.data.record).toBeNull();
    expect(res.body.data.prescriptions).toEqual([]);
    expect(res.body.data.labTests).toEqual([]);
  });

  it('notifies the patient that the after-visit summary is ready when the doctor completes the visit', async () => {
    const appointment = await createAppointment({ status: 'In Progress', completedAt: null });
    await addClinicalData(appointment._id);

    const completed = await asUser(
      request(app).patch(`/api/appointments/${appointment._id}/complete`),
      doctor.user.email
    );
    expect(completed.status).toBe(200);

    const notification = await Notification.findOne({
      patientId: patient.patient._id,
      appointmentId: appointment._id,
      title: 'Consultation completed',
    }).lean();
    expect(notification?.body).toContain('after-visit summary');
    expect(notification?.link).toBe(`/appointments/${appointment._id}#visit-summary`);

    const summary = await asUser(
      request(app).get(`/api/appointments/${appointment._id}/visit-summary`),
      patient.user.email
    );
    expect(summary.status).toBe(200);
    expect(summary.body.data.record.diagnosis).toBe('Malaria');
  });
});
