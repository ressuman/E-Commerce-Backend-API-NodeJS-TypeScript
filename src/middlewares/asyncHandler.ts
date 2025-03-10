import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncFunction<T = void> = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<T>;

export const asyncHandler = <T = void>(
  fn: AsyncFunction<T>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
