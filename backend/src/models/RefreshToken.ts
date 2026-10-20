import { Schema, model, Document, Types } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  jti: string;
  deviceInfo?: string;
  issuedAt: Date;
  expiresAt: Date;
  revoked: boolean;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
    tokenHash: { type: String, required: true, unique: true },
    jti: { type: String, required: true, index: true },
    deviceInfo: { type: String, trim: true },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ userId: 1, revoked: 1 });

export const RefreshToken = model<IRefreshToken>('RefreshTokens', refreshTokenSchema);
