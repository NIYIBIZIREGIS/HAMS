import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createUser, createPatient } from './factories';
import { AuditLog } from '../src/models';
import { AUDIT_GUARD } from '../src/middleware/auditLog';
import { PERMISSION_GUARD, ROLE_GUARD } from '../src/middleware/rbac';
import { PERMISSIONS } from '../src/utils/permissions';

const MUTATIONS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Mutations that are deliberately not audited, named individually so that exempting a new route
 * is a visible decision rather than a silent gap.
 *
 * Read receipts on a user's own messages and notifications are the only exemption. They are
 * high-frequency, low-consequence state changes to a caller's own data: auditing them would add
 * an entry every time any user opened their inbox, and the signal-to-noise cost of a trail that
 * mostly says "read" is paid by exactly the investigations the trail exists to serve. The
 * permission that guards them is still enforced, and any actual change to another party's data
 * remains audited.
 */
const AUDIT_EXEMPT: { method: string; path: string; why: string }[] = [
  { method: 'PATCH', path: '/api/messages/:id/read', why: 'own read receipt' },
  { method: 'PATCH', path: '/api/notifications/:id/read', why: 'own read receipt' },
  { method: 'PATCH', path: '/api/notifications/read-all', why: 'own read receipts' },
];

function isExempt(route: DiscoveredRoute): boolean {
  return AUDIT_EXEMPT.some(
    (exempt) => exempt.method === route.method && exempt.path === route.path
  );
}

interface Layer {
  route?: { path: string; stack: Layer[]; methods?: string[] };
  regexp?: RegExp;
  handle?: ((req: Request, res: Response, next: NextFunction) => void) & {
    stack?: Layer[];
    [ROLE_GUARD]?: { roles: string[] };
    [PERMISSION_GUARD]?: { permissions: string[]; mode: 'all' | 'any' };
    [AUDIT_GUARD]?: { entity: string; methods: string[] };
  };
}

interface DiscoveredRoute {
  method: string;
  path: string;
  privileged: boolean;
  roles: string[];
  permissions: string[];
  audited: boolean;
  auditEntity?: string;
}

/**
 * Recovers the mount path of a sub-router.
 *
 * Express keeps it only inside the layer's regexp, e.g. `^\/api\/audit-logs\/?(?=\/|$)`.
 * Matching the regexp against a sentinel never matches here, because every one of these requires
 * a non-empty path after the mount point — so the literal prefix is read out of the source
 * instead. Without a real prefix, `/api/audit-logs` and `/api/messages` are indistinguishable
 * and the coverage assertions below would silently pass on an empty set.
 */
function mountPath(regexp: RegExp | undefined): string {
  const source = regexp?.source ?? '';
  const unescaped = source.replace(/^\^/, '').replace(/\\\//g, '/');
  const match = /^\/*([\w\-/]+)/.exec(unescaped);
  if (!match) return '';
  return `/${match[1].replace(/\/+$/, '')}`;
}

function collectRoutes(): DiscoveredRoute[] {
  const found: DiscoveredRoute[] = [];

  const walk = (stack: Layer[], prefix: string) => {
    for (const layer of stack) {
      if (layer.route) {
        const roles: string[] = [];
        const permissions: string[] = [];
        let audited = false;
        let auditEntity: string | undefined;

        for (const handlerLayer of layer.route.stack) {
          const handle = handlerLayer.handle;
          if (typeof handle !== 'function') continue;
          if (handle[ROLE_GUARD]) roles.push(...handle[ROLE_GUARD].roles);
          if (handle[PERMISSION_GUARD]) permissions.push(...handle[PERMISSION_GUARD].permissions);
          if (handle[AUDIT_GUARD]) {
            audited = true;
            auditEntity = handle[AUDIT_GUARD].entity;
          }
        }

        for (const method of Object.keys(layer.route.methods ?? {})) {
          const upper = method.toUpperCase();
          found.push({
            method: upper,
            path: `${prefix}${layer.route.path}`,
            // A mutation is "privileged" when a guard decides who may call it. Unguarded
            // mutations are self-service or public, and the request-level tests cover those.
            privileged: MUTATIONS.includes(upper) && (roles.length > 0 || permissions.length > 0),
            roles,
            permissions,
            audited,
            auditEntity,
          });
        }
        continue;
      }

      const mounted = layer.handle;
      if (!mounted || !Array.isArray(mounted.stack)) continue;
      walk(mounted.stack, `${prefix}${mountPath(layer.regexp)}`);
    }
  };

  const router = (app as unknown as { _router: { stack: Layer[] } })._router;
  walk(router.stack, '');
  return found;
}

describe('Audit trail', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  describe('coverage invariants', () => {
    it('audits every privileged mutation', () => {
      const unaudited = collectRoutes()
        .filter((route) => route.privileged && !route.audited && !isExempt(route))
        .map((route) => `${route.method} ${route.path}`);
      expect(unaudited).toEqual([]);
    });

    it('keeps the exemption list honest', () => {
      // An exemption that no longer matches a real route is stale documentation, and an
      // exemption that has quietly started covering a mutation is a hole in the trail.
      const privileged = collectRoutes().filter(
        (route) => route.privileged && !route.audited
      );
      const exemptions = AUDIT_EXEMPT.filter((exempt) =>
        privileged.some(
          (route) => route.method === exempt.method && route.path === exempt.path
        )
      );
      expect(exemptions.map((exempt) => `${exempt.method} ${exempt.path}`).sort()).toEqual(
        AUDIT_EXEMPT.map((exempt) => `${exempt.method} ${exempt.path}`).sort()
      );
      for (const exempt of AUDIT_EXEMPT) {
        expect(exempt.why).toBeTruthy();
      }
    });

    it('never mounts a mutating route on the audit-log API', () => {
      // An auditor who can edit or delete entries can erase their own tracks, which would make
      // the collection worthless as evidence.
      const mutations = collectRoutes()
        .filter((route) => route.path.startsWith('/api/audit-logs'))
        .filter((route) => MUTATIONS.includes(route.method));
      expect(mutations).toEqual([]);
    });

    it('grants every role that can read audit logs the audit permission', () => {
      const routes = collectRoutes().filter((route) => route.path.startsWith('/api/audit-logs'));
      expect(routes.length).toBeGreaterThan(0);
      for (const route of routes) {
        expect(route.permissions).toContain(PERMISSIONS.AUDIT_VIEW);
      }
    });
  });

  describe('recorded entries', () => {
    it('records the target hospital, not the actor, for a platform deletion', async () => {
      const facility = await createFacility();
      const platformAdmin = await createUser({ role: 'super_admin' });

      await request(app)
        .delete(`/api/facilities/${facility._id}`)
        .set('x-test-user', platformAdmin.email as string);

      const entry = await AuditLog.findOne({ entity: 'Facility', action: 'DELETE' }).lean();
      expect(entry).not.toBeNull();
      // A platform owner has no hospital of their own; filing this under null would make the
      // trail impossible to filter per tenant.
      expect(String(entry?.facilityId)).toBe(String(facility._id));
      expect(entry?.actorFacilityId).toBeNull();
    });

    it('records a role change explicitly rather than leaving it to be diffed', async () => {
      const facility = await createFacility();
      const doctor = await createUser({ role: 'doctor', facilityId: facility._id });
      const facilityAdmin = await createUser({
        role: 'facility_admin',
        facilityId: facility._id,
      });

      await request(app)
        .put(`/api/users/${doctor._id}`)
        .set('x-test-user', facilityAdmin.email as string)
        .send({ role: 'receptionist' });

      const entry = await AuditLog.findOne({ entity: 'User', action: 'PUT' })
        .sort({ timestamp: -1 })
        .lean();
      expect(entry?.metadata).toMatchObject({
        roleChanged: { from: 'doctor', to: 'receptionist' },
      });
      expect(entry?.summary).toContain('doctor');
    });

    it('never stores a password in a snapshot', async () => {
      const facility = await createFacility();
      const facilityAdmin = await createUser({
        role: 'facility_admin',
        facilityId: facility._id,
      });

      await request(app)
        .post('/api/users')
        .set('x-test-user', facilityAdmin.email as string)
        .send({
          fullName: 'New Receptionist',
          email: 'new.reception@example.test',
          password: 'SuperSecret123!',
          role: 'receptionist',
          facilityId: facility._id,
        });

      const serialised = JSON.stringify((await AuditLog.find().lean()) ?? []);
      expect(serialised).not.toContain('SuperSecret123!');
    });

    it('records a refused privileged action', async () => {
      const facility = await createFacility();
      const receptionist = await createUser({
        role: 'receptionist',
        facilityId: facility._id,
      });

      await request(app)
        .delete(`/api/facilities/${facility._id}`)
        .set('x-test-user', receptionist.email as string);

      const entry = await AuditLog.findOne({ action: 'DENIED' }).lean();
      expect(entry).not.toBeNull();
      expect(entry?.entity).toBe('Access');
      expect(entry?.succeeded).toBe(false);
      expect(entry?.metadata).toMatchObject({ guard: 'role' });
    });

    it('records a cross-tenant read attempt', async () => {
      const mine = await createFacility();
      const theirs = await createFacility();
      const facilityAdmin = await createUser({
        role: 'facility_admin',
        facilityId: mine._id,
      });

      await request(app)
        .get(`/api/facilities/${theirs._id}/staff`)
        .set('x-test-user', facilityAdmin.email as string);

      const entry = await AuditLog.findOne({ action: 'DENIED' }).lean();
      expect(entry?.metadata).toMatchObject({ guard: 'tenant' });
    });
  });

  describe('reading the trail', () => {
    it('limits an auditor to their own hospital', async () => {
      const mine = await createFacility();
      const theirs = await createFacility();
      const auditor = await createUser({ role: 'auditor', facilityId: mine._id });

      await AuditLog.create({
        action: 'POST',
        entity: 'Patient',
        facilityId: mine._id,
        succeeded: true,
        statusCode: 201,
        timestamp: new Date(),
      });
      await AuditLog.create({
        action: 'POST',
        entity: 'Patient',
        facilityId: theirs._id,
        succeeded: true,
        statusCode: 201,
        timestamp: new Date(),
      });

      const res = await request(app).get('/api/audit-logs').set('x-test-user', auditor.email as string);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(String(res.body.data[0].facilityId)).toBe(String(mine._id));
    });

    it('ignores a facilityId override instead of widening the result set', async () => {
      const mine = await createFacility();
      const theirs = await createFacility();
      const auditor = await createUser({ role: 'auditor', facilityId: mine._id });

      await AuditLog.create({
        action: 'POST',
        entity: 'Patient',
        facilityId: theirs._id,
        succeeded: true,
        statusCode: 201,
        timestamp: new Date(),
      });

      const res = await request(app)
        .get(`/api/audit-logs?facilityId=${theirs._id}`)
        .set('x-test-user', auditor.email as string);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('lets a platform owner read across tenants', async () => {
      const first = await createFacility();
      const second = await createFacility();
      const platformAdmin = await createUser({ role: 'super_admin' });

      await AuditLog.create({
        action: 'POST',
        entity: 'Patient',
        facilityId: first._id,
        succeeded: true,
        statusCode: 201,
        timestamp: new Date(),
      });
      await AuditLog.create({
        action: 'POST',
        entity: 'Patient',
        facilityId: second._id,
        succeeded: true,
        statusCode: 201,
        timestamp: new Date(),
      });

      const res = await request(app).get('/api/audit-logs').set('x-test-user', platformAdmin.email as string);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('filters by outcome so a failed attempt can be reviewed', async () => {
      const facility = await createFacility();
      const auditor = await createUser({ role: 'auditor', facilityId: facility._id });

      await AuditLog.create({
        action: 'DENIED',
        entity: 'Access',
        facilityId: facility._id,
        succeeded: false,
        statusCode: 403,
        timestamp: new Date(),
      });
      await AuditLog.create({
        action: 'POST',
        entity: 'Patient',
        facilityId: facility._id,
        succeeded: true,
        statusCode: 201,
        timestamp: new Date(),
      });

      const res = await request(app)
        .get('/api/audit-logs?succeeded=false')
        .set('x-test-user', auditor.email as string);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].action).toBe('DENIED');
    });

    it('refuses a patient', async () => {
      const patient = await createPatient();

      const res = await request(app)
        .get('/api/audit-logs')
        .set('x-test-user', patient.user.email as string);

      expect(res.status).toBe(403);
    });

    it('hides an entry from another hospital behind a 404', async () => {
      const theirs = await createFacility();
      const auditor = await createUser({ role: 'auditor', facilityId: (await createFacility())._id });

      const entry = await AuditLog.create({
        action: 'POST',
        entity: 'Patient',
        facilityId: theirs._id,
        succeeded: true,
        statusCode: 201,
        timestamp: new Date(),
      });

      const res = await request(app)
        .get(`/api/audit-logs/${entry._id}`)
        .set('x-test-user', auditor.email as string);

      // 404 rather than 403 so the endpoint does not confirm that the entry exists.
      expect(res.status).toBe(404);
    });
  });
});
