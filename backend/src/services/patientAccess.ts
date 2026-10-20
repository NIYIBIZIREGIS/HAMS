import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Appointment, Patient } from '../models';
import { forbidden, notFound } from '../utils/AppError';
import { hasRole, isSuperAdmin, isTenantScoped, toObjectId, ROLE_PATIENT } from '../utils/tenancy';
import { activePatientIdsAtFacility, isActiveMember } from './patientFacilityService';

type PatientLike = { _id: unknown; userId: unknown; facilityId?: unknown };

/**
 * Mongo condition matching the patients a hospital-scoped caller may see.
 *
 * A patient qualifies when they hold an active membership at that hospital, when they are
 * registered there as their home hospital, or when they have an appointment there. All three
 * are needed because the three ways a patient reaches a hospital overlap but none subsumes
 * the others: a portal patient who has only ever booked at Beta holds no membership yet but
 * is plainly Beta's to treat, and a patient whose home is Alpha may still be Beta's patient.
 *
 * The `$or` arms compile into two `$in` lists, so this is bounded by the number of patients a
 * hospital has ever booked rather than the size of the patient table.
 */
export async function visiblePatientCondition(facilityId: string): Promise<Record<string, unknown>> {
  const oid = toObjectId(facilityId);
  const [members, withAppointments] = await Promise.all([
    activePatientIdsAtFacility(oid),
    Appointment.distinct('patientId', { facilityId: oid }),
  ]);
  return {
    $or: [{ facilityId: oid }, { _id: { $in: members } }, { _id: { $in: withAppointments } }],
  };
}

/**
 * Whether a hospital may reach a patient at all, ignoring who is asking.
 *
 * Three routes, all of which have to be honoured. `Patient.facilityId` is the patient's home
 * hospital and grants access on its own, because a patient registered at a hospital must
 * remain reachable there even if no membership row has been written yet. Membership is the
 * primary answer for every other hospital. The appointment fallback comes last, because a
 * patient can reach a hospital the moment they book before any membership row exists, and
 * because rows created before the backfill migration must not suddenly become unreachable.
 */
async function hospitalTreatsPatient(
  patient: PatientLike,
  facilityId: Types.ObjectId
): Promise<boolean> {
  if (patient.facilityId && String(patient.facilityId) === String(facilityId)) return true;
  if (await isActiveMember(patient._id, facilityId)) return true;
  const hasAppointment = await Appointment.exists({ patientId: patient._id, facilityId });
  return Boolean(hasAppointment);
}

/**
 * Enforces read access to a patient record.
 *
 * Cross-tenant access is reported as "not found" rather than "forbidden" so a hospital
 * cannot probe for the existence of another hospital's patients.
 */
export async function assertPatientAccess(req: AuthRequest, patient: PatientLike): Promise<void> {
  if (isSuperAdmin(req.user)) return;

  if (hasRole(req.user, ROLE_PATIENT) && String(patient.userId) === req.user?.id) return;

  if (!isTenantScoped(req.user)) throw forbidden('Forbidden');

  const own = toObjectId(req.user?.facilityId);
  if (!own) throw forbidden('Account is not assigned to a hospital');

  // A patient can belong to several hospitals. Reaching for `patient.facilityId` first and
  // stopping there is what made a hospital that treats a patient unable to open their record
  // whenever the patient's home hospital was somewhere else.
  if (await hospitalTreatsPatient(patient, own)) return;

  throw notFound('Patient not found');
}

/**
 * Asserts that a patient may be written to as part of a record owned by `facilityId`.
 *
 * Used by messaging, notifications and document upload, which attach a record to a patient
 * the caller names by id. Without this, hospital A could write into hospital B's patient's
 * inbox, because those records are stamped with the caller's hospital while pointing at an
 * arbitrary patient.
 */
export async function assertPatientReachable(
  req: AuthRequest,
  patient: PatientLike,
  targetFacilityId: unknown
): Promise<void> {
  if (isSuperAdmin(req.user)) return;

  const target = toObjectId(targetFacilityId);
  if (!target) throw forbidden('No hospital assigned to the record');

  if (await hospitalTreatsPatient(patient, target)) return;

  throw notFound('Patient not found');
}

/** Loads a patient for a staff-initiated write and asserts reachability in one step. */
export async function loadReachablePatient(
  req: AuthRequest,
  patientId: string,
  targetFacilityId: unknown
): Promise<NonNullable<Awaited<ReturnType<typeof Patient.findById>>>> {
  const patient = await Patient.findById(patientId).select('_id userId facilityId');
  if (!patient) throw notFound('Patient not found');
  await assertPatientReachable(req, patient, targetFacilityId);
  return patient;
}
