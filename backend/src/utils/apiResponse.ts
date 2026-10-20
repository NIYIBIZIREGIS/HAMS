import { Response } from 'express';

export function success(res: Response, statusCode = 200, data?: unknown, meta?: unknown) {
  const body: Record<string, unknown> = { success: true };
  if (data !== undefined) body.data = data;
  if (meta !== undefined) body.meta = meta;
  res.status(statusCode).json(body);
}

export function paginate(page: number, limit: number, total: number) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  return {
    page: safePage,
    limit: safeLimit,
    total,
    pages: Math.ceil(total / safeLimit),
  };
}
