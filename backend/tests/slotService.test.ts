import {
  connectTestDB,
  clearTestDB,
  closeTestDB,
} from './helpers';
import { generateSlots } from '../src/services/slotService';
import { createFacility, createDoctorWithSchedule, monday } from './factories';
import { DoctorLeave, Appointment } from '../src/models';
import { createPatient } from './factories';

describe('Slot generation', () => {
  let facility: Awaited<ReturnType<typeof createFacility>>;

  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    facility = await createFacility();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  it('derives slots from the schedule stepping by slotDurationMinutes', async () => {
    const deptId = '000000000000000000000001';
    const { doctor } = await createDoctorWithSchedule(String(facility._id), deptId, {
      startTime: '09:00',
      endTime: '11:00',
      slotDurationMinutes: 30,
    });

    const slots = await generateSlots({ doctorId: String(doctor._id), date: monday(new Date()) });

    expect(slots.map((s) => s.time)).toEqual(['09:00', '09:30', '10:00', '10:30']);
    expect(slots.every((s) => s.available === 1)).toBe(true);
  });

  it('blocks break periods', async () => {
    const deptId = '000000000000000000000001';
    const { doctor } = await createDoctorWithSchedule(String(facility._id), deptId, {
      startTime: '09:00',
      endTime: '12:00',
      breakStart: '10:00',
      breakEnd: '11:00',
      slotDurationMinutes: 60,
    });

    const slots = await generateSlots({ doctorId: String(doctor._id), date: monday(new Date()) });
    expect(slots.map((s) => s.time)).toEqual(['09:00', '11:00']);
  });

  it('returns no slots on a day the doctor is on leave', async () => {
    const deptId = '000000000000000000000001';
    const { doctor } = await createDoctorWithSchedule(String(facility._id), deptId);
    const target = monday(new Date());

    await DoctorLeave.create({ doctorId: doctor._id, date: target, reason: 'Sick leave' });

    const slots = await generateSlots({ doctorId: String(doctor._id), date: target });
    expect(slots).toEqual([]);
  });

  it('returns no slots when no schedule exists for the day', async () => {
    const deptId = '000000000000000000000001';
    const { doctor } = await createDoctorWithSchedule(String(facility._id), deptId);
    const sunday = new Date(monday(new Date()));
    sunday.setDate(sunday.getDate() + 6); // Sunday

    const slots = await generateSlots({ doctorId: String(doctor._id), date: sunday });
    expect(slots).toEqual([]);
  });

  it('marks booked slots with available = 0 (capacity exhausted)', async () => {
    const deptId = '000000000000000000000001';
    const { doctor } = await createDoctorWithSchedule(String(facility._id), deptId, {
      startTime: '09:00',
      endTime: '10:00',
      slotDurationMinutes: 60,
      maxPatientsPerSlot: 1,
    });
    const target = monday(new Date());
    const { patient } = await createPatient();

    await Appointment.create({
      facilityId: facility._id,
      patientId: patient._id,
      doctorId: doctor._id,
      departmentId: deptId,
      appointmentDate: target,
      timeSlot: '09:00',
      status: 'Confirmed',
    });

    const slots = await generateSlots({ doctorId: String(doctor._id), date: target });
    expect(slots.find((s) => s.time === '09:00')?.available).toBe(0);
  });

  it('does not count cancelled appointments against availability', async () => {
    const deptId = '000000000000000000000001';
    const { doctor } = await createDoctorWithSchedule(String(facility._id), deptId, {
      startTime: '09:00',
      endTime: '10:00',
      slotDurationMinutes: 60,
      maxPatientsPerSlot: 1,
    });
    const target = monday(new Date());
    const { patient } = await createPatient();

    await Appointment.create({
      facilityId: facility._id,
      patientId: patient._id,
      doctorId: doctor._id,
      departmentId: deptId,
      appointmentDate: target,
      timeSlot: '09:00',
      status: 'Cancelled',
    });

    const slots = await generateSlots({ doctorId: String(doctor._id), date: target });
    expect(slots.find((s) => s.time === '09:00')?.available).toBe(1);
  });
});
