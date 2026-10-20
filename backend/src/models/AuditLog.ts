import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  userId?: Types.ObjectId;
  role?: string;
  action: string;
  entity: string;
  entityId?: string;
  /**
   * The hospital the *change happened to*. Deliberately not the actor's hospital: a platform
   * owner deleting another tenant's hospital has no hospital of their own, and filing that
   * under `null` would make the audit trail unfilterable per tenant — exactly the queries an
   * auditor or a hospital admin most needs to run.
   */
  facilityId?: Types.ObjectId;
  /** The actor's own hospital, retained so "who inside hospital X did this" still works. */
  actorFacilityId?: Types.ObjectId;
  before?: unknown;
  after?: unknown;
  /** Free-form request metadata the caller wants kept (status change, reason, count, ...). */
  metadata?: Record<string, unknown>;
  /** Short human-readable description, for audit review screens. */
  summary?: string;
  succeeded: boolean;
  statusCode: number;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'Users', default: null },
    role: { type: String },
    action: { type: String, required: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', default: null },
    actorFacilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', default: null },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    summary: { type: String },
    succeeded: { type: Boolean, default: true, index: true },
    statusCode: { type: Number, default: 200 },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ facilityId: 1, timestamp: -1 });
auditLogSchema.index({ actorFacilityId: 1, timestamp: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
// Audit review screens filter by outcome and recency together.
auditLogSchema.index({ succeeded: 1, timestamp: -1 });

export const AuditLog = model<IAuditLog>('AuditLogs', auditLogSchema);
