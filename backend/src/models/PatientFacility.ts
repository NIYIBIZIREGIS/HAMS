import { Schema, model, Document, Types } from 'mongoose';

/**
 * A patient's membership of one hospital.
 *
 * A patient is a single global identity (`Patient.userId` is unique and `Patient.patientNumber`
 * is globally unique), but they may be treated by several hospitals. Membership is what grants
 * a hospital access to that patient's record, and it is deliberately per-hospital so that a
 * discharge or a GDPR erasure request at one hospital does not silently strip the patient's
 * history at another.
 *
 * `Patient.facilityId` remains the patient's home/primary hospital. It is kept in step with the
 * membership flagged `isPrimary` rather than being deleted, so the existing "registered at this
 * hospital" screens and the patient number sequence keep working while this collection is the
 * authority on reachability.
 */
export interface IPatientFacility extends Document {
  patientId: Types.ObjectId;
  facilityId: Types.ObjectId;
  /**
   * `active` grants the hospital access. `inactive` is a soft end of membership: the record
   * stays for audit, but the hospital can no longer reach the patient through this row.
   */
  status: 'active' | 'inactive';
  /** The patient's home hospital. At most one membership per patient may carry this. */
  isPrimary: boolean;
  registeredAt: Date;
  endedAt?: Date | null;
  /** The account that created the membership: a receptionist, a platform admin, or the patient. */
  registeredBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const patientFacilitySchema = new Schema<IPatientFacility>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patients', required: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isPrimary: { type: Boolean, default: false },
    registeredAt: { type: Date, default: () => new Date() },
    endedAt: { type: Date, default: null },
    registeredBy: { type: Schema.Types.ObjectId, ref: 'Users', default: null },
  },
  { timestamps: true }
);

// One row per patient per hospital. This is the invariant that makes `upsert` safe.
patientFacilitySchema.index({ patientId: 1, facilityId: 1 }, { unique: true });

// Serves "this hospital's patients" and "is this patient one of ours?".
patientFacilitySchema.index({ facilityId: 1, status: 1 });
patientFacilitySchema.index({ patientId: 1, status: 1 });

// At most one primary membership per patient, enforced by the database rather than by
// application code, so two concurrent requests cannot both claim to be the home hospital.
patientFacilitySchema.index(
  { patientId: 1, isPrimary: 1 },
  {
    unique: true,
    partialFilterExpression: { isPrimary: true },
  }
);

export const PatientFacility = model<IPatientFacility>('PatientFacilities', patientFacilitySchema);
