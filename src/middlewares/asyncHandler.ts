// src/middlewares/asyncHandler.ts
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

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      status: "error",
      message: this.message,
    };
  }
}
