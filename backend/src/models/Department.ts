import { Schema, model, Document, Types } from 'mongoose';

export interface IDepartment extends Document {
  facilityId: Types.ObjectId;
  name: string;
  description?: string;
  defaultConsultationFee?: number;
  contactInfo?: { phone?: string; email?: string };
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
  {
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facilities', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    defaultConsultationFee: { type: Number, min: 0 },
    contactInfo: {
      phone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
  },
  { timestamps: true }
);

departmentSchema.index({ facilityId: 1, name: 1 }, { unique: true });

export const Department = model<IDepartment>('Departments', departmentSchema);
