import { NextFunction, Response } from 'express';
import { ZodSchema } from 'zod';
import { badRequest } from '../utils/AppError';
import { AuthRequest } from './auth';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const target = req[source];
    const result = schema.safeParse(target);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(badRequest('Validation failed', details));
    }
    (req as unknown as Record<string, unknown>)[source] = result.data;
    return next();
  };
}

export function validateObjectId(idName: string) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const value = req.params[idName];
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!value || !objectIdPattern.test(value)) {
      return next(badRequest(`Invalid ${idName}`));
    }
    return next();
  };
}
