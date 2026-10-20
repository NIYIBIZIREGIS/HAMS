/**
 * Backfills `Patient.facilityId` for rows created before patient records were tenant-scoped.
 *
 * A patient's hospital is inferred, in order of confidence, from:
 *   1. the hospital of their most recent appointment,
 *   2. the hospital on their owning user account.
 *
 * Patients who cannot be attributed to a hospital are left null; they stay reachable
 * only through their appointments, which is how the tenant-isolation rule treats
 * portal-registered patients.
 *
 * Idempotent: rows that already have a hospital are skipped. Run with --dry-run to report
 * without writing.
 *
 *   npx tsx scripts/migratePatientFacility.ts [--dry-run]
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db';
import { Patient } from '../src/models/Patient';
import { Appointment } from '../src/models/Appointment';
import { User } from '../src/models/User';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  await connectDB();

  const unlinked = await Patient.find({ $or: [{ facilityId: null }, { facilityId: { $exists: false } }] })
    .select('_id userId patientNumber')
    .lean();

  console.log(`[migrate] patients without a hospital: ${unlinked.length}`);
  if (unlinked.length === 0) {
    await disconnectDB();
    return;
  }

  const stats = { fromAppointment: 0, fromUser: 0, unresolved: 0 };

  for (const patient of unlinked) {
    const latest = await Appointment.findOne({ patientId: patient._id })
      .sort({ createdAt: -1 })
      .select('facilityId')
      .lean();

    let target: mongoose.Types.ObjectId | null = null;
    if (latest?.facilityId) {
      target = latest.facilityId as mongoose.Types.ObjectId;
      stats.fromAppointment += 1;
    } else {
      const owner = await User.findById(patient.userId).select('facilityId').lean();
      if (owner?.facilityId) {
        target = owner.facilityId as mongoose.Types.ObjectId;
        stats.fromUser += 1;
      }
    }

    if (!target) {
      stats.unresolved += 1;
      console.log(`[migrate] unresolved: ${patient.patientNumber} (${patient._id})`);
      continue;
    }

    console.log(
      `[migrate] ${patient.patientNumber} -> facility ${target} (${
        latest?.facilityId ? 'from appointment' : 'from user'
      })`
    );

    if (!dryRun) {
      await Patient.updateOne({ _id: patient._id }, { $set: { facilityId: target } });
    }
  }

  console.log('[migrate] summary', stats);
  if (dryRun) console.log('[migrate] dry run, no changes written');

  await disconnectDB();
}

main().catch(async (err) => {
  console.error('[migrate] failed', err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
