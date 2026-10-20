import { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wrap an async Express handler so rejected promises reach the error middleware. */
export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}