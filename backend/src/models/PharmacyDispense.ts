import { Schema, model, Document, Types } from 'mongoose';

export interface IPharmacyDispense extends Document {
  prescriptionId: Types.ObjectId;
  inventoryId: Types.ObjectId;
  dispensedBy: Types.ObjectId;
  facilityId: Types.ObjectId;
  quantity: number;
  dispensedAt: Date;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const pharmacyDispenseSchema = new Schema<IPharmacyDispense>(
  {
    prescriptionId: { type: Schema.Types.ObjectId, ref: 'Prescriptions', required: true },
    inventoryId: { type: Schema.Types.ObjectId, ref: 'PharmacyInventories', required: true },
    dispensedBy: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    quantity: { type: Number, required: true, min: 1 },
    dispensedAt: { type: Date, default: () => new Date() },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

pharmacyDispenseSchema.index({ prescriptionId: 1 });
pharmacyDispenseSchema.index({ facilityId: 1, dispensedAt: -1 });

export const PharmacyDispense = model<IPharmacyDispense>(
  'PharmacyDispenses',
  pharmacyDispenseSchema,
);
