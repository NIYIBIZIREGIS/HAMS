/**
 * Repairs `Role` documents that hold permission names from an older schema.
 *
 * Authorisation reads a role's grants from the database in preference to the code, so a role
 * document left over from a previous permission scheme silently strips every capability from
 * its holders: each permission-guarded route answers 403, the portal's lists come back empty,
 * and nothing anywhere reports a bad grant. The symptom looks like broken frontend fetching
 * rather than a data problem, which is why this is worth a dedicated command.
 *
 * `syncRoleCatalog` does the work; this only gives it a CLI. It is safe to run at any time:
 * roles in the code catalog are brought in line with it, and any custom role outside the
 * catalog is left untouched.
 *
 *   npx tsx scripts/syncRolePermissions.ts [--dry-run]
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS, WILDCARD } from '../src/utils/permissions';
import { Role } from '../src/models/Role';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await connectDB();

  const known = new Set<string>([...ALL_PERMISSIONS, WILDCARD]);

  // Report first, so the operator can see what is stale before anything is rewritten.
  const roles = await Role.find({}).select('name permissions').lean<{
    name: string;
    permissions: string[];
  }>();

  console.log(`[sync-roles] ${roles.length} role document(s) in the database`);
  let stale = 0;
  for (const role of roles.sort((a, b) => a.name.localeCompare(b.name))) {
    const stored = Array.isArray(role.permissions) ? role.permissions : [];
    const unrecognised = stored.filter((permission) => !known.has(permission));
    const catalogued = Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role.name);
    if (!unrecognised.length) continue;
    stale += 1;
    console.log(
      `[sync-roles]   ${role.name}: ${unrecognised.length}/${stored.length} grant(s) not in the current catalog` +
        `${catalogued ? '' : ' (role is outside the catalog, left as-is)'}` +
        `\n              unrecognised: ${unrecognised.join(', ')}`
    );
  }
  if (!stale) console.log('[sync-roles] no stale grants found');
  if (dryRun) {
    console.log('[sync-roles] dry run, no changes written');
    await disconnectDB();
    return;
  }

  const { syncRoleCatalog } = await import('../src/services/roleCatalog');
  const result = await syncRoleCatalog();
  console.log('[sync-roles] synced');
  console.log(`[sync-roles]   created   ${result.created.length}${result.created.length ? `: ${result.created.join(', ')}` : ''}`);
  console.log(`[sync-roles]   updated   ${result.updated.length}${result.updated.length ? `: ${result.updated.join(', ')}` : ''}`);
  console.log(`[sync-roles]   unchanged ${result.unchanged.length}`);

  await disconnectDB();
}

main().catch(async (err) => {
  console.error('[sync-roles] failed', err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});