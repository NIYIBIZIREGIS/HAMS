import { Types } from 'mongoose';
import { Patient, PatientFacility, Facility } from '../models';
import { badRequest } from '../utils/AppError';
import { toObjectId } from '../utils/tenancy';

export interface GrantOptions {
  /** Marks this as the patient's home hospital and mirrors it onto `Patient.facilityId`. */
  isPrimary?: boolean;
  /** The account granting the membership, for the audit trail. */
  registeredBy?: unknown;
}

/**
 * Promotes one membership to the patient's home hospital.
 *
 * The demotion has to be written *before* the promotion: `PatientFacility` carries a partial
 * unique index on `{ patientId, isPrimary }` for `isPrimary: true`, so promoting a second row
 * while the incumbent still holds the flag would fail with a duplicate-key error. Doing it in
 * this order makes the swap safe under concurrency, at the cost of a brief window with no
 * primary row, which nothing reads as a correctness requirement.
 */
async function makePrimary(patientId: Types.ObjectId, facilityId: Types.ObjectId): Promise<void> {
  await PatientFacility.updateMany(
    { patientId, isPrimary: true, facilityId: { $ne: facilityId } },
    { $set: { isPrimary: false } }
  );
  await PatientFacility.updateOne({ patientId, facilityId }, { $set: { isPrimary: true } });
  // Kept in step with the membership so the existing "registered at this hospital" screens,
  // the patient number sequence and the legacy ownership checks stay correct.
  await Patient.updateOne({ _id: patientId }, { $set: { facilityId } });
}

/**
 * Records that a hospital may treat a patient, creating the row if needed.
 *
 * Idempotent: re-granting a membership that is already active changes nothing, and
 * re-granting one that was ended reactivates it instead of accumulating duplicates. The
 * `{ patientId, facilityId }` unique index is the backstop if two requests race.
 */
export async function grantMembership(
  patientId: unknown,
  facilityId: unknown,
  options: GrantOptions = {}
): Promise<void> {
  const patientOid = toObjectId(patientId);
  const facilityOid = toObjectId(facilityId);
  if (!patientOid) throw badRequest('A patient is required');
  if (!facilityOid) throw badRequest('A hospital is required');

  const set: Record<string, unknown> = { status: 'active', endedAt: null };
  const registeredBy = toObjectId(options.registeredBy);
  if (registeredBy) set.registeredBy = registeredBy;

  await PatientFacility.updateOne(
    { patientId: patientOid, facilityId: facilityOid },
    {
      $set: set,
      // `registeredAt` records when the patient first joined this hospital, so it is only set
      // on insert. Re-granting after an end does not rewrite the original registration date.
      $setOnInsert: { registeredAt: new Date(), isPrimary: false },
    },
    { upsert: true }
  );

  if (options.isPrimary) {
    await makePrimary(patientOid, facilityOid);
    return;
  }

  // A patient who arrived through the public portal has no home hospital. The first hospital
  // that treats them becomes their home, so the registration screens keep working.
  const hasPrimary = await PatientFacility.exists({ patientId: patientOid, isPrimary: true });
  if (!hasPrimary) {
    const patient = await Patient.findById(patientOid).select('facilityId').lean();
    if (patient && !patient.facilityId) await makePrimary(patientOid, facilityOid);
  }
}

/**
 * Ends a membership without deleting it.
 *
 * The row is retained so a hospital keeps the record of having treated the patient while
 * losing the ability to reach them. The patient's home hospital cannot be ended by accident:
 * ending it would leave `Patient.facilityId` pointing at a hospital that no longer holds a
 * membership, so the caller has to promote another membership first.
 */
export async function endMembership(patientId: unknown, facilityId: unknown): Promise<void> {
  const patientOid = toObjectId(patientId);
  const facilityOid = toObjectId(facilityId);
  if (!patientOid || !facilityOid) throw badRequest('A patient and a hospital are both required');

  const membership = await PatientFacility.findOne({ patientId: patientOid, facilityId: facilityOid });
  if (!membership) return;
  if (membership.isPrimary) {
    throw badRequest('This is the patient\'s home hospital; move their home hospital first');
  }
  if (membership.status === 'inactive') return;

  membership.status = 'inactive';
  membership.endedAt = new Date();
  await membership.save();
}

/** Ids of the patients a hospital currently holds an active membership for. */
export async function activePatientIdsAtFacility(facilityId: unknown): Promise<Types.ObjectId[]> {
  const oid = toObjectId(facilityId);
  if (!oid) return [];
  return PatientFacility.distinct('patientId', { facilityId: oid, status: 'active' });
}

/** Ids of the hospitals a patient currently holds an active membership for. */
export async function activeFacilityIdsForPatient(patientId: unknown): Promise<Types.ObjectId[]> {
  const oid = toObjectId(patientId);
  if (!oid) return [];
  return PatientFacility.distinct('facilityId', { patientId: oid, status: 'active' });
}

/**
 * Whether a hospital holds an active membership for a patient.
 *
 * Used as one of the reachability tests, so it must stay a cheap indexed lookup.
 */
export async function isActiveMember(patientId: unknown, facilityId: unknown): Promise<boolean> {
  const patientOid = toObjectId(patientId);
  const facilityOid = toObjectId(facilityId);
  if (!patientOid || !facilityOid) return false;
  const found = await PatientFacility.exists({
    patientId: patientOid,
    facilityId: facilityOid,
    status: 'active',
  });
  return Boolean(found);
}

/**
 * Every membership for a patient, with hospital details resolved.
 *
 * The patient's home hospital is guaranteed to appear even when no membership row exists for
 * it. `Patient.facilityId` is what the pre-migration data and the receptionist registration
 * path both rely on, so omitting it here would under-report a patient's hospitals on any
 * database that has not yet been through `migrate:patient-facilities`.
 */
export async function listMemberships(patientId: unknown) {
  const patientOid = toObjectId(patientId);
  if (!patientOid) throw badRequest('A patient is required');

  const memberships = await PatientFacility.find({ patientId: patientOid })
    .populate('facilityId', 'name type region district address contactInfo isActive')
    .sort({ isPrimary: -1, registeredAt: -1 })
    .lean();

  const homeFacilityId = await Patient.findById(patientOid)
    .select('facilityId')
    .lean()
    .then((patient) => (patient?.facilityId ? String(patient.facilityId) : null));

  if (!homeFacilityId) return memberships;

  const represented = memberships.some((m) => {
    const value = m.facilityId as unknown as { _id?: unknown } | string | null;
    return String(typeof value === 'object' && value !== null ? value._id : value) === homeFacilityId;
  });
  if (represented) return memberships;

  const homeFacility = await Facility.findOne({ _id: homeFacilityId, deletedAt: null })
    .select('name type region district address contactInfo isActive')
    .lean();

  return [
    {
      patientId: patientOid,
      facilityId: homeFacility ?? homeFacilityId,
      status: 'active',
      isPrimary: true,
      // Flagged in the comment rather than dated: this row is derived, not created.
      registeredAt: null,
      endedAt: null,
      derivedFromPatientFacilityId: true,
    },
    ...memberships,
  ];
}
