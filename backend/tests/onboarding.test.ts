import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createUser } from './factories';
import { Facility, User, AuditLog, Patient } from '../src/models';
import { generateTemporaryPassword } from '../src/utils/password';

describe('Hospital onboarding', () => {
  let superAdmin: Awaited<ReturnType<typeof createUser>>;

  const as = (r: request.Test, user: { email?: string }) => r.set('x-test-user', user.email as string);

  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    superAdmin = await createUser({ role: 'super_admin', facilityId: null });
  });

  afterAll(async () => {
    await closeTestDB();
  });

  const adminPayload = {
    fullName: 'Alice Mukamana',
    email: 'alice.admin@test.local',
  };

  describe('temporary password generator', () => {
    it('satisfies the strong-password rule every time', () => {
      for (let i = 0; i < 200; i += 1) {
        const password = generateTemporaryPassword();
        expect(password.length).toBeGreaterThanOrEqual(14);
        expect(password).toMatch(/[a-zA-Z]/);
        expect(password).toMatch(/[0-9]/);
        expect(/[^a-zA-Z0-9]/.test(password)).toBe(true);
      }
    });

    it('does not repeat across many calls', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 200; i += 1) seen.add(generateTemporaryPassword());
      expect(seen.size).toBe(200);
    });

    it('avoids visually ambiguous characters', () => {
      for (let i = 0; i < 100; i += 1) {
        expect(generateTemporaryPassword()).not.toMatch(/[O0lI1]/);
      }
    });
  });

  describe('registering a hospital with its first admin', () => {
    it('creates the hospital and its facility_admin in one request', async () => {
      const res = await as(request(app).post('/api/facilities'), superAdmin).send({
        name: 'Kigali General Hospital',
        type: 'hospital',
        region: 'Kigali',
        contactInfo: { email: 'info@kigali.test' },
        logo: 'https://cdn.test/logo.png',
        subscriptionStatus: 'trial',
        admin: adminPayload,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.facility.name).toBe('Kigali General Hospital');
      expect(res.body.data.facility.logo).toBe('https://cdn.test/logo.png');
      expect(res.body.data.facility.subscriptionStatus).toBe('trial');
      expect(res.body.data.facility.deletedAt).toBeNull();
      expect(res.body.data.admin.email).toBe('alice.admin@test.local');
      expect(res.body.data.admin.role).toBe('facility_admin');

      const admin = await User.findOne({ email: 'alice.admin@test.local' });
      expect(admin).toBeTruthy();
      expect(String(admin?.facilityId)).toBe(res.body.data.facility._id);
      expect(admin?.mustChangePassword).toBe(true);
      expect(admin?.status).toBe('active');
    });

    it('returns the temporary password exactly once and never in plaintext storage', async () => {
      const res = await as(request(app).post('/api/facilities'), superAdmin).send({
        name: 'Once Only Hospital',
        type: 'hospital',
        admin: adminPayload,
      });

      expect(res.status).toBe(201);
      const tempPassword = res.body.data.temporaryPassword;
      expect(typeof tempPassword).toBe('string');
      expect(tempPassword.length).toBeGreaterThanOrEqual(14);

      const admin = await User.findOne({ email: 'alice.admin@test.local' });
      // Only the bcrypt hash is persisted.
      expect(admin?.passwordHash).not.toContain(tempPassword);
      expect(admin?.passwordHash).toMatch(/^\$2[aby]\$/);

      // A later read of the same hospital must not re-expose it.
      const detail = await as(request(app).get(`/api/facilities/${res.body.data.facility._id}`), superAdmin);
      expect(JSON.stringify(detail.body)).not.toContain(tempPassword);
    });

    it('lets the onboarded admin sign in with the temporary password', async () => {
      const created = await as(request(app).post('/api/facilities'), superAdmin).send({
        name: 'Login Test Hospital',
        type: 'hospital',
        admin: adminPayload,
      });
      const tempPassword = created.body.data.temporaryPassword;

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alice.admin@test.local', password: tempPassword });

      expect(res.status).toBe(200);
      expect(res.body.data.user.mustChangePassword).toBe(true);
      expect(res.body.data.user.facilityId).toBe(created.body.data.facility._id);
    });

    it('clears mustChangePassword once the admin chooses a private password', async () => {
      const created = await as(request(app).post('/api/facilities'), superAdmin).send({
        name: 'Rotate Test Hospital',
        type: 'hospital',
        admin: adminPayload,
      });
      const tempPassword = created.body.data.temporaryPassword;

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${(
          await request(app)
            .post('/api/auth/login')
            .send({ email: 'alice.admin@test.local', password: tempPassword })
        ).body.data.tokens.accessToken}`)
        .send({ currentPassword: tempPassword, newPassword: 'BrandNew@4567' });

      expect(res.status).toBe(200);
      const admin = await User.findOne({ email: 'alice.admin@test.local' });
      expect(admin?.mustChangePassword).toBe(false);
    });

    it('locks the temporary-password account out of the API until it rotates', async () => {
      const created = await as(request(app).post('/api/facilities'), superAdmin).send({
        name: 'Locked Out Hospital',
        type: 'hospital',
        admin: adminPayload,
      });
      const tempPassword = created.body.data.temporaryPassword;
      const token = (
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'alice.admin@test.local', password: tempPassword })
      ).body.data.tokens.accessToken;

      const blocked = await request(app).get('/api/patients').set('Authorization', `Bearer ${token}`);
      expect(blocked.status).toBe(403);
      expect(blocked.body.error).toMatch(/password change required/i);
      expect(blocked.body.details?.code).toBe('MUST_CHANGE_PASSWORD');

      const stillBlockedViaTestHeader = await as(request(app).get('/api/patients'), {
        email: 'alice.admin@test.local',
      });
      expect(stillBlockedViaTestHeader.status).toBe(403);

      const rotated = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: tempPassword, newPassword: 'BrandNew@4567' });
      expect(rotated.status).toBe(200);

      const allowed = await request(app).get('/api/patients').set('Authorization', `Bearer ${token}`);
      expect(allowed.status).toBe(200);
    });

    it('refuses to reuse a password that was already current', async () => {
      const created = await as(request(app).post('/api/facilities'), superAdmin).send({
        name: 'Same Password Hospital',
        type: 'hospital',
        admin: adminPayload,
      });
      const tempPassword = created.body.data.temporaryPassword;
      const token = (
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'alice.admin@test.local', password: tempPassword })
      ).body.data.tokens.accessToken;

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: tempPassword, newPassword: tempPassword });

      expect(res.status).toBe(400);
    });

    it('still supports registering a hospital without an admin', async () => {
      const res = await as(request(app).post('/api/facilities'), superAdmin).send({
        name: 'No Admin Yet Hospital',
        type: 'clinic',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.temporaryPassword).toBeUndefined();
      expect(await User.countDocuments({ role: 'facility_admin' })).toBe(0);
    });

    it('rejects a duplicate live hospital name', async () => {
      await as(request(app).post('/api/facilities'), superAdmin).send({ name: 'Dupe', type: 'clinic' });
      const res = await as(request(app).post('/api/facilities'), superAdmin).send({ name: 'Dupe', type: 'clinic' });

      expect(res.status).toBe(409);
    });

    it('rejects a non-http logo reference', async () => {
      const res = await as(request(app).post('/api/facilities'), superAdmin).send({
        name: 'Bad Logo Hospital',
        type: 'clinic',
        logo: 'javascript:alert(1)',
        admin: adminPayload,
      });

      expect(res.status).toBe(400);
    });

    it('rejects onboarding when the admin email already exists, and leaves no orphan hospital', async () => {
      await createUser({ email: 'alice.admin@test.local' });

      const res = await as(request(app).post('/api/facilities'), superAdmin).send({
        name: 'Rollback Hospital',
        type: 'hospital',
        admin: adminPayload,
      });

      expect(res.status).toBe(409);
      // The half-onboarded hospital must not survive the failure.
      expect(await Facility.countDocuments({ name: 'Rollback Hospital' })).toBe(0);
    });

    it('rejects a malformed admin block', async () => {
      const res = await as(request(app).post('/api/facilities'), superAdmin).send({
        name: 'Bad Admin Hospital',
        type: 'hospital',
        admin: { fullName: 'Al', email: 'not-an-email' },
      });

      expect(res.status).toBe(400);
    });

    it('refuses onboarding from a non-platform role', async () => {
      const facility = await createFacility();
      const facilityAdmin = await createUser({ role: 'facility_admin', facilityId: String(facility._id) });

      const res = await as(request(app).post('/api/facilities'), facilityAdmin).send({
        name: 'Sneaky Hospital',
        type: 'hospital',
        admin: { fullName: 'Sneaky Admin', email: 'sneaky@test.local' },
      });

      expect(res.status).toBe(403);
    });

    it('audits hospital registration', async () => {
      await as(request(app).post('/api/facilities'), superAdmin).send({
        name: 'Audited Onboarding',
        type: 'hospital',
        admin: adminPayload,
      });

      const entry = await AuditLog.findOne({ entity: 'Facility', action: 'POST' });
      expect(entry).toBeTruthy();
      expect(String(entry?.userId)).toBe(String(superAdmin._id));
    });
  });

  describe('subscription management', () => {
    it('records subscription status and expiry', async () => {
      const facility = await createFacility();

      const res = await as(request(app).patch(`/api/facilities/${facility._id}/subscription`), superAdmin).send({
        subscriptionStatus: 'active',
        subscriptionExpiresAt: '2027-01-01T00:00:00.000Z',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.subscriptionStatus).toBe('active');
      expect(new Date(res.body.data.subscriptionExpiresAt).getUTCFullYear()).toBe(2027);
    });

    it('deactivates a hospital when its subscription is suspended', async () => {
      const facility = await createFacility();

      const res = await as(request(app).patch(`/api/facilities/${facility._id}/subscription`), superAdmin).send({
        subscriptionStatus: 'suspended',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('rejects an unknown subscription status', async () => {
      const facility = await createFacility();
      const res = await as(request(app).patch(`/api/facilities/${facility._id}/subscription`), superAdmin).send({
        subscriptionStatus: 'platinum',
      });

      expect(res.status).toBe(400);
    });

    it('refuses subscription changes from a hospital admin', async () => {
      const facility = await createFacility();
      const facilityAdmin = await createUser({ role: 'facility_admin', facilityId: String(facility._id) });

      const res = await as(
        request(app).patch(`/api/facilities/${facility._id}/subscription`),
        facilityAdmin
      ).send({ subscriptionStatus: 'active' });

      expect(res.status).toBe(403);
    });

    it('blocks sign-in while the subscription is suspended', async () => {
      const facility = await createFacility();
      const facilityAdmin = await createUser({ role: 'facility_admin', facilityId: String(facility._id) });
      await Facility.updateOne({ _id: facility._id }, { $set: { subscriptionStatus: 'suspended' } });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: facilityAdmin.email, password: 'Password@123' });

      expect(res.status).toBe(403);
    });

    it('revokes access tokens that were already issued before the suspension', async () => {
      const facility = await createFacility();
      const facilityAdmin = await createUser({ role: 'facility_admin', facilityId: String(facility._id) });
      const token = (
        await request(app)
          .post('/api/auth/login')
          .send({ email: facilityAdmin.email, password: 'Password@123' })
      ).body.data.tokens.accessToken;

      const before = await request(app).get('/api/patients').set('Authorization', `Bearer ${token}`);
      expect(before.status).toBe(200);

      await as(request(app).patch(`/api/facilities/${facility._id}/subscription`), superAdmin).send({
        subscriptionStatus: 'suspended',
      });

      const after = await request(app).get('/api/patients').set('Authorization', `Bearer ${token}`);
      expect(after.status).toBe(403);
      expect(after.body.error).toMatch(/suspended/i);

      const viaTestHeader = await as(request(app).get('/api/patients'), facilityAdmin);
      expect(viaTestHeader.status).toBe(403);

      await as(request(app).patch(`/api/facilities/${facility._id}/subscription`), superAdmin).send({
        subscriptionStatus: 'active',
      });
      const reinstated = await request(app).get('/api/patients').set('Authorization', `Bearer ${token}`);
      expect(reinstated.status).toBe(200);
    });
  });

  describe('soft delete', () => {
    async function onboarded() {
      const res = await as(request(app).post('/api/facilities'), superAdmin).send({
        name: `Deletable ${Date.now()}`,
        type: 'hospital',
        admin: adminPayload,
      });
      return {
        facilityId: res.body.data.facility._id,
        email: res.body.data.admin.email,
        temporaryPassword: res.body.data.temporaryPassword,
      };
    }

    it('keeps the hospital row so tenant history stays intact', async () => {
      const { facilityId } = await onboarded();
      const patient = await createUser({ role: 'patient' });
      await Patient.create({
        userId: patient._id,
        facilityId,
        patientNumber: 'PT-90001',
        allergies: [],
        chronicConditions: [],
      });

      const res = await as(request(app).delete(`/api/facilities/${facilityId}`), superAdmin);

      expect(res.status).toBe(200);
      // Hard delete would have cascaded these into orphans.
      expect(await Facility.exists({ _id: facilityId })).toBeTruthy();
      expect(await Patient.exists({ facilityId })).toBeTruthy();
    });

    it('marks the hospital deleted and hides it from the directory', async () => {
      const { facilityId } = await onboarded();

      await as(request(app).delete(`/api/facilities/${facilityId}`), superAdmin);

      const stored = await Facility.findById(facilityId).lean();
      expect(stored?.deletedAt).toBeTruthy();
      expect(stored?.isActive).toBe(false);

      const list = await as(request(app).get('/api/facilities'), superAdmin);
      expect(JSON.stringify(list.body.data)).not.toContain(facilityId);

      const detail = await as(request(app).get(`/api/facilities/${facilityId}`), superAdmin);
      expect(detail.status).toBe(404);
    });

    it('suspends the hospital staff so they cannot keep operating it', async () => {
      const { facilityId, email } = await onboarded();

      const res = await as(request(app).delete(`/api/facilities/${facilityId}`), superAdmin);
      expect(res.body.data.suspendedStaff).toBe(1);

      const admin = await User.findOne({ email });
      expect(admin?.status).toBe('suspended');
      expect(admin?.preFacilitySuspensionStatus).toBe('active');

      // The next request from that account is refused.
      const blocked = await request(app).get('/api/facilities').set('x-test-user', email);
      expect(blocked.status).toBe(403);
    });

    it('refuses a deleted hospital even if an account is reactivated by mistake', async () => {
      const { facilityId, email, temporaryPassword } = await onboarded();
      await as(request(app).delete(`/api/facilities/${facilityId}`), superAdmin);

      await User.updateOne({ email }, { $set: { status: 'active', preFacilitySuspensionStatus: null } });

      const blocked = await request(app).get('/api/patients').set('x-test-user', email);
      expect(blocked.status).toBe(403);
      expect(blocked.body.error).toMatch(/has been removed/i);

      const signIn = await request(app)
        .post('/api/auth/login')
        .send({ email, password: temporaryPassword });
      expect(signIn.status).toBe(403);
      expect(signIn.body.error).toMatch(/has been removed/i);
    });

    it('remembers each account status so restore is exact', async () => {
      const { facilityId } = await onboarded();
      // A receptionist who was deliberately inactive before the hospital was deleted.
      await createUser({ role: 'receptionist', facilityId, status: 'inactive' });

      await as(request(app).delete(`/api/facilities/${facilityId}`), superAdmin);
      const res = await as(request(app).post(`/api/facilities/${facilityId}/restore`), superAdmin);

      expect(res.status).toBe(200);
      expect(res.body.data.facility.deletedAt).toBeNull();

      const staff = await User.find({ facilityId, role: { $ne: 'patient' } }).lean();
      const statuses = staff.map((u) => u.status);
      // The admin goes back to active; the receptionist is not silently reactivated.
      expect(statuses).toContain('active');
      expect(statuses).toContain('inactive');
      expect(statuses).not.toContain('suspended');
    });

    it('lets the platform owner restore a deleted hospital', async () => {
      const { facilityId, email, temporaryPassword } = await onboarded();
      await as(request(app).delete(`/api/facilities/${facilityId}`), superAdmin);

      const res = await as(request(app).post(`/api/facilities/${facilityId}/restore`), superAdmin);

      expect(res.status).toBe(200);
      const admin = await User.findOne({ email });
      expect(admin?.status).toBe('active');
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email, password: temporaryPassword });
      expect(login.status).toBe(200);
    });

    it('refuses to restore a hospital that is not deleted', async () => {
      const facility = await createFacility();
      const res = await as(request(app).post(`/api/facilities/${facility._id}/restore`), superAdmin);

      expect(res.status).toBe(400);
    });

    it('frees the name for reuse after deletion', async () => {
      const first = await onboarded();
      await as(request(app).delete(`/api/facilities/${first.facilityId}`), superAdmin);

      const res = await as(request(app).post('/api/facilities'), superAdmin).send({
        name: (await Facility.findById(first.facilityId).lean())?.name,
        type: 'hospital',
      });

      expect(res.status).toBe(201);
    });

    it('hides deleted hospitals from platform stats', async () => {
      const { facilityId } = await onboarded();
      await as(request(app).delete(`/api/facilities/${facilityId}`), superAdmin);

      const res = await as(request(app).get('/api/admin/facilities/stats'), superAdmin);

      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body.data)).not.toContain(facilityId);
    });

    it('refuses to assign an admin to a deleted hospital', async () => {
      const { facilityId } = await onboarded();
      await as(request(app).delete(`/api/facilities/${facilityId}`), superAdmin);
      const orphan = await createUser({ role: 'facility_admin', facilityId: null });

      const res = await as(request(app).post('/api/admin/assign-facility'), superAdmin).send({
        adminId: String(orphan._id),
        facilityId,
      });

      expect(res.status).toBe(404);
    });

    it('refuses deletion from a hospital admin', async () => {
      const facility = await createFacility();
      const facilityAdmin = await createUser({ role: 'facility_admin', facilityId: String(facility._id) });

      const res = await as(request(app).delete(`/api/facilities/${facility._id}`), facilityAdmin);

      expect(res.status).toBe(403);
      expect((await Facility.findById(facility._id).lean())?.deletedAt).toBeNull();
    });

    it('audits hospital deletion', async () => {
      const { facilityId } = await onboarded();
      await as(request(app).delete(`/api/facilities/${facilityId}`), superAdmin);

      const entry = await AuditLog.findOne({ entity: 'Facility', action: 'DELETE' });
      expect(entry).toBeTruthy();
      expect(String(entry?.entityId)).toBe(facilityId);
    });
  });

  describe('profile editing', () => {
    it('ignores deletedAt smuggled into a profile update', async () => {
      const facility = await createFacility();

      const res = await as(request(app).put(`/api/facilities/${facility._id}`), superAdmin).send({
        name: 'Renamed Hospital',
        deletedAt: new Date().toISOString(),
      });

      expect(res.status).toBe(200);
      const stored = await Facility.findById(facility._id).lean();
      expect(stored?.name).toBe('Renamed Hospital');
      expect(stored?.deletedAt).toBeNull();
    });

    it('refuses to edit a deleted hospital', async () => {
      const facility = await createFacility();
      await as(request(app).delete(`/api/facilities/${facility._id}`), superAdmin);

      const res = await as(request(app).put(`/api/facilities/${facility._id}`), superAdmin).send({
        name: 'Zombie Rename',
      });

      expect(res.status).toBe(404);
    });

    it('searches without treating the term as a regex', async () => {
      await createFacility({ name: 'Kigali Teaching' });

      const res = await as(request(app).get('/api/facilities'), superAdmin).query({ search: '.*' });

      expect(res.status).toBe(200);
      // A metacharacter search must not match everything.
      expect(res.body.data).toHaveLength(0);
    });
  });
});
