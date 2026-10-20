import { NextFunction, RequestHandler, Response } from 'express';
import { AuthRequest, AuthUser } from './auth';
import { AppError } from '../utils/AppError';
import { assertFacilityAccess, hasRole, requestedFacilityId, toObjectId } from '../utils/tenancy';
import { userHasPermission } from '../utils/permissions';
import { AuditLog } from '../models/AuditLog';

/**
 * Metadata attached to the guards below so tests can walk the mounted routers and assert the
 * invariants that are otherwise only enforced at runtime — chiefly that a role the route
 * accepts also holds the permission the route requires.
 */
export const ROLE_GUARD = Symbol('rbac.roleGuard');
export const PERMISSION_GUARD = Symbol('rbac.permissionGuard');

export type RoleGuard = RequestHandler & {
  [ROLE_GUARD]?: { roles: string[] };
};
export type PermissionGuard = RequestHandler & {
  [PERMISSION_GUARD]?: { permissions: string[]; mode: 'all' | 'any' };
};

/**
 * Records a refused authorisation.
 *
 * The `auditLog` middleware is mounted *after* these guards, so it never sees a rejected
 * request. That is the right order — a denied caller should not be able to trigger snapshot
 * lookups against records they may not read — but it means the trail would otherwise record
 * only successes. A staff account probing for access it does not have is exactly the behaviour
 * an investigation needs to see, so denials are written here instead.
 */
function recordDenial(
  req: AuthRequest,
  kind: 'role' | 'permission' | 'self' | 'tenant',
  required: string[]
): Promise<void> {
  return AuditLog.create({
    userId: req.user?.id ?? null,
    role: req.user?.role ?? 'anonymous',
    action: 'DENIED',
    entity: 'Access',
    entityId: req.originalUrl,
    facilityId: toObjectId(req.user?.facilityId) ?? null,
    actorFacilityId: toObjectId(req.user?.facilityId) ?? null,
    metadata: {
      guard: kind,
      required,
      method: req.method,
      path: req.originalUrl,
    },
    summary: `Denied ${req.method} ${req.originalUrl} (${kind} guard)`,
    succeeded: false,
    statusCode: 403,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date(),
    // A failed insert must not convert a 403 into a 500.
  }).then(
    () => undefined,
    () => undefined
  );
}

/**
 * Role guard. Alias-aware, so `hospital_admin` satisfies a `facility_admin` requirement
 * and vice versa. Always prefer this over comparing `req.user.role` inline.
 */
export function requireRole(...roles: string[]): RoleGuard {
  const guard: RoleGuard = async (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Authentication required'));
    if (!hasRole(req.user, ...roles)) {
      // Awaited so the refusal is on record before the client is told about it; a denial that
      // can be lost is not evidence of anything.
      await recordDenial(req, 'role', roles);
      return next(new AppError(403, `Forbidden: requires role(s) ${roles.join(', ')}`));
    }
    return next();
  };
  guard[ROLE_GUARD] = { roles };
  return guard;
}

/**
 * Permission guard, for authorisation that should be tunable without a deploy.
 *
 * Requires *all* of the listed permissions, so a route that needs both `records.write` and
 * `prescriptions.write` cannot be satisfied by holding only one of them. Complements
 * `requireRole` rather than replacing it: the role guard states who the feature is for, the
 * permission guard states what that role is actually allowed to do right now.
 *
 * `super_admin` holds the wildcard and always passes.
 */
export function requirePermission(...permissions: string[]): PermissionGuard {
  const guard: PermissionGuard = async (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Authentication required'));
    try {
      if (await userHasPermission(req.user, ...permissions)) return next();
      await recordDenial(req, 'permission', permissions);
      return next(
        new AppError(403, `Forbidden: requires permission(s) ${permissions.join(', ')}`, {
          required: permissions,
          role: req.user.role,
        })
      );
    } catch (err) {
      return next(err);
    }
  };
  guard[PERMISSION_GUARD] = { permissions, mode: 'all' };
  return guard;
}

/**
 * Satisfies the guard when the caller holds *any* of the listed permissions.
 *
 * For endpoints that genuinely have several distinct entry points, such as a clinical form
 * that either a doctor or a nurse may file. Prefer `requirePermission` where the operations
 * differ in impact.
 */
export function requireAnyPermission(...permissions: string[]): PermissionGuard {
  const guard: PermissionGuard = async (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Authentication required'));
    try {
      for (const permission of permissions) {
        if (await userHasPermission(req.user, permission)) return next();
      }
      await recordDenial(req, 'permission', permissions);
      return next(
        new AppError(403, `Forbidden: requires one of ${permissions.join(', ')}`, {
          requiredAny: permissions,
          role: req.user.role,
        })
      );
    } catch (err) {
      return next(err);
    }
  };
  guard[PERMISSION_GUARD] = { permissions, mode: 'any' };
  return guard;
}

/**
 * Rejects a request that names a hospital other than the caller's own.
 *
 * Platform admins may name any hospital. Hospital-scoped staff are pinned to their own,
 * and a mismatch is an error rather than a silent no-op so cross-tenant probing fails
 * loudly. Request bodies that omit a hospital are allowed through: the controller
 * resolves the assignment with `resolveAssignmentTarget`.
 */
export function facilityScoped(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user) return next(new AppError(401, 'Authentication required'));
  const requested = requestedFacilityId(req);
  if (!requested) return next();
  try {
    assertFacilityAccess(req, requested);
    return next();
  } catch (err) {
    return next(err);
  }
}

export function selfOr(roles: string[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Authentication required'));
    const targetId = req.params.id ?? req.params.userId;
    if (targetId === req.user.id) return next();
    if (hasRole(req.user, ...roles)) return next();
    await recordDenial(req, 'self', ['self-or-' + roles.join('|')]);
    return next(new AppError(403, 'Forbidden'));
  };
}

/** Reads the authenticated principal, throwing when the route was mounted without `authenticate`. */
export function requireUser(req: AuthRequest): AuthUser {
  if (!req.user) throw new AppError(401, 'Authentication required');
  return req.user;
}

/**
 * Requires that the hospital named in a route parameter is the caller's own.
 *
 * Use on nested routes such as `GET /facilities/:id/staff` where a role guard alone would
 * still let a hospital admin read another hospital's data. Platform admins bypass it.
 */
export function requireOwnedParam(param = 'id') {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Authentication required'));
    try {
      assertFacilityAccess(req, req.params[param]);
      return next();
    } catch (err) {
      // Naming another tenant's id is the clearest possible signal of probing, so it is worth
      // its own trail entry even though the request was already going to be refused.
      await recordDenial(req, 'tenant', [`owned:${param}`]);
      return next(err);
    }
  };
}
