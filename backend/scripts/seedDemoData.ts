/**
 * Creates the demo database: the platform super admin plus a fresh, self-consistent cohort of
 * hospitals, staff and patients.
 *
 * This is the only demo-data script that should be run. `src/seed.ts` used to be invoked on
 * boot behind `SEED_ON_START`, but it writes its own hospital fixtures, so the two cohorts ended
 * up overlapping in one database and the patient directory listed every one of them. That flag
 * is now off by default and the super admin is created below, so running this script alone
 * produces a single coherent dataset.
 *
 * It is meant to be re-runnable: each run appends a new dated cohort, so pagination, the
 * medical-history timeline and the self-service payment flow can be exercised against more
 * than one page of data.
 *
 * Everything is written through the real models rather than raw inserts, so validators,
 * defaults and indexes all apply and the data looks like production data.
 *
 * Run with: npx tsx scripts/seedDemoData.ts
 * Pass --reset to drop the demo cohort first (leaves unrelated records alone).
 */
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db';
import { config } from '../src/config/env';
import { hashPassword } from '../src/utils/password';
import { syncRoleCatalog } from '../src/services/roleCatalog';
import { generateReceiptNumber } from '../src/services/billingService';
import {
  Appointment,
  AuditLog,
  Department,
  Doctor,
  DoctorLeave,
  DoctorSchedule,
  Facility,
  InsuranceClaim,
  InsuranceProvider,
  LaboratoryTest,
  MedicalRecord,
  Message,
  Notification,
  Patient,
  PatientDocument,
  PatientFacility,
  Payment,
  PharmacyDispense,
  PharmacyInventory,
  Prescription,
  User,
  nextSeq,
} from '../src/models';
import { grantMembership } from '../src/services/patientFacilityService';

const PASSWORD = 'Password@123';
/** Marker used to find this script's own records, so --reset only removes its own cohort. */
const DEMO_TAG = 'seed-demo';
const COHORT_SIZE = 6;

/** A stable-per-run suffix so re-running never collides on unique fields. */
const RUN = Date.now().toString(36).slice(-5);

const daysFromNow = (offset: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const FACILITY_TYPES = ['hospital', 'clinic', 'health_center'] as const;
const REGIONS = ['Kigali', 'Northern', 'Southern', 'Eastern', 'Western'];
const DEPARTMENTS = [
  'General Medicine',
  'Paediatrics',
  'Orthopaedics',
  'Cardiology',
  'Dermatology',
  'Obstetrics',
];
const CONSULT_SLOTS = ['08:00', '09:00', '10:30', '12:00', '14:00', '16:00'];
const CONSULT_TYPES = ['new', 'follow-up', 'referral'] as const;
const BOOKING_CHANNELS = ['web', 'mobile', 'sms', 'ussd', 'walk_in', 'referral'] as const;
/** Statuses an appointment can sit in while it is still ahead of the patient. */
const UPCOMING_STATUSES = ['Pending', 'Confirmed'] as const;
const SELF_PAY_METHODS = ['cash', 'card', 'online'] as const;
const BLOOD_GROUPS = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-'];
const GENDERS = ['male', 'female', 'other'] as const;
const DRUGS = [
  { name: 'Amoxicillin', unit: '500mg capsule', price: 500 },
  { name: 'Paracetamol', unit: '500mg tablet', price: 200 },
  { name: 'Ibuprofen', unit: '200mg tablet', price: 350 },
  { name: 'Ciprofloxacin', unit: '500mg tablet', price: 900 },
  { name: 'ORS Sachet', unit: 'sachet', price: 400 },
  { name: 'Metronidazole', unit: '400mg tablet', price: 450 },
];
const TESTS = [
  { name: 'Malaria RDT', fee: 5000, range: 'Negative' },
  { name: 'Full Blood Count', fee: 18000, range: 'Normal' },
  { name: 'HIV Rapid Test', fee: 10000, range: 'Negative' },
  { name: 'Liver Function Test', fee: 25000, range: 'Normal' },
  { name: 'Urine Analysis', fee: 8000, range: 'Normal' },
  { name: 'Stool Microscopy', fee: 7000, range: 'Normal' },
];
const DIAGNOSES = [
  'Malaria',
  'Upper respiratory tract infection',
  'Acute gastroenteritis',
  'Hypertension',
  'Type 2 diabetes mellitus',
  'Urinary tract infection',
];
const MEDICINE_LINES = [
  { name: 'Amoxicillin', dosage: '500mg', frequency: 'TDS', durationDays: 5 },
  { name: 'Paracetamol', dosage: '1g', frequency: 'TDS', durationDays: 3 },
  { name: 'ORS', dosage: '1 sachet', frequency: 'BD', durationDays: 2 },
  { name: 'Ibuprofen', dosage: '400mg', frequency: 'BD', durationDays: 4 },
];
const DOC_TYPES = ['medical_report', 'lab_result', 'billing_receipt', 'prescription', 'general'] as const;

const pick = <T,>(arr: readonly T[], i: number): T => arr[i % arr.length];

async function resetDemoCohort(): Promise<void> {
  const escapedTag = DEMO_TAG.replace(/[-]/g, '\\-');
  const patients = await Patient.find({
    patientNumber: new RegExp(`^${escapedTag}`),
  })
    .select('_id')
    .lean();
  const patientIds = patients.map((p) => p._id);

  // Clinic-side rows are reachable from the demo facilities, so the facilities are resolved
  // first and everything below is deleted by id. Matching on marker fields that this script no
  // longer writes would silently leave orphans behind.
  const facilityIds = (
    await Facility.find({ name: new RegExp(`^${escapedTag}`) }).select('_id').lean()
  ).map((f) => f._id);
  const doctorIds = (await Doctor.find({ facilityId: { $in: facilityIds } }).select('_id').lean()).map(
    (d) => d._id,
  );
  const providerIds = (
    await InsuranceProvider.find({ name: new RegExp(`^${escapedTag}`) }).select('_id').lean()
  ).map((p) => p._id);
  const userIds = (
    await User.find({ email: /^demo\.(reception|doctor|patient)\./ }).select('_id').lean()
  ).map((u) => u._id);

  // Every id the cohort owns has to be collected before anything is deleted. Resolving
  // prescriptions after `Prescription.deleteMany` returns an empty list and orphans the
  // dispenses that point at them.
  const prescriptionIds = (
    await Prescription.find({ patientId: { $in: patientIds } }).select('_id').lean()
  ).map((p) => p._id);

  await Promise.all([
    Payment.deleteMany({ patientId: { $in: patientIds } }),
    Message.deleteMany({ patientId: { $in: patientIds } }),
    Notification.deleteMany({ patientId: { $in: patientIds } }),
    PatientDocument.deleteMany({ patientId: { $in: patientIds } }),
    LaboratoryTest.deleteMany({ patientId: { $in: patientIds } }),
    // Matched by tag as well as by prescription: rows from an older revision of this script
    // pointed `prescriptionId` at a medical record, so those prescriptions no longer exist and
    // an id-only match would strand the dispenses.
    PharmacyDispense.deleteMany({
      $or: [{ prescriptionId: { $in: prescriptionIds } }, { notes: DEMO_TAG }],
    }),
    InsuranceClaim.deleteMany({ providerId: { $in: providerIds } }),
    MedicalRecord.deleteMany({ patientId: { $in: patientIds } }),
    Appointment.deleteMany({ patientId: { $in: patientIds } }),
    // Audit rows are keyed on the actor and the tenant they were filed under, because the
    // per-facility entries are ordinary `CREATE_USER` rows, not cohort-tagged ones.
    AuditLog.deleteMany({
      $or: [{ entity: 'DemoCohort' }, { userId: { $in: userIds } }, { facilityId: { $in: facilityIds } }],
    }),
  ]);

  await Promise.all([
    Prescription.deleteMany({ patientId: { $in: patientIds } }),
    DoctorSchedule.deleteMany({ doctorId: { $in: doctorIds } }),
    DoctorLeave.deleteMany({ doctorId: { $in: doctorIds } }),
    Doctor.deleteMany({ _id: { $in: doctorIds } }),
    PharmacyInventory.deleteMany({ facilityId: { $in: facilityIds } }),
    InsuranceProvider.deleteMany({ _id: { $in: providerIds } }),
    Department.deleteMany({ facilityId: { $in: facilityIds } }),
    Patient.deleteMany({ _id: { $in: patientIds } }),
    // Memberships reference patients that are about to be deleted, and there is no facility
    // id on them to match on, so they are keyed purely off the patient being removed.
    PatientFacility.deleteMany({ patientId: { $in: patientIds } }),
    // Demo accounts are matched by their email prefix so a re-run cannot collide on the
    // unique email index, and go only after the patients that referenced them.
    User.deleteMany({ email: /^demo\.(reception|doctor|patient)\./ }),
    Facility.deleteMany({ _id: { $in: facilityIds } }),
  ]);
}

/**
 * Creates the platform super admin if it is missing.
 *
 * This used to be the job of `src/seed.ts`, which is no longer run on boot, so the account that
 * signs in to register hospitals has to be created here instead. It is keyed on the configured
 * email rather than the demo tag, so it is deliberately outside `--reset`: the super admin is
 * not cohort data and dropping it would lock you out of the very screen that seeds it.
 */
async function ensureSuperAdmin(): Promise<void> {
  const { email, password } = config.seedSuperAdmin;
  const existing = await User.exists({ email });
  if (existing) {
    console.log(`super admin already present: ${email}`);
    return;
  }
  await User.create({
    fullName: 'System Super Administrator',
    email,
    passwordHash: await hashPassword(password),
    role: 'super_admin',
    facilityId: null,
    preferredLanguage: 'en',
  });
  console.log(`super admin created: ${email}`);
}

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  await connectDB();
  console.log('connected');

  if (reset) {
    console.log('removing previous demo cohort...');
    await resetDemoCohort();
  }

  // Before the cohort, because the super admin is what the registry page is signed in with.
  await ensureSuperAdmin();

  const passwordHash = await hashPassword(PASSWORD);
  const created: Record<string, number> = {};

  const bump = (key: string, n = 1) => {
    created[key] = (created[key] ?? 0) + n;
  };

  // Facilities: two hospitals and one clinic, so tenant scoping has something to separate.
  const facilities = [];
  for (let i = 0; i < COHORT_SIZE; i += 1) {
    facilities.push(
      await Facility.create({
        name: `${DEMO_TAG} ${['Hospital', 'Clinic', 'Medical Centre'][i % 3]} ${i + 1}`,
        type: pick(FACILITY_TYPES, i),
        region: pick(REGIONS, i),
        district: `${pick(REGIONS, i)} District ${i + 1}`,
        address: `${DEMO_TAG}-${RUN}`,
        contactInfo: { phone: `+25078800000${i}`, email: `facility${i}@demo.local` },
        operatingHours: '08:00 - 18:00',
        isActive: true,
        subscriptionStatus: 'active',
        subscriptionExpiresAt: daysFromNow(180),
      }),
    );
    bump('facilities');
  }

  // Departments: one per facility, so every facility is bookable.
  const departments = [];
  for (let i = 0; i < COHORT_SIZE; i += 1) {
    const facility = facilities[i];
    departments.push(
      await Department.create({
        facilityId: facility._id,
        name: pick(DEPARTMENTS, i),
        description: DEMO_TAG,
        defaultConsultationFee: 15000 + i * 2500,
        contactInfo: { phone: `+25078900000${i}` },
      }),
    );
    bump('departments');
  }

  // Receptionists: the staff who confirm portal payment requests, so one per facility.
  const receptionists = [];
  for (let i = 0; i < COHORT_SIZE; i += 1) {
    const facility = facilities[i];
    receptionists.push(
      await User.create({
        fullName: `${DEMO_TAG} Reception ${i + 1}`,
        email: `demo.reception.${RUN}.${i}@demo.local`,
        passwordHash,
        role: 'receptionist',
        status: 'active',
        preferredLanguage: 'en',
        facilityId: facility._id,
      }),
    );
    bump('users');
  }

  // Doctors: each attached to a facility and department, with a consultation fee.
  const doctors = [];
  for (let i = 0; i < COHORT_SIZE; i += 1) {
    const facility = facilities[i];
    const department = departments[i];
    const user = await User.create({
      fullName: `Dr. Demo ${['Aline', 'Bosco', 'Claude', 'Diane', 'Eric', 'Fatou'][i % 6]} ${i + 1}`,
      email: `demo.doctor.${RUN}.${i}@demo.local`,
      passwordHash,
      role: 'doctor',
      status: 'active',
      preferredLanguage: 'en',
      facilityId: facility._id,
    });
    bump('users');

    const doctor = await Doctor.create({
      userId: user._id,
      facilityId: facility._id,
      departmentId: [department._id],
      licenseNumber: `LIC-${RUN}-${i}`,
      specialization: [DEPARTMENTS[i]],
      qualification: ['MBBS'],
      experienceYears: 3 + i * 2,
      consultationFee: { newVisit: 15000 + i * 2500, followUp: 7500 },
      bio: `${DEMO_TAG} doctor bio`,
      rating: 3.5 + (i % 3) * 0.5,
    });
    doctors.push(doctor);
    bump('doctors');

    // A weekly schedule so the doctor is bookable, one slot per weekday.
    for (let d = 0; d < 6; d += 1) {
      await DoctorSchedule.create({
        doctorId: doctor._id,
        dayOfWeek: d,
        startTime: '08:00',
        endTime: '17:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        slotDurationMinutes: 30,
        maxPatientsPerSlot: 1,
        isActive: true,
      });
      bump('doctorschedules');
    }
  }

  // Leave: booked for a future date so it does not affect the seeded appointments.
  for (let i = 0; i < COHORT_SIZE; i += 1) {
    await DoctorLeave.create({
      doctorId: doctors[i]._id,
      date: daysFromNow(30 + i),
      reason: DEMO_TAG,
    });
    bump('doctorleaves');
  }

  // Pharmacy stock for the demo facilities. Kept per facility so dispenses can point at a
  // real inventory row.
  const inventory = [];
  for (let i = 0; i < COHORT_SIZE; i += 1) {
    const drug = DRUGS[i % DRUGS.length];
    const item = await PharmacyInventory.create({
      facilityId: facilities[i]._id,
      drugName: drug.name,
      form: 'tablet',
      strength: drug.unit,
      batchNumber: DEMO_TAG,
      quantityOnHand: 100 + i * 25,
      reorderThreshold: 20,
      unitCost: drug.price,
      expiryDate: daysFromNow(365),
    });
    inventory.push(item);
    bump('pharmacyinventories');
  }

  // Insurance providers, one per facility. `type` is required by the schema and drives the
  // claim flow, so half are private insurers and half government schemes.
  const providers = [];
  for (let i = 0; i < COHORT_SIZE; i += 1) {
    providers.push(
      await InsuranceProvider.create({
        // `name` is uniquely indexed, so it has to carry the per-run suffix. Without it a
        // second run collides on the first provider and the script dies part-way through.
        name: `${DEMO_TAG} ${RUN} ${i + 1}`,
        type: i % 2 === 0 ? 'private_insurance' : 'government_scheme',
        contactInfo: { phone: `+25078000000${i}`, email: `claims${i}@demo.local` },
        claimSubmissionMethod: i % 2 === 0 ? 'api' : 'manual',
        isActive: true,
      }),
    );
    bump('insuranceproviders');
  }

  // Claims have to reference a provider whose type matches the payment method, so both kinds
  // are kept addressable by name rather than looked up through the facility.
  const privateProviders = providers.filter((p) => p.type === 'private_insurance');
  const governmentProviders = providers.filter((p) => p.type === 'government_scheme');

  // Patients, each with a portal account so the patient flows can be exercised.
  const patients = [];
  for (let i = 0; i < COHORT_SIZE; i += 1) {
    const facility = facilities[i];
    // The real counter is used rather than a demo-only one, so a patient registered through the
    // app afterwards cannot collide with a seeded patient number.
    const seq = await nextSeq('patientNumber');
    const patientNumber = `${DEMO_TAG}-${RUN}-${String(seq).padStart(5, '0')}`;

    const user = await User.create({
      fullName: `${DEMO_TAG} Patient ${i + 1}`,
      email: `demo.patient.${RUN}.${i}@demo.local`,
      passwordHash,
      role: 'patient',
      status: 'active',
      preferredLanguage: 'en',
      facilityId: facility._id,
    });
    bump('users');

    // Cover matches the payment method used further down: even slots are insured, odd slots are
    // on the government scheme.
    const covered = i % 2 === 0;
    const patient = await Patient.create({
      userId: user._id,
      facilityId: facility._id,
      patientNumber,
      nationalHealthId: `NH-${RUN}-${i}`,
      dob: new Date(1980 + i, i % 12, 5 + i),
      gender: pick(GENDERS, i),
      bloodGroup: pick(BLOOD_GROUPS, i),
      allergies: i % 3 === 0 ? ['Penicillin'] : [],
      chronicConditions: i % 2 === 0 ? ['Hypertension'] : [],
      insurance: covered
        ? {
            provider: privateProviders[i % privateProviders.length].name,
            policyNumber: `POL-${RUN}-${i}`,
            coverageType: 'comprehensive',
            validTill: daysFromNow(300),
          }
        : undefined,
      governmentScheme: covered
        ? undefined
        : {
            schemeName: governmentProviders[i % governmentProviders.length].name,
            beneficiaryNumber: `BEN-${RUN}-${i}`,
            indigentStatus: i % 4 === 1,
          },
    });
    patients.push({ patient, user, facility, doctor: doctors[i], department: departments[i], provider: providers[i] });
    bump('patients');

    // Membership, not just `Patient.facilityId`: this is what the patient directory and the
    // cross-hospital reachability checks actually read.
    await grantMembership(patient._id, facility._id, { isPrimary: true });
    bump('patientfacilities');
  }

  // Appointments: two completed visits and one upcoming per patient, so the status tabs, the
  // date-range filters and the medical timeline all have more than one page of data.
  const appointments = [];
  for (const ctx of patients) {
    for (let a = 0; a < 3; a += 1) {
      const past = a < 2;
      const appointment = await Appointment.create({
        facilityId: ctx.facility._id,
        patientId: ctx.patient._id,
        doctorId: ctx.doctor._id,
        departmentId: ctx.department._id,
        appointmentDate: daysFromNow(past ? -(3 + a * 4) : 5 + a * 3, 9 + a),
        timeSlot: pick(CONSULT_SLOTS, a),
        visitType: pick(CONSULT_TYPES, a),
        bookingChannel: pick(BOOKING_CHANNELS, a),
        status: past ? 'Completed' : pick(UPCOMING_STATUSES, a),
        queueNumber: past ? a + 1 : undefined,
      });
      appointments.push({ appointment, ctx, past, visit: a });
      bump('appointments');
    }
  }

  // A patient can be treated by more than one hospital. Every second patient also gets a
  // completed visit at the *next* facility in the cohort, with a membership to match, so the
  // multi-facility screens have something real to show: the patient appears in two hospital
  // directories, while the hospital they are registered at stays their home.
  const crossFacilityVisits = [];
  for (let i = 0; i < patients.length; i += 1) {
    if (i % 2 !== 1) continue;
    const ctx = patients[i];
    const otherIndex = (i + 1) % facilities.length;
    const otherCtx = patients[otherIndex];
    if (!otherCtx || otherCtx.facility._id.equals(ctx.facility._id)) continue;

    const appointment = await Appointment.create({
      facilityId: otherCtx.facility._id,
      patientId: ctx.patient._id,
      doctorId: otherCtx.doctor._id,
      departmentId: otherCtx.department._id,
      appointmentDate: daysFromNow(-(20 + i), 11),
      timeSlot: pick(CONSULT_SLOTS, 1),
      visitType: 'follow-up',
      bookingChannel: 'web',
      status: 'Completed',
      queueNumber: 1,
    });
    await grantMembership(ctx.patient._id, otherCtx.facility._id, {
      registeredBy: ctx.user._id,
    });
    crossFacilityVisits.push({ appointment, ctx, otherCtx });
    bump('appointments');
    bump('patientfacilities');
  }

  // Clinical records for the completed visits, each with a prescription, a lab result and a
  // dispense, which together give the timeline several entries per patient. `clinical` runs
  // across the whole cohort so repeat visits do not all get the same diagnosis or test.
  let clinical = 0;
  for (const { appointment, ctx, past } of appointments.filter((a) => a.past)) {
    const slot = patients.findIndex((p) => p.patient._id.toString() === ctx.patient._id.toString());
    const record = await MedicalRecord.create({
      patientId: ctx.patient._id,
      doctorId: ctx.doctor._id,
      appointmentId: appointment._id,
      facilityId: ctx.facility._id,
      symptoms: ['Fever', 'Headache'],
      diagnosis: pick(DIAGNOSES, clinical),
      treatment: 'Rest, fluids and the prescribed course',
      notes: `${DEMO_TAG} clinical note`,
      vitals: {
        bloodPressure: '120/80',
        temperature: Number((37.4 + (clinical % 5)).toFixed(1)),
        pulse: 72,
        oxygenSaturation: 98,
        weight: 62,
        height: 170,
      },
      followUpDate: daysFromNow(10),
    });
    bump('medicalrecords');

    const line = MEDICINE_LINES[clinical % MEDICINE_LINES.length];
    const prescription = await Prescription.create({
      medicalRecordId: record._id,
      patientId: ctx.patient._id,
      doctorId: ctx.doctor._id,
      facilityId: ctx.facility._id,
      medicines: [line],
      instructions: 'Take after food and finish the full course',
    });
    bump('prescriptions');

    const test = TESTS[clinical % TESTS.length];
    await LaboratoryTest.create({
      appointmentId: appointment._id,
      medicalRecordId: record._id,
      facilityId: ctx.facility._id,
      patientId: ctx.patient._id,
      requestedBy: ctx.doctor._id,
      testName: test.name,
      fee: test.fee,
      result: test.range,
      referenceRange: 'Within normal limits',
      isAbnormal: false,
      status: 'Completed',
      requestedAt: appointment.appointmentDate,
      completedAt: daysFromNow(-3),
    });
    bump('laboratorytests');

    await PharmacyDispense.create({
      facilityId: ctx.facility._id,
      prescriptionId: prescription._id,
      inventoryId: inventory[slot]._id,
      dispensedBy: receptionists[slot]._id,
      quantity: 10,
      dispensedAt: appointment.appointmentDate,
      notes: DEMO_TAG,
    });
    bump('pharmacydispenses');
    clinical += 1;
  }

  // Payments: settled and pending, including portal requests waiting on staff confirmation.
// Each patient's first completed visit is billed through whichever cover they hold, which is
// what produces the claims; the second visit is self-paid and is where the portal requests
// live, since a patient asking to pay a balance online is paying cash/card, not a scheme.
  const completed = appointments.filter((a) => a.past);
  for (const { appointment, ctx, visit } of completed) {
    const slot = patients.findIndex((p) => p.patient._id.toString() === ctx.patient._id.toString());
    const covered = visit === 0;
    const method = covered
      ? slot % 2 === 0
        ? 'insurance'
        : 'government_scheme'
      : pick(SELF_PAY_METHODS, slot);
    const portal = !covered && slot % 2 === 1;
    const consultationFee = 15000 + (slot + visit) * 1500;
    const labCharges = pick(TESTS, slot + visit).fee;
    const pharmacyCharges = pick(DRUGS, slot + visit).price * 10;

    const payment = await Payment.create({
      appointmentId: appointment._id,
      patientId: ctx.patient._id,
      facilityId: ctx.facility._id,
      amount: consultationFee + labCharges,
      breakdown: {
        consultationFee,
        labCharges,
        pharmacyCharges,
        discount: 0,
        tax: 0,
        schemeSubsidy: method === 'government_scheme' ? Math.round(consultationFee / 2) : 0,
      },
      method,
      status: portal ? 'Pending' : pick(['Paid', 'Partially Paid'] as const, slot + visit),
      source: portal ? 'portal' : 'staff',
      requestReference: portal ? `PAY-${RUN.toUpperCase()}${slot}${visit}` : undefined,
      requestedBy: portal ? ctx.user._id : undefined,
      confirmedBy: portal ? undefined : receptionists[slot]._id,
      confirmedAt: portal ? undefined : appointment.appointmentDate,
      // Staff receipts come from the real generator so the receipt counter advances the same way a
      // live payment does.
      receiptNumber: portal ? undefined : await generateReceiptNumber(),
      paidAt: portal ? undefined : appointment.appointmentDate,
      createdAt: appointment.appointmentDate,
    });
    bump('payments');

    // Insurance and government-scheme payments get a claim, which requires a unique payment.
    // The provider must match the method: a government payment cannot sit on a private insurer.
    const provider =
      method === 'insurance'
        ? privateProviders[slot % privateProviders.length]
        : governmentProviders[slot % governmentProviders.length];
    if (method === 'insurance' || method === 'government_scheme') {
      await InsuranceClaim.create({
        paymentId: payment._id,
        providerId: provider._id,
        claimAmount: payment.amount,
        status: pick(['Submitted', 'Under Review', 'Approved'] as const, slot),
        submittedAt: appointment.appointmentDate,
        resolvedAt: slot % 2 === 0 ? appointment.appointmentDate : undefined,
      });
      bump('insuranceclaims');
    }
  }

  // Messaging: a two-way thread per patient, using the real threading shape.
  for (const ctx of patients) {
    const first = await Message.create({
      facilityId: ctx.facility._id,
      patientId: ctx.patient._id,
      direction: 'to_patient',
      senderUserId: receptionists[patients.indexOf(ctx)]._id,
      senderName: `${DEMO_TAG} Reception`,
      subject: 'Your test results are ready',
      body: 'Your results have been reviewed. Please collect them during opening hours.',
      isRead: false,
      createdAt: daysFromNow(-2),
    });
    // The root message keys its own thread; the reply points back at the root.
    first.threadId = first._id;
    await first.save();

    await Message.create({
      facilityId: ctx.facility._id,
      patientId: ctx.patient._id,
      threadId: first._id,
      direction: 'to_staff',
      senderUserId: ctx.user._id,
      senderName: `${DEMO_TAG} Patient`,
      subject: 'Re: Your test results are ready',
      body: 'Thank you. What time can I collect them?',
      isRead: false,
      createdAt: daysFromNow(-1),
    });
    bump('messages', 2);
  }

  // Notifications: several types so the portal list has varied rows.
  for (const ctx of patients) {
    const types = ['appointment', 'lab_result', 'billing'] as const;
    for (const type of types) {
      await Notification.create({
        facilityId: ctx.facility._id,
        patientId: ctx.patient._id,
        type,
        title: `${DEMO_TAG} ${type} notification`,
        body: 'This is demo notification content for the patient portal.',
        link: type === 'billing' ? '/patient/billing' : '/patient/appointments',
        isRead: false,
        createdAt: daysFromNow(-1),
      });
      bump('notifications');
    }
  }

  // Documents: one of each category so the category filter has a row on every tab.
  for (const ctx of patients) {
    for (let d = 0; d < DOC_TYPES.length; d += 1) {
      await PatientDocument.create({
        facilityId: ctx.facility._id,
        patientId: ctx.patient._id,
        category: pick(DOC_TYPES, d),
        title: `${DEMO_TAG} ${DOC_TYPES[d]} document`,
        fileName: `${DEMO_TAG}-${d}.pdf`,
        fileUrl: `/uploads/demo/${DEMO_TAG}-${RUN}-${d}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 120000 + d * 1000,
        uploadedBy: receptionists[patients.indexOf(ctx)]._id,
      });
      bump('patientdocuments');
    }
  }

  // Audit entries: one per facility for the seeded accounts, plus the cohort record itself.
  // The audit review screens paginate and filter by action, so one row is not enough to
  // exercise them.
  for (const [i, facility] of facilities.entries()) {
    await AuditLog.create({
      userId: receptionists[i]._id,
      role: 'receptionist',
      action: 'CREATE_USER',
      entity: 'User',
      entityId: receptionists[i]._id.toString(),
      facilityId: facility._id,
      actorFacilityId: facility._id,
      after: { email: receptionists[i].email, role: 'receptionist' },
      summary: `${DEMO_TAG} receptionist provisioned at ${facility.name}`,
      succeeded: true,
      statusCode: 201,
      ipAddress: '127.0.0.1',
      userAgent: 'seed-demo-data',
      timestamp: daysFromNow(-30 + i),
    });
    bump('auditlogs');
  }

  await AuditLog.create({
    userId: receptionists[0]?._id,
    role: 'receptionist',
    action: 'SEED_DEMO_COHORT',
    entity: 'DemoCohort',
    entityId: `${DEMO_TAG}-${RUN}`,
    facilityId: facilities[0]?._id,
    actorFacilityId: facilities[0]?._id,
    after: { facilities: facilities.length, patients: patients.length },
    summary: `Seeded demo cohort ${DEMO_TAG}-${RUN}`,
    succeeded: true,
    statusCode: 200,
    ipAddress: '127.0.0.1',
    userAgent: 'seed-demo-data',
  });
  bump('auditlogs');

  const total = Object.values(created).reduce((sum, n) => sum + n, 0);
  console.log(`\nseeded cohort ${DEMO_TAG}-${RUN}`);
  for (const [key, n] of Object.entries(created).sort()) {
    console.log(`  ${key.padEnd(22)} ${n}`);
  }
  console.log(`  ${'TOTAL'.padEnd(22)} ${total}`);

  // Every seeded user is judged by its Role document, so the catalog is synced here as well.
  // Skipping this leaves roles holding permission names from an older schema, which reads as
  // "no access" on every permission-guarded route rather than as an obvious failure.
  const roleSync = await syncRoleCatalog();
  console.log('\nrole catalog synced');
  console.log(`  ${'created'.padEnd(22)} ${roleSync.created.length}`);
  console.log(`  ${'updated'.padEnd(22)} ${roleSync.updated.length}`);
  console.log(`  ${'unchanged'.padEnd(22)} ${roleSync.unchanged.length}`);

  console.log(`\nportal logins (password: ${PASSWORD})`);
  for (const ctx of patients) {
    console.log(`  patient  ${ctx.user.email}`);
  }
  for (const r of receptionists) {
    console.log(`  reception ${r.email}`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});