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

// export const asyncHandler = (
//   fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
// ) => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     Promise.resolve(fn(req, res, next)).catch((err) => {
//       // Ensure proper JSON error response
//       res.status(err.statusCode || 500).json({
//         status: "error",
//         message: err.message || "Internal Server Error",
//       });
//     });
//   };
// };

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
