import { Schema, model, Document } from 'mongoose';

export type InsuranceProviderType = 'private_insurance' | 'government_scheme';
export type ClaimSubmissionMethod = 'api' | 'manual';

export interface IInsuranceProvider extends Document {
  name: string;
  type: InsuranceProviderType;
  contactInfo?: { phone?: string; email?: string };
  claimSubmissionMethod: ClaimSubmissionMethod;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const insuranceProviderSchema = new Schema<IInsuranceProvider>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    type: { type: String, enum: ['private_insurance', 'government_scheme'], required: true },
    contactInfo: {
      phone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    claimSubmissionMethod: { type: String, enum: ['api', 'manual'], default: 'manual' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const InsuranceProvider = model<IInsuranceProvider>('InsuranceProviders', insuranceProviderSchema);