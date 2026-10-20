import { Schema, model, Document, Types } from 'mongoose';

export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'expired';

export interface IFacility extends Document {
  name: string;
  type: 'hospital' | 'clinic' | 'health_center' | 'district_office';
  region?: string;
  district?: string;
  address?: string;
  geoLocation?: { lat: number; lng: number };
  contactInfo?: { phone?: string; email?: string };
  operatingHours?: string;
  /** Logo image URL shown in the hospital directory and admin header. */
  logo?: string;
  isActive: boolean;
  /** Commercial state of the tenant's subscription, managed by the platform owner. */
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt?: Date | null;
  /**
   * Soft-delete marker. A deleted hospital keeps its rows so patient, appointment and
   * payment history stays referentially intact, but it disappears from the directory and
   * its staff are suspended so nobody can operate it.
   */
  deletedAt?: Date | null;
  deletedBy?: Types.ObjectId | null;
  parentFacilityId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const facilitySchema = new Schema<IFacility>(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['hospital', 'clinic', 'health_center', 'district_office'],
      required: true,
    },
    region: { type: String, trim: true },
    district: { type: String, trim: true },
    address: { type: String, trim: true },
    geoLocation: {
      lat: { type: Number },
      lng: { type:Number },
    },
    contactInfo: {
      phone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    operatingHours: { type: String, trim: true },
    logo: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    subscriptionStatus: {
      type: String,
      enum: ['trial', 'active', 'suspended', 'expired'],
      default: 'trial',
    },
    subscriptionExpiresAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'Users', default: null },
    parentFacilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', default: null },
  },
  { timestamps: true }
);

// Every directory query filters out deleted tenants, so the index is on the soft-delete
// marker rather than `isActive`.
facilitySchema.index({ deletedAt: 1 });
facilitySchema.index({ subscriptionStatus: 1 });
// Deliberately not unique: legacy rows may already share a name, and a unique index that
// fails to build would break every subsequent write. Uniqueness among *live* hospitals is
// enforced in the controller so the caller gets a clear 409 instead of a driver error.
facilitySchema.index({ name: 1 });

/** Not a real document field: a deleted hospital is inactive by definition. */
facilitySchema.virtual('isDeleted').get(function (this: IFacility) {
  return Boolean(this.deletedAt);
});

export const Facility = model<IFacility>('Facilities', facilitySchema);
