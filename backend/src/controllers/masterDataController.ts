import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Doctor, InsuranceProvider, LaboratoryTest } from '../models';
import { success } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';

const models: Record<string, any> = {
  specializations: Doctor,
  'appointment-types': Doctor,
  'lab-test-types': LaboratoryTest,
  'insurance-providers': InsuranceProvider,
};

function getModel(type: string) {
  const model = models[type];
  if (!model) throw new AppError(404, 'Invalid master data type');
  return model;
}

export async function list(req: AuthRequest, res: Response) {
  const type = req.params.type;

  if (type === 'specializations') {
    const docs = await Doctor.find().distinct('specialization').lean();
    const items = (docs as any[]).flat().filter(Boolean).map((name: string) => ({ _id: name, name, isActive: true }));
    return success(res, 200, items);
  }
  if (type === 'appointment-types') {
    const items = [
      { _id: 'consultation', name: 'Consultation', isActive: true },
      { _id: 'follow-up', name: 'Follow-up', isActive: true },
      { _id: 'emergency', name: 'Emergency', isActive: true },
    ];
    return success(res, 200, items);
  }

  const model = getModel(type);
  const items = await model.find().sort({ name: 1 }).lean();
  success(res, 200, items);
}

export async function create(req: AuthRequest, res: Response) {
  const type = req.params.type;
  if (type === 'specializations' || type === 'appointment-types') {
    throw new AppError(400, 'Not editable');
  }
  const model = getModel(type);
  const item = await model.create(req.body);
  success(res, 201, item);
}

export async function update(req: AuthRequest, res: Response) {
  const type = req.params.type;
  if (type === 'specializations' || type === 'appointment-types') {
    throw new AppError(400, 'Not editable');
  }
  const model = getModel(type);
  const item = await model.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) throw new AppError(404, 'Item not found');
  success(res, 200, item);
}

export async function remove(req: AuthRequest, res: Response) {
  const type = req.params.type;
  if (type === 'specializations' || type === 'appointment-types') {
    throw new AppError(400, 'Not editable');
  }
  const model = getModel(type);
  const item = await model.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!item) throw new AppError(404, 'Item not found');
  success(res, 200, item);
}
