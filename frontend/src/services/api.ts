import { client } from './client';

export { getErrorMessage } from './client';
export default client;

export interface Facility {
  _id: string;
  name: string;
  type: 'hospital' | 'clinic' | 'health_center' | 'district_office';
  region?: string;
  district?: string;
  address?: string;
  operatingHours?: string;
  contactInfo?: { phone?: string; email?: string };
  logo?: string;
  isActive: boolean;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionExpiresAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'expired';

/** Returned once by the onboarding call, and never retrievable afterwards. */
export interface FacilityOnboardingResult {
  facility: Facility;
  admin: { id: string; fullName: string; email: string; role: string };
  temporaryPassword: string;
  mustChangePassword: true;
}

export interface Department {
  _id: string;
  facilityId: string;
  name: string;
  description?: string;
  defaultConsultationFee?: number;
  contactInfo?: { phone?: string; email?: string };
}

export interface Doctor {
  _id: string;
  userId:
    | {
        _id: string;
        fullName: string;
        email?: string;
        phone?: string;
        status?: string;
        profileImageUrl?: string;
        nationalId?: string;
      }
    | string;
  facilityId: string;
  departmentId: { _id: string; name: string }[] | string[];
  specialization: string[];
  licenseNumber?: string;
  experienceYears?: number;
  consultationFee?: { newVisit?: number; followUp?: number };
  rating?: number;
  bio?: string;
}

export interface AvailableSlot {
  time: string;
  label: string;
  capacity: number;
  available: number;
}

export interface DoctorScheduleEntry {
  _id: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
  slotDurationMinutes: number;
  maxPatientsPerSlot: number;
  isActive: boolean;
}

export interface Patient {
  _id: string;
  userId:
    | {
        _id: string;
        fullName: string;
        email: string;
        phone?: string;
        nationalId?: string;
        status?: string;
        profileImageUrl?: string;
      }
    | string;
  patientNumber: string;
  gender?: string;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContact?: { name?: string; relation?: string; phone?: string };
  insurance?: { provider?: string; policyNumber?: string; coverageType?: string; validTill?: string };
  governmentScheme?: { schemeName?: string; beneficiaryNumber?: string; indigentStatus?: boolean };
  dob?: string;
  bloodGroup?: string;
}

export interface Appointment {
  _id: string;
  facilityId: string;
  patientId:
    | { _id: string; patientNumber: string; userId?: { fullName: string; phone?: string } }
    | string;
  doctorId: { _id: string; specialization?: string[]; userId?: { fullName: string } } | string;
  departmentId: { _id: string; name: string } | string;
  appointmentDate: string;
  timeSlot: string;
  reason?: string;
  visitType: string;
  status: string;
  queueNumber?: number;
  checkInTime?: string;
  completedAt?: string;
}

export async function listFacilities(): Promise<Facility[]> {
  const res = await client.get('/facilities');
  return res.data.data as Facility[];
}

export interface StaffUser {
  _id: string;
  fullName: string;
  email?: string;
  phone?: string;
  nationalId?: string;
  role: string;
  facilityId?: string | null;
  status?: string;
  profileImageUrl?: string;
}

export async function listUsers(): Promise<StaffUser[]> {
  const res = await client.get('/users');
  return res.data.data as StaffUser[];
}

export async function createStaffUser(payload: {
  fullName: string;
  email: string;
  phone?: string;
  nationalId?: string;
  password: string;
  role: string;
  facilityId?: string;
}): Promise<StaffUser> {
  const res = await client.post('/users', payload);
  return res.data.data as StaffUser;
}

export async function createFacility(payload: Partial<Facility>): Promise<Facility> {
  const res = await client.post('/facilities', payload);
  return res.data.data as Facility;
}

export async function deactivateFacility(id: string) {
  await client.patch(`/facilities/${id}/deactivate`);
}

export async function listDepartments(): Promise<Department[]> {
  const res = await client.get('/departments');
  return res.data.data as Department[];
}

export async function createDepartment(payload: {
  name: string;
  description?: string;
  defaultConsultationFee?: number;
}) {
  const res = await client.post('/departments', payload);
  return res.data.data as Department;
}

export async function listDoctors(): Promise<Doctor[]> {
  const res = await client.get('/doctors');
  return res.data.data as Doctor[];
}

export interface FacilityStats {
  totalDoctors: number;
  activeDepartments: number;
  todayAppointments: number;
  staffCount: number;
  patientRegistrations: number;
}

export async function listFacilityStaff(facilityId: string): Promise<StaffUser[]> {
  const res = await client.get(`/facilities/${facilityId}/staff`);
  return res.data.data as StaffUser[];
}

export async function listFacilityDepartments(facilityId: string): Promise<Department[]> {
  const res = await client.get(`/facilities/${facilityId}/departments`);
  return res.data.data as Department[];
}

export async function listFacilityDoctors(facilityId: string): Promise<Doctor[]> {
  const res = await client.get(`/facilities/${facilityId}/doctors`);
  return res.data.data as Doctor[];
}

export async function getFacilityStats(facilityId: string): Promise<FacilityStats> {
  const res = await client.get(`/facilities/${facilityId}/stats`);
  return res.data.data as FacilityStats;
}

export async function createDoctorProfile(payload: {
  userId: string;
  departmentId: string[];
  licenseNumber?: string;
  specialization?: string[];
}) {
  const res = await client.post('/doctors', payload);
  return res.data.data as Doctor;
}

export async function updateDoctorProfile(id: string, payload: {
  departmentId?: string[];
  licenseNumber?: string;
  specialization?: string[];
  qualification?: string[];
  experienceYears?: number;
  consultationFee?: { newVisit?: number; followUp?: number };
  bio?: string;
}): Promise<Doctor> {
  const res = await client.put(`/doctors/${id}`, payload);
  return res.data.data as Doctor;
}

export async function deleteDoctorProfile(id: string): Promise<void> {
  await client.delete(`/doctors/${id}`);
}

export async function updateDepartment(id: string, payload: {
  name?: string;
  description?: string;
  defaultConsultationFee?: number;
  contactInfo?: { phone?: string; email?: string };
}): Promise<Department> {
  const res = await client.put(`/departments/${id}`, payload);
  return res.data.data as Department;
}

export async function deleteDepartment(id: string): Promise<void> {
  await client.delete(`/departments/${id}`);
}

export async function updateUser(id: string, payload: Partial<StaffUser>): Promise<StaffUser> {
  const res = await client.put(`/users/${id}`, payload);
  return res.data.data as StaffUser;
}

export async function deleteUser(id: string): Promise<void> {
  await client.delete(`/users/${id}`);
}

export async function updatePatientRecord(id: string, payload: {
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContact?: { name?: string; relation?: string; phone?: string };
}): Promise<Patient> {
  const res = await client.put(`/patients/${id}`, payload);
  return res.data.data as Patient;
}

export async function deletePatient(id: string): Promise<void> {
  await client.delete(`/patients/${id}`);
}

export async function getMyDoctorProfile(): Promise<Doctor> {
  const res = await client.get('/doctors/mine');
  return res.data.data as Doctor;
}

export async function getDoctorSchedule(doctorId: string): Promise<DoctorScheduleEntry[]> {
  const res = await client.get(`/doctors/${doctorId}/schedule`);
  return res.data.data as DoctorScheduleEntry[];
}

export async function upsertSchedule(doctorId: string, payload: Partial<DoctorScheduleEntry>) {
  const res = await client.post(`/doctors/${doctorId}/schedule`, payload);
  return res.data.data as DoctorScheduleEntry;
}

export async function deleteSchedule(doctorId: string, scheduleId: string): Promise<void> {
  await client.delete(`/doctors/${doctorId}/schedule/${scheduleId}`);
}

export async function getAvailability(doctorId: string, date: string): Promise<AvailableSlot[]> {
  const res = await client.get(`/doctors/${doctorId}/availability`, { params: { date } });
  return res.data.data.slots as AvailableSlot[];
}

export async function listPatients(search?: string): Promise<Patient[]> {
  const res = await client.get('/patients', { params: search ? { search } : {} });
  return res.data.data as Patient[];
}

export async function getPatient(id: string): Promise<Patient> {
  const res = await client.get(`/patients/${id}`);
  return res.data.data as Patient;
}

export async function registerPatient(payload: Record<string, unknown>): Promise<Patient> {
  const res = await client.post('/patients', payload);
  return res.data.data as Patient;
}

/**
 * A patient's membership of one hospital.
 *
 * `facilityId` comes back populated with the hospital's public details. `derivedFromPatientFacilityId`
 * marks an entry synthesised from the patient's home hospital because no membership row exists
 * for it yet, so the UI can avoid implying the patient actively registered there.
 */
export interface PatientFacilityMembership {
  _id?: string;
  patientId: string;
  facilityId: string | Facility;
  status: 'active' | 'inactive';
  isPrimary: boolean;
  registeredAt: string | null;
  endedAt?: string | null;
  derivedFromPatientFacilityId?: boolean;
}

export function facilityIdOf(membership: PatientFacilityMembership): string {
  const value = membership.facilityId;
  return typeof value === 'string' ? value : value._id;
}

/** The signed-in patient's own hospitals. */
export async function listMyFacilities(): Promise<PatientFacilityMembership[]> {
  const res = await client.get('/patients/me/facilities');
  return res.data.data as PatientFacilityMembership[];
}

/** Every hospital a patient belongs to, for staff who already treat them. */
export async function listPatientFacilities(patientId: string): Promise<PatientFacilityMembership[]> {
  const res = await client.get(`/patients/${patientId}/facilities`);
  return res.data.data as PatientFacilityMembership[];
}

/**
 * Registers a patient at the caller's own hospital.
 *
 * Takes no facility argument on purpose: the backend always uses the caller's tenant, so this
 * cannot be aimed at a different hospital.
 */
export async function registerPatientAtFacility(patientId: string): Promise<PatientFacilityMembership[]> {
  const res = await client.post(`/patients/${patientId}/facilities`);
  return res.data.data as PatientFacilityMembership[];
}

/** Ends the caller's own hospital's membership of a patient. */
export async function endPatientFacility(patientId: string): Promise<PatientFacilityMembership[]> {
  const res = await client.delete(`/patients/${patientId}/facilities`);
  return res.data.data as PatientFacilityMembership[];
}

export async function listAppointments(params?: Record<string, unknown>): Promise<Appointment[]> {
  const res = await client.get('/appointments', { params });
  return res.data.data as Appointment[];
}

/**
 * Server-paginated appointments. The portal tabs map to server filters rather than client-side
 * filtering, so page counts and rows stay consistent.
 */
export async function listAppointmentsPage(
  params?: Record<string, unknown>,
): Promise<Page<Appointment>> {
  return fetchPage<Appointment>('/appointments', params);
}

export async function listPrescriptionsPage(
  params?: Record<string, unknown>,
): Promise<Page<Prescription>> {
  return fetchPage<Prescription>('/prescriptions', params);
}

export async function listLabTestsPage(
  params?: Record<string, unknown>,
): Promise<Page<LaboratoryTest>> {
  return fetchPage<LaboratoryTest>('/lab-tests', params);
}

export async function listNotificationsPage(
  params?: Record<string, unknown>,
): Promise<Page<Notification>> {
  return fetchPage<Notification>('/notifications', params);
}

export async function listPatientDocumentsPage(
  params?: Record<string, unknown>,
): Promise<Page<PatientDocument>> {
  return fetchPage<PatientDocument>('/patient-documents', params);
}

export async function listMyPaymentsPage(
  params?: Record<string, unknown>,
): Promise<Page<Payment>> {
  return fetchPage<Payment>('/payments/me', params);
}

export async function bookAppointment(payload: {
  doctorId: string;
  departmentId: string;
  appointmentDate: string;
  timeSlot: string;
  reason?: string;
  visitType?: string;
  bookingChannel?: string;
  patientId?: string;
  facilityId?: string;
}): Promise<Appointment> {
  const res = await client.post('/appointments', payload);
  return res.data.data as Appointment;
}

export async function checkInAppointment(id: string) {
  const res = await client.post(`/appointments/${id}/check-in`);
  return res.data.data as Appointment;
}

export async function updateAppointmentStatus(id: string, status: string, cancellationReason?: string) {
  const res = await client.patch(`/appointments/${id}/status`, { status, cancellationReason });
  return res.data.data as Appointment;
}

export async function cancelAppointment(id: string, cancellationReason?: string) {
  const res = await client.delete(`/appointments/${id}`, { data: { cancellationReason } });
  return res.data.data as Appointment;
}

// ── Phase 2: Clinical ────────────────────────────────────────────────────────

export interface Vitals {
  bloodPressure?: string;
  temperature?: number;
  weight?: number;
  height?: number;
  pulse?: number;
  oxygenSaturation?: number;
}

export interface MedicalRecord {
  _id: string;
  patientId: string | { _id: string; patientNumber: string; userId?: { fullName: string; phone?: string }; allergies?: string[] };
  doctorId: string | { _id: string; specialization?: string[]; userId?: { fullName: string } };
  appointmentId: string | { _id: string; appointmentDate: string; timeSlot: string; visitType: string; status: string };
  facilityId: string;
  vitals?: Vitals;
  symptoms: string[];
  diagnosis: string;
  treatment?: string;
  notes?: string;
  followUpDate?: string;
  createdAt: string;
}

export interface PrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
}

export interface Prescription {
  _id: string;
  medicalRecordId: string;
  patientId: string | { _id: string; patientNumber: string; userId?: { fullName: string } };
  doctorId: string | { _id: string; userId?: { fullName: string } };
  facilityId: string | { _id: string; name: string };
  medicines: PrescriptionMedicine[];
  instructions?: string;
  issuedAt: string;
}

export interface LaboratoryTest {
  _id: string;
  appointmentId: string | { _id: string; appointmentDate: string; timeSlot: string };
  medicalRecordId?: string | null;
  facilityId: string;
  patientId: string | { _id: string; patientNumber: string; userId?: { fullName: string } };
  requestedBy: string | { _id: string; userId?: { fullName: string } };
  testName: string;
  result?: string;
  resultFileUrl?: string;
  referenceRange?: string;
  isAbnormal: boolean;
  status: 'Requested' | 'In Progress' | 'Completed';
  requestedAt: string;
  completedAt?: string;
}

// Medical Records
export async function createMedicalRecord(payload: {
  appointmentId: string;
  vitals?: Vitals;
  symptoms?: string[];
  diagnosis: string;
  treatment?: string;
  notes?: string;
  followUpDate?: string;
}): Promise<MedicalRecord> {
  const res = await client.post('/medical-records', payload);
  return res.data.data as MedicalRecord;
}

export async function getPatientMedicalRecords(patientId: string, params?: Record<string, unknown>): Promise<MedicalRecord[]> {
  const res = await client.get(`/medical-records/${patientId}`, { params });
  return res.data.data as MedicalRecord[];
}

export interface TimelineEntry {
  id: string;
  type: 'record' | 'prescription' | 'lab';
  date: string;
  title: string;
  status?: string | null;
  appointmentId?: string | null;
  doctorName?: string | null;
  facilityName?: string | null;
  payload: Record<string, unknown>;
}

export async function getPatientTimelinePage(
  patientId: string,
  params?: Record<string, unknown>,
): Promise<Page<TimelineEntry>> {
  return fetchPage<TimelineEntry>(`/medical-records/${patientId}/timeline`, params);
}

export async function getRecordByAppointment(appointmentId: string): Promise<MedicalRecord> {
  const res = await client.get(`/medical-records/by-appointment/${appointmentId}`);
  return res.data.data as MedicalRecord;
}

export async function updateMedicalRecord(id: string, payload: Partial<MedicalRecord>): Promise<MedicalRecord> {
  const res = await client.put(`/medical-records/${id}`, payload);
  return res.data.data as MedicalRecord;
}

// Prescriptions
export async function createPrescription(payload: {
  medicalRecordId: string;
  medicines: PrescriptionMedicine[];
  instructions?: string;
}): Promise<{ prescription: Prescription; allergyWarnings: string[] }> {
  const res = await client.post('/prescriptions', payload);
  return res.data.data as { prescription: Prescription; allergyWarnings: string[] };
}

export async function getPrescription(id: string): Promise<Prescription> {
  const res = await client.get(`/prescriptions/${id}`);
  return res.data.data as Prescription;
}

export async function listPrescriptions(params?: Record<string, unknown>): Promise<Prescription[]> {
  const res = await client.get('/prescriptions', { params });
  return res.data.data as Prescription[];
}

export function getPrescriptionPdfUrl(id: string): string {
  const API_URL = (import.meta.env.VITE_API_URL as string) ?? '/api';
  const token = localStorage.getItem('has_access_token');
  // Returns URL; caller opens it — token is passed as query param for browser navigation
  return `${API_URL}/prescriptions/${id}/pdf?token=${token ?? ''}`;
}

/**
 * A page of results.
 *
 * Every list endpoint in this file used to return a bare array, which discarded the `meta`
 * block the API already sends. Without it the UI had no way to know whether more rows existed
 * and had to fetch everything to find out, so the patient screens grew without bound.
 */
export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

async function fetchPage<T>(url: string, params?: Record<string, unknown>): Promise<Page<T>> {
  const res = await client.get(url, { params });
  const meta = (res.data?.meta ?? {}) as Partial<Page<unknown>>;
  const total = Number(meta.total ?? 0);
  const limit = Number(meta.limit ?? 20);
  return {
    items: (res.data?.data ?? []) as T[],
    page: Number(meta.page ?? 1),
    limit,
    total,
    pages: Number(meta.pages ?? Math.ceil(total / limit)),
  };
}

// Laboratory Tests
export async function createLabTest(payload: {
  appointmentId: string;
  medicalRecordId?: string;
  testName: string;
}): Promise<LaboratoryTest> {
  const res = await client.post('/lab-tests', payload);
  return res.data.data as LaboratoryTest;
}

export async function listLabTests(params?: Record<string, unknown>): Promise<LaboratoryTest[]> {
  const res = await client.get('/lab-tests', { params });
  return res.data.data as LaboratoryTest[];
}

export async function getLabTest(id: string): Promise<LaboratoryTest> {
  const res = await client.get(`/lab-tests/${id}`);
  return res.data.data as LaboratoryTest;
}

export async function updateLabTest(id: string, payload: {
  status: 'Requested' | 'In Progress' | 'Completed';
  result?: string;
  resultFileUrl?: string;
  referenceRange?: string;
  isAbnormal?: boolean;
}): Promise<LaboratoryTest> {
  const res = await client.put(`/lab-tests/${id}`, payload);
  return res.data.data as LaboratoryTest;
}

// ── Phase 4: Billing & Claims ─────────────────────────────────────────────────

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'online'
  | 'insurance'
  | 'government_scheme';

export type PaymentStatus = 'Pending' | 'Partially Paid' | 'Paid' | 'Refunded' | 'Failed';

export interface BillLine {
  label: string;
  category: 'consultation' | 'lab' | 'pharmacy';
  detail?: string;
  quantity?: number;
  unitCost?: number;
  amount: number;
}

export interface Bill {
  consultationFee: number;
  labCharges: number;
  pharmacyCharges: number;
  subtotal: number;
  discount: number;
  tax: number;
  schemeSubsidy: number;
  total: number;
  lines: BillLine[];
}

export interface Payment {
  _id: string;
  appointmentId: string;
  patientId: string;
  facilityId: string;
  amount: number;
  breakdown: {
    consultationFee: number;
    labCharges: number;
    pharmacyCharges: number;
    discount: number;
    tax: number;
    schemeSubsidy: number;
  };
  method: PaymentMethod;
  status: PaymentStatus;
  /** `portal` means the patient raised it and staff have not confirmed funds yet. */
  source?: 'staff' | 'portal';
  requestReference?: string;
  receiptNumber?: string;
  paidAt?: string;
  confirmedAt?: string;
  createdAt: string;
}

export interface Receipt {
  receiptNumber: string;
  facilityName: string;
  facilityType?: string;
  receiptDate: string;
  patient: {
    patientNumber?: string;
    name?: string;
    nationalHealthId?: string;
  };
  appointment: {
    date?: string;
    timeSlot?: string;
    visitType?: string;
    doctorName?: string;
  };
  lines: BillLine[];
  subtotal: number;
  discount: number;
  tax: number;
  schemeSubsidy: number;
  total: number;
  method: PaymentMethod;
  status: string;
}

export interface InsuranceProvider {
  _id: string;
  name: string;
  type: 'private_insurance' | 'government_scheme';
  contactInfo?: { phone?: string; email?: string };
  claimSubmissionMethod?: 'api' | 'manual';
  isActive: boolean;
}

export type ClaimStatus = 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Paid';

export interface InsuranceClaim {
  _id: string;
  paymentId: string;
  providerId: string;
  claimAmount: number;
  status: ClaimStatus;
  submittedAt: string;
  resolvedAt?: string;
  rejectionReason?: string;
}

export interface ClaimRow {
  claim: InsuranceClaim;
  provider: InsuranceProvider | null;
  payment: Payment | null;
}

export async function previewBill(appointmentId: string): Promise<Bill & { indigent: boolean }> {
  const res = await client.get(`/payments/bill/${appointmentId}`);
  return res.data.data as Bill & { indigent: boolean };
}

export async function createPayment(payload: {
  appointmentId: string;
  method: PaymentMethod;
  discount?: number;
  tax?: number;
  schemeSubsidy?: number;
}): Promise<{ payment: Payment; bill: Bill; receipt: Receipt; autoClaim?: { providerId: string; claimAmount: number } }> {
  const res = await client.post('/payments', payload);
  return res.data.data as { payment: Payment; bill: Bill; receipt: Receipt; autoClaim?: { providerId: string; claimAmount: number } };
}

export async function getPayment(id: string): Promise<{ payment: Payment; appointment: Appointment | null; patient: Patient | null; facility: Facility | null }> {
  const res = await client.get(`/payments/${id}`);
  return res.data.data as { payment: Payment; appointment: Appointment | null; patient: Patient | null; facility: Facility | null };
}

export async function listPayments(params?: Record<string, unknown>): Promise<Payment[]> {
  const res = await client.get('/payments', { params });
  return res.data.data as Payment[];
}

export async function listPatientPayments(
  patientId: string,
  params?: Record<string, unknown>,
): Promise<Payment[]> {
  const res = await client.get(`/payments/patient/${patientId}`, { params });
  return res.data.data as Payment[];
}

export async function issueReceipt(id: string): Promise<{ payment: Payment; receipt: Receipt }> {
  const res = await client.post(`/payments/${id}/receipt`);
  return res.data.data as { payment: Payment; receipt: Receipt };
}

export async function listMyPayments(params?: Record<string, unknown>): Promise<Payment[]> {
  const res = await client.get('/payments/me', { params });
  return res.data.data as Payment[];
}

export interface OutstandingBill {
  appointmentId: string;
  appointmentDate: string;
  timeSlot: string;
  status: string;
  visitType: string;
  total: number;
  paid: number;
  balance: number;
  lines: { description: string; amount: number; quantity?: number; unitAmount?: number }[];
  /** True when the patient already asked to pay this visit and staff have not confirmed. */
  hasOpenRequest: boolean;
  requestReference?: string;
}

export interface OutstandingSummary {
  totalOutstanding: number;
  currency: string;
  bills: OutstandingBill[];
}

/** What the signed-in patient still owes, per visit. */
export async function listMyOutstandingBills(): Promise<OutstandingSummary> {
  const res = await client.get('/payments/me/outstanding');
  return res.data.data as OutstandingSummary;
}

export interface PaymentRequestResult {
  payment: Payment;
  /** Server-computed balance; never a value supplied by the client. */
  amountDue: number;
  status: 'awaiting_confirmation';
}

/**
 * Asks the facility to settle one of the signed-in patient's outstanding visits.
 *
 * This records an intent to pay, not a charge: no processor is integrated, so the request stays
 * pending until staff confirm the funds. Card details are never collected by this app.
 */
export async function requestPayment(payload: {
  appointmentId: string;
  method: 'cash' | 'card' | 'online';
}): Promise<PaymentRequestResult> {
  const res = await client.post('/payments/me/requests', payload);
  return res.data.data as PaymentRequestResult;
}

/** Withdraws a payment request the patient raised and staff have not confirmed. */
export async function cancelPaymentRequest(paymentId: string): Promise<Payment> {
  const res = await client.post(`/payments/me/requests/${paymentId}/cancel`);
  return res.data.data.payment as Payment;
}

export async function listInsuranceProviders(): Promise<InsuranceProvider[]> {
  const res = await client.get('/insurance-providers');
  return res.data.data as InsuranceProvider[];
}

export async function createInsuranceProvider(payload: {
  name: string;
  type: 'private_insurance' | 'government_scheme';
  contactInfo?: { phone?: string; email?: string };
  claimSubmissionMethod?: 'api' | 'manual';
}): Promise<InsuranceProvider> {
  const res = await client.post('/insurance-providers', payload);
  return res.data.data as InsuranceProvider;
}

export async function createClaim(payload: {
  paymentId: string;
  providerId: string;
  claimAmount?: number;
}): Promise<InsuranceClaim> {
  const res = await client.post('/claims', payload);
  return res.data.data as InsuranceClaim;
}

export async function getClaim(id: string): Promise<{
  claim: InsuranceClaim;
  payment: Payment | null;
  provider: InsuranceProvider | null;
  patient: Patient | null;
  facility: Facility | null;
  appointment: Appointment | null;
}> {
  const res = await client.get(`/claims/${id}`);
  return res.data.data as {
    claim: InsuranceClaim;
    payment: Payment | null;
    provider: InsuranceProvider | null;
    patient: Patient | null;
    facility: Facility | null;
    appointment: Appointment | null;
  };
}

export async function updateClaimStatus(
  id: string,
  payload: { status: ClaimStatus; rejectionReason?: string },
): Promise<InsuranceClaim> {
  const res = await client.patch(`/claims/${id}/status`, payload);
  return res.data.data as InsuranceClaim;
}

export async function getClaimReconciliation(params?: Record<string, unknown>): Promise<ClaimRow[]> {
  const res = await client.get('/claims/reconciliation', { params });
  return res.data.data as ClaimRow[];
}

// ════════════════════════════════════════════════════════════════════════════
// Patient Messaging, Notifications & Documents
// ════════════════════════════════════════════════════════════════════════════

export interface Message {
  _id: string;
  facilityId: string;
  patientId: string;
  senderName: string;
  subject: string;
  body: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  /** Present on replies; the opening message points at its own id. */
  threadId?: string;
  direction?: 'to_patient' | 'to_staff';
}

/** One row per conversation, as returned by `GET /messages/threads`. */
export interface MessageThread {
  threadId: string;
  subject: string;
  lastBody: string;
  lastSenderName: string;
  lastDirection: 'to_patient' | 'to_staff';
  lastMessageAt: string;
  messageCount: number;
  unreadCount: number;
  patient?: { patientNumber: string };
}

export async function listMessages(params?: Record<string, unknown>): Promise<Message[]> {
  const res = await client.get('/messages', { params });
  return res.data.data as Message[];
}

/** Conversation list with the unread counts the header badge needs. */
export async function listMessageThreads(params?: Record<string, unknown>): Promise<Page<MessageThread>> {
  return fetchPage<MessageThread>('/messages/threads', params);
}

/** Full conversation, oldest first. Marks the caller's side as read. */
export async function getMessageThread(threadId: string): Promise<Message[]> {
  const res = await client.get(`/messages/threads/${threadId}`);
  return res.data.data as Message[];
}

export async function replyToThread(threadId: string, body: string): Promise<Message> {
  const res = await client.post(`/messages/threads/${threadId}/replies`, { body });
  return res.data.data as Message;
}

export async function getMessage(id: string): Promise<Message> {
  const res = await client.get(`/messages/${id}`);
  return res.data.data as Message;
}

export async function sendMessage(payload: {
  patientId: string;
  subject: string;
  body: string;
}): Promise<Message> {
  const res = await client.post('/messages', payload);
  return res.data.data as Message;
}

export async function markMessageRead(id: string): Promise<Message> {
  const res = await client.patch(`/messages/${id}/read`);
  return res.data.data as Message;
}

export type NotificationType =
  | 'appointment'
  | 'lab_result'
  | 'prescription'
  | 'billing'
  | 'general';

export interface Notification {
  _id: string;
  facilityId: string;
  patientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export async function listNotifications(params?: Record<string, unknown>): Promise<Notification[]> {
  const res = await client.get('/notifications', { params });
  return res.data.data as Notification[];
}

export async function createNotification(payload: {
  patientId: string;
  type?: NotificationType;
  title: string;
  body: string;
  link?: string;
}): Promise<Notification> {
  const res = await client.post('/notifications', payload);
  return res.data.data as Notification;
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const res = await client.patch(`/notifications/${id}/read`);
  return res.data.data as Notification;
}

export async function markAllNotificationsRead(): Promise<{ remainingUnread: number }> {
  const res = await client.patch('/notifications/read-all');
  return res.data.data as { remainingUnread: number };
}

export type DocumentCategory =
  | 'prescription'
  | 'lab_result'
  | 'medical_report'
  | 'billing_receipt'
  | 'general';

export interface PatientDocument {
  _id: string;
  facilityId: string;
  patientId: string;
  category: DocumentCategory;
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy: { _id: string; fullName?: string } | string;
  createdAt: string;
}

export async function listPatientDocuments(params?: Record<string, unknown>): Promise<PatientDocument[]> {
  const res = await client.get('/patient-documents', { params });
  return res.data.data as PatientDocument[];
}

export async function getPatientDocument(id: string): Promise<PatientDocument> {
  const res = await client.get(`/patient-documents/${id}`);
  return res.data.data as PatientDocument;
}

export async function createPatientDocument(payload: {
  patientId: string;
  category?: DocumentCategory;
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  sizeBytes?: number;
}): Promise<PatientDocument> {
  const res = await client.post('/patient-documents', payload);
  return res.data.data as PatientDocument;
}
