import { Facility, User, Doctor, DoctorSchedule, Patient } from '../src/models';
import { hashPassword } from '../src/utils/password';

export async function createFacility(overrides: Record<string, unknown> = {}) {
  return Facility.create({
    name: 'Test Hospital',
    type: 'hospital',
    region: 'Test Region',
    district: 'Test District',
    isActive: true,
    ...overrides,
  });
}

export async function createUser(
  overrides: Record<string, unknown> = {},
  password = 'Password@123'
) {
  return User.create({
    fullName: 'Test User',
    email: `user${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.local`,
    passwordHash: await hashPassword(password),
    role: 'patient',
    status: 'active',
    preferredLanguage: 'en',
    ...overrides,
  });
}

export async function createDoctorWithSchedule(
  facilityId: string,
  deptId: string,
  scheduleOverrides: Record<string, unknown> = {}
) {
  const user = await createUser({ role: 'doctor', facilityId });
  const doctor = await Doctor.create({
    userId: user._id,
    facilityId,
    departmentId: [deptId],
    specialization: ['General Medicine'],
    consultationFee: { newVisit: 5000, followUp: 3000 },
  });
  const schedule = await DoctorSchedule.create({
    doctorId: doctor._id,
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '12:00',
    breakStart: '',
    breakEnd: '',
    slotDurationMinutes: 15,
    maxPatientsPerSlot: 1,
    isActive: true,
    ...scheduleOverrides,
  });
  return { user, doctor, schedule };
}

export async function createPatient(userOverrides: Record<string, unknown> = {}, patientOverrides: Record<string, unknown> = {}) {
  const user = await createUser({ role: 'patient', ...userOverrides });
  const count = await Patient.countDocuments();
  const patient = await Patient.create({
    userId: user._id,
    patientNumber: `PT-${String(count + 1).padStart(5, '0')}`,
    allergies: [],
    chronicConditions: [],
    ...patientOverrides,
  });
  return { user, patient };
}

export async function signin(app: import('express').Application, email: string, password: string) {
  const res = await (await import('supertest')).default(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.data.tokens.accessToken as string;
}

export function monday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
