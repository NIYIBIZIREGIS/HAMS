import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models';
import { success } from '../utils/apiResponse';
import { AppError, badRequest } from '../utils/AppError';
import { issueCode, verifyCode, maskTarget } from '../services/verification';
import { buildPublicUser } from './authController';

export async function sendEmailCode(req: AuthRequest, res: Response) {
  const target = (req.body as { email?: string }).email?.trim().toLowerCase();
  await dispatchCode({ req, res, channel: 'email', target });
}

export async function sendPhoneCode(req: AuthRequest, res: Response) {
  const target = (req.body as { phone?: string }).phone?.trim();
  await dispatchCode({ req, res, channel: 'sms', target });
}

async function dispatchCode({
  req,
  res,
  channel,
  target,
}: {
  req: AuthRequest;
  res: Response;
  channel: 'email' | 'sms';
  target?: string;
}) {
  const user = await User.findById(req.user!.id);
  if (!user) throw new AppError(404, 'User not found');

  const resolved =
    target ??
    (channel === 'email' ? user.email : user.phone) ??
    '';
  if (!resolved) throw new AppError(400, 'No contact on file to verify');

  const result = await issueCode({
    userId: String(user._id),
    channel,
    target: resolved,
    purpose: 'account',
    user: { fullName: user.fullName, email: user.email },
  });

  const response: Record<string, unknown> = {
    message: `Verification code sent to ${maskTarget(resolved)}`,
    delivered: result.delivered,
    via: result.via,
  };
  if (result.devCode) {
    response.otp = result.devCode;
    response.notice = 'Transport not configured — dev-only code returned in response.';
  }
  success(res, 200, response);
}

export async function confirmEmailCode(req: AuthRequest, res: Response) {
  const code = (req.body as { code: string }).code;
  const target = (req.body as { email?: string }).email?.trim().toLowerCase();
  await confirmCode({ req, res, channel: 'email', code, target });
}

export async function confirmPhoneCode(req: AuthRequest, res: Response) {
  const code = (req.body as { code: string }).code;
  const target = (req.body as { phone?: string }).phone?.trim();
  await confirmCode({ req, res, channel: 'sms', code, target });
}

async function confirmCode({
  req,
  res,
  channel,
  code,
  target,
}: {
  req: AuthRequest;
  res: Response;
  channel: 'email' | 'sms';
  code: string;
  target?: string;
}) {
  const user = await User.findById(req.user!.id);
  if (!user) throw new AppError(404, 'User not found');

  const resolved =
    target ??
    (channel === 'email' ? user.email : user.phone) ??
    '';
  if (!resolved) throw badRequest('No contact on file to verify');

  const ownerId = await verifyCode({ channel, target: resolved, purpose: 'account', code });
  if (ownerId !== String(user._id)) {
    throw new AppError(403, 'This code belongs to a different account.');
  }

  const now = new Date();
  if (channel === 'email') {
    user.emailVerifiedAt = now;
  } else {
    user.phoneVerifiedAt = now;
  }
  await user.save();

  success(res, 200, {
    message: channel === 'email' ? 'Email verified' : 'Phone verified',
    [channel === 'email' ? 'emailVerifiedAt' : 'phoneVerifiedAt']: now.toISOString(),
    user: buildPublicUser(user),
  });
}