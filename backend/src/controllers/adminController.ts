import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User, Facility, Doctor, Appointment, Payment, Patient, PatientFacility } from '../models';
import { success } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { canonicalRole } from '../utils/tenancy';

const PUBLIC_FIELDS = '-passwordHash';

/** Loads a facility_admin by id, accepting the `hospital_admin` alias. */
async function loadAssignableAdmin(adminId: string) {
  const admin = await User.findById(adminId);
  if (!admin) throw new AppError(404, 'Admin user not found');
  if (canonicalRole(admin.role) !== 'facility_admin') {
    throw new AppError(400, 'Only facility_admin users can be assigned');
  }
  return admin;
}

/** Rejects an assignment to a hospital that does not exist, which would orphan the admin. */
async function assertFacilityExists(facilityId: string) {
  if (!(await Facility.exists({ _id: facilityId, deletedAt: null }))) {
    throw new AppError(404, 'Facility not found');
  }
}

export async function getGlobalAnalytics(_req: AuthRequest, res: Response) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [totalPatients, totalDoctors, appointmentsThisMonth, revenueAgg] = await Promise.all([
    User.countDocuments({ role: 'patient' }),
    Doctor.countDocuments(),
    Appointment.countDocuments({ appointmentDate: { $gte: monthStart, $lt: monthEnd } }),
    Payment.aggregate([
      {
        $match: {
          status: { $in: ['Paid', 'Partially Paid'] },
          createdAt: { $gte: monthStart, $lt: monthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  success(res, 200, {
    totalPatients,
    totalDoctors,
    appointmentsThisMonth,
    revenue: revenueAgg[0]?.total ?? 0,
  });
}

/**
 * Distinct patients each hospital is responsible for.
 *
 * Membership is the authority, so a patient treated by three hospitals is counted by all
 * three. `Patient.facilityId` is unioned in as well so a database that has not yet been
 * through the backfill migration does not report zero for every hospital.
 *
 * The union is keyed on the (patient, hospital) pair rather than on the patient, because a
 * patient whose home is Alpha but who holds a membership at Beta has to be counted at both.
 * Keying on the patient alone would drop Alpha; summing the two counts instead would count
 * every registered patient twice, since post-migration each of them also holds a primary
 * membership at that same hospital.
 */
async function countPatientsPerHospital(): Promise<Map<string, number>> {
  const pairs = new Map<string, Set<string>>();

  const add = (facilityId: unknown, patientId: unknown) => {
    const facility = String(facilityId);
    if (!pairs.has(facility)) pairs.set(facility, new Set());
    pairs.get(facility)!.add(String(patientId));
  };

  const memberships = await PatientFacility.find({ status: 'active' })
    .select('patientId facilityId')
    .lean();
  for (const row of memberships) add(row.facilityId, row.patientId);

  const homes = await Patient.find({ facilityId: { $ne: null } })
    .select('_id facilityId')
    .lean();
  for (const home of homes) add(home.facilityId, home._id);

  return new Map([...pairs].map(([facility, patients]) => [facility, patients.size]));
}

export async function getFacilityStatsList(_req: AuthRequest, res: Response) {
  // Deleted hospitals are excluded so platform stats never resurrect a removed tenant.
  const facilities = await Facility.find({ deletedAt: null }).sort({ name: 1 }).lean();

  const [apptAgg, staffAgg, patientMap] = await Promise.all([
    Appointment.aggregate([
      // The enum value is capitalised, so a lowercase 'cancelled' would match nothing
      // and cancelled visits would be counted as active.
      { $match: { status: { $ne: 'Cancelled' } } },
      { $group: { _id: '$facilityId', count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { role: { $ne: 'patient' }, facilityId: { $ne: null } } },
      { $group: { _id: '$facilityId', count: { $sum: 1 } } },
    ]),
    countPatientsPerHospital(),
  ]);

  const apptMap = new Map(apptAgg.map((a) => [String(a._id), a.count]));
  const staffMap = new Map(staffAgg.map((a) => [String(a._id), a.count]));

  const stats = facilities.map((f) => ({
    _id: f._id,
    name: f.name,
    appointments: apptMap.get(String(f._id)) ?? 0,
    staff: staffMap.get(String(f._id)) ?? 0,
    patients: patientMap.get(String(f._id)) ?? 0,
    // No review store exists yet, so this stays null instead of showing a number
    // derived from unrelated row counts.
    rating: null as number | null,
    reviewCount: 0,
  }));

  success(res, 200, stats);
}

export async function assignFacility(req: AuthRequest, res: Response) {
  const { adminId, facilityId } = req.body as { adminId: string; facilityId: string };
  const admin = await loadAssignableAdmin(adminId);
  await assertFacilityExists(facilityId);

  admin.facilityId = facilityId as unknown as typeof admin.facilityId;
  await admin.save();

  const updated = await User.findById(admin._id).select(PUBLIC_FIELDS).lean();
  success(res, 200, updated);
}

export async function reassignFacility(req: AuthRequest, res: Response) {
  const { adminId, newFacilityId } = req.body as { adminId: string; newFacilityId: string };
  const admin = await loadAssignableAdmin(adminId);
  await assertFacilityExists(newFacilityId);

  admin.facilityId = newFacilityId as unknown as typeof admin.facilityId;
  await admin.save();

  const updated = await User.findById(admin._id).select(PUBLIC_FIELDS).lean();
  success(res, 200, updated);
}

export async function removeFacilityAssignment(req: AuthRequest, res: Response) {
  const admin = await loadAssignableAdmin(req.params.adminId);

  // Detaching the last admin would leave the hospital with nobody who can manage it.
  const remaining = await User.countDocuments({
    _id: { $ne: admin._id },
    role: 'facility_admin',
    facilityId: admin.facilityId,
  });
  if (remaining === 0) {
    throw new AppError(400, 'A hospital must keep at least one facility_admin');
  }

  admin.facilityId = null as unknown as typeof admin.facilityId;
  await admin.save();

  const updated = await User.findById(admin._id).select(PUBLIC_FIELDS).lean();
  success(res, 200, updated);
}