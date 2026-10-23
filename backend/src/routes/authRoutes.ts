import { Router } from 'express';
import * as authController from '../controllers/authController';
import * as verificationController from '../controllers/verificationController';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { validate } from '../middleware/validate';
import { rateLimit } from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler';
import {
  registerSchema,
  loginSchema,
  nationalIdLoginSchema,
  otpRequestSchema,
  otpVerifySchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSendSchema,
  verifyPhoneSendSchema,
  verifyConfirmSchema,
  profileImageSchema,
  updateProfileSchema,
} from '../validators/schemas';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts, try again later' },
});

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  // The only unauthenticated write worth an audit entry: it is how an account gets created in
  // a hospital. Password and OTP fields are stripped from the snapshot by the audit middleware.
  auditLog({
    entity: 'User',
    entityId: (_req, body) => (body as { _id?: string } | undefined)?._id,
    before: async () => null,
    targetFacility: (_req, body) => (body as { facilityId?: string } | undefined)?.facilityId,
    metadata: (req) => ({ role: (req.body as { role?: string }).role }),
    summary: 'Account registered',
  }),
  asyncHandler(authController.register)
);
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post('/login/national-id', authLimiter, validate(nationalIdLoginSchema), asyncHandler(authController.loginWithNationalId));
router.post('/otp/request', authLimiter, validate(otpRequestSchema), asyncHandler(authController.requestOtp));
router.post('/otp/verify', authLimiter, validate(otpVerifySchema), asyncHandler(authController.verifyOtpLogin));
router.post('/refresh', authLimiter, validate(refreshSchema), asyncHandler(authController.refresh));
router.post('/logout', validate(logoutSchema), asyncHandler(authController.logout));
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), asyncHandler(authController.resetPassword));
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  // Completing the forced rotation from onboarding lands here, so this single entry is also
  // the record that a temporary password was retired.
  auditLog({
    entity: 'User',
    entityId: (req: AuthRequest) => req.user?.id,
    before: async () => null,
    summary: 'Password changed',
  }),
  asyncHandler(authController.changePassword)
);
router.put('/profile-image', authenticate, validate(profileImageSchema), asyncHandler(authController.updateProfileImage));
router.put('/profile', authenticate, validate(updateProfileSchema), asyncHandler(authController.updateProfile));

// ── Contact verification (real email + SMS codes) ─────────────────────────────
router.post('/verify/email/send', authLimiter, authenticate, validate(verifyEmailSendSchema), asyncHandler(verificationController.sendEmailCode));
router.post('/verify/email/confirm', authLimiter, authenticate, validate(verifyConfirmSchema), asyncHandler(verificationController.confirmEmailCode));
router.post('/verify/phone/send', authLimiter, authenticate, validate(verifyPhoneSendSchema), asyncHandler(verificationController.sendPhoneCode));
router.post('/verify/phone/confirm', authLimiter, authenticate, validate(verifyConfirmSchema), asyncHandler(verificationController.confirmPhoneCode));

export default router;
