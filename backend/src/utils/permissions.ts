import { Role } from '../models/Role';
import { AuthUser } from '../middleware/auth';
import { ROLE_SUPER_ADMIN, canonicalRole, isSuperAdmin } from './tenancy';

/**
 * Every permission the platform knows about.
 *
 * Declared as a frozen object of string constants so a typo is a compile error rather than a
 * silently-denyable string, and so `allPermissions()` can be used to validate what the
 * database holds.
 */
export const PERMISSIONS = Object.freeze({
  // Platform administration
  PLATFORM_FACILITY_CREATE: 'platform.facility.create',
  PLATFORM_FACILITY_EDIT: 'platform.facility.edit',
  PLATFORM_FACILITY_SUBSCRIPTION: 'platform.facility.subscription',
  PLATFORM_FACILITY_DELETE: 'platform.facility.delete',
  PLATFORM_FACILITY_RESTORE: 'platform.facility.restore',
  PLATFORM_FACILITY_VIEW: 'platform.facility.view',
  PLATFORM_STAFF_ASSIGN: 'platform.staff.assign',
  PLATFORM_ROLE_EDIT: 'platform.role.edit',
  PLATFORM_AUDIT_READ: 'platform.audit.read',

  // Hospital administration
  FACILITY_MANAGE: 'facility.manage',
  FACILITY_STAFF_READ: 'facility.staff.read',
  FACILITY_STAFF_MANAGE: 'facility.staff.manage',
  FACILITY_DEPARTMENT_MANAGE: 'facility.department.manage',
  FACILITY_OVERSIGHT: 'facility.oversight',
  REPORTS_VIEW: 'reports.view',

  // Patients and records
  PATIENT_VIEW: 'patients.view',
  PATIENT_CREATE: 'patients.create',
  PATIENT_UPDATE: 'patients.update',
  RECORDS_VIEW: 'records.view',
  RECORDS_WRITE: 'records.write',
  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_UPLOAD: 'documents.upload',

  // Front desk and scheduling
  APPOINTMENTS_VIEW: 'appointments.view',
  APPOINTMENTS_CREATE: 'appointments.create',
  APPOINTMENTS_UPDATE: 'appointments.update',
  APPOINTMENTS_CANCEL: 'appointments.cancel',
  APPOINTMENTS_CHECKIN: 'appointments.checkin',

  // Clinical work
  CONSULTATIONS_MANAGE: 'consultations.manage',
  VITALS_WRITE: 'vitals.write',
  PRESCRIPTIONS_VIEW: 'prescriptions.view',
  PRESCRIPTIONS_WRITE: 'prescriptions.write',

  // Laboratory
  LAB_VIEW: 'lab.view',
  LAB_ORDER: 'lab.order',
  LAB_RESULTS_WRITE: 'lab.results.write',

  // Pharmacy — controlled, so dispensing is separated from inventory
  PHARMACY_VIEW: 'pharmacy.view',
  PHARMACY_INVENTORY: 'pharmacy.inventory',
  PHARMACY_DISPENSE: 'pharmacy.dispense',

  // Money
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_RECORD: 'payments.record',
  CLAIMS_VIEW: 'claims.view',
  CLAIMS_SUBMIT: 'claims.submit',
  CLAIMS_VERIFY: 'claims.verify',

  // Communication
  MESSAGES_SEND: 'messages.send',
  NOTIFICATIONS_SEND: 'notifications.send',

  /**
   * Editing one's *own* staff record — schedule, leave, contact details.
   *
   * Separate from `facility.staff.manage` because a clinician changing their own availability
   * is not the same act as a hospital admin editing the roster, and conflating them would
   * either over-grant the admin permission or lock doctors out of their own calendar.
   */
  PROFILE_SELF_MANAGE: 'profile.self.manage',

  // Audit
  AUDIT_VIEW: 'audit.view',

  // Patient self-service. Deliberately narrow: a patient may only ever reach their own data,
  // and the controllers enforce that ownership separately.
  SELF_APPOINTMENTS: 'self.appointments',
  SELF_RECORDS: 'self.records',
  SELF_BILLING: 'self.billing',
  SELF_MESSAGES: 'self.messages',
  SELF_DOCUMENTS: 'self.documents',
  SELF_NOTIFICATIONS: 'self.notifications',
} as const);

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly string[] = Object.freeze(
  Object.values(PERMISSIONS)
);

/** Wildcard held only by the platform owner role. */
export const WILDCARD = '*';

/**
 * Default grants per role, held in code as the source of truth.
 *
 * These deliberately reproduce the access that `requireRole` already allows today, so adding
 * `requirePermission` on top of an existing route guard refines the check without changing
 * who gets through. A `Role` document in the database may narrow or widen these (see
 * `resolvePermissions`); this map is what a fresh or unseeded database falls back to.
 */
export const ROLE_PERMISSIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  [ROLE_SUPER_ADMIN]: [WILDCARD],

  facility_admin: [
    PERMISSIONS.PLATFORM_FACILITY_VIEW,
    PERMISSIONS.FACILITY_MANAGE,
    PERMISSIONS.FACILITY_STAFF_READ,
    PERMISSIONS.FACILITY_STAFF_MANAGE,
    PERMISSIONS.FACILITY_DEPARTMENT_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.PATIENT_VIEW,
    PERMISSIONS.PATIENT_CREATE,
    PERMISSIONS.PATIENT_UPDATE,
    PERMISSIONS.RECORDS_VIEW,
    PERMISSIONS.RECORDS_WRITE,
    PERMISSIONS.DOCUMENTS_VIEW,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_CREATE,
    PERMISSIONS.APPOINTMENTS_UPDATE,
    PERMISSIONS.APPOINTMENTS_CANCEL,
    PERMISSIONS.APPOINTMENTS_CHECKIN,
    PERMISSIONS.CONSULTATIONS_MANAGE,
    PERMISSIONS.PRESCRIPTIONS_VIEW,
    PERMISSIONS.PRESCRIPTIONS_WRITE,
    PERMISSIONS.LAB_VIEW,
    PERMISSIONS.LAB_ORDER,
    PERMISSIONS.LAB_RESULTS_WRITE,
    PERMISSIONS.PHARMACY_VIEW,
    PERMISSIONS.PHARMACY_INVENTORY,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_RECORD,
    PERMISSIONS.CLAIMS_VIEW,
    PERMISSIONS.CLAIMS_SUBMIT,
    PERMISSIONS.CLAIMS_VERIFY,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.PROFILE_SELF_MANAGE,
  ],

  receptionist: [
    PERMISSIONS.PATIENT_VIEW,
    PERMISSIONS.PATIENT_CREATE,
    PERMISSIONS.PATIENT_UPDATE,
    PERMISSIONS.DOCUMENTS_VIEW,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_CREATE,
    PERMISSIONS.APPOINTMENTS_UPDATE,
    PERMISSIONS.APPOINTMENTS_CANCEL,
    PERMISSIONS.APPOINTMENTS_CHECKIN,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_RECORD,
    PERMISSIONS.CLAIMS_VIEW,
    PERMISSIONS.CLAIMS_SUBMIT,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.PROFILE_SELF_MANAGE,
  ],

  doctor: [
    PERMISSIONS.PATIENT_VIEW,
    PERMISSIONS.PATIENT_UPDATE,
    PERMISSIONS.RECORDS_VIEW,
    PERMISSIONS.RECORDS_WRITE,
    PERMISSIONS.DOCUMENTS_VIEW,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_CREATE,
    PERMISSIONS.APPOINTMENTS_UPDATE,
    PERMISSIONS.CONSULTATIONS_MANAGE,
    PERMISSIONS.VITALS_WRITE,
    PERMISSIONS.PRESCRIPTIONS_VIEW,
    PERMISSIONS.PRESCRIPTIONS_WRITE,
    PERMISSIONS.LAB_VIEW,
    PERMISSIONS.LAB_ORDER,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.PROFILE_SELF_MANAGE,
  ],

  nurse: [
    PERMISSIONS.PATIENT_VIEW,
    PERMISSIONS.PATIENT_UPDATE,
    PERMISSIONS.RECORDS_VIEW,
    PERMISSIONS.RECORDS_WRITE,
    PERMISSIONS.DOCUMENTS_VIEW,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_CHECKIN,
    PERMISSIONS.VITALS_WRITE,
    PERMISSIONS.LAB_VIEW,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.PROFILE_SELF_MANAGE,
  ],

  lab_technician: [
    PERMISSIONS.PATIENT_VIEW,
    PERMISSIONS.DOCUMENTS_VIEW,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.LAB_VIEW,
    PERMISSIONS.LAB_RESULTS_WRITE,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.PROFILE_SELF_MANAGE,
  ],

  pharmacist: [
    PERMISSIONS.PATIENT_VIEW,
    PERMISSIONS.DOCUMENTS_VIEW,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.PRESCRIPTIONS_VIEW,
    PERMISSIONS.PHARMACY_VIEW,
    PERMISSIONS.PHARMACY_INVENTORY,
    PERMISSIONS.PHARMACY_DISPENSE,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.PROFILE_SELF_MANAGE,
  ],

  insurance_verifier: [
    PERMISSIONS.PATIENT_VIEW,
    PERMISSIONS.DOCUMENTS_VIEW,
    PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_RECORD,
    PERMISSIONS.CLAIMS_VIEW,
    PERMISSIONS.CLAIMS_SUBMIT,
    PERMISSIONS.CLAIMS_VERIFY,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.PROFILE_SELF_MANAGE,
  ],

  auditor: [
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.PATIENT_VIEW,
    PERMISSIONS.DOCUMENTS_VIEW,
    PERMISSIONS.CLAIMS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.PROFILE_SELF_MANAGE,
  ],

  patient: [
    PERMISSIONS.SELF_APPOINTMENTS,
    PERMISSIONS.SELF_RECORDS,
    PERMISSIONS.SELF_BILLING,
    PERMISSIONS.SELF_MESSAGES,
    PERMISSIONS.SELF_DOCUMENTS,
    PERMISSIONS.SELF_NOTIFICATIONS,
  ],
});

/** The code-side default for a role. Unknown roles get nothing rather than everything. */
export function defaultPermissionsFor(role?: string | null): readonly string[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[canonicalRole(role)] ?? [];
}

/**
 * Resolves a role's effective permissions, preferring the database.
 *
 * The `Role` collection is the tunable source: a platform owner can narrow a role's grants
 * without a deploy. Falling back to the code defaults when the document is missing is the
 * important part — a fresh database with no seed must not silently strip every capability
 * from the platform owner and lock the whole app out.
 *
 * The same reasoning covers a document that is present but *stale*. Permission names are
 * renamed as the platform grows, and a role left holding only pre-rename names matches no
 * route: every guarded request 403s, the portal's lists come back empty, and the failure
 * presents as broken fetching rather than as a bad grant. So a stored list that contains no
 * recognised permission at all is treated as foreign and the code defaults are used. A list
 * that contains at least one recognised name is honoured as-is, because that is a deliberate
 * narrowing and overriding it would quietly widen access.
 */
export async function resolvePermissions(role?: string | null): Promise<string[]> {
  const canonical = canonicalRole(role);
  if (!canonical) return [];

  let stored: string[] | null = null;
  try {
    const doc = await Role.findOne({ name: canonical }).select('permissions').lean<{
      permissions: string[];
    }>();
    if (doc && Array.isArray(doc.permissions)) stored = doc.permissions;
  } catch {
    // A permissions lookup must never be the reason a request 500s; fall back to code.
    stored = null;
  }

  if (stored === null) return [...defaultPermissionsFor(canonical)];

  const known = new Set<string>(ALL_PERMISSIONS);
  const recognised = stored.filter(
    (permission) => permission === WILDCARD || known.has(permission)
  );
  // An empty stored list is a role deliberately granted nothing, so it is left alone.
  if (!stored.length || recognised.length) return stored;

  return [...defaultPermissionsFor(canonical)];
}

export function permissionSetSatisfies(
  granted: readonly string[],
  required: readonly string[]
): boolean {
  if (granted.includes(WILDCARD)) return true;
  return required.every((permission) => granted.includes(permission));
}

/** Checks one role's effective grants without touching the database. */
export function roleHasPermission(
  role: string | undefined,
  ...required: readonly string[]
): boolean {
  return permissionSetSatisfies(defaultPermissionsFor(role), required);
}

/** Checks a request principal's effective grants, loading the `Role` document if needed. */
export async function userHasPermission(
  user: AuthUser,
  ...required: readonly string[]
): Promise<boolean> {
  if (!required.length) return true;
  if (isSuperAdmin(user)) return true;
  const granted = await resolvePermissions(user.role);
  return permissionSetSatisfies(granted, required);
}
