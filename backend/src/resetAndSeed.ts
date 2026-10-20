/**
 * resetAndSeed.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Wipes EVERY collection (data + sessions/tokens), then seeds 10+ realistic
 * records across all key tables.
 *
 * Run with:
 *   npx tsx src/resetAndSeed.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
import { config } from './config/env';
import {
  Facility,
  User,
  Department,
  Doctor,
  DoctorSchedule,
  Patient,
  Appointment,
  RefreshToken,
  AuditLog,
  MedicalRecord,
  Prescription,
  LaboratoryTest,
  Role,
  Counter,
  VerificationCode,
  Payment,
  InsuranceProvider,
  InsuranceClaim,
  nextSeq,
} from './models';
import { DoctorLeave } from './models/DoctorLeave';
import { hashPassword } from './utils/password';

// ─── helpers ──────────────────────────────────────────────────────────────────

function pad(n: number, len = 5) {
  return String(n).padStart(len, '0');
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ─── 1. WIPE ──────────────────────────────────────────────────────────────────

async function wipeAll() {
  const collections = [
    Facility, User, Department, Doctor, DoctorSchedule, DoctorLeave,
    Patient, Appointment, RefreshToken, AuditLog, MedicalRecord,
    Prescription, LaboratoryTest, Role, Counter, VerificationCode,
    Payment, InsuranceProvider, InsuranceClaim,
  ];
  for (const model of collections) {
    const result = await (model as unknown as mongoose.Model<mongoose.Document>).deleteMany({});
    console.log(`  ✓ Cleared ${(model as unknown as mongoose.Model<mongoose.Document>).modelName}  (${result.deletedCount} docs)`);
  }
  console.log('\n[reset] All collections cleared.\n');
}

// ─── 2. SEED ──────────────────────────────────────────────────────────────────

async function seed() {

  // ── Passwords (same for all demo accounts) ──────────────────────────────────
  const pwAdmin    = await hashPassword('Admin@12345');
  const pwDoctor   = await hashPassword('Doctor@12345');
  const pwRecepti  = await hashPassword('Reception@12345');
  const pwNurse    = await hashPassword('Nurse@12345');
  const pwPatient  = await hashPassword('Patient@12345');

  // ════════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN
  // ════════════════════════════════════════════════════════════════════════════
  const superAdmin = await User.create({
    fullName: 'System Super Administrator',
    email: config.seedSuperAdmin.email,          // admin@has.local
    passwordHash: await hashPassword(config.seedSuperAdmin.password),
    role: 'super_admin',
    facilityId: null,
    preferredLanguage: 'en',
  });
  console.log(`[seed] Super admin:  ${superAdmin.email}  /  ${config.seedSuperAdmin.password}`);

  // ════════════════════════════════════════════════════════════════════════════
  // FACILITIES  (3 hospitals + 2 clinics + 1 health centre)
  // ════════════════════════════════════════════════════════════════════════════
  const facilitiesData = [
    { name: 'Kigali Central Hospital',     type: 'hospital',       region: 'Kigali',     district: 'Nyarugenge',  address: '1 KN 5 Rd',       phone: '+250 788 000 001', email: 'kch@has.demo' },
    { name: 'Remera District Hospital',    type: 'hospital',       region: 'Kigali',     district: 'Gasabo',      address: '10 KG 9 Ave',     phone: '+250 788 000 002', email: 'rdh@has.demo' },
    { name: 'Butare Teaching Hospital',    type: 'hospital',       region: 'Southern',   district: 'Huye',        address: '2 NR 1 Rd',       phone: '+250 788 000 003', email: 'bth@has.demo' },
    { name: 'Gikondo Health Clinic',       type: 'clinic',         region: 'Kigali',     district: 'Kicukiro',    address: '5 KK 15 Ave',     phone: '+250 788 000 004', email: 'ghc@has.demo' },
    { name: 'Nyamirambo Clinic',           type: 'clinic',         region: 'Kigali',     district: 'Nyarugenge',  address: '3 KN 22 St',      phone: '+250 788 000 005', email: 'nyc@has.demo' },
    { name: 'Muhima Health Center',        type: 'health_center',  region: 'Kigali',     district: 'Nyarugenge',  address: '8 KN 3 Rd',       phone: '+250 788 000 006', email: 'mhc@has.demo' },
  ] as const;

  const facilities = await Promise.all(facilitiesData.map((f) =>
    Facility.create({
      name: f.name, type: f.type, region: f.region, district: f.district,
      address: f.address,
      contactInfo: { phone: f.phone, email: f.email },
      operatingHours: 'Mon–Fri 07:30–17:00',
      isActive: true,
    })
  ));
  console.log(`[seed] ${facilities.length} facilities created`);

  // Primary facility for most staff
  const mainFacility = facilities[0];   // Kigali Central Hospital
  const facility2    = facilities[1];   // Remera District Hospital

  // ════════════════════════════════════════════════════════════════════════════
  // FACILITY ADMINS  (one per main facility)
  // ════════════════════════════════════════════════════════════════════════════
  const facilityAdminUsers = await Promise.all([
    User.create({ fullName: 'Alice Uwase',   email: 'fadmin1@has.demo', passwordHash: pwAdmin,   role: 'facility_admin', facilityId: mainFacility._id, preferredLanguage: 'en' }),
    User.create({ fullName: 'Bob Habimana',  email: 'fadmin2@has.demo', passwordHash: pwAdmin,   role: 'facility_admin', facilityId: facility2._id,    preferredLanguage: 'en' }),
  ]);
  console.log(`[seed] ${facilityAdminUsers.length} facility admins created`);

  // ════════════════════════════════════════════════════════════════════════════
  // DEPARTMENTS  (5 per main facility)
  // ════════════════════════════════════════════════════════════════════════════
  const deptData = [
    { name: 'General Medicine',  fee: 5000,  desc: 'General out-patient consultations' },
    { name: 'Paediatrics',       fee: 4500,  desc: 'Children health services' },
    { name: 'Cardiology',        fee: 8000,  desc: 'Heart & cardiovascular conditions' },
    { name: 'Orthopaedics',      fee: 7000,  desc: 'Bone, joint & muscle care' },
    { name: 'Gynaecology',       fee: 6000,  desc: "Women's reproductive health" },
    { name: 'Dermatology',       fee: 5500,  desc: 'Skin conditions & treatments' },
    { name: 'Neurology',         fee: 9000,  desc: 'Brain & nervous system disorders' },
    { name: 'Ophthalmology',     fee: 6500,  desc: 'Eye care & vision services' },
    { name: 'ENT',               fee: 5000,  desc: 'Ear, nose & throat services' },
    { name: 'Emergency',         fee: 10000, desc: '24/7 emergency & trauma care' },
  ];

  const departments = await Promise.all(deptData.map((d) =>
    Department.create({
      facilityId: mainFacility._id,
      name: d.name,
      description: d.desc,
      defaultConsultationFee: d.fee,
    })
  ));
  console.log(`[seed] ${departments.length} departments created`);

  // ════════════════════════════════════════════════════════════════════════════
  // DOCTORS  (5 doctors)
  // ════════════════════════════════════════════════════════════════════════════
  const doctorData = [
    { fullName: 'Dr. Jean Niyonzima',    email: 'doctor1@has.demo', phone: '+250 788 100 001', spec: ['General Medicine'],  dept: [departments[0]._id], lic: 'LIC-001', exp: 10 },
    { fullName: 'Dr. Claire Mukamana',   email: 'doctor2@has.demo', phone: '+250 788 100 002', spec: ['Paediatrics'],       dept: [departments[1]._id], lic: 'LIC-002', exp: 7  },
    { fullName: 'Dr. Eric Tuyishime',    email: 'doctor3@has.demo', phone: '+250 788 100 003', spec: ['Cardiology'],        dept: [departments[2]._id], lic: 'LIC-003', exp: 14 },
    { fullName: 'Dr. Sandrine Uwimana', email: 'doctor4@has.demo', phone: '+250 788 100 004', spec: ['Orthopaedics'],      dept: [departments[3]._id], lic: 'LIC-004', exp: 9  },
    { fullName: 'Dr. Patrick Gasana',   email: 'doctor5@has.demo', phone: '+250 788 100 005', spec: ['Gynaecology'],       dept: [departments[4]._id], lic: 'LIC-005', exp: 12 },
  ];

  const doctorProfiles = [];
  for (let i = 0; i < doctorData.length; i++) {
    const d = doctorData[i];
    const userDoc = await User.create({
      fullName: d.fullName, email: d.email, phone: d.phone,
      passwordHash: pwDoctor, role: 'doctor',
      facilityId: mainFacility._id, preferredLanguage: 'en',
    });
    const profile = await Doctor.create({
      userId: userDoc._id, facilityId: mainFacility._id,
      departmentId: d.dept, licenseNumber: d.lic,
      specialization: d.spec, qualification: ['MBChB', 'MD'],
      experienceYears: d.exp,
      consultationFee: { newVisit: 5000 + i * 1000, followUp: 3000 + i * 500 },
      bio: `${d.fullName} — ${d.spec.join(', ')} specialist at Kigali Central Hospital.`,
    });
    // Weekly schedule Mon–Fri
    for (let day = 1; day <= 5; day++) {
      await DoctorSchedule.create({
        doctorId: profile._id, dayOfWeek: day,
        startTime: '08:00', endTime: '16:00',
        breakStart: '12:00', breakEnd: '13:00',
        slotDurationMinutes: 15, maxPatientsPerSlot: 1, isActive: true,
      });
    }
    doctorProfiles.push(profile);
  }
  console.log(`[seed] ${doctorProfiles.length} doctors + schedules created`);

  // ════════════════════════════════════════════════════════════════════════════
  // RECEPTIONISTS  (3)
  // ════════════════════════════════════════════════════════════════════════════
  const receptionistUsers = await Promise.all([
    User.create({ fullName: 'Grace Ingabire',  email: 'recep1@has.demo', phone: '+250 788 200 001', passwordHash: pwRecepti, role: 'receptionist', facilityId: mainFacility._id, preferredLanguage: 'en' }),
    User.create({ fullName: 'David Nkurunziza',email: 'recep2@has.demo', phone: '+250 788 200 002', passwordHash: pwRecepti, role: 'receptionist', facilityId: mainFacility._id, preferredLanguage: 'rw' }),
    User.create({ fullName: 'Marie Uwineza',   email: 'recep3@has.demo', phone: '+250 788 200 003', passwordHash: pwRecepti, role: 'receptionist', facilityId: facility2._id,    preferredLanguage: 'fr' }),
  ]);
  console.log(`[seed] ${receptionistUsers.length} receptionists created`);

  // ════════════════════════════════════════════════════════════════════════════
  // NURSES  (2)
  // ════════════════════════════════════════════════════════════════════════════
  await Promise.all([
    User.create({ fullName: 'Josiane Mukandori', email: 'nurse1@has.demo', phone: '+250 788 300 001', passwordHash: pwNurse, role: 'nurse', facilityId: mainFacility._id, preferredLanguage: 'en' }),
    User.create({ fullName: 'Théogène Nzabonimpa', email: 'nurse2@has.demo', phone: '+250 788 300 002', passwordHash: pwNurse, role: 'nurse', facilityId: mainFacility._id, preferredLanguage: 'rw' }),
  ]);

  // ════════════════════════════════════════════════════════════════════════════
  // PATIENTS  (10)
  // ════════════════════════════════════════════════════════════════════════════
  const patientData = [
    { fullName: 'Amina Uwera',        email: 'patient1@has.demo', phone: '+250 788 400 001', natId: 'NID-0001', dob: '1992-03-15', gender: 'female', blood: 'A+',  allergies: ['Penicillin'],    chronic: ['Hypertension'] },
    { fullName: 'Claude Bizimungu',   email: 'patient2@has.demo', phone: '+250 788 400 002', natId: 'NID-0002', dob: '1985-07-20', gender: 'male',   blood: 'O+',  allergies: [],                 chronic: ['Diabetes Type 2'] },
    { fullName: 'Diane Umutesi',      email: 'patient3@has.demo', phone: '+250 788 400 003', natId: 'NID-0003', dob: '2000-11-05', gender: 'female', blood: 'B+',  allergies: ['Sulfa'],          chronic: [] },
    { fullName: 'Evariste Nkusi',     email: 'patient4@has.demo', phone: '+250 788 400 004', natId: 'NID-0004', dob: '1978-04-12', gender: 'male',   blood: 'AB-', allergies: ['Aspirin'],        chronic: ['Asthma'] },
    { fullName: 'Faida Mukamurenzi',  email: 'patient5@has.demo', phone: '+250 788 400 005', natId: 'NID-0005', dob: '1995-09-30', gender: 'female', blood: 'O-',  allergies: [],                 chronic: [] },
    { fullName: 'Gervais Habimana',   email: 'patient6@has.demo', phone: '+250 788 400 006', natId: 'NID-0006', dob: '1968-01-22', gender: 'male',   blood: 'A-',  allergies: ['Latex'],          chronic: ['Hypertension', 'Diabetes Type 2'] },
    { fullName: 'Honorine Uwimana',   email: 'patient7@has.demo', phone: '+250 788 400 007', natId: 'NID-0007', dob: '2003-06-14', gender: 'female', blood: 'B-',  allergies: [],                 chronic: [] },
    { fullName: 'Ignace Rukeribuga',  email: 'patient8@has.demo', phone: '+250 788 400 008', natId: 'NID-0008', dob: '1990-12-01', gender: 'male',   blood: 'O+',  allergies: ['Codeine'],        chronic: ['Epilepsy'] },
    { fullName: 'Joselyne Nyirabeza', email: 'patient9@has.demo', phone: '+250 788 400 009', natId: 'NID-0009', dob: '1988-08-17', gender: 'female', blood: 'A+',  allergies: [],                 chronic: [] },
    { fullName: 'Kevin Munyaneza',    email: 'patient10@has.demo',phone: '+250 788 400 010', natId: 'NID-0010', dob: '1975-05-25', gender: 'male',   blood: 'AB+', allergies: ['Ibuprofen'],      chronic: ['Chronic Kidney Disease'] },
  ];

  const patientRecords = [];
  for (let i = 0; i < patientData.length; i++) {
    const p = patientData[i];
    const userDoc = await User.create({
      fullName: p.fullName, email: p.email, phone: p.phone,
      nationalId: p.natId,
      passwordHash: pwPatient, role: 'patient', preferredLanguage: 'en',
    });
    const patient = await Patient.create({
      userId: userDoc._id,
      patientNumber: `PT-${pad(i + 1)}`,
      dob: new Date(p.dob),
      gender: p.gender,
      bloodGroup: p.blood,
      allergies: p.allergies,
      chronicConditions: p.chronic,
      emergencyContact: { name: `Emergency Contact ${i + 1}`, phone: `+250 788 500 ${pad(i + 1, 3)}`, relation: 'Family' },
    });
    patientRecords.push(patient);
  }
  console.log(`[seed] ${patientRecords.length} patients created`);

  // ════════════════════════════════════════════════════════════════════════════
  // APPOINTMENTS  (10 — mix of past & upcoming, various statuses)
  // ════════════════════════════════════════════════════════════════════════════
  const apptData = [
    { pi: 0, di: 0, depti: 0, daysOffset: -7,  slot: '09:00', status: 'Completed',  visitType: 'new',   reason: 'Routine check-up' },
    { pi: 1, di: 1, depti: 1, daysOffset: -5,  slot: '10:00', status: 'Completed',  visitType: 'new',   reason: 'Child vaccination review' },
    { pi: 2, di: 2, depti: 2, daysOffset: -3,  slot: '11:00', status: 'Completed',  visitType: 'new',   reason: 'Chest pain evaluation' },
    { pi: 3, di: 3, depti: 3, daysOffset: -2,  slot: '14:00', status: 'Cancelled',  visitType: 'follow-up',   reason: 'Knee pain follow-up' },
    { pi: 4, di: 4, depti: 4, daysOffset: -1,  slot: '09:30', status: 'Completed',  visitType: 'new',   reason: 'Gynaecological consultation' },
    { pi: 5, di: 0, depti: 0, daysOffset:  1,  slot: '08:00', status: 'Confirmed',  visitType: 'follow-up',   reason: 'Blood pressure review' },
    { pi: 6, di: 1, depti: 1, daysOffset:  2,  slot: '10:30', status: 'Pending',    visitType: 'new',   reason: 'Fever and cough' },
    { pi: 7, di: 2, depti: 2, daysOffset:  3,  slot: '11:30', status: 'Confirmed',  visitType: 'follow-up',   reason: 'ECG results review' },
    { pi: 8, di: 3, depti: 3, daysOffset:  5,  slot: '13:00', status: 'Pending',    visitType: 'new',   reason: 'Hip pain assessment' },
    { pi: 9, di: 4, depti: 4, daysOffset:  7,  slot: '15:00', status: 'Pending',    visitType: 'new',   reason: 'Prenatal care' },
  ];

  const appointments = [];
  for (let i = 0; i < apptData.length; i++) {
    const a = apptData[i];
    const apptDate = a.daysOffset < 0 ? daysAgo(-a.daysOffset) : daysFromNow(a.daysOffset);
    apptDate.setHours(0, 0, 0, 0);
    const appt = await Appointment.create({
      facilityId:      mainFacility._id,
      patientId:       patientRecords[a.pi]._id,
      doctorId:        doctorProfiles[a.di]._id,
      departmentId:    departments[a.depti]._id,
      appointmentDate: apptDate,
      timeSlot:        a.slot,
      reason:          a.reason,
      visitType:       a.visitType,
      status:          a.status,
      bookingChannel:  'web',
      queueNumber:     i + 1,
      ...(a.status === 'Completed' ? { completedAt: apptDate } : {}),
    });
    appointments.push(appt);
  }
  console.log(`[seed] ${appointments.length} appointments created`);

  // ════════════════════════════════════════════════════════════════════════════
  // MEDICAL RECORDS  (for the 3 Completed appointments)
  // ════════════════════════════════════════════════════════════════════════════
  const completedAppts = appointments.filter((_, i) => apptData[i].status === 'Completed');

  const diagnosisData = [
    { symptoms: ['Fatigue', 'Headache'], diagnosis: 'Essential Hypertension', treatment: 'Lifestyle changes, Amlodipine 5mg OD', notes: 'BP: 150/95 mmHg. Recheck in 4 weeks.' },
    { symptoms: ['Fever', 'Rash'],       diagnosis: 'Viral Exanthem',         treatment: 'Paracetamol, rest, hydration',           notes: 'Mild fever 38.1°C. No antibiotics needed.' },
    { symptoms: ['Chest pain', 'SOB'],   diagnosis: 'Stable Angina',          treatment: 'GTN spray PRN, Aspirin 75mg OD',        notes: 'ECG normal. Treadmill test scheduled.' },
    { symptoms: ['Knee pain', 'Swelling'], diagnosis: 'Osteoarthritis',       treatment: 'Physiotherapy, Ibuprofen 400mg TDS',    notes: 'X-ray: mild joint space narrowing.' },
    { symptoms: ['Abdominal pain'],       diagnosis: 'Dysmenorrhoea',         treatment: 'Mefenamic acid 500mg TDS for 3 days',   notes: 'No structural abnormality found.' },
  ];

  const medRecords = [];
  for (let i = 0; i < completedAppts.length; i++) {
    const appt = completedAppts[i];
    const di = diagnosisData[i % diagnosisData.length];
    const rec = await MedicalRecord.create({
      patientId:     (appt as { patientId: unknown }).patientId,
      doctorId:      (appt as { doctorId: unknown }).doctorId,
      appointmentId: appt._id,
      facilityId:    mainFacility._id,
      vitals: { bloodPressure: '120/80', temperature: 36.8, weight: 70, height: 170, pulse: 72, oxygenSaturation: 98 },
      symptoms:   di.symptoms,
      diagnosis:  di.diagnosis,
      treatment:  di.treatment,
      notes:      di.notes,
      followUpDate: daysFromNow(28),
    });
    medRecords.push(rec);
  }
  console.log(`[seed] ${medRecords.length} medical records created`);

  // ════════════════════════════════════════════════════════════════════════════
  // PRESCRIPTIONS  (for the first 3 medical records)
  // ════════════════════════════════════════════════════════════════════════════
  const rxData = [
    { medicines: [{ name: 'Amlodipine',   dosage: '5mg',   frequency: 'Once daily',       durationDays: 30, instructions: 'Take with food' }] },
    { medicines: [{ name: 'Paracetamol',  dosage: '500mg', frequency: 'Every 6 hours PRN',durationDays:  5, instructions: 'Take with water' }] },
    { medicines: [{ name: 'GTN Spray',    dosage: '400mcg',frequency: 'PRN',              durationDays: 90, instructions: 'Spray under tongue when chest pain occurs' },
                  { name: 'Aspirin',      dosage: '75mg',  frequency: 'Once daily',       durationDays: 90, instructions: 'Take after breakfast' }] },
  ];

  for (let i = 0; i < Math.min(rxData.length, medRecords.length); i++) {
    const appt = completedAppts[i];
    await Prescription.create({
      medicalRecordId: medRecords[i]._id,
      patientId:       (appt as { patientId: unknown }).patientId,
      doctorId:        (appt as { doctorId: unknown }).doctorId,
      facilityId:      mainFacility._id,
      medicines:       rxData[i].medicines,
      instructions:    'Take as directed. Return if symptoms worsen.',
      issuedAt:        new Date(),
    });
  }
  console.log(`[seed] ${Math.min(rxData.length, medRecords.length)} prescriptions created`);

  // ════════════════════════════════════════════════════════════════════════════
  // LAB TESTS  (3)
  // ════════════════════════════════════════════════════════════════════════════
  const labData = [
    { testName: 'Full Blood Count (FBC)',       fee: 5000,  status: 'Completed', result: 'Hb 13.5 g/dL, WBC 7.2×10⁹/L, Plt 250×10⁹/L', ref: 'Hb 12–17 g/dL', abnormal: false },
    { testName: 'Fasting Blood Glucose (FBG)',  fee: 3000,  status: 'Completed', result: '7.2 mmol/L',                                   ref: '3.9–6.1 mmol/L', abnormal: true  },
    { testName: 'Electrocardiogram (ECG)',       fee: 10000, status: 'In Progress',result: undefined,                                     ref: undefined,        abnormal: false },
  ];

  for (let i = 0; i < labData.length && i < completedAppts.length; i++) {
    const appt = completedAppts[i];
    const lab = labData[i];
    await LaboratoryTest.create({
      appointmentId: appt._id,
      medicalRecordId: medRecords[i]?._id ?? null,
      facilityId:     mainFacility._id,
      patientId:      (appt as { patientId: unknown }).patientId,
      requestedBy:    (appt as { doctorId: unknown }).doctorId,
      testName:       lab.testName,
      fee:            lab.fee,
      status:         lab.status,
      result:         lab.result,
      referenceRange: lab.ref,
      isAbnormal:     lab.abnormal,
      requestedAt:    daysAgo(3),
      ...(lab.status === 'Completed' ? { completedAt: daysAgo(1) } : {}),
    });
  }
  console.log(`[seed] ${labData.length} lab tests created`);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 4: BILLING & INSURANCE DEMO DATA
  // ════════════════════════════════════════════════════════════════════════════
  const [rssb, sanasure] = await Promise.all([
    InsuranceProvider.create({
      name: 'RSSB (Rwanda Social Security Board)',
      type: 'government_scheme',
      contactInfo: { phone: '+250 788 700 001', email: 'claims@rssb.rw' },
      claimSubmissionMethod: 'api',
      isActive: true,
    }),
    InsuranceProvider.create({
      name: 'Sanasure Life Assurance',
      type: 'private_insurance',
      contactInfo: { phone: '+250 788 700 002', email: 'claims@sanasure.rw' },
      claimSubmissionMethod: 'manual',
      isActive: true,
    }),
  ]);
  console.log(`[seed] 2 insurance providers created: ${rssb.name}, ${sanasure.name}`);

  // Scheme enrollments: patient 1 on RSSB (indigent → free-care path),
  // patient 2 on RSSB, patient 5 on Sanasure (private insurance)
  await Patient.updateOne({ _id: patientRecords[0]._id }, {
    $set: {
      governmentScheme: { schemeName: 'RSSB CSR', beneficiaryNumber: `CSR-${pad(0)}`, indigentStatus: true },
    },
  });
  await Patient.updateOne({ _id: patientRecords[1]._id }, {
    $set: {
      governmentScheme: { schemeName: 'RSSB CSR', beneficiaryNumber: `CSR-${pad(1)}`, indigentStatus: false },
    },
  });
  await Patient.updateOne({ _id: patientRecords[4]._id }, {
    $set: {
      insurance: { provider: 'Sanasure Life Assurance', policyNumber: 'POL-0005', coverageType: 'Outpatient', validTill: daysFromNow(300) },
    },
  });

  // Payments for completed appointments so billing + verifier screens have data.
  // Appointment [0] belongs to the indigent RSSB patient → free-care path with a claim.
  const billed = [];
  const completedIdx = [0, 1, 2, 4];
  for (const i of completedIdx.slice(0, 3)) {
    const appt = appointments[i];
    const consultationFee = departments[apptData[i].depti].defaultConsultationFee ?? 5000;
    const isGov = i === 0;
    const payment = await Payment.create({
      appointmentId: appt._id,
      patientId:     (appt as { patientId: unknown }).patientId,
      facilityId:    (appt as { facilityId: unknown }).facilityId,
      amount:        isGov ? 0 : consultationFee,
      breakdown: {
        consultationFee,
        labCharges:     0,
        pharmacyCharges: 0,
        discount:       0,
        tax:            0,
        schemeSubsidy:  isGov ? consultationFee : 0,
      },
      method:        isGov ? 'government_scheme' : 'cash',
      status:        'Paid',
      receiptNumber: `RCPT-${String(await nextSeq('receipt')).padStart(6, '0')}`,
      paidAt:        new Date(),
    });
    billed.push(payment);
  }
  console.log(`[seed] ${billed.length} demo payments created`);

  if (billed[0]) {
    await InsuranceClaim.create({
      paymentId:   billed[0]._id,
      providerId:  rssb._id,
      claimAmount: billed[0].amount,
      status:      'Submitted',
      submittedAt: new Date(),
    });
    console.log('[seed] 1 demo government-scheme claim created (RSSB, Submitted)');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUMMARY TABLE
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  SEED COMPLETE — Demo Login Credentials');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Super Admin       ${config.seedSuperAdmin.email.padEnd(28)}  ${config.seedSuperAdmin.password}`);
  console.log(`  Facility Admin 1  fadmin1@has.demo              Admin@12345`);
  console.log(`  Facility Admin 2  fadmin2@has.demo              Admin@12345`);
  console.log(`  Doctor 1          doctor1@has.demo              Doctor@12345`);
  console.log(`  Doctor 2          doctor2@has.demo              Doctor@12345`);
  console.log(`  Doctor 3          doctor3@has.demo              Doctor@12345`);
  console.log(`  Receptionist 1    recep1@has.demo               Reception@12345`);
  console.log(`  Nurse 1           nurse1@has.demo               Nurse@12345`);
  console.log(`  Patient 1         patient1@has.demo             Patient@12345`);
  console.log(`  Patient 2         patient2@has.demo             Patient@12345`);
  console.log('══════════════════════════════════════════════════════════════\n');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n[reset] Connecting to MongoDB: ${config.mongoUri}\n`);
  await mongoose.connect(config.mongoUri);

  console.log('[reset] Wiping all collections...');
  await wipeAll();

  console.log('[seed] Seeding fresh data...\n');
  await seed();

  await mongoose.disconnect();
  console.log('[done] Database reset and seeded successfully.\n');
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
