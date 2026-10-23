import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { User, Patient, RefreshToken, Facility, nextSeq, Notification } from '../models';
import { signAccessToken, signRefreshToken, verifyRefreshToken, sha256 } from '../utils/tokens';
import { hashPassword, comparePassword } from '../utils/password';
import { issueCode, verifyCode } from '../services/verification';
import type { VerificationPurpose } from '../models/VerificationCode';
import { success } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { config } from '../config/env';
import { maskEmail } from '../utils/string';
import { canonicalRole, describeFacilityBlock, isTenantScoped } from '../utils/tenancy';
import { grantMembership } from '../services/patientFacilityService';

interface RegisterBody {
  fullName: string;
  email?: string;
  phone?: string;
  nationalId?: string;
  password: string;
  preferredLanguage?: string;
  facilityId?: string;
}

async function issueTokenPair(user: { id: string; role: string; facilityId?: string | null }, deviceInfo?: string) {
  const accessToken = signAccessToken({ id: user.id, role: user.role, facilityId: user.facilityId ?? null });
  const { token: refreshToken, jti } = signRefreshToken(user.id);
  const expiresMs = parseExpiryMs(config.jwt.refreshExpiresIn);
  await RefreshToken.create({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    jti,
    deviceInfo: deviceInfo ?? '',
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + expiresMs),
    revoked: false,
  });
  return { accessToken, refreshToken };
}

function parseExpiryMs(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[unit];
}

export function buildPublicUser(user: {
  _id: unknown;
  fullName: string;
  email?: string;
  phone?: string;
  nationalId?: string;
  role: string;
  facilityId?: unknown;
  preferredLanguage?: string;
  status?: string;
  profileImageUrl?: string;
  emailVerifiedAt?: Date | null;
  phoneVerifiedAt?: Date | null;
  mustChangePassword?: boolean;
  createdAt?: Date;
}) {
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    nationalId: user.nationalId,
    role: user.role,
    facilityId: user.facilityId ? String(user.facilityId) : null,
    preferredLanguage: user.preferredLanguage,
    status: user.status ?? 'active',
    profileImageUrl: user.profileImageUrl ?? '',
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    phoneVerifiedAt: user.phoneVerifiedAt ?? null,
    // Lets the client force a password change after signing in with a temporary one.
    mustChangePassword: user.mustChangePassword ?? false,
    createdAt: user.createdAt ?? null,
  };
}

const ALLOWED_IMAGE_PREFIX = /^data:image\/(jpeg|jpg|png|webp);base64,/;
const MAX_PROFILE_IMAGE_BYTES = 512 * 1024; // 512 KB

export async function updateProfileImage(req: AuthRequest, res: Response) {
  const user = await User.findById(req.user?.id);
  if (!user) throw new AppError(404, 'User not found');

  const raw = (req.body as { image?: string | null }).image;
  const image = (raw ?? '').trim();

  if (!image) {
    user.profileImageUrl = '';
    await user.save();
    success(res, 200, { user: buildPublicUser(user) });
    return;
  }

  if (!ALLOWED_IMAGE_PREFIX.test(image)) {
    throw new AppError(400, 'Unsupported image format. Use JPG, PNG or WebP.');
  }

  let sizeBytes = 0;
  try {
    sizeBytes = Buffer.from(image.split(';base64,')[1], 'base64').length;
  } catch {
    throw new AppError(400, 'The image data could not be decoded.');
  }
  if (sizeBytes > MAX_PROFILE_IMAGE_BYTES) {
    throw new AppError(400, 'Profile image must be 512 KB or smaller.');
  }

  user.profileImageUrl = image;
  await user.save();
  success(res, 200, { user: buildPublicUser(user) });
}

export async function updateProfile(req: AuthRequest, res: Response) {
  const user = await User.findById(req.user?.id);
  if (!user) throw new AppError(404, 'User not found');

  const { fullName, phone } = req.body as { fullName?: string; phone?: string };
  if (fullName) user.fullName = fullName.trim();
  if (phone !== undefined) {
    const next = phone.trim();
    if (next !== (user.phone ?? '')) {
      // Clearing the field must unset it; an empty string would collide with the
      // unique index for every other account that has no phone number.
      user.phone = next || undefined;
      // A re-typed number is unverified until the owner proves it again.
      user.phoneVerifiedAt = undefined;
    }
  }

  await user.save();
  success(res, 200, { user: buildPublicUser(user) });
}

export async function register(req: AuthRequest, res: Response) {
  const body = req.body as RegisterBody;

  // A patient may choose to register at a specific hospital, which is a membership: it lets
  // that hospital treat them. The hospital has to be genuinely bookable, otherwise registration
  // could be used to attach an account to a suspended tenant.
  let chosenFacilityId: string | null = null;
  if (body.facilityId) {
    const facility = await Facility.findOne({
      _id: body.facilityId,
      isActive: true,
      deletedAt: null,
    }).lean();
    if (!facility) throw new AppError(400, 'That hospital is not accepting registrations');
    chosenFacilityId = String(facility._id);
  }

  const existing = await User.findOne({
    $or: [
      ...(body.email ? [{ email: body.email.toLowerCase() }] : []),
      ...(body.phone ? [{ phone: body.phone }] : []),
      ...(body.nationalId ? [{ nationalId: body.nationalId }] : []),
    ],
  });
  if (existing) throw new AppError(409, 'A user with that email/phone/national ID already exists');

  const user = await User.create({
    fullName: body.fullName,
    email: body.email?.toLowerCase(),
    phone: body.phone,
    nationalId: body.nationalId,
    passwordHash: await hashPassword(body.password),
    role: 'patient',
    facilityId: chosenFacilityId,
    preferredLanguage: body.preferredLanguage ?? 'en',
  });

  const nextNumber = await nextSeq('patientNumber');
  const patient = await Patient.create({
    userId: user._id,
    // Kept in step with the membership below so the patient is not left with an account
    // pointing at a hospital their patient record has never heard of.
    facilityId: chosenFacilityId ? new Types.ObjectId(chosenFacilityId) : null,
    patientNumber: `PT-${String(nextNumber).padStart(5, '0')}`,
  });

  if (chosenFacilityId) {
    await grantMembership(patient._id, chosenFacilityId, {
      isPrimary: true,
      registeredBy: user._id,
    });
  }

  try {
    await Notification.create({
      patientId: patient._id,
      facilityId: chosenFacilityId ? new Types.ObjectId(chosenFacilityId) : undefined,
      recipientType: 'patient',
      type: 'general',
      title: 'Welcome to HAS',
      body: 'Thank you for registering with Hospital Appointments Management System. You can now book appointments and access services.',
      link: '/dashboard',
    });
  } catch (err) {
    console.error('[notification] welcome notification failed:', err instanceof Error ? err.message : err);
  }

  const verification = { emailDelivered: false, smsDelivered: false };
  if (user.email) {
    try {
      const r = await issueCode({
        userId: String(user._id),
        channel: 'email',
        target: user.email.toLowerCase(),
        purpose: 'account',
        user: { fullName: user.fullName, email: user.email },
      });
      verification.emailDelivered = r.delivered;
    } catch (err) {
      console.error('[verification] registration email send skipped:', err instanceof Error ? err.message : err);
    }
  }
  if (user.phone) {
    try {
      const r = await issueCode({
        userId: String(user._id),
        channel: 'sms',
        target: user.phone,
        purpose: 'account',
        user: { fullName: user.fullName, email: user.email },
      });
      verification.smsDelivered = r.delivered;
    } catch (err) {
      console.error('[verification] registration SMS send skipped:', err instanceof Error ? err.message : err);
    }
  }

  const tokens = await issueTokenPair({ id: String(user._id), role: user.role, facilityId: user.facilityId ? String(user.facilityId) : null }, req.get('user-agent'));

  success(res, 201, {
    user: buildPublicUser(user),
    patientNumber: patient.patientNumber,
    verification,
    tokens,
  });
}

/**
 * Rejects sign-in when the account's hospital has been deleted or its subscription
 * suspended. A staff member is otherwise blocked on the next request anyway (deleting a
 * hospital suspends its staff), but failing here explains *why* instead of showing a bare
 * "account is suspended".
 */
async function assertHospitalUsable(user: { facilityId?: unknown; role: string }): Promise<void> {
  if (!user.facilityId) return;
  const authUser = { id: '', role: canonicalRole(user.role), facilityId: String(user.facilityId) };
  if (!isTenantScoped(authUser)) return;
  const facility = await Facility.findById(authUser.facilityId)
    .select('isActive subscriptionStatus deletedAt')
    .lean();
  const blocked = describeFacilityBlock(facility);
  if (blocked) throw new AppError(403, blocked);
}

export async function login(req: AuthRequest, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new AppError(401, 'Invalid email or password');
  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) throw new AppError(401, 'Invalid email or password');
  if (user.status !== 'active') throw new AppError(403, `Account is ${user.status}`);
  await assertHospitalUsable(user);

  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
  const tokens = await issueTokenPair({ id: String(user._id), role: user.role, facilityId: user.facilityId ? String(user.facilityId) : null }, req.get('user-agent'));
  success(res, 200, { user: buildPublicUser(user), tokens });
}

export async function loginWithNationalId(req: AuthRequest, res: Response) {
  const { nationalId, password } = req.body as { nationalId: string; password: string };
  const user = await User.findOne({ nationalId });
  if (!user) throw new AppError(401, 'Invalid national ID or password');
  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) throw new AppError(401, 'Invalid national ID or password');
  if (user.status !== 'active') throw new AppError(403, `Account is ${user.status}`);
  await assertHospitalUsable(user);

  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
  const tokens = await issueTokenPair({ id: String(user._id), role: user.role, facilityId: user.facilityId ? String(user.facilityId) : null }, req.get('user-agent'));
  success(res, 200, { user: buildPublicUser(user), tokens });
}

/**
 * Issues a single-use code for a password-less flow.
 *
 * Delegates to the verification service rather than generating a code inline. The service
 * stores only a hash, marks the code consumed on first use, caps the number of guesses and
 * expires it, none of which a code generated and checked in the same request can offer. The
 * returned `devCode` exists only when nothing was actually delivered outside production, which
 * is the only way to exercise these flows locally.
 */
async function dispatchEmailOtp(
  user: { _id: unknown; fullName?: string; email?: string },
  email: string,
  purposeLabel: string,
  purpose: VerificationPurpose
) {
  const result = await issueCode({
    userId: String(user._id),
    channel: 'email',
    target: email,
    purpose,
    user: { fullName: user.fullName ?? 'there', email: user.email },
  });

  const response: Record<string, unknown> = {
    message: `${purposeLabel} sent to ${maskEmail(email)}`,
    delivered: result.delivered,
    via: result.via,
  };
  if (result.devCode) {
    response.otp = result.devCode;
    response.notice = 'Email transport not configured — dev-only code returned in the response.';
  }
  return response;
}

export async function requestOtp(req: AuthRequest, res: Response) {
  const { email } = req.body as { email: string };
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new AppError(404, 'No account found for that email');

  const response = await dispatchEmailOtp(user, email, 'login code', 'login');
  success(res, 200, response);
}

export async function verifyOtpLogin(req: AuthRequest, res: Response) {
  const { email, otp } = req.body as { email: string; otp: string };
  // Marks the code consumed, so a captured code cannot be replayed to mint another session.
  await verifyCode({ channel: 'email', target: email, purpose: 'login', code: otp });
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new AppError(404, 'No account found for that email');
  if (user.status !== 'active') throw new AppError(403, `Account is ${user.status}`);

  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
  const tokens = await issueTokenPair({ id: String(user._id), role: user.role, facilityId: user.facilityId ? String(user.facilityId) : null }, req.get('user-agent'));
  success(res, 200, { user: buildPublicUser(user), tokens });
}

export async function refresh(req: AuthRequest, res: Response) {
  const { refreshToken } = req.body as { refreshToken: string };
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'Invalid refresh token');
  }

  const stored = await RefreshToken.findOne({ tokenHash: sha256(refreshToken) });
  if (!stored || stored.revoked) throw new AppError(401, 'Refresh token has been revoked');
  if (stored.expiresAt.getTime() < Date.now()) throw new AppError(401, 'Refresh token has expired');

  const user = await User.findById(payload.sub);
  if (!user) throw new AppError(401, 'User no longer exists');
  if (user.status !== 'active') throw new AppError(403, `Account is ${user.status}`);

  // Rotate the refresh token
  stored.revoked = true;
  await stored.save();

  const tokens = await issueTokenPair({ id: String(user._id), role: user.role, facilityId: user.facilityId ? String(user.facilityId) : null }, req.get('user-agent'));
  success(res, 200, { user: buildPublicUser(user), tokens });
}

export async function logout(req: AuthRequest, res: Response) {
  const { refreshToken } = req.body as { refreshToken: string };
  await RefreshToken.updateOne(
    { tokenHash: sha256(refreshToken) },
    { $set: { revoked: true } }
  );
  success(res, 200, { message: 'Logged out' });
}

export async function forgotPassword(req: AuthRequest, res: Response) {
  const { email } = req.body as { email: string };
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new AppError(404, 'No account found for that email');

  const response = await dispatchEmailOtp(user, email, 'password reset code', 'reset_password');
  success(res, 200, response);
}

export async function resetPassword(req: AuthRequest, res: Response) {
  const { email, otp, newPassword } = req.body as {
    email: string;
    otp: string;
    newPassword: string;
  };
  // Verified before the password is touched, and single-use, so a code observed once cannot be
  // replayed to set a different password.
  await verifyCode({ channel: 'email', target: email, purpose: 'reset_password', code: otp });
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new AppError(404, 'No account found for that email');

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  await RefreshToken.updateMany({ userId: user._id }, { $set: { revoked: true } });
  success(res, 200, { message: 'Password reset successfully. Please log in.' });
}

export async function changePassword(req: AuthRequest, res: Response) {
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };
  const user = await User.findById(req.user?.id);
  if (!user) throw new AppError(404, 'User not found');
  if (user.status !== 'active') throw new AppError(403, `Account is ${user.status}`);

  const ok = await comparePassword(currentPassword, user.passwordHash);
  if (!ok) throw new AppError(401, 'Current password is incorrect');

  user.passwordHash = await hashPassword(newPassword);
  // Choosing a private password clears the one-time-password requirement, so the account
  // is no longer treated as freshly onboarded.
  user.mustChangePassword = false;
  await user.save();

  await RefreshToken.updateMany({ userId: user._id }, { $set: { revoked: true } });
  const tokens = await issueTokenPair(
    { id: String(user._id), role: user.role, facilityId: user.facilityId ? String(user.facilityId) : null },
    req.get('user-agent'),
  );
  success(res, 200, { message: 'Password changed successfully', tokens });
}
