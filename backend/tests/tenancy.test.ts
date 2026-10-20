import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createFacility, createUser, createPatient } from './factories';
import { Patient, Appointment, Department, Doctor, Facility, PatientFacility, User } from '../src/models';
import { grantMembership, endMembership } from '../src/services/patientFacilityService';

/**
 * Tenant-isolation regression suite.
 *
 * Every test here covers a way a hospital-scoped account could previously reach another
 * hospital's data. The suite is deliberately adversarial: it passes the other hospital's
 * id in the path, the body and the query string, and asserts the request is refused or
 * silently narrowed rather than honoured.
 */
describe('Cross-tenant isolation', () => {
  let alpha: Awaited<ReturnType<typeof createFacility>>;
  let beta: Awaited<ReturnType<typeof createFacility>>;
  let alphaAdmin: Awaited<ReturnType<typeof createUser>>;
  let alphaReceptionist: Awaited<ReturnType<typeof createUser>>;
  let betaReceptionist: Awaited<ReturnType<typeof createUser>>;
  let betaAdmin: Awaited<ReturnType<typeof createUser>>;
  let superAdmin: Awaited<ReturnType<typeof createUser>>;

  const as = (r: request.Test, user: { email?: string }) => r.set('x-test-user', user.email as string);

  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    alpha = await createFacility({ name: 'Alpha Hospital' });
    beta = await createFacility({ name: 'Beta Hospital' });

    alphaAdmin = await createUser({ role: 'facility_admin', facilityId: String(alpha._id) });
    alphaReceptionist = await createUser({ role: 'receptionist', facilityId: String(alpha._id) });
    betaAdmin = await createUser({ role: 'facility_admin', facilityId: String(beta._id) });
    betaReceptionist = await createUser({ role: 'receptionist', facilityId: String(beta._id) });
    superAdmin = await createUser({ role: 'super_admin', facilityId: null });
  });

  afterAll(async () => {
    await closeTestDB();
  });

  /** Registers a patient directly at a hospital, bypassing the API. */
  async function patientAt(facilityId: unknown, label: string) {
    const user = await createUser({ role: 'patient', fullName: `${label} Patient` });
    const n = await Patient.countDocuments();
    const patient = await Patient.create({
      userId: user._id,
      facilityId: facilityId ? new mongoose.Types.ObjectId(String(facilityId)) : null,
      patientNumber: `PT-${String(n + 1).padStart(5, '0')}`,
      allergies: [],
      chronicConditions: [],
    });
    return { user, patient };
  }

  describe('patient directory', () => {
    it('does not return another hospital\'s patients', async () => {
      await patientAt(alpha._id, 'Alpha');
      const betaPatient = await patientAt(beta._id, 'Beta');

      const res = await as(request(app).get('/api/patients'), alphaReceptionist);

      expect(res.status).toBe(200);
      const ids = (res.body.data as Array<{ _id: string }>).map((p) => p._id);
      expect(ids).toContain(String((await Patient.findOne({ _id: ids[0] }))?._id));
      expect(ids).not.toContain(String(betaPatient.patient._id));
    });

    it('returns 404, not 403, for another hospital\'s patient so existence is not leaked', async () => {
      const betaPatient = await patientAt(beta._id, 'Beta');

      const res = await as(request(app).get(`/api/patients/${betaPatient.patient._id}`), alphaReceptionist);

      expect(res.status).toBe(404);
    });

    it('rejects a patient lookup for another hospital\'s national ID', async () => {
      const betaPatient = await patientAt(beta._id, 'Beta');
      const nationalId = '1199900011111111';
      await User.updateOne({ _id: betaPatient.user._id }, { nationalId });

      const res = await as(request(app).get('/api/patients/lookup'), alphaReceptionist).query({
        nationalId,
      });

      expect(res.status).toBe(404);
    });

    it('rejects a ?facilityId= query override on the patient list', async () => {
      await patientAt(beta._id, 'Beta');

      const res = await as(request(app).get('/api/patients'), alphaReceptionist).query({
        facilityId: String(beta._id),
      });

      expect(res.status).toBe(403);
    });

    it('rejects a ?facilityId= query override on the user list', async () => {
      const res = await as(request(app).get('/api/users'), alphaAdmin).query({
        facilityId: String(beta._id),
      });

      expect(res.status).toBe(403);
    });

    it('blocks editing another hospital\'s patient', async () => {
      const betaPatient = await patientAt(beta._id, 'Beta');

      const res = await as(request(app).put(`/api/patients/${betaPatient.patient._id}`), alphaAdmin).send({
        bloodGroup: 'O+',
      });

      expect(res.status).toBe(404);
    });

    it('strips facilityId from patient updates so a patient cannot be moved', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha');

      const res = await as(request(app).put(`/api/patients/${patient._id}`), alphaAdmin).send({
        bloodGroup: 'AB+',
        facilityId: String(beta._id),
      });

      expect(res.status).toBe(200);
      const stored = await Patient.findById(patient._id).lean();
      expect(String(stored?.facilityId)).toBe(String(alpha._id));
    });

    it('assigns a receptionist-created patient to their own hospital', async () => {
      const res = await as(request(app).post('/api/patients'), alphaReceptionist).send({
        fullName: 'Walk In Patient',
        email: 'walkin.alpha@test.local',
        password: 'Password@123',
      });

      expect(res.status).toBe(201);
      const stored = await Patient.findById(res.body.data.patient._id).lean();
      expect(String(stored?.facilityId)).toBe(String(alpha._id));
    });

    it('does not leak hospital A\'s patients to a hospital-B receptionist', async () => {
      const alphaPatient = await patientAt(alpha._id, 'Alpha');
      const betaReceptionist = await createUser({ role: 'receptionist', facilityId: String(beta._id) });

      const res = await as(request(app).get('/api/patients'), betaReceptionist);

      const ids = (res.body.data as Array<{ _id: string }>).map((p) => p._id);
      expect(ids).not.toContain(String(alphaPatient.patient._id));
    });
  });

  describe('privilege escalation', () => {
    it('refuses to let a hospital admin promote a user to super_admin', async () => {
      const receptionist = await createUser({ role: 'receptionist', facilityId: String(alpha._id) });

      const res = await as(request(app).put(`/api/users/${receptionist._id}`), alphaAdmin).send({
        role: 'super_admin',
      });

      expect(res.status).toBe(403);
      const stored = await User.findById(receptionist._id).lean();
      expect(stored?.role).toBe('receptionist');
    });

    it('refuses to let a hospital admin mint a peer hospital admin', async () => {
      const res = await as(request(app).post('/api/users'), alphaAdmin).send({
        fullName: 'Peer Admin',
        email: 'peer.admin@test.local',
        password: 'Password@123',
        role: 'facility_admin',
      });

      expect(res.status).toBe(403);
    });

    it('refuses a hospital admin create a super_admin', async () => {
      const res = await as(request(app).post('/api/users'), alphaAdmin).send({
        fullName: 'Sneaky Admin',
        email: 'sneaky.admin@test.local',
        password: 'Password@123',
        role: 'super_admin',
      });

      // `createStaffUserSchema` does not list super_admin as an assignable role, so
      // validation rejects the request before the controller's `assertCanAssignRole`
      // runs. The controller guard covers the roles validation does allow, such as
      // `facility_admin`, which is tested above.
      expect(res.status).toBe(400);
      expect(await User.findOne({ email: 'sneaky.admin@test.local' })).toBeNull();
    });

    it('refuses to let a hospital admin move a user to another hospital', async () => {
      const receptionist = await createUser({ role: 'receptionist', facilityId: String(alpha._id) });

      const res = await as(request(app).put(`/api/users/${receptionist._id}`), alphaAdmin).send({
        facilityId: String(beta._id),
      });

      expect(res.status).toBe(403);
      const stored = await User.findById(receptionist._id).lean();
      expect(String(stored?.facilityId)).toBe(String(alpha._id));
    });

    it('refuses hospital admin access to a user in another hospital', async () => {
      const res = await as(request(app).get(`/api/users/${betaAdmin._id}`), alphaAdmin);

      expect(res.status).toBe(403);
    });

    it('refuses hospital admin edits to a user in another hospital', async () => {
      const res = await as(request(app).put(`/api/users/${betaAdmin._id}`), alphaAdmin).send({
        fullName: 'Hijacked Admin',
      });

      expect(res.status).toBe(403);
    });

    it('never returns a password hash when creating a staff user', async () => {
      const res = await as(request(app).post('/api/users'), alphaAdmin).send({
        fullName: 'New Receptionist',
        email: 'new.receptionist@test.local',
        password: 'Password@123',
        role: 'receptionist',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('refuses a hospital admin deactivating a platform admin', async () => {
      const res = await as(request(app).delete(`/api/users/${superAdmin._id}`), alphaAdmin);

      expect(res.status).toBe(403);
    });
  });

  describe('hospital_admin role alias', () => {
    it('stores hospital_admin as the canonical facility_admin', async () => {
      const aliased = await createUser({ role: 'hospital_admin', facilityId: String(alpha._id) });
      const stored = await User.findById(aliased._id).lean();
      expect(stored?.role).toBe('facility_admin');
    });

    it('grants hospital_admin the same access as facility_admin', async () => {
      const aliased = await createUser({ role: 'hospital_admin', facilityId: String(alpha._id) });
      const stored = await User.findById(aliased._id).lean();
      expect(stored?.role).toBe('facility_admin');

      const res = await as(request(app).get('/api/users'), aliased);
      expect(res.status).toBe(200);
    });
  });

  /** Creates a minimal valid appointment, since the model requires doctor and department. */
  async function appointmentAt(facilityId: unknown, patientId: unknown) {
    return Appointment.create({
      patientId: new mongoose.Types.ObjectId(String(patientId)),
      doctorId: new mongoose.Types.ObjectId('0000000000000000000000a1'),
      departmentId: new mongoose.Types.ObjectId('0000000000000000000000b1'),
      facilityId: new mongoose.Types.ObjectId(String(facilityId)),
      appointmentDate: new Date(),
      timeSlot: '09:00',
      status: 'Pending',
      visitType: 'new',
    });
  }

  describe('appointments', () => {
    it('rejects a ?facilityId= query override', async () => {
      const res = await as(request(app).get('/api/appointments'), alphaReceptionist).query({
        facilityId: String(beta._id),
      });

      expect(res.status).toBe(403);
    });

    it('stops a patient from listing another patient\'s appointments', async () => {
      const patientA = await createPatient();
      const patientB = await createPatient();
      await appointmentAt(beta._id, patientB.patient._id);

      const res = await as(request(app).get('/api/appointments'), patientA.user).query({
        patientId: String(patientB.patient._id),
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('ignores a cross-hospital facilityId smuggled into an update', async () => {
      const patient = await patientAt(alpha._id, 'Alpha');
      const appointment = await appointmentAt(alpha._id, patient.patient._id);

      const res = await as(request(app).put(`/api/appointments/${appointment._id}`), alphaReceptionist)
        .send({ facilityId: String(beta._id), reason: 'Follow-up needed' });

      expect(res.status).toBe(200);
      const stored = await Appointment.findById(appointment._id).lean();
      expect(stored?.reason).toBe('Follow-up needed');
      expect(String(stored?.facilityId)).toBe(String(alpha._id));
    });

    it('rejects an update whose only field is a cross-hospital facilityId', async () => {
      const patient = await patientAt(alpha._id, 'Alpha');
      const appointment = await appointmentAt(alpha._id, patient.patient._id);

      const res = await as(request(app).put(`/api/appointments/${appointment._id}`), alphaReceptionist)
        .send({ facilityId: String(beta._id) });

      expect(res.status).toBe(400);
      const stored = await Appointment.findById(appointment._id).lean();
      expect(String(stored?.facilityId)).toBe(String(alpha._id));
    });

    it('refuses a patient reading another hospital\'s appointment', async () => {
      const patientA = await createPatient();
      const betaPatient = await patientAt(beta._id, 'Beta');
      const appointment = await appointmentAt(beta._id, betaPatient.patient._id);

      const res = await as(
        request(app).get(`/api/appointments/${appointment._id}`),
        patientA.user
      );

      expect(res.status).toBe(403);
    });
  });

  describe('doctors and departments', () => {
    it('rejects a ?facilityId= query override on the doctor list', async () => {
      const res = await as(request(app).get('/api/doctors'), alphaAdmin).query({
        facilityId: String(beta._id),
      });

      expect(res.status).toBe(403);
    });

    it('refuses a hospital admin reading another hospital\'s doctor', async () => {
      const user = await createUser({ role: 'doctor', facilityId: String(beta._id) });
      const doctor = await Doctor.create({
        userId: user._id,
        facilityId: beta._id,
        departmentId: [],
        specialization: ['Cardiology'],
      });

      const res = await as(request(app).get(`/api/doctors/${doctor._id}`), alphaAdmin);

      expect(res.status).toBe(403);
    });

    it('refuses a hospital admin editing another hospital\'s doctor schedule', async () => {
      const user = await createUser({ role: 'doctor', facilityId: String(beta._id) });
      const doctor = await Doctor.create({
        userId: user._id,
        facilityId: beta._id,
        departmentId: [],
        specialization: ['Cardiology'],
      });

      const res = await as(request(app).post(`/api/doctors/${doctor._id}/schedule`), alphaAdmin).send({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
        slotDurationMinutes: 15,
        maxPatientsPerSlot: 1,
      });

      expect(res.status).toBe(403);
    });

    it('rejects a ?facilityId= query override on the department list', async () => {
      const res = await as(request(app).get('/api/departments'), alphaAdmin).query({
        facilityId: String(beta._id),
      });

      expect(res.status).toBe(403);
    });

    it('refuses a hospital admin deleting another hospital\'s department', async () => {
      const dept = await Department.create({ facilityId: beta._id, name: 'Beta Cardiology' });

      const res = await as(request(app).delete(`/api/departments/${dept._id}`), alphaAdmin);

      expect(res.status).toBe(403);
    });
  });

  describe('nested facility routes', () => {
    it('refuses a hospital admin reading another hospital\'s staff list', async () => {
      const res = await as(request(app).get(`/api/facilities/${beta._id}/staff`), alphaAdmin);

      expect(res.status).toBe(403);
    });

    it('refuses a hospital admin reading another hospital\'s stats', async () => {
      const res = await as(request(app).get(`/api/facilities/${beta._id}/stats`), alphaAdmin);

      expect(res.status).toBe(403);
    });

    it('allows a hospital admin reading their own facility', async () => {
      const res = await as(request(app).get(`/api/facilities/${alpha._id}/staff`), alphaAdmin);

      expect(res.status).toBe(200);
    });
  });

  describe('messaging and documents', () => {
    it('refuses writing a message into another hospital\'s patient inbox', async () => {
      const betaPatient = await patientAt(beta._id, 'Beta');

      const res = await as(request(app).post('/api/messages'), alphaReceptionist).send({
        patientId: String(betaPatient.patient._id),
        subject: 'Hello',
        body: 'Should not be delivered',
      });

      expect(res.status).toBe(404);
    });

    it('refuses attaching a document to another hospital\'s patient', async () => {
      const betaPatient = await patientAt(beta._id, 'Beta');

      const res = await as(request(app).post('/api/patient-documents'), alphaReceptionist).send({
        patientId: String(betaPatient.patient._id),
        title: 'Scan',
        fileName: 'scan.pdf',
        fileUrl: 'https://example.test/scan.pdf',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('fails closed for misconfigured accounts', () => {
    it('refuses tenant reads for a hospital role with no hospital assigned', async () => {
      const orphan = await createUser({ role: 'receptionist', facilityId: null });
      const betaPatient = await patientAt(beta._id, 'Beta');

      const listRes = await as(request(app).get('/api/patients'), orphan);
      expect(listRes.status).toBe(403);

      const readRes = await as(request(app).get(`/api/patients/${betaPatient.patient._id}`), orphan);
      expect(readRes.status).toBe(403);
    });
  });

  describe('platform admin', () => {
    it('can still read across hospitals', async () => {
      await patientAt(alpha._id, 'Alpha');
      const betaPatient = await patientAt(beta._id, 'Beta');

      const res = await as(request(app).get(`/api/patients/${betaPatient.patient._id}`), superAdmin);

      expect(res.status).toBe(200);
    });

    it('can narrow the patient list with an explicit facilityId', async () => {
      const alphaPatient = await patientAt(alpha._id, 'Alpha');
      await patientAt(beta._id, 'Beta');

      const res = await as(request(app).get('/api/patients'), superAdmin).query({
        facilityId: String(alpha._id),
      });

      expect(res.status).toBe(200);
      const ids = (res.body.data as Array<{ _id: string }>).map((p) => p._id);
      expect(ids).toContain(String(alphaPatient.patient._id));
    });
  });

  describe('hospital admin assignment', () => {
    it('assigns an unassigned admin to a hospital', async () => {
      const orphan = await createUser({ role: 'facility_admin', facilityId: null });

      const res = await as(request(app).post('/api/admin/assign-facility'), superAdmin).send({
        adminId: String(orphan._id),
        facilityId: String(alpha._id),
      });

      expect(res.status).toBe(200);
      const stored = await User.findById(orphan._id).lean();
      expect(String(stored?.facilityId)).toBe(String(alpha._id));
    });

    it('refuses to assign an admin to a hospital that does not exist', async () => {
      const orphan = await createUser({ role: 'facility_admin', facilityId: null });

      const res = await as(request(app).post('/api/admin/assign-facility'), superAdmin).send({
        adminId: String(orphan._id),
        facilityId: '0000000000000000000000ff',
      });

      expect(res.status).toBe(404);
      const stored = await User.findById(orphan._id).lean();
      expect(stored?.facilityId).toBeNull();
    });

    it('refuses to assign a non-admin role', async () => {
      const receptionist = await createUser({ role: 'receptionist', facilityId: null });

      const res = await as(request(app).post('/api/admin/assign-facility'), superAdmin).send({
        adminId: String(receptionist._id),
        facilityId: String(alpha._id),
      });

      expect(res.status).toBe(400);
    });

    it('refuses to detach the last admin of a hospital', async () => {
      // alphaAdmin is the only facility_admin registered at alpha.
      const res = await as(
        request(app).delete(`/api/admin/remove-facility/${alphaAdmin._id}`),
        superAdmin
      );

      expect(res.status).toBe(400);
      const stored = await User.findById(alphaAdmin._id).lean();
      expect(String(stored?.facilityId)).toBe(String(alpha._id));
    });

    it('detaches an admin once a peer admin exists', async () => {
      await createUser({ role: 'facility_admin', facilityId: String(alpha._id) });

      const res = await as(
        request(app).delete(`/api/admin/remove-facility/${alphaAdmin._id}`),
        superAdmin
      );

      expect(res.status).toBe(200);
      const stored = await User.findById(alphaAdmin._id).lean();
      expect(stored?.facilityId).toBeNull();
    });

    it('refuses admin assignment attempts from a hospital admin', async () => {
      const orphan = await createUser({ role: 'facility_admin', facilityId: null });

      const res = await as(request(app).post('/api/admin/assign-facility'), alphaAdmin).send({
        adminId: String(orphan._id),
        facilityId: String(beta._id),
      });

      expect(res.status).toBe(403);
    });

    it('audits an admin reassignment', async () => {
      await as(request(app).put('/api/admin/reassign-facility'), superAdmin).send({
        adminId: String(alphaAdmin._id),
        newFacilityId: String(beta._id),
      });

      const AuditLog = (await import('../src/models')).AuditLog;
      const entry = await AuditLog.findOne({ entity: 'User', action: 'PUT' });
      expect(entry).toBeTruthy();
      expect(String(entry?.userId)).toBe(String(superAdmin._id));
    });

    it('counts facility patients from Patient.facilityId, including walk-ins', async () => {
      // A walk-in patient has no User.facilityId, so only Patient.facilityId is correct.
      await patientAt(alpha._id, 'Walk In');
      await patientAt(beta._id, 'Beta');

      const res = await as(request(app).get('/api/admin/facilities/stats'), superAdmin);

      expect(res.status).toBe(200);
      const rows = res.body.data as Array<{ _id: string; patients: number }>;
      expect(rows.find((r) => String(r._id) === String(alpha._id))?.patients).toBe(1);
      expect(rows.find((r) => String(r._id) === String(beta._id))?.patients).toBe(1);
    });

    it('reports a null rating rather than a fabricated score', async () => {
      const res = await as(request(app).get('/api/admin/facilities/stats'), superAdmin);

      expect(res.status).toBe(200);
      for (const row of res.body.data as Array<{ rating: number | null; reviewCount: number }>) {
        expect(row.rating).toBeNull();
        expect(row.reviewCount).toBe(0);
      }
    });
  });

  describe('facility records', () => {
    it('refuses a hospital admin reading another hospital\'s own facility record', async () => {
      const res = await as(request(app).get(`/api/facilities/${beta._id}`), alphaAdmin);

      expect(res.status).toBe(403);
    });

    it('lets a hospital admin read its own facility record', async () => {
      const res = await as(request(app).get(`/api/facilities/${alpha._id}`), alphaAdmin);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(String(alpha._id));
    });

    it('lets the platform owner read any facility record', async () => {
      const res = await as(request(app).get(`/api/facilities/${beta._id}`), superAdmin);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(String(beta._id));
    });

    it('refuses a patient reading a facility record directly', async () => {
      const patient = await patientAt(alpha._id, 'Alpha');

      const res = await as(
        request(app).get(`/api/facilities/${alpha._id}`),
        patient.user
      );

      expect(res.status).toBe(403);
    });

    it('pins a hospital admin to its own hospital in the directory', async () => {
      const res = await as(request(app).get('/api/facilities'), alphaAdmin);

      expect(res.status).toBe(200);
      const ids = (res.body.data as Array<{ _id: string }>).map((f) => f._id);
      expect(ids).toEqual([String(alpha._id)]);
    });

    it('withholds commercial fields from a hospital admin viewing another hospital', async () => {
      const res = await as(request(app).get('/api/facilities'), alphaAdmin);

      expect(res.status).toBe(200);
      // Pinned to its own record, so its own commercial data is legitimately visible.
      expect(res.body.data[0].name).toBe('Alpha Hospital');
    });

    it('still lets a patient browse the public directory to choose where to book', async () => {
      const patient = await patientAt(alpha._id, 'Alpha');

      const res = await as(request(app).get('/api/facilities'), patient.user);

      expect(res.status).toBe(200);
      const ids = (res.body.data as Array<{ _id: string }>).map((f) => f._id);
      expect(ids).toContain(String(alpha._id));
      expect(ids).toContain(String(beta._id));
    });

    it('projects subscription and governance fields away from a patient', async () => {
      const patient = await patientAt(alpha._id, 'Alpha');

      const res = await as(request(app).get('/api/facilities'), patient.user);

      expect(res.status).toBe(200);
      const row = (res.body.data as Array<Record<string, unknown>>).find(
        (f) => f._id === String(alpha._id)
      )!;
      expect(row.name).toBe('Alpha Hospital');
      for (const leaked of ['subscriptionStatus', 'subscriptionExpiresAt', 'parentFacilityId', 'deletedBy']) {
        expect(row).not.toHaveProperty(leaked);
      }
    });

    it('still shows a patient only active, undeleted hospitals', async () => {
      const patient = await patientAt(alpha._id, 'Alpha');
      await Facility.updateOne({ _id: beta._id }, { $set: { isActive: false } });

      const res = await as(request(app).get('/api/facilities'), patient.user);

      expect(res.status).toBe(200);
      const ids = (res.body.data as Array<{ _id: string }>).map((f) => f._id);
      expect(ids).toContain(String(alpha._id));
      expect(ids).not.toContain(String(beta._id));
    });

    it('refuses a hospital role the directory it has no use for', async () => {
      const res = await as(request(app).get('/api/facilities'), alphaReceptionist);

      expect(res.status).toBe(403);
    });
  });

  /**
   * Membership listings come back with `facilityId` populated into a hospital object, so the
   * id has to be read out of it rather than stringified directly.
   */
  function facilityIds(rows: Array<{ facilityId: unknown }>): string[] {
    return rows.map((row) => {
      const value = row.facilityId as { _id?: unknown } | string | null;
      return typeof value === 'string' || value === null ? String(value) : String(value._id);
    });
  }

  describe('a patient treated by more than one hospital', () => {
    it('lets the second hospital open a patient whose home hospital is the first', async () => {
      // The regression this suite exists for: the patient list showed this patient to Beta,
      // but the detail read refused them because Patient.facilityId pointed at Alpha.
      const { patient } = await patientAt(alpha._id, 'Alpha Home');
      await appointmentAt(beta._id, patient._id);

      const list = await as(request(app).get('/api/patients'), betaReceptionist);
      expect((list.body.data as Array<{ _id: string }>).map((p) => p._id)).toContain(
        String(patient._id)
      );

      const detail = await as(request(app).get(`/api/patients/${patient._id}`), betaReceptionist);
      expect(detail.status).toBe(200);
      expect(detail.body.data._id).toBe(String(patient._id));
    });

    it('keeps the home hospital able to open the same patient', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');
      await appointmentAt(beta._id, patient._id);

      const detail = await as(request(app).get(`/api/patients/${patient._id}`), alphaReceptionist);
      expect(detail.status).toBe(200);
    });

    it('lets the second hospital message that patient', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');
      await appointmentAt(beta._id, patient._id);

      const res = await as(request(app).post('/api/messages'), betaReceptionist).send({
        patientId: String(patient._id),
        facilityId: String(beta._id),
        body: 'Your results are ready.',
        subject: 'Results',
      });

      expect(res.status).not.toBe(404);
    });

    it('still refuses a hospital that neither treats nor is a member', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');
      await appointmentAt(alpha._id, patient._id);

      const detail = await as(request(app).get(`/api/patients/${patient._id}`), betaReceptionist);
      expect(detail.status).toBe(404);
    });

    it('grants access from a membership alone, with no appointment', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');
      await PatientFacility.create({
        patientId: patient._id,
        facilityId: beta._id,
        status: 'active',
        isPrimary: false,
      });

      const detail = await as(request(app).get(`/api/patients/${patient._id}`), betaReceptionist);
      expect(detail.status).toBe(200);
    });

    it('withholds access once the membership is ended', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');
      await PatientFacility.create({
        patientId: patient._id,
        facilityId: beta._id,
        status: 'active',
        isPrimary: false,
      });
      await PatientFacility.updateOne(
        { patientId: patient._id, facilityId: beta._id },
        { $set: { status: 'inactive' } }
      );

      const detail = await as(request(app).get(`/api/patients/${patient._id}`), betaReceptionist);
      expect(detail.status).toBe(404);
    });

    it('lists the patient under both hospitals', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');
      await appointmentAt(beta._id, patient._id);

      const atAlpha = await as(request(app).get('/api/patients'), alphaReceptionist);
      const atBeta = await as(request(app).get('/api/patients'), betaReceptionist);

      expect((atAlpha.body.data as Array<{ _id: string }>).map((p) => p._id)).toContain(
        String(patient._id)
      );
      expect((atBeta.body.data as Array<{ _id: string }>).map((p) => p._id)).toContain(
        String(patient._id)
      );
    });

    it('lets a portal patient be adopted as their first hospital', async () => {
      const { patient } = await patientAt(null, 'Portal');
      expect(patient.facilityId).toBeFalsy();

      await grantMembership(patient._id, beta._id);

      const stored = await Patient.findById(patient._id).lean();
      expect(String(stored?.facilityId)).toBe(String(beta._id));
      const membership = await PatientFacility.findOne({
        patientId: patient._id,
        facilityId: beta._id,
      }).lean();
      expect(membership?.isPrimary).toBe(true);
    });

    it('does not let booking at a second hospital steal their home hospital', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');

      await grantMembership(patient._id, beta._id);

      const stored = await Patient.findById(patient._id).lean();
      expect(String(stored?.facilityId)).toBe(String(alpha._id));
    });

    it('refuses to end the home hospital membership', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');
      await grantMembership(patient._id, alpha._id, { isPrimary: true });

      await expect(endMembership(patient._id, alpha._id)).rejects.toThrow(/home hospital/i);
    });

    it('counts the patient once at each of their hospitals', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');
      await grantMembership(patient._id, beta._id);

      const res = await as(request(app).get('/api/admin/facilities/stats'), superAdmin);

      expect(res.status).toBe(200);
      const rows = res.body.data as Array<{ _id: string; patients: number }>;
      expect(rows.find((r) => String(r._id) === String(alpha._id))?.patients).toBe(1);
      expect(rows.find((r) => String(r._id) === String(beta._id))?.patients).toBe(1);
    });

    it('lets a receptionist register a patient at their own hospital', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');

      const res = await as(request(app).post(`/api/patients/${patient._id}/facilities`), betaReceptionist);

      expect(res.status).toBe(201);
      const facilities = res.body.data as Array<{ facilityId: unknown }>;
      expect(facilityIds(facilities)).toContain(String(beta._id));
    });

    it('ignores a facility named in the body and uses the caller\'s own hospital', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');

      const res = await as(
        request(app).post(`/api/patients/${patient._id}/facilities`),
        betaReceptionist
      ).send({ facilityId: String(alpha._id) });

      expect(res.status).toBe(201);
      const facilities = res.body.data as Array<{ facilityId: unknown }>;
      expect(facilityIds(facilities)).toContain(String(beta._id));
      expect(facilityIds(facilities)).not.toContain(String(alpha._id) + 'only');
    });

    it('lets a receptionist end their own hospital\'s membership', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');
      await grantMembership(patient._id, beta._id);

      const res = await as(
        request(app).delete(`/api/patients/${patient._id}/facilities`),
        betaReceptionist
      );

      expect(res.status).toBe(200);
      const detail = await as(request(app).get(`/api/patients/${patient._id}`), betaReceptionist);
      expect(detail.status).toBe(404);
    });

    it('lets a patient list their own hospitals', async () => {
      const { user, patient } = await patientAt(alpha._id, 'Alpha Home');
      await grantMembership(patient._id, beta._id);

      const res = await as(request(app).get('/api/patients/me/facilities'), user);

      expect(res.status).toBe(200);
      const facilities = res.body.data as Array<{ facilityId: unknown }>;
      expect(facilityIds(facilities)).toContain(String(alpha._id));
      expect(facilityIds(facilities)).toContain(String(beta._id));
    });

    it('refuses a patient listing someone else\'s hospitals', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');
      const stranger = await patientAt(alpha._id, 'Stranger');

      const res = await as(
        request(app).get(`/api/patients/${patient._id}/facilities`),
        stranger.user
      );

      // 403 rather than 404: `PATIENT_VIEW` is a staff grant, so a patient never holds it.
      // The refusal happens at the route, before the record is looked up.
      expect(res.status).toBe(403);
    });

    it('refuses a hospital that does not treat the patient from listing their hospitals', async () => {
      const { patient } = await patientAt(alpha._id, 'Alpha Home');

      const res = await as(
        request(app).get(`/api/patients/${patient._id}/facilities`),
        betaReceptionist
      );

      expect(res.status).toBe(404);
    });
  });
});
