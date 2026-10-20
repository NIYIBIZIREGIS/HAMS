import { Schema, model, Document, Types } from 'mongoose';

export interface IPharmacyInventory extends Document {
  facilityId: Types.ObjectId;
  drugName: string;
  form: string;
  strength: string;
  batchNumber: string;
  expiryDate: Date;
  quantityOnHand: number;
  reorderThreshold: number;
  unitCost: number;
  createdAt: Date;
  updatedAt: Date;
}

const pharmacyInventorySchema = new Schema<IPharmacyInventory>(
  {
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    drugName: { type: String, required: true, trim: true },
    form: { type: String, trim: true, default: 'tablet' },
    strength: { type: String, trim: true, default: '' },
    batchNumber: { type: String, trim: true, default: '' },
    expiryDate: { type: Date, required: true },
    quantityOnHand: { type: Number, default: 0, min: 0 },
    reorderThreshold: { type: Number, default: 10, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

pharmacyInventorySchema.index({ facilityId: 1, drugName: 1 });
pharmacyInventorySchema.index({ facilityId: 1, expiryDate: 1 });

export const PharmacyInventory = model<IPharmacyInventory>(
  'PharmacyInventories',
  pharmacyInventorySchema,
);
