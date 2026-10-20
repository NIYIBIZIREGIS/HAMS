import { Response } from 'express';
import { InsuranceProvider } from '../models';
import { success } from '../utils/apiResponse';
import { AuthRequest } from '../middleware/auth';
import { isSuperAdmin } from '../utils/tenancy';

/**
 * GET /api/insurance-providers
 * List insurance providers (for verifier/receptionist dropdowns and admin screens).
 *
 * Insurance providers are a platform-wide catalogue rather than per-hospital records, so
 * this listing is intentionally not tenant-scoped.
 */
export async function listProviders(req: AuthRequest, res: Response) {
  const includeInactive = req.query.includeInactive === 'true' && isSuperAdmin(req.user);
  const filter = includeInactive ? {} : { isActive: true };
  const providers = await InsuranceProvider.find(filter)
    .sort({ name: 1 })
    .lean();

  success(res, 200, providers);
}

/**
 * POST /api/insurance-providers
 * Register a new insurance provider / government scheme.
 */
export async function createProvider(req: AuthRequest, res: Response) {
  const provider = await InsuranceProvider.create(req.body);
  success(res, 201, provider.toObject());
}