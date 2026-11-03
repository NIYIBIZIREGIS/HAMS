import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createDoctorWithSchedule, createPatient } from './factories';
import {
  Appointment,
  AppointmentHistory,
  LaboratoryTest,
  MedicalRecord,
  Notification,
  PatientDocument,
} from '../src/models';

const DAY = new Date('2026-11-02T00:00:00.000Z');
const deptId = '000000000000000000000001';

describe('Appointment rescheduling and doctor patient view', () => {
  let facility: Awaited<ReturnType<typeof createFacility>>;
  let doctor: Awaited<ReturnType<typeof createDoctorWithSchedule>>;
  let otherDoctor: Awaited<ReturnType<typeof createDoctorWithSchedule>>;
  let patient: Awaited<ReturnType<typeof createPatient>>;
  let appointment: { _id: Types.ObjectId };

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
      appointmentDate: DAY,
      timeSlot: '09:00',
      reason: 'Persistent headache',
      visitType: 'new',
      bookingChannel: 'web',
      status: 'Pending',
    });
  });

  afterAll(async () => {
    await closeTestDB();
  });

  const asDoctor = (req: request.Test, user = doctor.user) =>
    req.set('x-test-user', user.email as string);
  const asPatient = (req: request.Test) =>
    req.set('x-test-user', patient.user.email as string);

  async function confirmAppointment() {
    await asDoctor(request(app).patch(`/api/appointments/${appointment._id}/accept`));
  }

  it('proposes a new time, records it, and notifies the patient', async () => {
    const res = await asDoctor(request(app).patch(`/api/appointments/${appointment._id}/propose`)).send({
      appointmentDate: DAY.toISOString(),
      timeSlot: '09:15',
      note: 'Please come 15 minutes later',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Reschedule Proposed');
    expect(res.body.data.proposedTimeSlot).toBe('09:15');
    expect(res.body.data.proposedNote).toBe('Please come 15 minutes later');

    const history = await AppointmentHistory.findOne({ appointmentId: appointment._id }).lean();
    expect(history).toMatchObject({
      fromStatus: 'Pending',
      toStatus: 'Reschedule Proposed',
      changedBy: doctor.user._id,
    });

    const notification = await Notification.findOne({
      patientId: patient.patient._id,
      appointmentId: appointment._id,
    }).lean();
    expect(notification?.title).toBe('New appointment time proposed');
    expect(notification?.body).toContain('09:15');
    expect(notification?.link).toBe(`/appointments/${appointment._id}`);
  });

  it('rejects a proposed time outside the doctor schedule or already booked', async () => {
    const outside = await asDoctor(
      request(app).patch(`/api/appointments/${appointment._id}/propose`)
    ).send({ appointmentDate: DAY.toISOString(), timeSlot: '08:00' });
    expect(outside.status).toBe(400);

    await Appointment.create({
      facilityId: facility._id,
      patientId: patient.patient._id,
      doctorId: doctor.doctor._id,
      departmentId: deptId,
      appointmentDate: DAY,
      timeSlot: '09:15',
      visitType: 'new',
      bookingChannel: 'web',
      status: 'Confirmed',
    });

    const taken = await asDoctor(
      request(app).patch(`/api/appointments/${appointment._id}/propose`)
    ).send({ appointmentDate: DAY.toISOString(), timeSlot: '09:15' });
    expect(taken.status).toBe(409);
    expect((await Appointment.findById(appointment._id).lean())?.status).toBe('Pending');
  });

  it('lets the patient accept a proposal and notifies the doctor', async () => {
    await asDoctor(request(app).patch(`/api/appointments/${appointment._id}/propose`)).send({
      appointmentDate: DAY.toISOString(),
      timeSlot: '09:45',
    });

    const res = await asPatient(
      request(app).patch(`/api/appointments/${appointment._id}/proposal/accept`)
    );

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Confirmed');
    expect(res.body.data.timeSlot).toBe('09:45');

    const history = await AppointmentHistory.find({ appointmentId: appointment._id })
      .sort({ createdAt: 1 })
      .lean();
    expect(history.map((row) => row.toStatus)).toEqual(['Reschedule Proposed', 'Confirmed']);

    const notification = await Notification.findOne({
      doctorId: doctor.doctor._id,
      appointmentId: appointment._id,
    }).lean();
    expect(notification?.title).toBe('Reschedule accepted');
  });

  it('lets the patient reject a proposal and keeps the original time', async () => {
    await asDoctor(request(app).patch(`/api/appointments/${appointment._id}/propose`)).send({
      appointmentDate: DAY.toISOString(),
      timeSlot: '10:00',
    });

    const res = await asPatient(
      request(app).patch(`/api/appointments/${appointment._id}/proposal/reject`)
    ).send({ reason: 'I cannot travel that early' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Declined');
    expect(res.body.data.timeSlot).toBe('09:00');
    expect(res.body.data.declineReason).toContain('I cannot travel that early');

    const notification = await Notification.findOne({
      doctorId: doctor.doctor._id,
      appointmentId: appointment._id,
    }).lean();
    expect(notification?.title).toBe('Reschedule rejected');
  });

  it('rejects an accept when the proposed slot has since been taken', async () => {
    await asDoctor(request(app).patch(`/api/appointments/${appointment._id}/propose`)).send({
      appointmentDate: DAY.toISOString(),
      timeSlot: '10:15',
    });
    await Appointment.create({
      facilityId: facility._id,
      patientId: patient.patient._id,
      doctorId: doctor.doctor._id,
      departmentId: deptId,
      appointmentDate: DAY,
      timeSlot: '10:15',
      visitType: 'new',
      bookingChannel: 'web',
      status: 'Confirmed',
    });

    const res = await asPatient(
      request(app).patch(`/api/appointments/${appointment._id}/proposal/accept`)
    );
    expect(res.status).toBe(409);
    expect((await Appointment.findById(appointment._id).lean())?.status).toBe('Reschedule Proposed');
  });

  it('reschedules a confirmed appointment with conflict checks and notifies the patient', async () => {
    await confirmAppointment();
    const blocked = await asDoctor(
      request(app).patch(`/api/appointments/${appointment._id}/reschedule`)
    ).send({ appointmentDate: DAY.toISOString(), timeSlot: '08:00' });
    expect(blocked.status).toBe(400);

    const res = await asDoctor(
      request(app).patch(`/api/appointments/${appointment._id}/reschedule`)
    ).send({ appointmentDate: DAY.toISOString(), timeSlot: '10:30', reason: 'Theatre schedule' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Confirmed');
    expect(res.body.data.timeSlot).toBe('10:30');

    const notification = await Notification.findOne({
      patientId: patient.patient._id,
      appointmentId: appointment._id,
      title: 'Appointment rescheduled',
    }).lean();
    expect(notification?.body).toContain('10:30');
    expect(notification?.body).toContain('Theatre schedule');
  });

  it('requires a reason when a doctor cancels and notifies the patient when supplied', async () => {
    await confirmAppointment();

    const missing = await asDoctor(
      request(app).delete(`/api/appointments/${appointment._id}`)
    );
    expect(missing.status).toBe(400);

    const res = await asDoctor(request(app).delete(`/api/appointments/${appointment._id}`)).send({
      reason: 'Doctor emergency',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Cancelled');
    expect(res.body.data.cancellationReason).toBe('Doctor emergency');

    const notification = await Notification.findOne({
      patientId: patient.patient._id,
      appointmentId: appointment._id,
      title: 'Appointment cancelled',
    }).lean();
    expect(notification?.body).toContain('Doctor emergency');
  });

  it('serves an appointment-scoped read-only patient summary to the owning doctor', async () => {
    const completed = await Appointment.create({
      facilityId: facility._id,
      patientId: patient.patient._id,
      doctorId: doctor.doctor._id,
      departmentId: deptId,
      appointmentDate: new Date('2026-10-26T00:00:00.000Z'),
      timeSlot: '09:00',
      visitType: 'new',
      bookingChannel: 'web',
      status: 'Completed',
    });
    await MedicalRecord.create({
      patientId: patient.patient._id,
      doctorId: doctor.doctor._id,
      appointmentId: completed._id,
      facilityId: facility._id,
      symptoms: ['Cough'],
      diagnosis: 'Bronchitis',
    });
    await LaboratoryTest.create({
      appointmentId: completed._id,
      facilityId: facility._id,
      patientId: patient.patient._id,
      requestedBy: doctor.doctor._id,
      testName: 'Chest X-ray',
      status: 'Completed',
    });
    await PatientDocument.create({
      facilityId: facility._id,
      patientId: patient.patient._id,
      category: 'medical_report',
      title: 'Discharge summary',
      fileName: 'discharge.pdf',
      fileUrl: 'https://example.test/discharge.pdf',
      uploadedBy: doctor.user._id,
    });

    const res = await asDoctor(
      request(app).get(`/api/appointments/${appointment._id}/patient-summary`)
    );

    expect(res.status).toBe(200);
    expect(res.body.data.patient.userId.fullName).toBe('Aline Patient');
    expect(res.body.data.medicalHistory[0].diagnosis).toBe('Bronchitis');
    expect(res.body.data.labResults[0].testName).toBe('Chest X-ray');
    expect(res.body.data.documents[0].title).toBe('Discharge summary');
    expect(String(res.body.data.previousVisits[0]._id)).toBe(String(completed._id));
  });

  it('blocks another doctor from reading the appointment patient summary', async () => {
    const res = await asDoctor(
      request(app).get(`/api/appointments/${appointment._id}/patient-summary`),
      otherDoctor.user
    );
    expect(res.status).toBe(403);
  });
});
