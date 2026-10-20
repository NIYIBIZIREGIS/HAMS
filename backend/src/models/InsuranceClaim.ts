import { Schema, model, Document, Types } from 'mongoose';

export type ClaimStatus = 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Paid';

export interface IInsuranceClaim extends Document {
  paymentId: Types.ObjectId;
  providerId: Types.ObjectId;
  claimAmount: number;
  status: ClaimStatus;
  submittedAt: Date;
  resolvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const insuranceClaimSchema = new Schema<IInsuranceClaim>(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payments', required: true, unique: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'InsuranceProviders', required: true },
    claimAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid'],
      default: 'Submitted',
    },
    submittedAt: { type: Date, default: () => new Date() },
    resolvedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

insuranceClaimSchema.index({ providerId: 1, status: 1 });
insuranceClaimSchema.index({ submittedAt: -1 });

export const InsuranceClaim = model<IInsuranceClaim>('InsuranceClaims', insuranceClaimSchema);