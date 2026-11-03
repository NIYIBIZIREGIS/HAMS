import { Router } from 'express';
import * as masterDataController from '../controllers/masterDataController';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('super_admin'));

router.get('/:type', asyncHandler(masterDataController.list));
router.post('/:type', asyncHandler(masterDataController.create));
router.put('/:type/:id', asyncHandler(masterDataController.update));
router.delete('/:type/:id', asyncHandler(masterDataController.remove));

export default router;
