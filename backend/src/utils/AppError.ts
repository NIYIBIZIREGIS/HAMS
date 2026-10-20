export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, message, details);

export const unauthorized = (message = 'Unauthorized') => new AppError(401, message);

export const forbidden = (message = 'Forbidden') => new AppError(403, message);

export const notFound = (message = 'Not found') => new AppError(404, message);

export const conflict = (message: string) => new AppError(409, message);
