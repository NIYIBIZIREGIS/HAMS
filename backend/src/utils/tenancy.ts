import { Types } from 'mongoose';
import type { AuthRequest, AuthUser } from '../middleware/auth';
import { AppError, forbidden, unauthorized } from './AppError';

export const ROLE_SUPER_ADMIN = 'super_admin';
export const ROLE_FACILITY_ADMIN = 'facility_admin';
export const ROLE_RECEPTIONIST = 'receptionist';
export const ROLE_DOCTOR = 'doctor';
export const ROLE_NURSE = 'nurse';
export const ROLE_LAB_TECHNICIAN = 'lab_technician';
export const ROLE_PHARMACIST = 'pharmacist';
export const ROLE_INSURANCE_VERIFIER = 'insurance_verifier';
export const ROLE_AUDITOR = 'auditor';
export const ROLE_PATIENT = 'patient';

/**
 * The specification names the hospital administrator role `hospital_admin`, while the
 * existing data model, routes and UI use `facility_admin`. Both spellings are accepted
 * and canonicalised to `facility_admin` so existing rows keep working.
 */
export const ROLE_ALIASES: Record<string, string> = {
  hospital_admin: ROLE_FACILITY_ADMIN,
};

export function canonicalRole(role?: string | null): string {
  if (!role) return '';
  const key = String(role).trim();
  return ROLE_ALIASES[key] ?? key;
}

export function isSuperAdmin(user?: AuthUser | null): boolean {
  return canonicalRole(user?.role) === ROLE_SUPER_ADMIN;
}

/** Alias-aware role test. Every role check in the codebase should go through this. */
export function hasRole(user: AuthUser | null | undefined, ...roles: string[]): boolean {
  const current = canonicalRole(user?.role);
  if (!current) return false;
  return roles.some((role) => canonicalRole(role) === current);
}

/** Roles that operate inside a single hospital and therefore must be tenant-scoped. */
export const TENANT_ROLES = [
  ROLE_FACILITY_ADMIN,
  ROLE_RECEPTIONIST,
  ROLE_DOCTOR,
  ROLE_NURSE,
  ROLE_LAB_TECHNICIAN,
  ROLE_PHARMACIST,
  ROLE_INSURANCE_VERIFIER,
  ROLE_AUDITOR,
];

export function isTenantScoped(user?: AuthUser | null): boolean {
  return hasRole(user, ...TENANT_ROLES);
}

export const SUBSCRIPTION_BLOCKING_STATUSES = ['suspended', 'expired'];

/** The subset of a hospital document that decides whether its staff may keep working. */
export interface FacilityAccessState {
  isActive?: boolean | null;
  subscriptionStatus?: string | null;
  deletedAt?: unknown;
}

/**
 * Single source of truth for "may this hospital's staff still operate?".
 *
 * Shared by login and by per-request authentication so a suspended or deleted hospital
 * cannot be blocked at sign-in while existing access tokens keep working. Returns the
 * message to surface, or `null` when the hospital is usable.
 *
 * `isActive` is a denormalised flag that the facility controller keeps in step with
 * `subscriptionStatus`, but `deletedAt` is checked as well so a stale flag cannot keep a
 * removed hospital reachable.
 */
export function describeFacilityBlock(state?: FacilityAccessState | null): string | null {
  if (!state) {
    return 'This hospital has been removed. Contact the platform administrator.';
  }
  if (state.deletedAt) {
    return 'This hospital has been removed. Contact the platform administrator.';
  }
  if (state.isActive === false || SUBSCRIPTION_BLOCKING_STATUSES.includes(String(state.subscriptionStatus))) {
    return 'This hospital is currently suspended. Contact the platform administrator.';
  }
  return null;
}

export function toObjectId(value: unknown): Types.ObjectId | null {
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === 'string' && Types.ObjectId.isValid(value)) return new Types.ObjectId(value);
  if (value && typeof value === 'object' && '_id' in (value as Record<string, unknown>)) {
    return toObjectId((value as Record<string, unknown>)._id);
  }
  return null;
}

function toIdString(value: unknown): string | null {
  const oid = toObjectId(value);
  return oid ? String(oid) : null;
}

export interface TenantScope {
  /** `null` means "all hospitals" and is only ever produced for platform-level accounts. */
  facilityId: string | null;
  isSuperAdmin: boolean;
}

/**
 * Resolves the hospital a request may read or write.
 *
 * A query string may narrow the scope for a platform admin, but it can never widen it for
 * a hospital-scoped account: passing another hospital's id is rejected rather than
 * silently ignored, so a caller cannot probe for the existence of other tenants.
 */
export function resolveTenantScope(
  req: AuthRequest,
  requested?: unknown
): TenantScope {
  const user = req.user;
  if (!user) throw unauthorized('Authentication required');

  if (isSuperAdmin(user)) {
    const requestedId = toIdString(requested);
    return { facilityId: requestedId, isSuperAdmin: true };
  }

  if (!isTenantScoped(user)) {
    throw forbidden('Account is not permitted to access hospital records');
  }

  const ownId = toIdString(user.facilityId);
  if (!ownId) {
    throw forbidden('Account is not assigned to a hospital');
  }

  const requestedId = toIdString(requested);
  if (requestedId && requestedId !== ownId) {
    throw forbidden('Forbidden: record belongs to another hospital');
  }

  return { facilityId: ownId, isSuperAdmin: false };
}

/**
 * Builds a Mongo filter that can be spread into a `find()` call and guarantees the
 * hospital scope. Use with care: callers must not later overwrite the returned key.
 */
export function tenantFilter(
  req: AuthRequest,
  requested?: unknown
): Record<string, unknown> {
  const { facilityId, isSuperAdmin } = resolveTenantScope(req, requested);
  return isSuperAdmin ? {} : { facilityId: toObjectId(facilityId) };
}

/**
 * Asserts the caller may act on a record owned by `facilityId`.
 *
 * Records with no owning hospital (for example portal-registered patients) are rejected
 * for hospital-scoped accounts unless the caller explicitly opts in via `allowUnowned`.
 */
export function assertFacilityAccess(
  req: AuthRequest,
  facilityId: unknown,
  options: { allowUnowned?: boolean } = {}
): void {
  const user = req.user;
  if (!user) throw unauthorized('Authentication required');
  if (isSuperAdmin(user)) return;

  if (!isTenantScoped(user)) {
    throw forbidden('Account is not permitted to access hospital records');
  }

  const recordFacilityId = toIdString(facilityId);
  if (!recordFacilityId) {
    if (options.allowUnowned) return;
    throw forbidden('Forbidden: record is not owned by a hospital');
  }

  const ownId = toIdString(user.facilityId);
  if (!ownId) throw forbidden('Account is not assigned to a hospital');
  if (recordFacilityId !== ownId) {
    throw forbidden('Forbidden: record belongs to another hospital');
  }
}

/** Convenience wrapper that asserts access to a loaded document. */
export function assertRecordAccess(
  req: AuthRequest,
  record: { facilityId?: unknown } | null | undefined,
  options: { allowUnowned?: boolean } = {}
): void {
  if (!record) throw new AppError(404, 'Not found');
  assertFacilityAccess(req, record.facilityId, options);
}

/**
 * The hospital a newly created record should be attached to.
 *
 * Platform accounts must state the target hospital explicitly; hospital-scoped accounts
 * are always pinned to their own hospital regardless of any submitted value.
 */
export function resolveAssignmentTarget(
  req: AuthRequest,
  requested?: unknown
): Types.ObjectId | null {
  const { facilityId, isSuperAdmin } = resolveTenantScope(req, requested);
  if (isSuperAdmin && !facilityId) {
    throw new AppError(400, 'A hospital must be selected for this record');
  }
  return toObjectId(facilityId);
}

/**
 * Unwraps a `populate()`d reference to its id.
 *
 * A populated field is a subdocument with `_id`; a non-populated one is the ObjectId
 * itself. Comparing a populated document with `String()` yields `"[object Object]"`, which
 * silently never matches an ObjectId, so access checks must unwrap first.
 */
export function populatedId(value: unknown): unknown {
  if (value && typeof value === 'object' && '_id' in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>)._id;
  }
  return value;
}

/** Reads a hospital id from query string, body or params, whichever is present. */
export function requestedFacilityId(req: AuthRequest): unknown {
  const fromQuery = (req.query as Record<string, unknown> | undefined)?.facilityId;
  return fromQuery ?? req.body?.facilityId ?? req.params?.facilityId;
}

/**
 * Roles a hospital admin may grant. A hospital admin cannot mint another hospital
 * admin, a platform admin, or a patient: patient accounts are created only through
 * self-registration or the receptionist desk.
 */
export const FACILITY_ADMIN_ASSIGNABLE_ROLES = [
  ROLE_RECEPTIONIST,
  ROLE_DOCTOR,
  ROLE_NURSE,
  ROLE_LAB_TECHNICIAN,
  ROLE_PHARMACIST,
  ROLE_INSURANCE_VERIFIER,
  ROLE_AUDITOR,
];

export function assertCanAssignRole(req: AuthRequest, targetRole: string): void {
  const user = req.user;
  if (!user) throw unauthorized('Authentication required');

  if (isSuperAdmin(user)) return;

  if (hasRole(user, ROLE_FACILITY_ADMIN)) {
    if (!FACILITY_ADMIN_ASSIGNABLE_ROLES.includes(canonicalRole(targetRole))) {
      throw forbidden(`Forbidden: hospital admins may not grant the ${targetRole} role`);
    }
    return;
  }

  throw forbidden('Account is not permitted to change user roles');
}

/**
 * Guard for mutations aimed at a user account. Hospital-scoped staff may not touch
 * platform admins or accounts outside their own hospital.
 */
export function assertCanManageUser(
  req: AuthRequest,
  target: { role?: string; facilityId?: unknown }
): void {
  const user = req.user;
  if (!user) throw unauthorized('Authentication required');

  if (isSuperAdmin(user)) return;

  if (!hasRole(user, ROLE_FACILITY_ADMIN)) {
    throw forbidden('Account is not permitted to manage staff');
  }

  if (isSuperAdmin({ role: target.role ?? '', id: '' })) {
    throw forbidden('Forbidden: hospital admins may not manage platform admin accounts');
  }

  assertFacilityAccess(req, target.facilityId, { allowUnowned: true });
}
