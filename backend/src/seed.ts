import {
  Facility,
  User,
  Department,
  Doctor,
  DoctorSchedule,
  DoctorLeave,
  Patient,
  Appointment,
  MedicalRecord,
  Prescription,
  LaboratoryTest,
  PharmacyInventory,
  PharmacyDispense,
  Payment,
  InsuranceProvider,
  InsuranceClaim,
  AuditLog,
  Message,
  Notification,
  PatientDocument,
  type PaymentMethod,
  type NotificationType,
  type DocumentCategory,
} from './models';
import { Types } from 'mongoose';
import { hashPassword } from './utils/password';
import { syncRoleCatalog } from './services/roleCatalog';
import { config } from './config/env';

/**
 * Idempotent seed: creates a super admin, a demo facility, departments, a doctor
 * (with a weekly schedule), a receptionist and a sample patient ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â only when missing.
 */
export async function seedIfNeeded(): Promise<void> {
  const superAdminExists = await User.exists({ email: config.seedSuperAdmin.email });
  if (!superAdminExists) {
    await User.create({
      fullName: 'System Super Administrator',
      email: config.seedSuperAdmin.email,
      passwordHash: await hashPassword(config.seedSuperAdmin.password),
      role: 'super_admin',
      facilityId: null,
      preferredLanguage: 'en',
    });
    console.log(`[seed] Super admin created: ${config.seedSuperAdmin.email}`);
  }

  let facility = await Facility.findOne({ name: 'HAS Demo Hospital' });
  if (!facility) {
    facility = await Facility.create({
      name: 'HAS Demo Hospital',
      type: 'hospital',
      region: 'Demo Region',
      district: 'Demo District',
      address: '1 Health Road',
      contactInfo: { phone: '+250 700 000 000', email: 'info@has.demo' },
      operatingHours: 'Mon-Fri 08:00-17:00',
      isActive: true,
    });
    console.log('[seed] Demo facility created');
  }

  const deptNames = ['General Medicine', 'Paediatrics', 'Cardiology'];
  const deptIds: string[] = [];
  for (const name of deptNames) {
    const existing = await Department.findOne({ facilityId: facility._id, name });
    if (!existing) {
      const dept = await Department.create({
        facilityId: facility._id,
        name,
        description: `Department of ${name}`,
        defaultConsultationFee: 5000,
      });
      deptIds.push(String(dept._id));
    } else {
      deptIds.push(String(existing._id));
    }
  }

  const doctorUser = await User.findOne({ email: 'doctor@has.demo' });
  let doctorProfile = doctorUser ? await Doctor.findOne({ userId: doctorUser._id }) : null;
  if (!doctorProfile) {
    const user =
      doctorUser ??
      (await User.create({
        fullName: 'Dr. Demo Doctor',
        email: 'doctor@has.demo',
        phone: '+250 700 000 001',
        passwordHash: await hashPassword('Doctor@12345'),
        role: 'doctor',
        facilityId: facility._id,
        preferredLanguage: 'en',
      }));
    doctorProfile = await Doctor.create({
      userId: user._id,
      facilityId: facility._id,
      departmentId: deptIds,
      licenseNumber: 'LIC-0001',
      specialization: ['General Medicine'],
      qualification: ['MD'],
      experienceYears: 8,
      consultationFee: { newVisit: 5000, followUp: 3000 },
      bio: 'Demo doctor for Phase 1.',
    });
    for (let day = 1; day <= 5; day += 1) {
      await DoctorSchedule.create({
        doctorId: doctorProfile._id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '17:00',
        breakStart: '13:00',
        breakEnd: '14:00',
        slotDurationMinutes: 15,
        maxPatientsPerSlot: 1,
        isActive: true,
      });
    }
    console.log('[seed] Demo doctor + weekly schedule created');
  }

  const receptionistExists = await User.exists({ email: 'reception@has.demo' });
  if (!receptionistExists) {
    await User.create({
      fullName: 'Demo Receptionist',
      email: 'reception@has.demo',
      phone: '+250 700 000 002',
      passwordHash: await hashPassword('Reception@12345'),
      role: 'receptionist',
      facilityId: facility._id,
      preferredLanguage: 'en',
    });
    console.log('[seed] Demo receptionist created');
  }

  const patientUserExists = await User.exists({ email: 'patient@has.demo' });
  if (!patientUserExists) {
    const user = await User.create({
      fullName: 'Demo Patient',
      email: 'patient@has.demo',
      phone: '+250 700 000 003',
      nationalId: 'DEMO-0001',
      passwordHash: await hashPassword('Patient@12345'),
      role: 'patient',
      preferredLanguage: 'en',
    });
    const nextNumber = await Patient.countDocuments();
    await Patient.create({
      userId: user._id,
      patientNumber: `PT-${String(nextNumber + 1).padStart(5, '0')}`,
      dob: new Date('1990-01-01'),
      gender: 'other',
      allergies: ['Penicillin'],
    });
    console.log('[seed] Demo patient created');
  }

  const demoPatientUser = await User.findOne({ email: 'patient@has.demo' });
  const demoPatientProfile = demoPatientUser
    ? await Patient.findOne({ userId: demoPatientUser._id })
    : null;

  if (demoPatientProfile) {
    const existingAppointment = await Appointment.findOne({ patientId: demoPatientProfile._id });
    if (!existingAppointment) {
      const doctorUser = await User.findOne({ email: 'doctor@has.demo' });
      const doctorProfile = doctorUser ? await Doctor.findOne({ userId: doctorUser._id }) : null;
      const facility = await Facility.findOne({ name: 'HAS Demo Hospital' });
      const dept = await Department.findOne({ facilityId: facility?._id, name: 'General Medicine' });

      const appointmentDates = Array.from({ length: 24 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (i * 1)); // 24 days of history, ending today
        d.setHours(9 + (i % 5), 0, 0, 0);
        return d;
      });

      const apptIds: Types.ObjectId[] = [];
      const statuses: ('Pending' | 'Confirmed' | 'Checked In' | 'Completed' | 'Cancelled' | 'Missed' | 'Rejected')[] = [
        'Completed', 'Completed', 'Completed', 'Checked In', 'Confirmed',
        'Cancelled', 'Completed', 'Completed', 'Missed', 'Confirmed',
      ];

      for (let i = 0; i < appointmentDates.length; i += 1) {
        if (!doctorProfile || !facility || !dept) break;
        const appt = await Appointment.create({
          facilityId: facility._id,
          patientId: demoPatientProfile._id,
          doctorId: doctorProfile._id,
          departmentId: dept._id,
          appointmentDate: appointmentDates[i],
          timeSlot: `${9 + (i % 5)}:00`,
          reason: ['Fever and headache', 'Follow-up: hypertension', 'Routine check-up', 'Consultation', 'Refill prescription'][i % 5],
          visitType: i % 4 === 0 ? 'follow-up' : i % 5 === 0 ? 'referral' : 'new',
          bookingChannel: i % 3 === 0 ? 'web' : i % 3 === 1 ? 'walk_in' : 'mobile',
          status: statuses[i % statuses.length],
          queueNumber: i + 1,
        });
        apptIds.push(appt._id);
      }

      console.log(`[seed] Demo patient: ${apptIds.length} appointments created`);

      const questions = ['Allergies', 'History', 'Consultation'];
      for (let i = 0; i < apptIds.length; i += 1) {
        if (i % 10 === 9) continue;
        const record = await MedicalRecord.create({
          patientId: demoPatientProfile._id,
          doctorId: doctorProfile?._id,
          appointmentId: apptIds[i],
          facilityId: facility?._id,
          vitals: {
            bloodPressure: `${110 + i}80/${70 + (i % 6)}`,
            temperature: 36.5 + (i % 3) * 0.3,
            weight: 62 + (i % 8),
            height: 167,
            pulse: 72 + (i % 10),
            oxygenSaturation: 97 + (i % 3),
          },
          symptoms: [questions[i % 3], 'Dizziness'.includes(questions[i % 3]) ? 'Dizziness' : 'Nausea'],
          diagnosis: ['Malaria', 'Hypertension', 'Typhoid', 'Allergic reaction', 'Common cold'][i % 5],
          treatment:
            i % 4 === 0
              ? 'Prescribed Artemether/Lumefantrine'
              : i % 4 === 1
                ? 'Prescribed Amlodipine 5mg'
                : i % 4 === 2
                  ? 'Prescribed Doxycycline'
                  : 'Rest, fluids, paracetamol',
          notes: i % 5 === 0 ? 'Reassessed; schedule follow-up in 2 weeks.' : undefined,
        });
        await Prescription.create({
          medicalRecordId: record._id,
          patientId: demoPatientProfile._id,
          doctorId: doctorProfile?._id,
          facilityId: facility?._id,
          medicines: [
            { name: 'Paracetamol 500mg', dosage: '1 tablet', frequency: '3x daily', durationDays: 5 },
            { name: 'Amoxicillin 500mg', dosage: '1 capsule', frequency: '3x daily', durationDays: 7 },
          ],
          instructions: i % 3 === 0 ? 'Take after meals.' : 'Take with plenty of water.',
          issuedAt: appointmentDates[i],
        });
      }

      const labNames = ['Blood smear', 'Malaria test', 'Urinalysis', 'Full blood count', 'Typhoid test'];
      for (let i = 0; i < apptIds.length; i += 1) {
        if (i % 10 === 9) continue;
        const medRecord = await MedicalRecord.findOne({ appointmentId: apptIds[i] });
        if (!medRecord) continue;
        await LaboratoryTest.create({
          appointmentId: apptIds[i],
          medicalRecordId: medRecord._id,
          facilityId: facility?._id,
          patientId: demoPatientProfile._id,
          requestedBy: doctorProfile?._id,
          testName: labNames[i % labNames.length],
          result: i % 4 === 0 ? 'Negative' : 'Positive',
          resultFileUrl: `https://has.demo/lab/${apptIds[i]}.pdf`,
          referenceRange: 'Negative / Positive',
          isAbnormal: i % 4 === 0 ? true : false,
          status: i % 3 === 0 ? 'Completed' : i % 3 === 1 ? 'In Progress' : 'Requested',
          requestedAt: appointmentDates[i],
          completedAt: i % 3 === 0 ? new Date() : undefined,
        });
      }

      console.log('[seed] Demo patient clinical data (appointments, records, prescriptions, lab tests) created');
    }
  }

  if (demoPatientProfile) {
    const facility = await Facility.findOne({ name: 'HAS Demo Hospital' });
    const doctorUser = await User.findOne({ email: 'doctor@has.demo' });
    const uploaderId = doctorUser?._id ?? demoPatientProfile.userId;

    if (facility) {
      const existingPayment = await Payment.findOne({ patientId: demoPatientProfile._id });
      if (existingPayment) {
        console.log('[seed] Demo patient payments already seeded');
      } else {
        const patientAppointments = await Appointment.find({ patientId: demoPatientProfile._id }).select('_id status');
        const payableStatuses = ['Completed', 'Confirmed', 'Checked In'];
        let paymentsCreated = 0;
        for (const appt of patientAppointments) {
          if (!payableStatuses.includes(appt.status)) continue;
          if (paymentsCreated >= 24) break;
          const consultation = 8000 + (paymentsCreated % 4) * 2000;
          const lab = paymentsCreated % 3 === 0 ? 12000 : 0;
          const pharmacy = paymentsCreated % 2 === 0 ? 4500 : 0;
          const tax = Math.round((consultation + lab + pharmacy) * 0.05);
          const methods: PaymentMethod[] = ['cash', 'card', 'online', 'insurance', 'government_scheme'];
          await Payment.create({
            appointmentId: appt._id,
            patientId: demoPatientProfile._id,
            facilityId: facility._id,
            amount: consultation + lab + pharmacy + tax,
            breakdown: { consultationFee: consultation, labCharges: lab, pharmacyCharges: pharmacy, discount: 0, tax, schemeSubsidy: 0 },
            method: methods[paymentsCreated % methods.length],
            status: paymentsCreated % 5 === 0 ? 'Pending' : 'Paid',
            receiptNumber: `RCT-${String(paymentsCreated + 1).padStart(5, '0')}`,
            paidAt: paymentsCreated % 5 === 0 ? undefined : new Date(),
          });
          paymentsCreated += 1;
        }
        console.log(`[seed] Demo patient: ${paymentsCreated} payments created`);
      }
    }

    const existingMessage = await Message.findOne({ patientId: demoPatientProfile._id });
    if (!existingMessage) {
      const messageSeeds: Array<{ subject: string; body: string }> = [
        { subject: 'Welcome to HAS Hospital', body: 'Your patient record has been created. Welcome to the HAS health network.' },
        { subject: 'Lab results ready', body: 'Your recent lab results have been completed. You can view them in the Lab Results section.' },
        { subject: 'Appointment confirmed', body: 'Your appointment has been confirmed. Please arrive 15 minutes early.' },
        { subject: 'Prescription ready for pickup', body: 'Your prescription is ready at the pharmacy counter.' },
        { subject: 'Payment receipt issued', body: 'Your payment has been recorded. A receipt is available in Billing.' },
        { subject: 'Physiotherapy session reminder', body: 'Reminder: your physiotherapy follow-up is scheduled for next week.' },
        { subject: 'Vaccination campaign', body: 'HAS Hospital is running a free vaccination campaign this month.' },
        { subject: 'Follow-up consultation', body: 'The doctor has scheduled a follow-up consultation. Please book at your convenience.' },
        { subject: 'Insurance claim update', body: 'Your insurance claim has been submitted for review.' },
        { subject: 'Pharmacy stock notice', body: 'Please check availability before visiting the pharmacy for refills.' },
        { subject: 'Dietary advice', body: 'Our nutritionist has prepared personalized dietary recommendations for you.' },
        { subject: 'Annual health check', body: 'Your annual comprehensive health check is now due.' },
        { subject: 'Chronic care program', body: 'You have been enrolled in the chronic care support program.' },
        { subject: 'Lab appointment booked', body: 'Your blood work appointment has been booked for tomorrow morning.' },
        { subject: 'Prescription updated', body: 'Your treatment plan was updated today. Review your prescriptions.' },
        { subject: 'Feedback appreciated', body: 'Thank you for your feedback. Our quality team values your input.' },
        { subject: 'Medical record update', body: 'Important: update your emergency contact details in Settings.' },
        { subject: 'Family planning services', body: 'Learn about our confidential family planning services.' },
        { subject: 'Diabetes support group', body: 'Join the monthly diabetes support group at HAS.' },
        { subject: 'Receipt for your visit', body: 'A copy of your consultation receipt is available under Billing.' },
      ];
      for (let i = 0; i < messageSeeds.length; i += 1) {
        await Message.create({
          facilityId: facility?._id,
          patientId: demoPatientProfile._id,
          senderName: i % 3 === 0 ? 'Dr. Demo Doctor' : i % 3 === 1 ? 'HAS Reception' : 'HAS Admin',
          subject: messageSeeds[i].subject,
          body: messageSeeds[i].body,
          isRead: i % 4 === 0,
          readAt: i % 4 === 0 ? new Date() : undefined,
        });
      }
      console.log(`[seed] Demo patient: ${messageSeeds.length} messages created`);
    }

    const existingNotification = await Notification.findOne({ patientId: demoPatientProfile._id });
    if (!existingNotification) {
      const notificationSeeds: Array<{ type: NotificationType; title: string; body: string; link?: string }> = [
        { type: 'appointment', title: 'Appointment confirmed', body: 'Your check-up appointment is confirmed for this week.', link: '/appointments' },
        { type: 'lab_result', title: 'Results available', body: 'Your blood results are now available.', link: '/lab-results' },
        { type: 'prescription', title: 'New prescription', body: 'A new prescription was issued by your doctor.', link: '/prescriptions' },
        { type: 'billing', title: 'Payment received', body: 'We received your payment for the recent consultation.', link: '/billing' },
        { type: 'general', title: 'Health tips', body: 'Stay hydrated and maintain a balanced diet.' },
        { type: 'appointment', title: 'Reschedule notice', body: 'Your physiotherapy slot has been rescheduled to Thursday.', link: '/appointments' },
        { type: 'lab_result', title: 'Abnormal result flagged', body: 'One lab result needs your review; please contact the clinic.', link: '/lab-results' },
        { type: 'prescription', title: 'Prescription renewal', body: 'Your chronic medication is due for renewal.', link: '/prescriptions' },
        { type: 'billing', title: 'Invoice generated', body: 'A new invoice has been generated for lab services.', link: '/billing' },
        { type: 'general', title: 'Flu season reminder', body: 'Get your annual flu vaccination at HAS.' },
        { type: 'appointment', title: 'Check-in reminder', body: 'Use the kiosk to check in when you arrive.', link: '/appointments' },
        { type: 'lab_result', title: 'Fasting test reminder', body: 'Fasting required before your glucose test tomorrow.' },
        { type: 'prescription', title: 'Prescription dispensed', body: 'Your pharmacy order has been dispensed.', link: '/prescriptions' },
        { type: 'billing', title: 'Balance due', body: 'A partial balance remains on your last bill.', link: '/billing' },
        { type: 'general', title: 'Clinic schedule', body: 'HAS operates Monday to Friday, 08:00-17:00.' },
        { type: 'appointment', title: 'Teleconsultation link', body: 'Your virtual consult link has been shared via SMS.', link: '/appointments' },
        { type: 'lab_result', title: 'Culture test scheduled', body: 'A sputum culture test has been ordered for you.' },
        { type: 'prescription', title: 'Repeat prescription', body: 'Repeat prescriptions can be renewed online.', link: '/prescriptions' },
        { type: 'billing', title: 'Insurance coverage', body: 'Your insurance covers the latest lab charges.', link: '/billing' },
        { type: 'general', title: 'HAS mobile app', body: 'Download HAS Mobile for quick bookings and test results.' },
      ];
      for (let i = 0; i < notificationSeeds.length; i += 1) {
        await Notification.create({
          facilityId: facility?._id,
          patientId: demoPatientProfile._id,
          type: notificationSeeds[i].type,
          title: notificationSeeds[i].title,
          body: notificationSeeds[i].body,
          link: notificationSeeds[i].link ?? undefined,
          isRead: i % 4 === 1,
          readAt: i % 4 === 1 ? new Date() : undefined,
        });
      }
      console.log(`[seed] Demo patient: ${notificationSeeds.length} notifications created`);
    }

    const existingDocument = await PatientDocument.findOne({ patientId: demoPatientProfile._id });
    if (!existingDocument) {
      const documentSeeds: Array<{ category: DocumentCategory; title: string; fileName: string; fileUrl: string }> = [
        { category: 'billing_receipt', title: 'Consultation receipt', fileName: 'receipt-00001.pdf', fileUrl: 'https://has.demo/documents/receipt-00001.pdf' },
        { category: 'lab_result', title: 'Full blood count', fileName: 'fbc-result.pdf', fileUrl: 'https://has.demo/documents/fbc-result.pdf' },
        { category: 'prescription', title: 'Prescription #1001', fileName: 'rx-1001.pdf', fileUrl: 'https://has.demo/documents/rx-1001.pdf' },
        { category: 'medical_report', title: 'Annual health check summary', fileName: 'health-check-2026.pdf', fileUrl: 'https://has.demo/documents/health-check-2026.pdf' },
        { category: 'general', title: 'HAS patient handbook', fileName: 'patient-handbook.pdf', fileUrl: 'https://has.demo/documents/patient-handbook.pdf' },
        { category: 'lab_result', title: 'Lipid panel', fileName: 'lipid-panel.pdf', fileUrl: 'https://has.demo/documents/lipid-panel.pdf' },
        { category: 'billing_receipt', title: 'Lab charges receipt', fileName: 'receipt-00002.pdf', fileUrl: 'https://has.demo/documents/receipt-00002.pdf' },
        { category: 'prescription', title: 'Prescription #1002', fileName: 'rx-1002.pdf', fileUrl: 'https://has.demo/documents/rx-1002.pdf' },
        { category: 'medical_report', title: 'Cardiology consult report', fileName: 'cardiology-report.pdf', fileUrl: 'https://has.demo/documents/cardiology-report.pdf' },
        { category: 'general', title: 'Insurance policy document', fileName: 'policy-9021.pdf', fileUrl: 'https://has.demo/documents/policy-9021.pdf' },
        { category: 'lab_result', title: 'Thyroid function test', fileName: 'tft-result.pdf', fileUrl: 'https://has.demo/documents/tft-result.pdf' },
        { category: 'billing_receipt', title: 'Pharmacy receipt', fileName: 'receipt-00003.pdf', fileUrl: 'https://has.demo/documents/receipt-00003.pdf' },
        { category: 'prescription', title: 'Prescription #1003', fileName: 'rx-1003.pdf', fileUrl: 'https://has.demo/documents/rx-1003.pdf' },
        { category: 'medical_report', title: 'Malaria treatment record', fileName: 'malaria-record.pdf', fileUrl: 'https://has.demo/documents/malaria-record.pdf' },
        { category: 'general', title: 'Referral letter', fileName: 'referral-1.pdf', fileUrl: 'https://has.demo/documents/referral-1.pdf' },
        { category: 'lab_result', title: 'Urinalysis', fileName: 'urinalysis.pdf', fileUrl: 'https://has.demo/documents/urinalysis.pdf' },
        { category: 'billing_receipt', title: 'Consultation receipt 2', fileName: 'receipt-00004.pdf', fileUrl: 'https://has.demo/documents/receipt-00004.pdf' },
        { category: 'prescription', title: 'Prescription #1004', fileName: 'rx-1004.pdf', fileUrl: 'https://has.demo/documents/rx-1004.pdf' },
        { category: 'medical_report', title: 'Hypertension follow-up', fileName: 'bp-followup.pdf', fileUrl: 'https://has.demo/documents/bp-followup.pdf' },
        { category: 'general', title: 'Vaccination record', fileName: 'vaccination-card.pdf', fileUrl: 'https://has.demo/documents/vaccination-card.pdf' },
        { category: 'lab_result', title: 'Fasting blood sugar', fileName: 'fbs-result.pdf', fileUrl: 'https://has.demo/documents/fbs-result.pdf' },
        { category: 'billing_receipt', title: 'Total visit payment', fileName: 'receipt-00005.pdf', fileUrl: 'https://has.demo/documents/receipt-00005.pdf' },
      ];
      for (let i = 0; i < documentSeeds.length; i += 1) {
        await PatientDocument.create({
          facilityId: facility?._id,
          patientId: demoPatientProfile._id,
          category: documentSeeds[i].category,
          title: documentSeeds[i].title,
          fileName: documentSeeds[i].fileName,
          fileUrl: documentSeeds[i].fileUrl,
          mimeType: 'application/pdf',
          sizeBytes: 50000 + i * 1250,
          uploadedBy: uploaderId,
        });
      }
      console.log(`[seed] Demo patient: ${documentSeeds.length} documents created`);
    }
  }

  await seedBulkData();

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  SEED COMPLETE — Demo Login Credentials');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Super Admin       ${config.seedSuperAdmin.email.padEnd(28)}  ${config.seedSuperAdmin.password}`);
  console.log(`  Doctor            doctor@has.demo                  Doctor@12345`);
  console.log(`  Receptionist      reception@has.demo               Reception@12345`);
  console.log(`  Patient (main)    patient@has.demo                 Patient@12345`);
  console.log(`  Patients 2–28     patient{n}@has.demo (n = 2..28)  Patient@12345`);
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log('[seed] Complete');
}

/**
 * Phase 7: Bulk demo data expansion.
 * Brings every domain collection to 20+ records (facilities, users, roles,
 * departments, doctors, schedules, leaves, patients, appointments, clinical,
 * pharmacy, billing, insurance, messaging and audit data). Guards are keyed on
 * entity existence so a partial or repeated run never duplicates records.
 * Runtime infra collections (Counters, RefreshTokens, VerificationCodes) are
 * intentionally excluded: they store sequence counters, live sessions and OTP
 * codes, and seeding them would break availability-slot numbering, session and
 * verification flows.
 */
async function seedBulkData() {
  // Every sub-section below is individually existence-guarded, so a re-run is
  // idempotent: only the newly added records (e.g. per-facility staff) get created.

  const demoFacility = await Facility.findOne({ name: 'HAS Demo Hospital' });
  const demoDoctorUser = await User.findOne({ email: 'doctor@has.demo' });
  const demoDoctor = demoDoctorUser
    ? await Doctor.findOne({ userId: demoDoctorUser._id }).select('_id facilityId departmentId')
    : null;
  const demoDept = demoFacility
    ? await Department.findOne({ facilityId: demoFacility._id, name: 'General Medicine' })
    : null;

  // ── Facilities (24 more) ───────────────────────────────────────────────
  const facSeeds = [
    { name: 'HAS Kigali District Hospital', type: 'hospital' },
    { name: 'HAS Nyabugogo Health Center', type: 'health_center' },
    { name: 'HAS Remera Clinic', type: 'clinic' },
    { name: 'HAS Muhima District Hospital', type: 'hospital' },
    { name: 'HAS Kimironko Clinic', type: 'clinic' },
    { name: 'HAS Gisozi Health Center', type: 'health_center' },
    { name: 'HAS Kicukiro District Hospital', type: 'hospital' },
    { name: 'HAS Nyarugenge Health Center', type: 'health_center' },
    { name: 'HAS Kanombe Clinic', type: 'clinic' },
    { name: 'HAS Gikondo District Hospital', type: 'hospital' },
    { name: 'HAS Ndera Health Center', type: 'health_center' },
    { name: 'HAS Rebero Clinic', type: 'clinic' },
    { name: 'HAS Kacyiru District Hospital', type: 'hospital' },
    { name: 'HAS Kimisagara Health Center', type: 'health_center' },
    { name: 'HAS Butamwa Clinic', type: 'clinic' },
    { name: 'HAS Gatsata District Hospital', type: 'hospital' },
    { name: 'HAS Kinyinya Health Center', type: 'health_center' },
    { name: 'HAS Nyamirambo Clinic', type: 'clinic' },
    { name: 'HAS Kanogo District Hospital', type: 'hospital' },
    { name: 'HAS Biryogo Health Center', type: 'health_center' },
    { name: 'HAS Gitega Clinic', type: 'clinic' },
    { name: 'HAS Kibagabaga District Hospital', type: 'hospital' },
    { name: 'HAS Mpazi Health Center', type: 'health_center' },
    { name: 'HAS Nyakabanda Clinic', type: 'clinic' },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const facilities: any[] = [];
  let facCreated = 0;
  for (let i = 0; i < facSeeds.length; i += 1) {
    const name = facSeeds[i].name;
    const existing = await Facility.findOne({ name }).select('_id');
    if (existing) {
      facilities.push(existing);
      continue;
    }
    const fac = await Facility.create({
      name,
      type: facSeeds[i].type as 'hospital' | 'clinic' | 'health_center' | 'district_office',
      region: `Region ${i + 1}`,
      district: `District ${i + 1}`,
      address: `${i + 1} Health Road`,
      contactInfo: { phone: `+250 7${String(83000000 + i).padStart(8, '0')}`, email: `contact${i + 1}@has.demo` },
      operatingHours: 'Mon-Fri 08:00-17:00',
      isActive: true,
    });
    facilities.push(fac);
    facCreated += 1;
  }
  console.log(`[seed] Bulk: ${facCreated} facilities created (total ${facilities.length})`);

  // ── Roles ──────────────────────────────────────────────────────────────
  // Upserted from the code catalog so a re-seed actually reconciles grants instead of
  // leaving stale permissions behind. See services/roleCatalog.ts.
  const roleSync = await syncRoleCatalog();
  console.log(
    `[seed] Bulk: roles synchronised (${roleSync.created.length} created, ` +
      `${roleSync.updated.length} updated, ${roleSync.unchanged.length} unchanged)`
  );

  // ── Departments (6 per facility) ───────────────────────────────────────
  const deptSeeds = [
    'General Medicine',
    'Pediatrics',
    'Surgery',
    'Laboratory',
    'Pharmacy',
    'Maternity',
  ];
  let deptsCreated = 0;
  for (const f of facilities) {
    for (const dname of deptSeeds) {
      const dExists = await Department.exists({ facilityId: f._id, name: dname });
      if (dExists) continue;
      await Department.create({
        facilityId: f._id,
        name: dname,
        description: `${dname} department`,
        defaultConsultationFee: 5000 + deptsCreated * 250,
      });
      deptsCreated += 1;
    }
  }
  console.log(`[seed] Bulk: ${deptsCreated} departments created`);

  // ── Staff users (facility admins + receptionists per facility) ─────────
  let staffCreated = 0;
  for (let i = 0; i < facilities.length; i += 1) {
    const fac = facilities[i];
    const adminEmail = `admin-fac${i + 1}@has.demo`;
    if (!(await User.exists({ email: adminEmail }))) {
      await User.create({
        fullName: `Facility Admin ${i + 1}`,
        email: adminEmail,
        phone: `+2507930${String(i + 1).padStart(3, '0')}`,
        passwordHash: await hashPassword('Facility@12345'),
        role: 'facility_admin',
        facilityId: fac._id,
        preferredLanguage: 'en',
      });
      staffCreated += 1;
    }
    const recEmail = `recept-fac${i + 1}@has.demo`;
    if (!(await User.exists({ email: recEmail }))) {
      await User.create({
        fullName: `Receptionist ${i + 1}`,
        email: recEmail,
        phone: `+2507931${String(i + 1).padStart(3, '0')}`,
        passwordHash: await hashPassword('Reception@12345'),
        role: 'receptionist',
        facilityId: fac._id,
        preferredLanguage: 'en',
      });
      staffCreated += 1;
    }
    // Additional per-facility staff: nurse, lab technician, pharmacist,
    // insurance verifier and auditor, each assigned to the same facility.
    const perFacilityStaff = [
      { key: 'nurse', role: 'nurse', label: 'Staff Nurse', pfx: '+2507934' },
      { key: 'lab', role: 'lab_technician', label: 'Lab Technician', pfx: '+2507935' },
      { key: 'pharm', role: 'pharmacist', label: 'Pharmacist', pfx: '+2507936' },
      { key: 'verif', role: 'insurance_verifier', label: 'Insurance Verifier', pfx: '+2507937' },
      { key: 'audit', role: 'auditor', label: 'Auditor', pfx: '+2507938' },
    ];
    for (const s of perFacilityStaff) {
      const email = `${s.key}-fac${i + 1}@has.demo`;
      if (await User.exists({ email })) continue;
      await User.create({
        fullName: `${s.label} ${i + 1}`,
        email,
        phone: `${s.pfx}${String(i + 1).padStart(3, '0')}`,
        passwordHash: await hashPassword('Staff@12345'),
        role: s.role as
          | 'nurse'
          | 'lab_technician'
          | 'pharmacist'
          | 'insurance_verifier'
          | 'auditor',
        facilityId: fac._id,
        preferredLanguage: 'en',
      });
      staffCreated += 1;
    }
  }

  // Demo-facility specialized staff
  const demoStaff = [
    { email: 'nurse@has.demo', name: 'Demo Nurse', role: 'nurse', phone: '+2507932001' },
    { email: 'labtech@has.demo', name: 'Demo Lab Technician', role: 'lab_technician', phone: '+2507932002' },
    { email: 'pharmacist@has.demo', name: 'Demo Pharmacist', role: 'pharmacist', phone: '+2507932003' },
    { email: 'verifier@has.demo', name: 'Demo Verifier', role: 'insurance_verifier', phone: '+2507932004' },
    { email: 'auditor@has.demo', name: 'Demo Auditor', role: 'auditor', phone: '+2507932005' },
  ];
  for (const s of demoStaff) {
    if (await User.exists({ email: s.email })) continue;
    await User.create({
      fullName: s.name,
      email: s.email,
      phone: s.phone,
      passwordHash: await hashPassword('Staff@12345'),
      role: s.role as 'nurse' | 'lab_technician' | 'pharmacist' | 'insurance_verifier' | 'auditor',
      facilityId: demoFacility?._id,
      preferredLanguage: 'en',
    });
    staffCreated += 1;
  }
  console.log(`[seed] Bulk: ${staffCreated} staff users created`);

  // ── Doctors (23 more) + schedules ──────────────────────────────────────
  const doctorNames = [
    'Alphonse Niyonzima', 'Grace Mugisha', 'Jean Bosco Habimana', 'Aline Uwase',
    'Emmanuel Ndayizeye', 'Claudine Mukamana', 'Patrick Rwema', 'Chantal Umuhoza',
    'Olivier Gasana', 'Diane Ingabire', 'Fabrice Nsengimana', 'Josiane Mukeshimana',
    'Eric Habiyaremye', 'Sandrine Uwimana', 'Yves Nsabimana', 'Esther Mukamana',
    'Theoneste Nshimiyimana', 'Naomi Uwera', 'Didier Mudenge', 'Providence Ingabire',
    'Christophe Nkurunziza', 'Solange Mukakarisa', 'Gilbert Nshuti',
  ];
  const specializations = [
    'General Medicine', 'Pediatrics', 'Surgery', 'Laboratory', 'Pharmacy', 'Maternity',
  ];
  const doctors: any[] = demoDoctor ? [demoDoctor] : [];
  let docsCreated = 0;
  for (let i = 0; i < doctorNames.length; i += 1) {
    const email = `doctor${i + 2}@has.demo`;
    const fac = facilities[i % facilities.length];
    const dept = await Department.findOne({ facilityId: fac._id }).select('_id');
    if (!dept) continue;
    let docUser = await User.findOne({ email });
    if (!docUser) {
      docUser = await User.create({
        fullName: doctorNames[i],
        email,
        phone: `+2507933${String(i + 1).padStart(3, '0')}`,
        passwordHash: await hashPassword('Doctor@12345'),
        role: 'doctor',
        facilityId: fac._id,
        preferredLanguage: 'en',
      });
    }
    const existingDoc = await Doctor.findOne({ userId: docUser._id }).select('_id');
    if (existingDoc) {
      doctors.push(existingDoc as any);
      continue;
    }
    const doctor = await Doctor.create({
      userId: docUser._id,
      facilityId: fac._id,
      departmentId: [dept._id],
      licenseNumber: `LIC-${String(1000 + i)}`,
      specialization: [specializations[i % specializations.length]],
      qualification: ['MD'],
      experienceYears: 3 + (i % 15),
      consultationFee: { newVisit: 4000 + (i % 6) * 2000, followUp: 2500 + (i % 6) * 1000 },
      bio: `Demo physician at ${fac.name}.`,
      rating: 3.8 + ((i % 12) / 10),
    });
    doctors.push(doctor);
    docsCreated += 1;
  }
  console.log(`[seed] Bulk: ${docsCreated} doctors created (total ${doctors.length})`);

  let schedCreated = 0;
  for (const doc of doctors) {
    for (let day = 1; day <= 5; day += 1) {
      const sExists = await DoctorSchedule.exists({ doctorId: doc._id, dayOfWeek: day });
      if (sExists) continue;
      await DoctorSchedule.create({
        doctorId: doc._id,
        dayOfWeek: day as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        startTime: '09:00',
        endTime: '17:00',
        breakStart: '13:00',
        breakEnd: '14:00',
        slotDurationMinutes: 15,
        maxPatientsPerSlot: 1,
        isActive: true,
      });
      schedCreated += 1;
    }
  }
  console.log(`[seed] Bulk: ${schedCreated} doctor schedules created`);

  // ── Doctor leaves (24) ─────────────────────────────────────────────────
  const leaveReasons = [
    'Annual leave', 'Sick leave', 'Training workshop', 'Conference', 'Family leave',
  ];
  let leavesCreated = 0;
  for (let i = 0; i < 24; i += 1) {
    const doc = doctors[i % doctors.length];
    const date = new Date();
    date.setDate(date.getDate() + 5 + i);
    date.setHours(9, 0, 0, 0);
    const lExists = await DoctorLeave.exists({ doctorId: doc?._id, date });
    if (lExists) continue;
    await DoctorLeave.create({
      doctorId: doc?._id,
      date,
      reason: leaveReasons[i % leaveReasons.length],
    });
    leavesCreated += 1;
  }
  console.log(`[seed] Bulk: ${leavesCreated} doctor leaves created`);

  // ── Patients (27 more) ─────────────────────────────────────────────────
  const patientNames = [
    'Alice Kanyange', 'Benimana Claude', 'Chantal Nyirahabimana', 'Diana Uwase',
    'Emile Nshimiyimana', 'Fiona Mukandayisenga', 'Gaetan Bizimana', 'Helene Uwera',
    'Ibrahim Habimana', 'Jacinta Mukamana', 'Kevin Ndayambaje', 'Louise Uwimana',
    'Moses Nsengiyumva', 'Nicole Ingabire', 'Olivier Mugabo', 'Patience Umuhoza',
    'Quentin Nkurunziza', 'Rose Mukamana', 'Samuel Ingabire', 'Tiana Uwineza',
    'Umar Niyonkuru', 'Valerie Mukantabana', 'William Ndayishimiye', 'Yvette Uwanyirigira',
    'Zawadi Mukamwezi', 'Albert Nshimiyimana', 'Bella Uwase',
  ];
  const patients: any[] = [];
  let patientsCreated = 0;
  for (let i = 0; i < patientNames.length; i += 1) {
    const email = `patient${i + 2}@has.demo`;
    let pUser = await User.findOne({ email });
    if (!pUser) {
      pUser = await User.create({
        fullName: patientNames[i],
        email,
        phone: `+2507920${String(i + 2).padStart(3, '0')}`,
        nationalId: `DEMO-P${1000 + i}`,
        passwordHash: await hashPassword('Patient@12345'),
        role: 'patient',
        facilityId: (demoFacility?._id as any) ?? undefined,
        preferredLanguage: i % 3 === 1 ? 'fr' : 'en',
      });
    }
    const existingPatient = await Patient.findOne({ userId: pUser._id }).select('_id');
    if (existingPatient) {
      patients.push(existingPatient as any);
      continue;
    }
    const patient = await Patient.create({
      userId: pUser._id,
      patientNumber: `PT-${String(10000 + i)}`,
      nationalHealthId: `NIH-${1000 + i}`,
      dob: new Date(1970 + (i % 25), (i % 12) + 1, (i % 28) + 1),
      gender: i % 3 === 0 ? 'female' : i % 3 === 1 ? 'male' : 'other',
      bloodGroup: ['O+', 'A+', 'B+', 'AB+', 'O-'][i % 5],
      allergies: i % 4 === 0 ? ['Penicillin'] : [],
      chronicConditions: i % 6 === 2 ? ['Hypertension'] : [],
    });
    patients.push(patient);
    patientsCreated += 1;
  }
  console.log(`[seed] Bulk: ${patientsCreated} patients created (total ${patients.length})`);

  // ── Appointments (2 per new patient) ───────────────────────────────────
  const reasons = [
    'Fever and headache', 'Routine check-up', 'Abdominal pain', 'Cough and cold',
    'Annual physical', 'Skin rash', 'Joint pain', 'Follow-up visit',
  ];
  const times = ['09:00', '09:15', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'];
  let apptsCreated = 0;
  for (let i = 0; i < patients.length; i += 1) {
    const patient = patients[i];
    const existingAppts = await Appointment.countDocuments({ patientId: patient._id });
    if (existingAppts > 0) continue;
    const doc = doctors[i % doctors.length];
    const dept = doc?.departmentId?.[0]
      ? await Department.findById(doc.departmentId[0]).select('_id')
      : demoDept;
    const facId = doc?.facilityId;

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - (5 + (i * 3) % 60));
    pastDate.setHours(9, 0, 0, 0);
    await Appointment.create({
      facilityId: facId,
      patientId: patient._id,
      doctorId: doc?._id,
      departmentId: dept?._id,
      appointmentDate: pastDate,
      timeSlot: times[i % times.length],
      reason: reasons[i % reasons.length],
      visitType: i % 4 === 1 ? 'follow-up' : 'new',
      bookingChannel: 'web',
      status: 'Completed',
      queueNumber: (i + 2) * 2 - 1,
      checkInTime: new Date(pastDate.getTime() + 15 * 60000),
      completedAt: new Date(pastDate.getTime() + 45 * 60000),
    });
    apptsCreated += 1;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2 + (i % 25));
    futureDate.setHours(9, 0, 0, 0);
    await Appointment.create({
      facilityId: facId,
      patientId: patient._id,
      doctorId: doc?._id,
      departmentId: dept?._id,
      appointmentDate: futureDate,
      timeSlot: times[(i + 3) % times.length],
      reason: reasons[(i + 2) % reasons.length],
      visitType: 'follow-up',
      bookingChannel: i % 2 === 0 ? 'web' : 'mobile',
      status: (['Pending', 'Confirmed', 'Checked In'] as const)[i % 3],
    });
    apptsCreated += 1;
  }
  console.log(`[seed] Bulk: ${apptsCreated} appointments created`);

  // ── Medical records + prescriptions + lab tests per completed appt ─────
  const diagnoses = [
    'Malaria', 'Upper respiratory tract infection', 'Gastritis', 'Hypertension',
    'Urinary tract infection', 'Anemia', 'Typhoid fever', 'Diabetes mellitus',
  ];
  const vitalsPool = [
    { bloodPressure: '120/80', temperature: 36.8, weight: 65, height: 168, pulse: 72, oxygenSaturation: 98 },
    { bloodPressure: '130/85', temperature: 37.2, weight: 72, height: 172, pulse: 78, oxygenSaturation: 97 },
    { bloodPressure: '118/76', temperature: 38.1, weight: 58, height: 160, pulse: 84, oxygenSaturation: 96 },
  ];
  const medsPool = [
    { name: 'Paracetamol', dosage: '500mg', frequency: '1-0-1', durationDays: 5 },
    { name: 'Amoxicillin', dosage: '250mg', frequency: '1-1-1', durationDays: 7 },
    { name: 'Metronidazole', dosage: '400mg', frequency: '1-0-1', durationDays: 5 },
    { name: 'Artemether-Lumefantrine', dosage: '20/120mg', frequency: '0-0-2', durationDays: 3 },
    { name: 'Ibuprofen', dosage: '400mg', frequency: '1-0-1', durationDays: 4 },
    { name: 'Oral Rehydration Salts', dosage: '1 sachet', frequency: 'after each stool', durationDays: 2 },
  ];
  const testsPool = [
    { name: 'Full Blood Count', fee: 5000, range: '4.5-11.0 x10^9/L', normal: 'Hemoglobin 13-17 g/dL' },
    { name: 'Malaria Rapid Test', fee: 4000, range: 'Negative', normal: 'Negative' },
    { name: 'Urinalysis', fee: 6000, range: 'Normal', normal: 'No abnormalities' },
    { name: 'Random Blood Sugar', fee: 3000, range: '4.0-7.8 mmol/L', normal: '4.0-7.8 mmol/L' },
    { name: 'Lipid Panel', fee: 8000, range: 'LDL < 3.4 mmol/L', normal: 'LDL < 3.4 mmol/L' },
    { name: 'Thyroid Function Test', fee: 12000, range: 'TSH 0.4-4.0 mIU/L', normal: 'TSH 0.4-4.0 mIU/L' },
  ];
  const completedAppts = (await Appointment.find({ patientId: { $in: patients.map((p) => p._id) }, status: 'Completed' }).select('_id patientId doctorId facilityId completedAt')).map((a) => a.toObject());
  let recordsCreated = 0;
  let rxCreated = 0;
  let testCreated = 0;
  for (let i = 0; i < completedAppts.length; i += 1) {
    const appt = completedAppts[i];
    const rExists = await MedicalRecord.exists({ appointmentId: appt._id });
    let recordId: any = null;
    if (!rExists) {
      const record = await MedicalRecord.create({
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        appointmentId: appt._id,
        facilityId: appt.facilityId,
        vitals: vitalsPool[i % vitalsPool.length],
        symptoms: [reasons[i % reasons.length]],
        diagnosis: diagnoses[i % diagnoses.length],
        treatment: `Prescribed ${medsPool[i % medsPool.length].name} per protocol.`,
        notes: 'Patient advised on hydration and rest. Return for review if symptoms persist.',
        followUpDate: appt.completedAt ? new Date(new Date(appt.completedAt).getTime() + 7 * 86400000) : undefined,
      });
      recordId = record._id;
      recordsCreated += 1;
    } else {
      const rr = await MedicalRecord.findOne({ appointmentId: appt._id }).select('_id');
      recordId = rr?._id;
    }

    if (recordId) {
      const rxExists = await Prescription.exists({ medicalRecordId: recordId });
      if (!rxExists) {
        const med = medsPool[i % medsPool.length];
        await Prescription.create({
          medicalRecordId: recordId,
          patientId: appt.patientId,
          doctorId: appt.doctorId,
          facilityId: appt.facilityId,
          medicines: [med, medsPool[(i + 2) % medsPool.length]].map((m) => ({ ...m, instructions: 'Take with meals' })),
          instructions: 'Complete the full course of treatment.',
          issuedAt: appt.completedAt ?? new Date(),
        });
        rxCreated += 1;
      }

      const test = testsPool[i % testsPool.length];
      const tExists = await LaboratoryTest.exists({ appointmentId: appt._id, testName: test.name });
      if (!tExists) {
        const abnormal = i % 9 === 0;
        await LaboratoryTest.create({
          appointmentId: appt._id,
          medicalRecordId: recordId,
          facilityId: appt.facilityId,
          patientId: appt.patientId,
          requestedBy: appt.doctorId,
          testName: test.name,
          fee: test.fee,
          result: abnormal ? 'Outside reference range' : test.normal,
          referenceRange: test.range,
          isAbnormal: abnormal,
          status: 'Completed',
          requestedAt: appt.completedAt ?? new Date(),
          completedAt: appt.completedAt ? new Date(new Date(appt.completedAt).getTime() + 600000) : undefined,
        });
        testCreated += 1;
      }
    }
  }
  console.log(`[seed] Bulk: ${recordsCreated} records, ${rxCreated} prescriptions, ${testCreated} lab tests created`);

  // ── Pharmacy inventory (24 drugs) + dispenses ──────────────────────────
  const drugSeeds = [
    ['Paracetamol', 'tablet', '500mg'],
    ['Amoxicillin', 'capsule', '250mg'],
    ['Metronidazole', 'tablet', '400mg'],
    ['Artemether-Lumefantrine', 'tablet', '20/120mg'],
    ['Ibuprofen', 'tablet', '400mg'],
    ['ORS Sachets', 'sachet', '20.5g'],
    ['Ciprofloxacin', 'tablet', '500mg'],
    ['Omeprazole', 'capsule', '20mg'],
    ['Amlodipine', 'tablet', '5mg'],
    ['Metformin', 'tablet', '500mg'],
    ['Cetirizine', 'tablet', '10mg'],
    ['Salbutamol Inhaler', 'inhaler', '100mcg/dose'],
    ['Prednisolone', 'tablet', '5mg'],
    ['Diclofenac Gel', 'gel', '1%'],
    ['Vitamin B Complex', 'tablet', 'B1/B2/B6/B12'],
    ['Ferrous Sulfate', 'tablet', '200mg'],
    ['Folic Acid', 'tablet', '5mg'],
    ['Zinc Sulfate', 'tablet', '20mg'],
    ['Albendazole', 'tablet', '400mg'],
    ['Diazepam', 'tablet', '5mg'],
    ['Hydrochlorothiazide', 'tablet', '25mg'],
    ['Atorvastatin', 'tablet', '20mg'],
    ['Insulin Glargine', 'injection', '100IU/ml'],
    ['Potassium Chloride', 'tablet', '600mg'],
  ];
  const inventoryIds: any[] = [];
  let invCreated = 0;
  const targetFac = (demoFacility?._id as any) ?? facilities[0]?._id;
  for (let i = 0; i < drugSeeds.length; i += 1) {
    const drugName = drugSeeds[i][0];
    const iExists = await PharmacyInventory.exists({ facilityId: targetFac, drugName });
    if (iExists) continue;
    const item = await PharmacyInventory.create({
      facilityId: targetFac,
      drugName,
      form: drugSeeds[i][1],
      strength: drugSeeds[i][2],
      batchNumber: `B-${String(2400 + i)}`,
      expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)),
      quantityOnHand: 100 + i * 25,
      reorderThreshold: 20 + i,
      unitCost: 500 + i * 120,
    });
    inventoryIds.push(item._id);
    invCreated += 1;
  }
  console.log(`[seed] Bulk: ${invCreated} pharmacy inventory items created`);

  let dispCreated = 0;
  const pharmacistUser = await User.findOne({ email: 'pharmacist@has.demo' }).select('_id');
  const allRx = await Prescription.find({ facilityId: targetFac }).select('_id facilityId').limit(24).sort({ createdAt: -1 });
  for (let i = 0; i < allRx.length; i += 1) {
    const rx = allRx[i];
    const dExists = await PharmacyDispense.exists({ prescriptionId: rx._id });
    if (dExists) continue;
    const inv = inventoryIds[i % Math.max(inventoryIds.length, 1)];
    if (!inv) continue;
    await PharmacyDispense.create({
      prescriptionId: rx._id,
      inventoryId: inv,
      dispensedBy: pharmacistUser?._id,
      facilityId: rx.facilityId,
      quantity: 1 + (i % 3),
      notes: 'Dispensed as prescribed.',
    });
    dispCreated += 1;
  }
  console.log(`[seed] Bulk: ${dispCreated} pharmacy dispenses created`);

  // ── Insurance providers (24) + claims from insurance/gov payments ──────
  const providerSeeds = [
    ['RSSB Government Scheme', 'government_scheme'],
    ['RAMA', 'private_insurance'],
    ['Mutuelle de Sante Kigali', 'government_scheme'],
    ['Inyange Insurance', 'private_insurance'],
    ['Sonarwa Health', 'private_insurance'],
    ['Saham Insurance', 'private_insurance'],
    ['Radiant Insurance', 'private_insurance'],
    ['Britam Health', 'private_insurance'],
    ['Prime Insurance', 'private_insurance'],
    ['Cormer Group', 'private_insurance'],
    ['UAP Insurance', 'private_insurance'],
    ['Sanlam Health', 'private_insurance'],
    ['Amita Insurance', 'private_insurance'],
    ['RSSB Contributors', 'government_scheme'],
    ['Military Health Scheme', 'government_scheme'],
    ['Police Medical Scheme', 'government_scheme'],
    ['University Health Plan', 'private_insurance'],
    ['Cooperatives Health Cover', 'private_insurance'],
    ['Mille Collines Assurance', 'private_insurance'],
    ['Villa Insurance', 'private_insurance'],
    ['Kigali Mutual', 'government_scheme'],
    ['Gicumbi Health Fund', 'government_scheme'],
    ['Huye Community Scheme', 'government_scheme'],
    ['East Africa Life Health', 'private_insurance'],
  ] as Array<[string, 'private_insurance' | 'government_scheme']>;
  const providerIds: any[] = [];
  let provCreated = 0;
  for (let i = 0; i < providerSeeds.length; i += 1) {
    const pname = providerSeeds[i][0];
    const pExists = await InsuranceProvider.exists({ name: pname });
    if (pExists) continue;
    const prov = await InsuranceProvider.create({
      name: pname,
      type: providerSeeds[i][1],
      contactInfo: { phone: `+250 78${String(400000 + i)}`, email: `claims${i + 1}@ins.demo` },
      claimSubmissionMethod: i % 3 === 0 ? 'api' : 'manual',
      isActive: true,
    });
    providerIds.push(prov._id);
    provCreated += 1;
  }
  // Reference an existing provider record for the seeded demo payments so
  // claim linking always has a provider id.
  const firstProvider = await InsuranceProvider.findOne({}).select('_id');
  const referenceProviderId = providerIds[0] ?? firstProvider?._id;
  console.log(`[seed] Bulk: ${provCreated} insurance providers created`);

  // ── Payments for the new patients' completed appointments ──────────────
  let payCreated = 0;
  const claimTargets: any[] = [];
  for (let i = 0; i < completedAppts.length; i += 1) {
    const appt = completedAppts[i];
    const pExists = await Payment.exists({ appointmentId: appt._id });
    if (pExists) continue;
    const consultation = 5000 + (i % 6) * 1500;
    const lab = i % 2 === 0 ? testsPool[i % testsPool.length].fee : 0;
    const pharmacy = i % 3 === 0 ? 3500 : 0;
    const tax = Math.round((consultation + lab + pharmacy) * 0.05);
    const method = i % 3 === 0 ? 'government_scheme' : 'insurance';
    const status = i % 7 === 1 ? 'Pending' : 'Paid';
    const pay = await Payment.create({
      appointmentId: appt._id,
      patientId: appt.patientId,
      facilityId: appt.facilityId,
      amount: consultation + lab + pharmacy + tax,
      breakdown: { consultationFee: consultation, labCharges: lab, pharmacyCharges: pharmacy, discount: 0, tax, schemeSubsidy: 0 },
      method,
      status,
      receiptNumber: `RCT-${String(94000 + i).padStart(5, '0')}`,
      paidAt: status === 'Paid' ? appt.completedAt ?? new Date() : undefined,
    });
    payCreated += 1;
    if (status === 'Paid') claimTargets.push(pay._id);
  }
  console.log(`[seed] Bulk: ${payCreated} patient payments created`);

  let claimCreated = 0;
  for (let i = 0; i < claimTargets.length; i += 1) {
    const cExists = await InsuranceClaim.exists({ paymentId: claimTargets[i] });
    if (cExists) continue;
    const pay = await Payment.findById(claimTargets[i]).select('amount createdAt');
    const providerId = referenceProviderId as any;
    const status = (['Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid'] as const)[i % 5];
    await InsuranceClaim.create({
      paymentId: claimTargets[i],
      providerId,
      claimAmount: pay?.amount ?? 0,
      status,
      submittedAt: pay?.createdAt ?? new Date(),
      resolvedAt: status === 'Under Review' || status === 'Approved' || status === 'Paid' ? new Date() : undefined,
      rejectionReason: status === 'Rejected' ? 'Documentation incomplete' : undefined,
    });
    claimCreated += 1;
  }
  console.log(`[seed] Bulk: ${claimCreated} insurance claims created`);

  // ── Audit log trail (24) ───────────────────────────────────────────────
  const auditActions = [
    ['CREATE', 'User'], ['UPDATE', 'Appointment'], ['PAYMENT', 'Payment'], ['CREATE', 'Prescription'],
    ['UPDATE', 'MedicalRecord'], ['LOGIN', 'Session'], ['CREATE', 'Department'], ['UPDATE', 'Doctor'],
    ['DISPENSE', 'PharmacyDispense'], ['CREATE', 'InsuranceClaim'], ['UPDATE', 'Inventory'], ['EXPORT', 'Report'],
  ];
  let auditCreated = 0;
  const auditActors = await User.find({ role: { $in: ['doctor', 'receptionist', 'pharmacist', 'facility_admin'] } }).select('_id role').limit(12);
  const auditSlot = await AuditLog.countDocuments();
  for (let i = auditSlot; i < 24; i += 1) {
    const actor = auditActors[i % Math.max(auditActors.length, 1)];
    const [action, entity] = auditActions[i % auditActions.length];
    const ts = new Date(Date.now() - (24 - i) * 3600 * 1000);
    await AuditLog.create({
      userId: actor?._id,
      role: actor?.role,
      action,
      entity,
      entityId: `seed-${i + 1}`,
      facilityId: facilities[i % facilities.length]?._id ?? demoFacility?._id,
      ipAddress: '10.0.0.42',
      userAgent: 'seed-demo',
      timestamp: ts,
    });
    auditCreated += 1;
  }
  console.log(`[seed] Bulk: ${auditCreated} audit logs created`);

  // ── Top-up messages/notifications for the demo patient → 25 each ───────
  if (demoDoctor) {
    const demoPatient = await Patient.findOne({ userId: (await User.findOne({ email: 'patient@has.demo' }))?._id });
    if (demoPatient) {
      const extraSubjects = [
        'Quarterly health newsletter',
        'Appointment reminder for this week',
        'Your bill summary is ready',
        'Lab results follow-up note',
        'Seasonal health advisory',
      ];
      const msgCount = await Message.countDocuments({ patientId: demoPatient._id });
      for (let i = msgCount; i < 25; i += 1) {
        await Message.create({
          facilityId: demoFacility?._id,
          patientId: demoPatient._id,
          senderName: i % 2 === 0 ? 'HAS Care Team' : 'Dr. Demo Doctor',
          subject: extraSubjects[i % extraSubjects.length],
          body: `Update #${i + 1}: our care team has prepared a new notice for your review.`,
          isRead: i % 3 === 0,
          readAt: i % 3 === 0 ? new Date() : undefined,
        });
      }
      console.log(`[seed] Bulk: messages topped up to 25 for demo patient`);

      const notifCount = await Notification.countDocuments({ patientId: demoPatient._id });
      for (let i = notifCount; i < 25; i += 1) {
        await Notification.create({
          facilityId: demoFacility?._id,
          patientId: demoPatient._id,
          type: (['appointment', 'general', 'billing', 'lab_result'] as const)[i % 4],
          title: `Update ${i + 1}`,
          body: `Notification update ${i + 1} about your recent visit.`,
          isRead: i % 3 === 1,
          readAt: i % 3 === 1 ? new Date() : undefined,
        });
      }
      console.log(`[seed] Bulk: notifications topped up to 25 for demo patient`);
    }
  }
}
