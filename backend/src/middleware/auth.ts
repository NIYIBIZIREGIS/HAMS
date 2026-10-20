import { NextFunction, Request, Response } from 'express';
import { Facility, User } from '../models';
import { verifyAccessToken } from '../utils/tokens';
import {
  canonicalRole,
  describeFacilityBlock,
  isTenantScoped,
} from '../utils/tenancy';
import { AppError } from '../utils/AppError';
import { config } from '../config/env';

export interface AuthUser {
  id: string;
  /** Always canonical, so `hospital_admin` accounts surface as `facility_admin`. */
  role: string;
  facilityId?: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/**
 * While an account still holds a platform-issued temporary password it may do exactly one
 * thing: replace that password. Everything else is refused so the handover credential
 * cannot be used to operate a hospital account.
 */
const PASSWORD_ROTATION_ALLOWLIST = ['/api/auth/change-password'];

function isPasswordRotationRequest(req: Request): boolean {
  const path = req.originalUrl.split('?')[0];
  return PASSWORD_ROTATION_ALLOWLIST.includes(path);
}

/**
 * Refuses the request when the caller's hospital has been suspended, has an expired
 * subscription, or has been deleted. Re-checked per request rather than only at sign-in,
 * because an access token outlives the decision that was made when it was issued.
 *
 * Platform accounts and patients are not tenant staff, so a hospital's billing state does
 * not lock a patient out of their own records.
 */
async function assertFacilityUsable(authUser: AuthUser): Promise<void> {
  if (!isTenantScoped(authUser) || !authUser.facilityId) return;

  const facility = await Facility.findById(authUser.facilityId)
    .select('isActive subscriptionStatus deletedAt')
    .lean<Parameters<typeof describeFacilityBlock>[0]>();

  const blocked = describeFacilityBlock(facility);
  if (blocked) throw new AppError(403, blocked);
}

export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    // Test-only bypass. Gated on an explicit opt-in flag as well as NODE_ENV=test, because a
    // production process started with the wrong NODE_ENV would otherwise accept an
    // `x-test-user` header from the internet and hand that account an authenticated session
    // with no password and no token. The flag defaults off, so tests must ask for it.
    if (config.allowTestAuth && req.headers['x-test-user']) {
      const testUser = await User.findOne({
        email: String(req.headers['x-test-user']).toLowerCase(),
      }).select('_id role facilityId status mustChangePassword');
      if (!testUser) throw new AppError(401, 'Test user not found');
      // Same rules as the real path, so a suspended account or a temporary password is
      // exercised by the tests rather than being accidentally privileged in test mode only.
      if (testUser.status !== 'active') {
        throw new AppError(403, `Account is ${testUser.status}`);
      }
      const testAuthUser: AuthUser = {
        id: String(testUser._id),
        role: canonicalRole(testUser.role),
        facilityId: testUser.facilityId ? String(testUser.facilityId) : null,
      };
      await assertFacilityUsable(testAuthUser);
      if (testUser.mustChangePassword && !isPasswordRotationRequest(req)) {
        throw new AppError(403, 'Password change required', { code: 'MUST_CHANGE_PASSWORD' });
      }
      req.user = testAuthUser;
      return next();
    }

    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError(401, 'Authentication token missing');
    }
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select(
      '_id role facilityId status mustChangePassword'
    );
    if (!user) throw new AppError(401, 'User no longer exists');
    if (user.status !== 'active') {
      throw new AppError(403, `Account is ${user.status}`);
    }
    const authUser: AuthUser = {
      id: String(user._id),
      role: canonicalRole(user.role),
      facilityId: user.facilityId ? String(user.facilityId) : null,
    };
    await assertFacilityUsable(authUser);
    if (user.mustChangePassword && !isPasswordRotationRequest(req)) {
      throw new AppError(403, 'Password change required', { code: 'MUST_CHANGE_PASSWORD' });
    }
    req.user = authUser;
    next();
  } catch (err) {
    next(err);
  }
}
