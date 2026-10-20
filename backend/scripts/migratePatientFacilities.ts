/**
 * Backfills `PatientFacility` memberships for rows created before a patient could belong to
 * more than one hospital.
 *
 * Two memberships are created per patient where the data supports it:
 *   1. a primary membership at their home hospital, which is `Patient.facilityId` when set,
 *      otherwise inferred from their most recent appointment or their owning user account;
 *   2. a membership at every other hospital they have an appointment at, since a patient who
 *      has been treated there is plainly that hospital's to open.
 *
 * The primary flag is what keeps `Patient.facilityId` authoritative for "where is this patient
 * registered", so a patient who visited several hospitals keeps their original home rather
 * than having it rewritten by the most recent visit.
 *
 * Idempotent: `grantMembership` upserts on `{ patientId, facilityId }`, so re-running adds
 * nothing and never duplicates. Existing rows are left exactly as they are, including rows
 * that were deliberately ended.
 *
 *   npx tsx scripts/migratePatientFacilities.ts [--dry-run]
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db';
import { Patient } from '../src/models/Patient';
import { Appointment } from '../src/models/Appointment';
import { User } from '../src/models/User';
import { Facility } from '../src/models/Facility';
import { PatientFacility } from '../src/models/PatientFacility';
import { grantMembership } from '../src/services/patientFacilityService';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  await connectDB();

  const patients = await Patient.find({})
    .select('_id userId patientNumber facilityId')
    .lean();
  console.log(`[migrate] patients: ${patients.length}`);

  // A hospital that has been deleted or deactivated cannot receive a membership, or the
  // backfill would grant reachability to a tenant the platform has already stood down.
  const liveFacilityIds = new Set(
    (
      await Facility.find({ deletedAt: null, isActive: true })
        .select('_id')
        .lean()
    ).map((f) => String(f._id))
  );
  console.log(`[migrate] active hospitals: ${liveFacilityIds.size}`);

  const stats = {
    primaryFromPatient: 0,
    primaryFromAppointment: 0,
    primaryFromUser: 0,
    noHome: 0,
    extraFromVisits: 0,
    skippedInactiveFacility: 0,
  };

  for (const patient of patients) {
    const home: mongoose.Types.ObjectId | null = patient.facilityId ?? null;
    let primary = home;

    if (!primary) {
      const latest = await Appointment.findOne({ patientId: patient._id })
        .sort({ createdAt: -1 })
        .select('facilityId')
        .lean();
      if (latest?.facilityId) {
        primary = latest.facilityId as mongoose.Types.ObjectId;
        stats.primaryFromAppointment += 1;
      } else {
        const owner = await User.findById(patient.userId).select('facilityId').lean();
        if (owner?.facilityId) {
          primary = owner.facilityId as mongoose.Types.ObjectId;
          stats.primaryFromUser += 1;
        }
      }
    } else {
      stats.primaryFromPatient += 1;
    }

    if (primary) {
      if (!liveFacilityIds.has(String(primary))) {
        console.log(
          `[migrate] ${patient.patientNumber}: home hospital is no longer active, left unmapped`
        );
        stats.skippedInactiveFacility += 1;
        primary = null;
      }
    }

    if (!primary) {
      stats.noHome += 1;
    } else if (!dryRun) {
      await grantMembership(patient._id, primary, { isPrimary: true });
    }

    // Every other hospital this patient has actually been treated at.
    const visited = await Appointment.distinct('facilityId', { patientId: patient._id });
    for (const facilityId of visited) {
      const id = String(facilityId);
      if (primary && id === String(primary)) continue;
      if (!liveFacilityIds.has(id)) continue;
      if (!dryRun) await grantMembership(patient._id, facilityId);
      stats.extraFromVisits += 1;
    }
  }

  console.log('[migrate] summary', stats);
  console.log(`[migrate] memberships now in collection: ${await PatientFacility.countDocuments()}`);
  if (dryRun) console.log('[migrate] dry run, no changes written');

  await disconnectDB();
}

main().catch(async (err) => {
  console.error('[migrate] failed', err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
