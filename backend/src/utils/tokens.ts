import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  facilityId?: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export function signAccessToken(user: {
  id: string;
  role: string;
  facilityId?: string | null;
}): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    role: user.role,
    facilityId: user.facilityId ?? null,
  };
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, jti } as RefreshTokenPayload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
