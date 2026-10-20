const bearerAuth = { bearerAuth: [] };

const schemas: Record<string, Record<string, unknown>> = {
  Facility: {
    type: 'object',
    required: ['name', 'type'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['hospital', 'clinic', 'health_center', 'district_office'] },
      region: { type: 'string' },
      district: { type: 'string' },
      address: { type: 'string' },
      contactInfo: { type: 'object', properties: { phone: { type: 'string' }, email: { type: 'string' } } },
      operatingHours: { type: 'string' },
      isActive: { type: 'boolean' },
    },
  },
  User: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      fullName: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      role: {
        type: 'string',
        enum: ['super_admin', 'facility_admin', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'insurance_verifier', 'auditor', 'patient'],
      },
      facilityId: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
    },
  },
  Department: {
    type: 'object',
    properties: {
      facilityId: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      defaultConsultationFee: { type: 'number' },
    },
  },
  Doctor: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      facilityId: { type: 'string' },
      departmentId: { type: 'array', items: { type: 'string' } },
      licenseNumber: { type: 'string' },
      specialization: { type: 'array', items: { type: 'string' } },
      consultationFee: { type: 'object', properties: { newVisit: { type: 'number' }, followUp: { type: 'number' } } },
    },
  },
  DoctorSchedule: {
    type: 'object',
    properties: {
      doctorId: { type: 'string' },
      dayOfWeek: { type: 'integer', minimum: 0, maximum: 6 },
      startTime: { type: 'string', example: '09:00' },
      endTime: { type: 'string', example: '17:00' },
      breakStart: { type: 'string', example: '13:00' },
      breakEnd: { type: 'string', example: '14:00' },
      slotDurationMinutes: { type: 'integer', default: 15 },
      maxPatientsPerSlot: { type: 'integer', default: 1 },
    },
  },
  Patient: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      patientNumber: { type: 'string' },
      nationalHealthId: { type: 'string' },
      dob: { type: 'string', format: 'date-time' },
      gender: { type: 'string', enum: ['male', 'female', 'other'] },
      allergies: { type: 'array', items: { type: 'string' } },
      chronicConditions: { type: 'array', items: { type: 'string' } },
    },
  },
  Appointment: {
    type: 'object',
    properties: {
      facilityId: { type: 'string' },
      patientId: { type: 'string' },
      doctorId: { type: 'string' },
      departmentId: { type: 'string' },
      appointmentDate: { type: 'string', format: 'date-time' },
      timeSlot: { type: 'string', example: '09:00' },
      visitType: { type: 'string', enum: ['new', 'follow-up', 'referral'] },
      bookingChannel: { type: 'string', enum: ['web', 'mobile', 'sms', 'ussd', 'walk_in', 'referral'] },
      status: { type: 'string', enum: ['Pending', 'Confirmed', 'Checked In', 'In Progress', 'Completed', 'Cancelled', 'Missed', 'Rejected'] },
      queueNumber: { type: 'number' },
    },
  },
  AvailableSlot: {
    type: 'object',
    properties: {
      time: { type: 'string', example: '09:00' },
      label: { type: 'string' },
      capacity: { type: 'number' },
      available: { type: 'number' },
    },
  },
  AuthTokens: {
    type: 'object',
    properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' } },
  },
  Error: {
    type: 'object',
    properties: { success: { type: 'boolean', example: false }, error: { type: 'string' } },
  },
  // ── Phase 2: Clinical ────────────────────────────────────────────────────
  Vitals: {
    type: 'object',
    properties: {
      bloodPressure: { type: 'string', example: '120/80' },
      temperature: { type: 'number', example: 36.6 },
      weight: { type: 'number', example: 70 },
      height: { type: 'number', example: 175 },
      pulse: { type: 'number', example: 72 },
      oxygenSaturation: { type: 'number', example: 98 },
    },
  },
  MedicalRecord: {
    type: 'object',
    required: ['appointmentId', 'diagnosis'],
    properties: {
      _id: { type: 'string' },
      patientId: { type: 'string' },
      doctorId: { type: 'string' },
      appointmentId: { type: 'string' },
      facilityId: { type: 'string' },
      vitals: { $ref: '#/components/schemas/Vitals' },
      symptoms: { type: 'array', items: { type: 'string' } },
      diagnosis: { type: 'string' },
      treatment: { type: 'string' },
      notes: { type: 'string' },
      followUpDate: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  PrescriptionMedicine: {
    type: 'object',
    required: ['name', 'dosage', 'frequency', 'durationDays'],
    properties: {
      name: { type: 'string' },
      dosage: { type: 'string', example: '500mg' },
      frequency: { type: 'string', example: 'Twice daily' },
      durationDays: { type: 'integer', example: 7 },
      instructions: { type: 'string' },
    },
  },
  Prescription: {
    type: 'object',
    required: ['medicalRecordId', 'medicines'],
    properties: {
      _id: { type: 'string' },
      medicalRecordId: { type: 'string' },
      patientId: { type: 'string' },
      doctorId: { type: 'string' },
      facilityId: { type: 'string' },
      medicines: { type: 'array', items: { $ref: '#/components/schemas/PrescriptionMedicine' } },
      instructions: { type: 'string' },
      issuedAt: { type: 'string', format: 'date-time' },
      allergyWarnings: { type: 'array', items: { type: 'string' }, description: 'Populated on creation if any medicine conflicts with patient allergies' },
    },
  },
  LaboratoryTest: {
    type: 'object',
    required: ['appointmentId', 'testName'],
    properties: {
      _id: { type: 'string' },
      appointmentId: { type: 'string' },
      medicalRecordId: { type: 'string', nullable: true },
      facilityId: { type: 'string' },
      patientId: { type: 'string' },
      requestedBy: { type: 'string' },
      testName: { type: 'string' },
      fee: { type: 'number', description: 'Price of the test, used for itemized billing' },
      result: { type: 'string' },
      resultFileUrl: { type: 'string' },
      referenceRange: { type: 'string' },
      isAbnormal: { type: 'boolean' },
      status: { type: 'string', enum: ['Requested', 'In Progress', 'Completed'] },
      requestedAt: { type: 'string', format: 'date-time' },
      completedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  Payment: {
    type: 'object',
    required: ['appointmentId', 'patientId', 'facilityId', 'amount', 'method'],
    properties: {
      _id: { type: 'string' },
      appointmentId: { type: 'string' },
      patientId: { type: 'string' },
      facilityId: { type: 'string' },
      amount: { type: 'number', example: 5000 },
      breakdown: {
        type: 'object',
        properties: {
          consultationFee: { type: 'number' },
          labCharges: { type: 'number' },
          pharmacyCharges: { type: 'number' },
          discount: { type: 'number' },
          tax: { type: 'number' },
          schemeSubsidy: { type: 'number' },
        },
      },
      method: { type: 'string', enum: ['cash', 'card', 'online', 'insurance', 'government_scheme'] },
      status: { type: 'string', enum: ['Pending', 'Partially Paid', 'Paid', 'Refunded', 'Failed'] },
      receiptNumber: { type: 'string', example: 'RCPT-000001' },
      paidAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  InsuranceProvider: {
    type: 'object',
    required: ['name', 'type'],
    properties: {
      _id: { type: 'string' },
      name: { type: 'string' },
      type: { type: 'string', enum: ['private_insurance', 'government_scheme'] },
      contactInfo: { type: 'object', properties: { phone: { type: 'string' }, email: { type: 'string' } } },
      claimSubmissionMethod: { type: 'string', enum: ['api', 'manual'] },
      isActive: { type: 'boolean' },
    },
  },
  InsuranceClaim: {
    type: 'object',
    required: ['paymentId', 'providerId', 'claimAmount'],
    properties: {
      _id: { type: 'string' },
      paymentId: { type: 'string' },
      providerId: { type: 'string' },
      claimAmount: { type: 'number' },
      status: { type: 'string', enum: ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid'] },
      submittedAt: { type: 'string', format: 'date-time' },
      resolvedAt: { type: 'string', format: 'date-time', nullable: true },
      rejectionReason: { type: 'string', nullable: true },
    },
  },
};

function idParam(name = 'id') {
  return [{ name, in: 'path', required: true, schema: { type: 'string' } }];
}

function json200(desc: string, schema?: Record<string, unknown>): Record<string, unknown> {
  return {
    200: {
      description: desc,
      content: schema ? { 'application/json': { schema } } : undefined,
    },
  };
}

const paths: Record<string, Record<string, unknown>> = {
  '/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Register a patient account',
      security: [],
      responses: { '201': { description: 'User created' }, '409': { description: 'Duplicate user' } },
    },
  },
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Log in with email + password',
      security: [],
      responses: { '200': { description: 'Tokens + user' }, '401': { description: 'Invalid credentials' } },
    },
  },
  '/auth/login/national-id': {
    post: { tags: ['Auth'], summary: 'Log in with national ID + password', security: [], responses: json200('Tokens + user') },
  },
  '/auth/otp/request': {
    post: { tags: ['Auth'], summary: 'Request a one-time passcode', security: [], responses: json200('OTP dispatched') },
  },
  '/auth/otp/verify': {
    post: { tags: ['Auth'], summary: 'Verify OTP and log in', security: [], responses: json200('Tokens + user') },
  },
  '/auth/refresh': {
    post: { tags: ['Auth'], summary: 'Exchange a refresh token for a new token pair', security: [], responses: json200('New token pair') },
  },
  '/auth/logout': {
    post: { tags: ['Auth'], summary: 'Revoke the given refresh token', security: [], responses: json200('Logged out') },
  },
  '/auth/forgot-password': {
    post: { tags: ['Auth'], summary: 'Request a password-reset OTP', security: [], responses: json200('OTP dispatched') },
  },
  '/auth/reset-password': {
    post: { tags: ['Auth'], summary: 'Reset password with email + OTP', security: [], responses: json200('Password reset') },
  },
  '/facilities': {
    get: {
      tags: ['Facilities'],
      summary: 'List facilities',
      security: [bearerAuth],
      responses: json200('Paginated facilities'),
    },
    post: {
      tags: ['Facilities'],
      summary: 'Create a facility (super_admin)',
      security: [bearerAuth],
      responses: { '201': { description: 'Facility created' } },
    },
  },
  '/facilities/{id}': {
    get: { tags: ['Facilities'], summary: 'Get a facility', security: [bearerAuth], parameters: idParam(), responses: json200('Facility') },
    put: { tags: ['Facilities'], summary: 'Update a facility (super_admin)', security: [bearerAuth], parameters: idParam(), responses: json200('Updated facility') },
    delete: { tags: ['Facilities'], summary: 'Delete a facility (super_admin)', security: [bearerAuth], parameters: idParam(), responses: json200('Facility deleted') },
  },
  '/facilities/{id}/deactivate': {
    patch: { tags: ['Facilities'], summary: 'Deactivate a facility (super_admin)', security: [bearerAuth], responses: json200('Facility deactivated') },
  },
  '/users': {
    get: { tags: ['Users'], summary: 'List users (facility_admin+)', security: [bearerAuth], responses: json200('Paginated users') },
    post: { tags: ['Users'], summary: 'Create a staff user (facility_admin+)', security: [bearerAuth], responses: { '201': { description: 'User created' } } },
  },
  '/users/{id}': {
    get: { tags: ['Users'], summary: 'Get a user', security: [bearerAuth], parameters: idParam(), responses: json200('User') },
    put: { tags: ['Users'], summary: 'Update a user (facility_admin+)', security: [bearerAuth], parameters: idParam(), responses: json200('Updated user') },
    delete: { tags: ['Users'], summary: 'Deactivate a user (facility_admin+)', security: [bearerAuth], parameters: idParam(), responses: json200('User deactivated') },
  },
  '/departments': {
    get: { tags: ['Departments'], summary: 'List departments (facility-scoped)', security: [bearerAuth], responses: json200('Paginated departments') },
    post: { tags: ['Departments'], summary: 'Create a department (facility_admin+)', security: [bearerAuth], responses: { '201': { description: 'Department created' } } },
  },
  '/departments/{id}': {
    get: { tags: ['Departments'], summary: 'Get a department', security: [bearerAuth], parameters: idParam(), responses: json200('Department') },
    put: { tags: ['Departments'], summary: 'Update a department (facility_admin+)', security: [bearerAuth], parameters: idParam(), responses: json200('Updated department') },
    delete: { tags: ['Departments'], summary: 'Delete a department (facility_admin+)', security: [bearerAuth], parameters: idParam(), responses: json200('Department deleted') },
  },
  '/doctors': {
    get: { tags: ['Doctors'], summary: 'List doctors (facility-scoped)', security: [bearerAuth], responses: json200('Paginated doctors') },
    post: { tags: ['Doctors'], summary: 'Create a doctor profile (facility_admin+)', security: [bearerAuth], responses: { '201': { description: 'Doctor created' } } },
  },
  '/doctors/{id}': {
    get: { tags: ['Doctors'], summary: 'Get a doctor', security: [bearerAuth], parameters: idParam(), responses: json200('Doctor') },
    put: { tags: ['Doctors'], summary: 'Update a doctor (facility_admin or doctor self)', security: [bearerAuth], parameters: idParam(), responses: json200('Updated doctor') },
  },
  '/doctors/{id}/schedule': {
    get: { tags: ['Doctors'], summary: 'Get a doctor weekly schedule', security: [bearerAuth], parameters: idParam(), responses: json200('Schedule entries') },
    post: { tags: ['Doctors'], summary: 'Create/update a schedule entry', security: [bearerAuth], parameters: idParam(), responses: json200('Schedule entry upserted') },
  },
  '/doctors/{id}/availability': {
    get: {
      tags: ['Doctors'],
      summary: 'Get available slots for a doctor on a date',
      security: [bearerAuth],
      parameters: [
        ...idParam(),
        { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
      ],
      responses: { 200: { description: 'Available slots', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AvailableSlot' } } } } } },
    },
  },
  '/doctors/{id}/schedule/{scheduleId}': {
    delete: { tags: ['Doctors'], summary: 'Delete a schedule entry', security: [bearerAuth], responses: json200('Schedule entry deleted') },
  },
  '/doctors/{id}/leaves': {
    post: { tags: ['Doctors'], summary: 'Create a leave entry', security: [bearerAuth], parameters: idParam(), responses: { '201': { description: 'Leave created' } } },
  },
  '/doctors/{id}/leaves/{leaveId}': {
    delete: { tags: ['Doctors'], summary: 'Delete a leave entry', security: [bearerAuth], responses: json200('Leave deleted') },
  },
  '/patients': {
    get: { tags: ['Patients'], summary: 'List patients (staff only)', security: [bearerAuth], responses: json200('Paginated patients') },
    post: { tags: ['Patients'], summary: 'Register a new patient', security: [bearerAuth], responses: { '201': { description: 'Patient created' } } },
  },
  '/patients/lookup': {
    get: {
      tags: ['Patients'],
      summary: 'Look up a patient by national ID',
      security: [bearerAuth],
      parameters: [{ name: 'nationalId', in: 'query', required: true, schema: { type: 'string' } }],
      responses: json200('Patient found'),
    },
  },
  '/patients/{id}': {
    get: { tags: ['Patients'], summary: 'Get a patient', security: [bearerAuth], parameters: idParam(), responses: json200('Patient') },
    put: { tags: ['Patients'], summary: 'Update a patient', security: [bearerAuth], parameters: idParam(), responses: json200('Updated patient') },
  },
  '/appointments': {
    get: { tags: ['Appointments'], summary: 'List appointments (role-scoped)', security: [bearerAuth], responses: json200('Paginated appointments') },
    post: {
      tags: ['Appointments'],
      summary: 'Book an appointment (slot + conflict checking)',
      security: [bearerAuth],
      responses: { '201': { description: 'Appointment created' }, '409': { description: 'Slot already booked' } },
    },
  },
  '/appointments/sms': {
    post: { tags: ['Appointments'], summary: 'SMS/USSD gateway webhook (Phase 1 acknowledgement)', security: [], responses: json200('Received') },
  },
  '/appointments/{id}': {
    get: { tags: ['Appointments'], summary: 'Get an appointment', security: [bearerAuth], parameters: idParam(), responses: json200('Appointment') },
    put: { tags: ['Appointments'], summary: 'Reschedule/update an appointment', security: [bearerAuth], parameters: idParam(), responses: json200('Updated appointment') },
    delete: { tags: ['Appointments'], summary: 'Cancel an appointment', security: [bearerAuth], parameters: idParam(), responses: json200('Appointment cancelled') },
  },
  '/appointments/{id}/status': {
    patch: {
      tags: ['Appointments'],
      summary: 'Transition appointment status',
      security: [bearerAuth],
      parameters: idParam(),
      responses: json200('Status updated'),
    },
  },
  '/appointments/{id}/check-in': {
    post: { tags: ['Appointments'], summary: 'Check in an appointment (receptionist)', security: [bearerAuth], parameters: idParam(), responses: json200('Checked in') },
  },
  // ── Phase 2: Medical Records ─────────────────────────────────────────────
  '/medical-records': {
    post: {
      tags: ['Medical Records'],
      summary: 'Create a consultation / medical record (doctor)',
      security: [bearerAuth],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/MedicalRecord' } } },
      },
      responses: { '201': { description: 'Medical record created' }, '409': { description: 'Record already exists for this appointment' } },
    },
  },
  '/medical-records/{patientId}': {
    get: {
      tags: ['Medical Records'],
      summary: 'List all medical records for a patient',
      security: [bearerAuth],
      parameters: [
        ...idParam('patientId'),
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: json200('Paginated medical records'),
    },
  },
  '/medical-records/by-appointment/{appointmentId}': {
    get: {
      tags: ['Medical Records'],
      summary: 'Get the medical record for a specific appointment',
      security: [bearerAuth],
      parameters: idParam('appointmentId'),
      responses: json200('Medical record'),
    },
  },
  '/medical-records/{id}': {
    put: {
      tags: ['Medical Records'],
      summary: 'Update a medical record (doctor who created it, or admin)',
      security: [bearerAuth],
      parameters: idParam(),
      responses: json200('Updated medical record'),
    },
  },
  // ── Phase 2: Prescriptions ───────────────────────────────────────────────
  '/prescriptions': {
    post: {
      tags: ['Prescriptions'],
      summary: 'Create a prescription with allergy checking (doctor)',
      security: [bearerAuth],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Prescription' } } },
      },
      responses: {
        '201': { description: 'Prescription created — response includes allergyWarnings[]' },
        '409': { description: 'Prescription already exists for this record' },
      },
    },
    get: {
      tags: ['Prescriptions'],
      summary: 'List prescriptions (role-scoped)',
      security: [bearerAuth],
      responses: json200('Paginated prescriptions'),
    },
  },
  '/prescriptions/{id}': {
    get: {
      tags: ['Prescriptions'],
      summary: 'Get a prescription',
      security: [bearerAuth],
      parameters: idParam(),
      responses: json200('Prescription'),
    },
  },
  '/prescriptions/{id}/pdf': {
    get: {
      tags: ['Prescriptions'],
      summary: 'Download prescription as printable HTML (print-to-PDF)',
      security: [bearerAuth],
      parameters: idParam(),
      responses: { '200': { description: 'HTML document', content: { 'text/html': {} } } },
    },
  },
  // ── Phase 2: Laboratory Tests ────────────────────────────────────────────
  '/lab-tests': {
    post: {
      tags: ['Lab Tests'],
      summary: 'Request a lab test (doctor)',
      security: [bearerAuth],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/LaboratoryTest' } } },
      },
      responses: { '201': { description: 'Lab test requested' } },
    },
    get: {
      tags: ['Lab Tests'],
      summary: 'List lab tests (role-scoped)',
      security: [bearerAuth],
      responses: json200('Paginated lab tests'),
    },
  },
  '/lab-tests/{id}': {
    get: {
      tags: ['Lab Tests'],
      summary: 'Get a lab test',
      security: [bearerAuth],
      parameters: idParam(),
      responses: json200('Lab test'),
    },
    put: {
      tags: ['Lab Tests'],
      summary: 'Update test result / status (lab_technician)',
      security: [bearerAuth],
      parameters: idParam(),
      responses: json200('Updated lab test'),
    },
  },
  '/payments': {
    post: {
      tags: ['Payments'],
      summary: 'Create a payment; the itemized bill auto-generates from the appointment (receptionist, insurance_verifier, facility_admin)',
      security: [bearerAuth],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['appointmentId', 'method'],
              properties: {
                appointmentId: { type: 'string' },
                method: { type: 'string', enum: ['cash', 'card', 'online', 'insurance', 'government_scheme'] },
                discount: { type: 'number' },
                tax: { type: 'number' },
                schemeSubsidy: { type: 'number' },
              },
            },
          },
        },
      },
      responses: { '201': { description: 'Payment created with receipt' } },
    },
    get: {
      tags: ['Payments'],
      summary: 'List payments (staff/super_admin) with filters',
      security: [bearerAuth],
      responses: json200('Paginated payments'),
    },
  },
  '/payments/{id}': {
    get: {
      tags: ['Payments'],
      summary: 'Get a payment',
      security: [bearerAuth],
      parameters: idParam(),
      responses: json200('Payment'),
    },
  },
  '/payments/patient/{patientId}': {
    get: {
      tags: ['Payments'],
      summary: 'List a patient\'s payments',
      security: [bearerAuth],
      parameters: [{ name: 'patientId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: json200('Paginated payments'),
    },
  },
  '/payments/{id}/receipt': {
    post: {
      tags: ['Payments'],
      summary: 'Issue/regenerate the printable receipt',
      security: [bearerAuth],
      parameters: idParam(),
      responses: json200('Receipt'),
    },
  },
  '/insurance-providers': {
    get: {
      tags: ['Claims'],
      summary: 'List insurance providers / government schemes',
      security: [bearerAuth],
      responses: json200('Providers'),
    },
    post: {
      tags: ['Claims'],
      summary: 'Register an insurance provider (super_admin)',
      security: [bearerAuth],
      responses: { '201': { description: 'Provider created' } },
    },
  },
  '/claims': {
    post: {
      tags: ['Claims'],
      summary: 'Submit an insurance/government-scheme claim (insurance_verifier, receptionist, facility_admin)',
      security: [bearerAuth],
      responses: { '201': { description: 'Claim created' } },
    },
  },
  '/claims/reconciliation': {
    get: {
      tags: ['Claims'],
      summary: 'Claim reconciliation report for facility administrators and verifiers',
      security: [bearerAuth],
      responses: json200('Reconciliation rows'),
    },
  },
  '/claims/{id}': {
    get: {
      tags: ['Claims'],
      summary: 'Get a claim',
      security: [bearerAuth],
      parameters: idParam(),
      responses: json200('Claim'),
    },
  },
  '/claims/{id}/status': {
    patch: {
      tags: ['Claims'],
      summary: 'Advance a claim through its lifecycle (insurance_verifier, facility_admin)',
      security: [bearerAuth],
      parameters: idParam(),
      responses: json200('Updated claim'),
    },
  },
};

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Hospital Appointment & Health Records System (HAS) API',
    version: '2.0.0',
    description:
      'Phase 1 — Core: Authentication, Facilities, Users & Roles, Departments, Doctors, ' +
      'Schedules, Patients and Appointments with slot generation and conflict detection. ' +
      'Phase 2 — Clinical: Medical Records, Prescriptions (with allergy warnings + PDF), ' +
      'and Laboratory Tests with status state machine. ' +
      'Phase 3 — Pharmacy: Inventory, dispensing and write-offs. ' +
      'Phase 4 — Financial: itemized billing & payments, receipts, insurance providers and claims.',
  },
  servers: [{ url: '/api', description: 'HAS API' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas,
  },
  paths,
};
