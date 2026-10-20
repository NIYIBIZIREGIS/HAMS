import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
  }

  // Mongoose validation error
  const anyErr = err as {
    name?: string;
    message?: string;
    code?: number;
    keyValue?: Record<string, unknown>;
    errors?: Record<string, { message: string }>;
  };

  if (anyErr?.name === 'ValidationError' && anyErr.errors) {
    const details = Object.values(anyErr.errors).map((e) => e.message);
    return res.status(400).json({ success: false, error: 'Validation error', details });
  }

  if (anyErr?.code === 11000) {
    const field = anyErr.keyValue ? Object.keys(anyErr.keyValue)[0] : 'field';
    return res.status(409).json({
      success: false,
      error: `Duplicate value for field: ${field}`,
    });
  }

  if (anyErr?.name === 'CastError') {
    return res.status(400).json({ success: false, error: 'Invalid ID format' });
  }

  if (anyErr?.name === 'JsonWebTokenError' || anyErr?.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

  console.error('Unhandled error:', anyErr);
  return res.status(500).json({ success: false, error: 'Internal server error' });
}
