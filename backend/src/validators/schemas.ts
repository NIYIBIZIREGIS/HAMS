import { z } from 'zod';
import { Types } from 'mongoose';

export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

export const emailSchema = z
  .string()
  .trim()
  .email('Invalid email')
  .optional();

/**
 * Personal names as they are actually written, not as a keyboard thinks they are.
 *
 * An ASCII "letters and spaces" rule looks harmless until it meets a real hospital roster:
 * it rejects `Dr. Jean Niyonzima`, `Anne-Marie`, `O'Brien` and `Theogene Nzabonimpa` — all of
 * which are seeded in this project's own fixtures. With `en`/`fr`/`rw` locales, dropping
 * accents matters too, so accented letters are explicitly allowed rather than tolerated by
 * accident. The rule therefore permits Unicode letters plus the punctuation names genuinely
 * use (space, hyphen, straight or curly apostrophe, period), and still requires the name to
 * start with a letter so a value of "---" cannot pass.
 */
const NAME_PATTERN = /^[\p{L}][\p{L}\s'’. -]*$/u;

const personName = (label = 'Full name') =>
  z
    .string()
    .trim()
    .min(5, `${label} must be at least 5 characters`)
    .max(100)
    .regex(
      NAME_PATTERN,
      `${label} may only contain letters, spaces, hyphens, apostrophes and periods`
    );
export const phoneSchema = z
  .string()
  .regex(/^0\d{9}$/, 'Phone number must be a valid Rwandan format (10 digits starting with 0)')
  .optional();
export const nationalIdSchema = z
  .string()
  .regex(/^1\d{15}$/, 'National ID must be exactly 16 digits starting with 1')
  .optional();

const strongPassword = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one symbol');

export const registerSchema = z.object({
  fullName: personName(),
  email: emailSchema,
  phone: phoneSchema,
  nationalId: nationalIdSchema,
  password: strongPassword,
  preferredLanguage: z.string().min(2).max(5).default('en'),
  facilityId: objectId.optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const nationalIdLoginSchema = z.object({
  nationalId: z.string().min(4),
  password: z.string().min(1),
});

export const otpRequestSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const otpVerifySchema = z.object({
  email: z.string().email('Invalid email'),
  otp: z.string().length(6),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(10),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
  otp: z.string().length(6),
  newPassword: strongPassword,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: strongPassword,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must differ from the current one',
    path: ['newPassword'],
  });

const profileImageDataUrl = z
  .string()
  .refine((v) => /^data:image\/(jpeg|jpg|png|webp);base64,/.test(v), 'Invalid image data URL');

/**
 * Accepts an upload, or an explicit clear (`''` / null) that removes the stored image
 * and falls the user back to the default avatar. Clients submit `''` when the user
 * deletes their picture, so the empty string must not be rejected as an invalid URL.
 */
const clearableProfileImage = z
  .union([profileImageDataUrl, z.literal(''), z.null()])
  .optional();

export const profileImageSchema = z.object({
  image: clearableProfileImage,
});

export const verifyEmailSendSchema = z.object({
  email: z.string().email('Invalid email').optional(),
});

export const verifyPhoneSendSchema = z.object({
  phone: phoneSchema,
});

export const verifyConfirmSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
  email: z.string().email('Invalid email').optional(),
  phone: phoneSchema,
});

const subscriptionStatusSchema = z.enum(['trial', 'active', 'suspended', 'expired']);

/** Accepts a pasted or uploaded logo reference only; never a data: blob. */
const logoSchema = z
  .string()
  .max(2048)
  .regex(/^https?:\/\/\S+$/i, 'Logo must be an http(s) URL')
  .optional();

export const facilitySchema = z.object({
  name: z.string().min(2).max(200),
  type: z.enum(['hospital', 'clinic', 'health_center', 'district_office']),
  region: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
  geoLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
  contactInfo: z.object({ phone: z.string().optional(), email: z.string().email().optional() }).optional(),
  operatingHours: z.string().optional(),
  isActive: z.boolean().optional(),
  parentFacilityId: objectId.optional(),
  logo: logoSchema,
  subscriptionStatus: subscriptionStatusSchema.optional(),
  subscriptionExpiresAt: z.string().datetime({ offset: true }).optional(),
});

/**
 * Onboarding payload: the hospital plus the details needed to mint its first admin.
 *
 * The admin's password is deliberately absent. The server generates a temporary one and
 * returns it exactly once, so a password never travels to or from the browser.
 */
export const createFacilityWithAdminSchema = facilitySchema.extend({
  // Optional: a hospital can be registered first and given its admin in a follow-up
  // assignment. When present, the first admin is created in the same request.
  admin: z
    .object({
fullName: personName('Admin full name'),
      email: z.string().email('Admin email is invalid'),
      phone: phoneSchema,
      nationalId: nationalIdSchema,
    })
    .optional(),
});

export const updateFacilitySubscriptionSchema = z.object({
  subscriptionStatus: subscriptionStatusSchema,
  subscriptionExpiresAt: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
});

export const userUpdateSchema = z.object({
  fullName: personName().optional(),
  email: emailSchema,
  phone: phoneSchema,
  preferredLanguage: z.string().min(2).max(5).optional(),
  profileImageUrl: clearableProfileImage,
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  role: z
    .enum([
      'super_admin',
      'facility_admin',
      'hospital_admin',
      'receptionist',
      'doctor',
      'nurse',
      'lab_technician',
      'pharmacist',
      'insurance_verifier',
      'auditor',
      'patient',
    ])
    .optional(),
  facilityId: objectId.optional(),
});

export const createStaffUserSchema = z.object({
  fullName: personName(),
  email: z.string().email('Invalid email'),
  phone: phoneSchema,
  nationalId: nationalIdSchema,
  password: strongPassword,
  role: z.enum([
    'facility_admin',
    'hospital_admin',
    'receptionist',
    'doctor',
    'nurse',
    'lab_technician',
    'pharmacist',
    'insurance_verifier',
    'auditor',
  ]),
  preferredLanguage: z.string().min(2).max(5).default('en'),
  facilityId: objectId.optional(),
});

export const assignFacilitySchema = z.object({
  adminId: objectId,
  facilityId: objectId,
});

export const reassignFacilitySchema = z.object({
  adminId: objectId,
  newFacilityId: objectId,
});

export const departmentSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().optional(),
  defaultConsultationFee: z.number().min(0).optional(),
  contactInfo: z.object({ phone: z.string().optional(), email: z.string().email().optional() }).optional(),
  facilityId: objectId.optional(),
});

export const doctorSchema = z.object({
  userId: objectId,
  departmentId: z.array(objectId).min(1, 'At least one department required').optional(),
  licenseNumber: z.string().optional(),
  specialization: z.array(z.string()).optional(),
  qualification: z.array(z.string()).optional(),
  experienceYears: z.number().min(0).optional(),
  consultationFee: z
    .object({ newVisit: z.number().min(0).optional(), followUp: z.number().min(0).optional() })
    .optional(),
  bio: z.string().optional(),
  facilityId: objectId.optional(),
});

export const doctorUpdateSchema = doctorSchema.partial().omit({ userId: true });

export const scheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time (HH:mm)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time (HH:mm)'),
  breakStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time (HH:mm)').optional(),
  breakEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time (HH:mm)').optional(),
  slotDurationMinutes: z.number().int().min(5).max(120).default(15),
  maxPatientsPerSlot: z.number().int().min(1).max(10).default(1),
  isActive: z.boolean().default(true),
});

export const leaveSchema = z.object({
  date: z.string().datetime({ offset: true }).or(z.string().date()),
  reason: z.string().optional(),
});

export const patientSchema = z.object({
  userId: objectId.optional(),
  dob: z.string().datetime({ offset: true }).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  bloodGroup: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  chronicConditions: z.array(z.string()).optional(),
  insurance: z
    .object({
      provider: z.string().optional(),
      policyNumber: z.string().optional(),
      coverageType: z.string().optional(),
      validTill: z.string().datetime({ offset: true }).optional(),
    })
    .optional(),
  governmentScheme: z
    .object({
      schemeName: z.string().optional(),
      beneficiaryNumber: z.string().optional(),
      indigentStatus: z.boolean().optional(),
    })
    .optional(),
  emergencyContact: z
    .object({ name: z.string().optional(), relation: z.string().optional(), phone: z.string().optional() })
    .optional(),
});

export const registerPatientSchema = patientSchema.extend({
  fullName: personName(),
  email: emailSchema,
  phone: phoneSchema,
  nationalId: nationalIdSchema,
  password: strongPassword,
  preferredLanguage: z.string().min(2).max(5).default('en'),
  // Only a platform admin may target a hospital; a receptionist is pinned to their own
  // and the controller ignores this value for them.
  facilityId: objectId.optional(),
});

export const patientLookupQuery = z.object({
  nationalId: z.string().min(4),
});

export const appointmentSchema = z.object({
  doctorId: objectId,
  departmentId: objectId,
  appointmentDate: z.string().datetime({ offset: true }),
  timeSlot: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time (HH:mm)'),
  reason: z.string().max(500).optional(),
  visitType: z.enum(['new', 'follow-up', 'referral']).default('new'),
  bookingChannel: z
    .enum(['web', 'mobile', 'sms', 'ussd', 'walk_in', 'referral'])
    .default('web'),
  patientId: objectId.optional(),
  facilityId: objectId.optional(),
});

export const appointmentUpdateSchema = z.object({
  doctorId: objectId.optional(),
  departmentId: objectId.optional(),
  appointmentDate: z.string().datetime({ offset: true }).optional(),
  timeSlot: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time (HH:mm)').optional(),
  reason: z.string().max(500).optional(),
  visitType: z.enum(['new', 'follow-up', 'referral']).optional(),
});

export const appointmentStatusSchema = z.object({
  status: z.enum([
    'Pending',
    'Confirmed',
    'Checked In',
    'In Progress',
    'Completed',
    'Cancelled',
    'Missed',
    'Rejected',
  ]),
  cancellationReason: z.string().max(300).optional(),
});

export const availabilityQuery = z.object({
  date: z.string().date().or(z.string().datetime({ offset: true })),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  facilityId: objectId.optional(),
  date: z.string().date().optional(),
  /** Single value, or a comma-separated list matched with `$in` (e.g. `Cancelled,Rejected`). */
  status: z.string().optional(),
  /** Inclusive range, used by the "upcoming" views. `date` remains the single-day filter. */
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  doctorId: objectId.optional(),
  departmentId: objectId.optional(),
  patientId: objectId.optional(),
  region: z.string().optional(),
  district: z.string().optional(),
  isActive: z.string().optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  role: z.string().optional(),
});

// ── Phase 2: Clinical ────────────────────────────────────────────────────────

export const vitalsSchema = z.object({
  bloodPressure: z.string().max(20).optional(),
  temperature: z.number().min(30).max(45).optional(),
  weight: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  pulse: z.number().min(0).optional(),
  oxygenSaturation: z.number().min(0).max(100).optional(),
});

export const medicalRecordSchema = z.object({
  appointmentId: objectId,
  vitals: vitalsSchema.optional(),
  symptoms: z.array(z.string().max(200)).default([]),
  diagnosis: z.string().min(2).max(1000),
  treatment: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  followUpDate: z.string().datetime({ offset: true }).optional(),
});

export const medicalRecordUpdateSchema = medicalRecordSchema.partial().omit({ appointmentId: true });

export const prescriptionMedicineSchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().min(1).max(100),
  frequency: z.string().min(1).max(100),
  durationDays: z.number().int().min(1).max(365),
  instructions: z.string().max(500).optional(),
});

export const prescriptionSchema = z.object({
  medicalRecordId: objectId,
  medicines: z.array(prescriptionMedicineSchema).min(1, 'At least one medicine required'),
  instructions: z.string().max(1000).optional(),
});

export const labTestSchema = z.object({
  appointmentId: objectId,
  medicalRecordId: objectId.optional(),
  testName: z.string().min(2).max(200),
  fee: z.number().min(0).optional(),
});

export const labTestResultSchema = z.object({
  result: z.string().max(2000).optional(),
  resultFileUrl: z.string().url().optional(),
  referenceRange: z.string().max(200).optional(),
  isAbnormal: z.boolean().optional(),
  status: z.enum(['Requested', 'In Progress', 'Completed']),
});

export const patientIdQuery = z.object({
  patientId: objectId.optional(),
  appointmentId: objectId.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Timeline branch: `all`, `record`, `prescription` or `lab`. */
  type: z.enum(['all', 'record', 'prescription', 'lab']).optional(),
  search: z.string().max(100).optional(),
});

// ── Phase 3: Pharmacy ────────────────────────────────────────────────────────

export const pharmacyInventorySchema = z.object({
  drugName: z.string().min(1, 'Drug name is required').max(200),
  form: z.string().max(50).default('tablet'),
  strength: z.string().max(100).default(''),
  batchNumber: z.string().max(100).default(''),
  expiryDate: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid expiry date'),
  quantityOnHand: z.number().int().min(0).default(0),
  reorderThreshold: z.number().int().min(0).default(10),
  unitCost: z.number().min(0).default(0),
  facilityId: objectId.optional(),
});

export const pharmacyInventoryUpdateSchema = pharmacyInventorySchema.partial().omit({ facilityId: true });

export const pharmacyDispenseSchema = z.object({
  prescriptionId: objectId,
  inventoryId: objectId,
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  notes: z.string().max(500).optional(),
});

export const pharmacyWriteOffSchema = z.object({
  inventoryId: objectId,
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  reason: z.string().min(1, 'Reason is required').max(500),
});

export function toObjectId(value: string) {
  return new Types.ObjectId(value);
}

// ── Phase 4: Billing & Insurance ────────────────────────────────────────────

export const paymentSchema = z.object({
  appointmentId: objectId,
  method: z.enum(['cash', 'card', 'online', 'insurance', 'government_scheme']),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  schemeSubsidy: z.number().min(0).default(0),
});

/**
 * A patient's own self-service payment request.
 *
 * No amount is accepted: the server recomputes the balance, so a client cannot offer less than
 * owed. Insurance and government schemes are excluded because those are settled by staff
 * through the claims flow, not by a patient request.
 */
export const paymentRequestSchema = z.object({
  appointmentId: objectId,
  method: z.enum(['cash', 'card', 'online']),
});

export const paymentsQuery = z.object({
  patientId: objectId.optional(),
  appointmentId: objectId.optional(),
  status: z.enum(['Pending', 'Partially Paid', 'Paid', 'Refunded', 'Failed']).optional(),
  method: z.enum(['cash', 'card', 'online', 'insurance', 'government_scheme']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const claimSchema = z.object({
  paymentId: objectId,
  providerId: objectId,
  claimAmount: z.number().min(0).optional(),
});

export const claimStatusSchema = z.object({
  status: z.enum(['Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid']),
  rejectionReason: z.string().max(500).optional(),
});

export const claimsQuery = z.object({
  providerId: objectId.optional(),
  status: z.enum(['Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid']).optional(),
  facilityId: objectId.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const insuranceProviderSchema = z.object({
  name: z.string().min(2).max(200),
  type: z.enum(['private_insurance', 'government_scheme']),
  contactInfo: z.object({ phone: z.string().optional(), email: z.string().email().optional() }).optional(),
  claimSubmissionMethod: z.enum(['api', 'manual']).default('manual'),
  isActive: z.boolean().optional(),
});

// ── Phase 6: Messaging, Notifications & Patient Documents ───────────────────

export const messageSchema = z.object({
  patientId: objectId,
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

/** A reply carries only its own text; the thread supplies the subject and recipient. */
export const replySchema = z.object({
  body: z.string().min(1).max(5000),
});

export const notificationSchema = z.object({
  patientId: objectId,
  type: z.enum(['appointment', 'lab_result', 'prescription', 'billing', 'general']).default('general'),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  link: z.string().max(500).optional(),
});

export const patientDocumentSchema = z.object({
  patientId: objectId,
  category: z.enum(['prescription', 'lab_result', 'medical_report', 'billing_receipt', 'general']).default('general'),
  title: z.string().min(1).max(200),
  fileName: z.string().min(1).max(300),
  fileUrl: z.string().min(1).max(1000),
  mimeType: z.string().max(100).optional(),
  sizeBytes: z.number().int().min(0).optional(),
});
