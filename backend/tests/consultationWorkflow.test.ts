import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import {
  createFacility,
  createDoctorWithSchedule,
  createPatient,
  createUser,
  signin,
} from './factories';
import {
  Appointment,
  AppointmentHistory,
  Department,
  LaboratoryTest,
  MedicalRecord,
  Notification,
  Prescription,
} from '../src/models';

function todayAt(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const value = new Date();
  value.setHours(hours, minutes, 0, 0);
  return value;
}

async function setupConsultation() {
  const facility = await createFacility();
  const department = await Department.create({
    facilityId: facility._id,
    name: 'General Medicine',
    defaultConsultationFee: 5000,
  });
  const dayOfWeek = new Date().getDay();
  const doctor = await createDoctorWithSchedule(String(facility._id), String(department._id), {
    dayOfWeek,
  });
  const otherDoctor = await createDoctorWithSchedule(String(facility._id), String(department._id), {
    dayOfWeek,
  });
  const patient = await createPatient({ fullName: 'Consultation Patient' });
  const labUser = await createUser({ role: 'lab_technician', facilityId: facility._id });

  const appointment = await Appointment.create({
    facilityId: facility._id,
    patientId: patient.patient._id,
    doctorId: doctor.doctor._id,
    departmentId: department._id,
    appointmentDate: todayAt('09:00'),
    timeSlot: '09:00',
    reason: 'Persistent headache',
    visitType: 'new',
    bookingChannel: 'web',
    status: 'Confirmed',
  });

  const doctorToken = await signin(app, doctor.user.email!, 'Password@123');
  const otherDoctorToken = await signin(app, otherDoctor.user.email!, 'Password@123');
  const patientToken = await signin(app, patient.user.email!, 'Password@123');
  const labToken = await signin(app, labUser.email!, 'Password@123');

  return {
    facility,
    department,
    doctor,
    otherDoctor,
    patient,
    appointment,
    doctorToken,
    otherDoctorToken,
    patientToken,
    labToken,
  };
}

beforeAll(async () => {
  await connectTestDB();
}, 60000);

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

describe('Phase 3 consultation workflow', () => {
  it('starts, records, prescribes, orders labs and completes a visit', async () => {
    const { appointment, doctorToken, patientToken, patient } = await setupConsultation();

    const started = await request(app)
      .patch(`/api/appointments/${appointment._id}/start`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(started.status).toBe(200);
    expect(started.body.data.status).toBe('In Progress');

    const record = await request(app)
      .post('/api/medical-records')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        appointmentId: String(appointment._id),
        chiefComplaint: 'Headache for three days',
        symptoms: ['Headache', 'Light sensitivity'],
        diagnosis: 'Tension headache',
        treatment: 'Rest, hydration and analgesia',
        notes: 'Review if symptoms worsen',
      });
    expect(record.status).toBe(201);
    expect(record.body.data.chiefComplaint).toBe('Headache for three days');

    const prescription = await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        medicalRecordId: record.body.data._id,
        medicines: [
          { name: 'Paracetamol', dosage: '500mg', frequency: 'Twice daily', durationDays: 3 },
        ],
      });
    expect(prescription.status).toBe(201);
    expect(String(prescription.body.data.prescription.appointmentId)).toBe(String(appointment._id));

    const lab = await request(app)
      .post('/api/lab-tests')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        appointmentId: String(appointment._id),
        medicalRecordId: record.body.data._id,
        testName: 'Full Blood Count',
      });
    expect(lab.status).toBe(201);

    const patientPrescriptions = await request(app)
      .get('/api/prescriptions')
      .query({ appointmentId: String(appointment._id) })
      .set('Authorization', `Bearer ${patientToken}`);
    expect(patientPrescriptions.status).toBe(200);
    expect(patientPrescriptions.body.data).toHaveLength(1);

    const patientLabs = await request(app)
      .get('/api/lab-tests')
      .query({ appointmentId: String(appointment._id) })
      .set('Authorization', `Bearer ${patientToken}`);
    expect(patientLabs.status).toBe(200);
    expect(patientLabs.body.data).toHaveLength(1);

    expect(
      await Notification.countDocuments({ patientId: patient.patient._id, type: 'prescription' })
    ).toBeGreaterThanOrEqual(1);
    expect(
      await Notification.countDocuments({ patientId: patient.patient._id, type: 'lab_result' })
    ).toBeGreaterThanOrEqual(1);

    const completed = await request(app)
      .patch(`/api/appointments/${appointment._id}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe('Completed');
    expect(completed.body.data.completedAt).toBeTruthy();

    const history = await AppointmentHistory.find({ appointmentId: appointment._id }).lean();
    expect(history.map((entry) => entry.toStatus).sort()).toEqual(['Completed', 'In Progress']);
    expect(await MedicalRecord.countDocuments({ appointmentId: appointment._id })).toBe(1);
    expect(await Prescription.countDocuments({ appointmentId: appointment._id })).toBe(1);
    expect(await LaboratoryTest.countDocuments({ appointmentId: appointment._id })).toBe(1);
  });

  it('rejects day actions from another doctor and invalid transitions', async () => {
    const { appointment, otherDoctorToken, doctorToken } = await setupConsultation();

    const forbidden = await request(app)
      .patch(`/api/appointments/${appointment._id}/start`)
      .set('Authorization', `Bearer ${otherDoctorToken}`);
    expect(forbidden.status).toBe(403);

    const invalid = await request(app)
      .patch(`/api/appointments/${appointment._id}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(invalid.status).toBe(409);

    const unchanged = await Appointment.findById(appointment._id).lean();
    expect(unchanged?.status).toBe('Confirmed');
  });

  it('marks an unattended appointment as a no-show', async () => {
    const { appointment, doctorToken } = await setupConsultation();

    const res = await request(app)
      .patch(`/api/appointments/${appointment._id}/no-show`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Missed');
    expect(await AppointmentHistory.countDocuments({ appointmentId: appointment._id })).toBe(1);
  });

  it('books a confirmed follow-up and notifies the patient and doctor', async () => {
    const { appointment, doctorToken, doctor, patient } = await setupConsultation();

    const res = await request(app)
      .post(`/api/appointments/${appointment._id}/follow-up`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        appointmentDate: todayAt('10:00').toISOString(),
        timeSlot: '10:00',
        note: 'Review response to treatment',
        autoConfirm: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('Confirmed');
    expect(res.body.data.visitType).toBe('follow-up');
    expect(String(res.body.data.patientId)).toBe(String(patient.patient._id));

    expect(
      await Notification.countDocuments({
        patientId: patient.patient._id,
        appointmentId: res.body.data._id,
      })
    ).toBeGreaterThanOrEqual(1);
    expect(
      await Notification.countDocuments({
        doctorId: doctor.doctor._id,
        appointmentId: res.body.data._id,
      })
    ).toBeGreaterThanOrEqual(1);
  });

  it('can leave a follow-up pending as a proposal', async () => {
    const { appointment, doctorToken } = await setupConsultation();

    const res = await request(app)
      .post(`/api/appointments/${appointment._id}/follow-up`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        appointmentDate: todayAt('10:30').toISOString(),
        timeSlot: '10:30',
        autoConfirm: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('Pending');
    expect(res.body.data.visitType).toBe('follow-up');
  });

  it('refers a patient to another doctor with an optional pending appointment', async () => {
    const { appointment, doctorToken, otherDoctor, patient } = await setupConsultation();

    const res = await request(app)
      .post(`/api/appointments/${appointment._id}/refer`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        targetDoctorId: String(otherDoctor.doctor._id),
        note: 'Please assess for specialist management',
        appointmentDate: todayAt('11:00').toISOString(),
        timeSlot: '11:00',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.appointment.status).toBe('Pending');
    expect(res.body.data.appointment.visitType).toBe('referral');

    expect(
      await Notification.countDocuments({
        doctorId: otherDoctor.doctor._id,
        appointmentId: res.body.data.appointment._id,
      })
    ).toBeGreaterThanOrEqual(1);
    expect(
      await Notification.countDocuments({
        patientId: patient.patient._id,
        appointmentId: res.body.data.appointment._id,
      })
    ).toBeGreaterThanOrEqual(1);
  });

  it('notifies the doctor and patient when a lab result is completed', async () => {
    const { appointment, doctorToken, labToken, doctor, patient } = await setupConsultation();

    await request(app)
      .patch(`/api/appointments/${appointment._id}/start`)
      .set('Authorization', `Bearer ${doctorToken}`);

    const lab = await request(app)
      .post('/api/lab-tests')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ appointmentId: String(appointment._id), testName: 'Malaria Test' });

    const updated = await request(app)
      .put(`/api/lab-tests/${lab.body.data._id}`)
      .set('Authorization', `Bearer ${labToken}`)
      .send({ status: 'Completed', result: 'Positive', isAbnormal: true });

    expect(updated.status).toBe(200);
    expect(
      await Notification.countDocuments({
        patientId: patient.patient._id,
        appointmentId: appointment._id,
        type: 'lab_result',
      })
    ).toBeGreaterThanOrEqual(2);
    expect(
      await Notification.countDocuments({
        doctorId: doctor.doctor._id,
        appointmentId: appointment._id,
        type: 'lab_result',
      })
    ).toBeGreaterThanOrEqual(1);
  });
});
