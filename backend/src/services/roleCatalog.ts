import { Role } from '../models/Role';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS, WILDCARD } from '../utils/permissions';

export interface RoleSyncResult {
  created: string[];
  updated: string[];
  unchanged: string[];
}

/**
 * Brings the `Role` collection in line with the code-side catalog.
 *
 * Upserts rather than skipping existing documents, so a role's grants actually follow the
 * catalog instead of silently keeping whatever a previous seed happened to write. Unknown
 * permission strings on a synced role are dropped: a typo in the database would otherwise
 * read as granted-but-unmatched and quietly widen access the moment the name is corrected.
 *
 * Role documents outside the catalog are left untouched, so an operator's custom roles are
 * not destroyed by re-seeding.
 */
export async function syncRoleCatalog(): Promise<RoleSyncResult> {
  const known = new Set<string>([...ALL_PERMISSIONS, WILDCARD]);
  const result: RoleSyncResult = { created: [], updated: [], unchanged: [] };

  for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    const wanted = [...permissions];
    const existing = await Role.findOne({ name }).select('permissions').lean<{
      permissions: string[];
    }>();

    if (!existing) {
      await Role.create({ name, permissions: wanted });
      result.created.push(name);
      continue;
    }

    const current = Array.isArray(existing.permissions) ? existing.permissions : [];
    const pruned = current.filter((permission) => known.has(permission));
    const changed =
      pruned.length !== current.length ||
      wanted.length !== pruned.length ||
      wanted.some((permission) => !pruned.includes(permission));

    if (!changed) {
      result.unchanged.push(name);
      continue;
    }

    await Role.updateOne({ name }, { $set: { permissions: wanted } });
    result.updated.push(name);
  }

  return result;
}
