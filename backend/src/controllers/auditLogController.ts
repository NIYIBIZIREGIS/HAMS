import { Response } from 'express';
import { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';
import { canonicalRole, isTenantScoped, toObjectId } from '../utils/tenancy';
import { AppError } from '../utils/AppError';
import { paginate, success } from '../utils/apiResponse';
import { AuthRequest } from '../middleware/auth';

interface ListQuery {
  facilityId?: string;
  entity?: string;
  entityId?: string;
  action?: string;
  userId?: string;
  succeeded?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type AuditScope =
  | { global: true; facilityIds: null }
  | { global: false; facilityIds: Types.ObjectId[] };

/**
 * An auditor is a hospital employee, so the audit trail is tenant data like any other: they see
 * their own hospital only. A platform owner is the one role allowed to read across tenants,
 * because investigating a cross-tenant problem is the job.
 */
function resolveScope(req: AuthRequest): AuditScope {
  if (canonicalRole(req.user?.role) === 'super_admin') return { global: true, facilityIds: null };
  if (!isTenantScoped(req.user)) return { global: false, facilityIds: [] };
  const own = toObjectId(req.user?.facilityId);
  return { global: false, facilityIds: own ? [own] : [] };
}

export async function listAuditLogs(req: AuthRequest, res: Response) {
  const q = req.query as ListQuery;
  const scope = resolveScope(req);

  const filter: Record<string, unknown> = {};

  if (scope.global) {
    if (q.facilityId) {
      const requested = toObjectId(q.facilityId);
      if (!requested) throw new AppError(400, 'Invalid facilityId');
      filter.facilityId = requested;
    }
  } else {
    // Non-platform callers are pinned to their own hospital; asking for another one must never
    // widen the result set, so the override is ignored rather than honoured.
    filter.facilityId = { $in: scope.facilityIds };
  }

  if (q.entity) filter.entity = escapeRegExp(q.entity);
  if (q.entityId) filter.entityId = q.entityId;
  if (q.action) filter.action = q.action.toUpperCase();
  if (q.succeeded !== undefined) {
    if (q.succeeded !== 'true' && q.succeeded !== 'false') {
      throw new AppError(400, 'succeeded must be "true" or "false"');
    }
    filter.succeeded = q.succeeded === 'true';
  }
  if (q.userId) {
    const requested = toObjectId(q.userId);
    if (!requested) throw new AppError(400, 'Invalid userId');
    filter.userId = requested;
  }
  if (q.from || q.to) {
    const range: Record<string, Date> = {};
    if (q.from) {
      const from = new Date(q.from);
      if (Number.isNaN(from.getTime())) throw new AppError(400, 'Invalid from date');
      range.$gte = from;
    }
    if (q.to) {
      const to = new Date(q.to);
      if (Number.isNaN(to.getTime())) throw new AppError(400, 'Invalid to date');
      range.$lte = to;
    }
    filter.timestamp = range;
  }

  const page = Number.parseInt(q.page ?? '1', 10) || 1;
  const limit = Number.parseInt(q.limit ?? '25', 10) || 25;
  const meta = paginate(page, limit, 0);

  const [total, entries] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ timestamp: -1, _id: -1 })
      .skip((meta.page - 1) * meta.limit)
      .limit(meta.limit)
      .lean(),
  ]);

  // Actor names are resolved in one query rather than per row, so a 100-entry page does not
  // turn into 100 round trips to the users collection.
  const actorIds = [...new Set(entries.map((e) => e.userId).filter(Boolean))] as Types.ObjectId[];
  const actors = actorIds.length
    ? await User.find({ _id: { $in: actorIds } })
        .select('fullName email role')
        .lean()
    : [];
  const actorById = new Map(actors.map((a) => [String(a._id), a]));

  return success(
    res,
    200,
    entries.map((entry) => ({
      ...entry,
      actor: entry.userId ? actorById.get(String(entry.userId)) ?? null : null,
    })),
    paginate(page, limit, total)
  );
}

export async function getAuditLog(req: AuthRequest, res: Response) {
  const entry = await AuditLog.findById(req.params.id).lean();
  if (!entry) throw new AppError(404, 'Audit entry not found');

  const scope = resolveScope(req);
  if (!scope.global) {
    const allowed = scope.facilityIds.some((id) => id.equals(entry.facilityId));
    // 404 rather than 403: confirming the entry exists would leak the shape of another
    // tenant's activity to someone who is not allowed to see it.
    if (!allowed) throw new AppError(404, 'Audit entry not found');
  }

  const actor = entry.userId
    ? await User.findById(entry.userId).select('fullName email role').lean()
    : null;

  return success(res, 200, { ...entry, actor: actor ?? null });
}
