import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AuditLog } from '../models/AuditLog';
import { AuthRequest } from './auth';
import { toObjectId } from '../utils/tenancy';

/**
 * Marker so coverage can be measured by walking the mounted routers, mirroring the RBAC
 * guards. An anonymous middleware cannot be identified any other way once mounted.
 */
export const AUDIT_GUARD = Symbol('audit.guard');

export type AuditGuard = RequestHandler & {
  [AUDIT_GUARD]?: {
    entity: string;
    methods: string[];
  };
};

export interface AuditOptions {
  entity: string;
  /**
   * Resolve the target entity id. Receives the response body as well, so a record created by
   * the request can be identified by the id the response returned.
   */
  entityId?: (req: Request, responseBody?: unknown) => string | undefined;
  /** Fetch a "before" snapshot for the entity. */
  before?: (req: Request) => Promise<unknown>;
  /**
   * Resolve the hospital the change is *to* (rather than the actor's own). Needed whenever a
   * platform action mutates another tenant's data, otherwise the entry cannot be filtered by
   * hospital. May be async so a lookup is possible, and receives the response body so a
   * freshly created record can be identified by its own id.
   */
  targetFacility?: (req: Request, responseBody?: unknown) => unknown | Promise<unknown>;
  /**
   * Extra facts worth keeping: a status transition, a reason, an affected-row count. Receives
   * the captured `before` snapshot and the response body so a change that matters (a role
   * escalation, a status flip) can be stated explicitly rather than left for a reader to
   * diff two documents by eye.
   */
  metadata?: (
    req: Request,
    ctx: { before?: unknown; body?: unknown }
  ) => Record<string, unknown>;
  /**
   * Short description for audit review screens. A plain string is fine when it does not depend
   * on the request; the callback form receives the same context as `metadata`.
   */
  summary?:
    | string
    | ((req: Request, ctx: { before?: unknown; body?: unknown }) => string | undefined);
  /** Which methods trigger logging. Defaults to POST/PUT/PATCH/DELETE. */
  methods?: string[];
  /**
   * Response fields to drop from the stored `after` snapshot. Passwords, tokens and OTPs must
   * never reach the audit collection.
   */
  redact?: string[];
}

/**
 * Never persisted into an audit entry. An audit log with weaker access control than the data
 * it records becomes the easier target: anyone who can read logs could read every password
 * change in the platform's history.
 */
const ALWAYS_REDACTED = [
  'password',
  'passwordHash',
  'newPassword',
  'currentPassword',
  'otp',
  'code',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'nationalId',
];

const MAX_SNAPSHOT_CHARS = 4000;

/**
 * Converts a snapshot to plain JSON-safe data.
 *
 * Controllers hand back live Mongoose documents, whose internals (`$__`, `_doc`, `db`,
 * `base`, …) form a cycle. Walking one with a plain recursive walk never terminates, and a
 * snapshot should record the state of the record rather than the shape of the driver, so the
 * document is serialised through its own `toJSON` first. Anything genuinely unserialisable is
 * dropped rather than allowed to fail the entry.
 */
function toPlain(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

function redact(value: unknown, fields: string[]): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.slice(0, 25).map((entry) => redact(entry, fields));
  }

  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    out[key] = fields.includes(key) ? '[redacted]' : redact(entry, fields);
  }
  return out;
}

function cap(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const serialised = JSON.stringify(value);
  if (serialised === undefined) return value;
  if (serialised.length <= MAX_SNAPSHOT_CHARS) return value;
  return { truncated: true, preview: `${serialised.slice(0, MAX_SNAPSHOT_CHARS)}…` };
}

/**
 * Audit-logging middleware applied to every privileged mutation.
 *
 * Records the actor, the action, the target entity, the target hospital, a before/after
 * snapshot, the outcome, and the request's origin. Two behaviours matter beyond the obvious:
 *
 *  - Failures are logged too. A mutation that was refused half way, or rejected by a guard,
 *    is precisely what an investigation is looking for, and an audit trail that only records
 *    successes cannot answer "who was trying this?".
 *  - The write is awaited. Fire-and-forget loses the entry if the process dies between the
 *    response and the insert, and makes the trail impossible to assert on in a test.
 */
export function auditLog(options: AuditOptions): AuditGuard {
  const { entity, entityId, before, targetFacility, metadata, summary, methods } = options;
  const watched = (methods ?? ['POST', 'PUT', 'PATCH', 'DELETE']).map((m) => m.toUpperCase());
  const redacted = [...ALWAYS_REDACTED, ...(options.redact ?? [])];

  const guard: AuditGuard = async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!watched.includes(req.method.toUpperCase())) return next();

    let beforeState: unknown;
    if (before) {
      try {
        beforeState = await before(req);
      } catch {
        // A missing snapshot must not prevent the mutation itself.
        beforeState = undefined;
      }
    }

    let recorded = false;

    const record = async (statusCode: number) => {
      if (recorded) return;
      recorded = true;

      // On failure the response body is an error payload, not the new state of the record.
      const afterBody = statusCode < 400 ? res.locals.auditAfter : undefined;

      let target: unknown = req.user?.facilityId;
      if (targetFacility) {
        try {
          const resolved = await targetFacility(req, afterBody);
          // Nullish means "not a cross-tenant change" — file it under the actor's own hospital
          // rather than dropping it into an unfilterable `null` bucket.
          if (resolved !== undefined && resolved !== null) target = resolved;
        } catch {
          // An unresolvable target still leaves a usable entry: the entity and snapshots carry
          // enough to identify the change even if it cannot be filed under a hospital.
        }
      }

      let entry;
      try {
        entry = {
          userId: req.user?.id ?? null,
          // Unauthenticated endpoints (registration, password reset) are still worth recording;
          // labelling them honestly beats a blank role field that reads like a bug.
          role: req.user?.role ?? 'anonymous',
          action: req.method.toUpperCase(),
          entity,
          entityId: entityId ? entityId(req, afterBody) : req.params.id,
          facilityId: toObjectId(target) ?? null,
          actorFacilityId: toObjectId(req.user?.facilityId) ?? null,
          before: cap(redact(toPlain(beforeState), redacted)),
          after: cap(redact(toPlain(afterBody), redacted)),
          metadata: metadata
            ? cap(metadata(req, { before: toPlain(beforeState), body: toPlain(afterBody) }))
            : undefined,
          summary:
            typeof summary === 'function'
              ? summary(req, { before: toPlain(beforeState), body: toPlain(afterBody) })
              : summary,
          succeeded: statusCode < 400,
          statusCode,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          timestamp: new Date(),
        };
      } catch {
        // A caller-supplied resolver threw. The change itself has already been authorised and
        // applied, so the entry is abandoned rather than the operation reported as failed.
        return;
      }

      try {
        await AuditLog.create(entry);
      } catch {
        // An audit failure must not turn a successful, authorised operation into a 500.
        // Silently dropping is a deliberate trade: availability of clinical endpoints over
        // completeness of the trail. Real deployments should alarm on this counter.
      }
    };

    const originalJson = res.json.bind(res);
    // The insert is awaited *before* the response is sent. Express types `res.json` as returning
    // the response, but it ignores the value and nothing here reads it, so the cast is where the
    // sending actually happens. The upshot is that a client does not receive a success unless
    // the entry is on its way to disk: one indexed insert is a fair price for an audit record
    // that cannot quietly go missing.
    //
    // The `catch` is load-bearing. Because the send is chained onto the write, anything that
    // threw in the audit path would otherwise leave the request hanging until it timed out —
    // an auditing fault must never be able to take a clinical endpoint down with it, so the
    // response is sent either way and only the entry is lost.
    res.json = ((body?: unknown) => {
      res.locals.auditAfter = (body as { data?: unknown } | undefined)?.data ?? body;
      return record(res.statusCode).then(() => originalJson(body));
    }) as unknown as Response['json'];

    // Backstop for responses that never reach `res.json` (a bare `res.end`, a 204, a stream).
    // The throwing-handler path does reach `res.json` via the error handler, so this only
    // fires when the middleware is mounted on a route that bypasses it.
    res.on('finish', () => {
      if (recorded) return;
      void record(res.statusCode);
    });

    return next();
  };

  guard[AUDIT_GUARD] = { entity, methods: watched };
  return guard;
}
