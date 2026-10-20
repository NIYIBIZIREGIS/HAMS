import { Schema, model, Document, Types } from 'mongoose';
import { config } from '../config/env';

export type VerificationChannel = 'email' | 'sms';
export type VerificationPurpose = 'account' | 'login' | 'reset_password';

export interface IVerificationCode extends Document {
  userId: Types.ObjectId;
  channel: VerificationChannel;
  target: string;
  purpose: VerificationPurpose;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const verificationCodeSchema = new Schema<IVerificationCode>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
    channel: { type: String, enum: ['email', 'sms'], required: true },
    target: { type: String, required: true, trim: true },
    purpose: { type: String, enum: ['account', 'login', 'reset_password'], default: 'account' },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

verificationCodeSchema.index({ channel: 1, target: 1, purpose: 1 });
verificationCodeSchema.index({ userId: 1, channel: 1, purpose: 1, createdAt: -1 });
verificationCodeSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: config.verification.codeTtlMinutes * 60 }
);

export const VerificationCode = model<IVerificationCode>('VerificationCodes', verificationCodeSchema);