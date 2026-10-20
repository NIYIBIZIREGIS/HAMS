import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createUser, createPatient, createDoctorWithSchedule } from './factories';
import { Role } from '../src/models';
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  WILDCARD,
  defaultPermissionsFor,
  resolvePermissions,
  roleHasPermission,
  permissionSetSatisfies,
} from '../src/utils/permissions';
import { syncRoleCatalog } from '../src/services/roleCatalog';
import { PERMISSION_GUARD, ROLE_GUARD } from '../src/middleware/rbac';

interface GuardedRoute {
  method: string;
  path: string;
  roles: string[];
  permissions: { permissions: string[]; mode: 'all' | 'any' }[];
}

type TaggedHandler = {
  (req: Request, res: Response, next: NextFunction): void | Promise<void>;
  [ROLE_GUARD]?: { roles: string[] };
  [PERMISSION_GUARD]?: { permissions: string[]; mode: 'all' | 'any' };
};

interface Layer {
  route?: { path: string; stack: Layer[]; methods?: string[] };
  regexp?: RegExp;
  handle?: TaggedHandler & { stack?: Layer[] };
}

function tagsOf(layer: Layer) {
  const handler = layer.handle;
  if (typeof handler !== 'function') return {};
  return { role: handler[ROLE_GUARD], permission: handler[PERMISSION_GUARD] };
}

/**
 * Walks the mounted routers and recovers which role and permission guards protect each route.
 *
 * The guards carry metadata for exactly this purpose. Without it the only way to know that a
 * role guard and a permission guard agree is to send a request per combination, and a route
 * that nobody exercises keeps its contradiction until production.
 */
function collectGuardedRoutes(): GuardedRoute[] {
  const found: GuardedRoute[] = [];

  const walk = (stack: Layer[], prefix: string) => {
    for (const layer of stack) {
      if (layer.route) {
        const roles: string[] = [];
        const permissions: GuardedRoute['permissions'] = [];
        for (const handlerLayer of layer.route.stack) {
          const { role, permission } = tagsOf(handlerLayer);
          if (role) roles.push(...role.roles);
          if (permission) permissions.push(permission);
        }
        if (roles.length || permissions.length) {
          for (const method of Object.keys(layer.route.methods ?? {})) {
            found.push({
              method: method.toUpperCase(),
              path: `${prefix}${layer.route.path}`,
              roles,
              permissions,
            });
          }
        }
        continue;
      }

      // A mounted sub-router. Express only keeps the mount path inside the regexp, so probe
      // it with a sentinel to recover a readable prefix for the failure messages.
      const mounted = layer.handle;
      if (!mounted || !Array.isArray(mounted.stack)) continue;
      const probe = (layer.regexp?.exec('/') ?? [''])[0].replace(/^\/+|\/+$/g, '');
      walk(mounted.stack, `${prefix}${probe ? `/${probe}` : ''}`);
    }
  };

  const router = (app as unknown as { _router: { stack: Layer[] } })._router;
  walk(router.stack, '');
  return found;
}

describe('Permission-based RBAC', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  describe('catalog integrity', () => {
    it('has no duplicate permission strings', () => {
      expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
    });

    it('only grants permissions that exist in the catalog', () => {
      const known = new Set<string>([...ALL_PERMISSIONS, WILDCARD]);
      const orphans: string[] = [];
      for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
        for (const permission of permissions) {
          if (!known.has(permission)) orphans.push(`${role} -> ${permission}`);
        }
      }
      expect(orphans).toEqual([]);
    });

    it('grants no unknown role the wildcard', () => {
      const wildcardHolders = Object.entries(ROLE_PERMISSIONS)
        .filter(([, permissions]) => permissions.includes(WILDCARD))
        .map(([role]) => role);
      expect(wildcardHolders).toEqual(['super_admin']);
    });

    it('keeps a patient limited to self-service permissions', () => {
      const patientGrants = defaultPermissionsFor('patient');
      expect(patientGrants.length).toBeGreaterThan(0);
      for (const permission of patientGrants) {
        expect(permission.startsWith('self.')).toBe(true);
      }
    });

    it('gives an unknown role nothing rather than everything', () => {
      expect(defaultPermissionsFor('some_role_that_does_not_exist')).toEqual([]);
      expect(roleHasPermission('some_role_that_does_not_exist', PERMISSIONS.RECORDS_VIEW)).toBe(false);
    });

    it('treats hospital_admin as an alias of facility_admin', () => {
      expect(defaultPermissionsFor('hospital_admin')).toEqual(defaultPermissionsFor('facility_admin'));
    });
  });

  describe('requirePermission semantics', () => {
    it('requires every listed permission, not just one', () => {
      const granted = [PERMISSIONS.RECORDS_VIEW, PERMISSIONS.PRESCRIPTIONS_WRITE];
      expect(permissionSetSatisfies(granted, [PERMISSIONS.RECORDS_VIEW])).toBe(true);
      expect(
        permissionSetSatisfies(granted, [PERMISSIONS.RECORDS_VIEW, PERMISSIONS.LAB_ORDER])
      ).toBe(false);
    });

    it('lets the wildcard satisfy anything', () => {
      expect(
        permissionSetSatisfies([WILDCARD], [PERMISSIONS.PLATFORM_FACILITY_DELETE])
      ).toBe(true);
    });
  });

  describe('database resolution', () => {
    it('falls back to the code catalog when no Role document exists', async () => {
      await Role.deleteMany({});
      const resolved = await resolvePermissions('receptionist');
      expect(resolved).toEqual([...defaultPermissionsFor('receptionist')]);
    });

    it('prefers a stored grant over the code default, so a role can be narrowed', async () => {
      await Role.create({ name: 'receptionist', permissions: [PERMISSIONS.PATIENT_VIEW] });
      const resolved = await resolvePermissions('receptionist');
      expect(resolved).toEqual([PERMISSIONS.PATIENT_VIEW]);
      expect(resolved).not.toContain(PERMISSIONS.PAYMENTS_RECORD);
    });

    it('reconciles stale permissions on re-seed instead of skipping the role', async () => {
      await Role.create({
        name: 'nurse',
        permissions: [PERMISSIONS.RECORDS_VIEW, 'records.manag'],
      });
      const first = await syncRoleCatalog();
      expect(first.updated).toContain('nurse');
      expect((await Role.findOne({ name: 'nurse' }))?.permissions).toEqual([
        ...defaultPermissionsFor('nurse'),
      ]);
    });

    it('creates catalog roles on first sync and is idempotent afterwards', async () => {
      await Role.deleteMany({});
      const first = await syncRoleCatalog();
      expect(first.created).toContain('doctor');
      const second = await syncRoleCatalog();
      expect(second.created).toEqual([]);
      expect(second.unchanged).toContain('doctor');
    });

    it('leaves roles outside the catalog alone', async () => {
      await Role.create({ name: 'district_supervisor', permissions: ['facility.oversight'] });
      await syncRoleCatalog();
      expect((await Role.findOne({ name: 'district_supervisor' }))?.permissions).toEqual([
        'facility.oversight',
      ]);
    });
  });

  describe('route guards', () => {
    it('finds the permission-guarded routes', () => {
      const routes = collectGuardedRoutes();
      const permissionGuarded = routes.filter((r) => r.permissions.length > 0);
      expect(permissionGuarded.length).toBeGreaterThan(10);
    });

    it('pairs every permission guard with a role guard', () => {
      const orphans = collectGuardedRoutes()
        .filter((r) => r.permissions.length > 0 && r.roles.length === 0)
        .map((r) => `${r.method} ${r.path}`);
      expect(orphans).toEqual([]);
    });

    /**
     * The invariant that makes layering a permission guard onto an existing route safe: any
     * role the route already accepts must still hold the permission the route now demands,
     * otherwise the change silently locks out a legitimate user.
     */
    it('never excludes a role that the same route already allows', () => {
      const violations: string[] = [];

      for (const route of collectGuardedRoutes()) {
        for (const guard of route.permissions) {
          for (const role of route.roles) {
            const held = new Set(defaultPermissionsFor(role));
            const satisfied =
              held.has(WILDCARD) ||
              (guard.mode === 'all'
                ? guard.permissions.every((p) => held.has(p))
                : guard.permissions.some((p) => held.has(p)));

            if (!satisfied) {
              violations.push(
                `${route.method} ${route.path}: role ${role} lacks ${guard.permissions.join('+')}`
              );
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('refuses a request whose role lacks the permission, naming the permission', async () => {
      const facility = await createFacility();
      const facilityAdmin = await createUser({
        role: 'facility_admin',
        facilityId: String(facility._id),
      });
      // The role guard still accepts a facility_admin, so the refusal can only come from the
      // permission guard — which is what makes a deploy-time grant change take effect.
      await Role.create({ name: 'facility_admin', permissions: [PERMISSIONS.PATIENT_VIEW] });

      const res = await request(app)
        .post('/api/users')
        .set('x-test-user', facilityAdmin.email as string)
        .send({ fullName: 'Test', email: 'new.staff@test.local', role: 'nurse' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/permission/i);
      expect(res.body.details?.required).toEqual([PERMISSIONS.FACILITY_STAFF_MANAGE]);
    });

    it('still admits a role that does hold the permission', async () => {
      const facility = await createFacility();
      const pharmacist = await createUser({ role: 'pharmacist', facilityId: String(facility._id) });

      const res = await request(app)
        .post('/api/pharmacy/dispense')
        .set('x-test-user', pharmacist.email as string)
        .send({ inventoryId: '507f1f77bcf86cd799439011', quantity: 1 });

      // Passing the guard is enough; the controller still rejects the unknown inventory id.
      expect(res.status).not.toBe(403);
    });

    it('lets super_admin through regardless of stored grants', async () => {
      await Role.create({ name: 'super_admin', permissions: [] });
      const superAdmin = await createUser({ role: 'super_admin', facilityId: null });

      const res = await request(app)
        .get('/api/facilities')
        .set('x-test-user', superAdmin.email as string);

      expect(res.status).toBe(200);
    });

    it('honours a narrowed grant stored in the database', async () => {
      const facility = await createFacility();
      const facilityAdmin = await createUser({
        role: 'facility_admin',
        facilityId: String(facility._id),
      });
      await Role.create({
        name: 'facility_admin',
        permissions: [PERMISSIONS.PATIENT_VIEW],
      });

      const read = await request(app)
        .get('/api/users')
        .set('x-test-user', facilityAdmin.email as string);
      expect(read.status).toBe(403);

      const write = await request(app)
        .post('/api/users')
        .set('x-test-user', facilityAdmin.email as string)
        .send({ fullName: 'Test', email: 'new.staff@test.local', role: 'nurse' });
      expect(write.status).toBe(403);
    });

    it('lets a patient book an appointment through the self-service grant', async () => {
      const facility = await createFacility();
      const { user } = await createPatient();
      const { doctor } = await createDoctorWithSchedule(
        String(facility._id),
        '000000000000000000000001'
      );

      const res = await request(app)
        .post('/api/appointments')
        .set('x-test-user', user.email as string)
        .send({
          doctorId: String(doctor._id),
          facilityId: String(facility._id),
          appointmentDate: new Date(Date.now() + 86_400_000).toISOString(),
          startTime: '09:00',
          reason: 'Check-up',
        });
      expect(res.status).not.toBe(403);
    });

    it('refuses a receptionist who has been stripped of payment recording', async () => {
      const facility = await createFacility();
      const receptionist = await createUser({
        role: 'receptionist',
        facilityId: String(facility._id),
      });
      await Role.create({
        name: 'receptionist',
        permissions: [PERMISSIONS.PATIENT_VIEW, PERMISSIONS.APPOINTMENTS_CREATE],
      });

      const res = await request(app)
        .post('/api/payments')
        .set('x-test-user', receptionist.email as string)
        .send({ patientId: '507f1f77bcf86cd799439011', amount: 1000, method: 'cash' });

      expect(res.status).toBe(403);
      expect(res.body.details?.required).toEqual([PERMISSIONS.PAYMENTS_RECORD]);
    });

    it('still admits a patient to their own payments through the self-service grant', async () => {
      const { user } = await createPatient();
      const res = await request(app)
        .get('/api/payments/me')
        .set('x-test-user', user.email as string);
      expect(res.status).toBe(200);
    });

    it('still lets a patient read their own documents through the self-service grant', async () => {
      const { user } = await createPatient();
      const res = await request(app)
        .get('/api/patient-documents')
        .set('x-test-user', user.email as string);
      expect(res.status).toBe(200);
    });
  });
});
