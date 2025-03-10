import type { Request, Response, NextFunction } from "express";

type Environment = "production" | "development" | "test";
type ErrorResponse = {
  message: string;
  stack?: string;
};

export interface HttpError extends Error {
  statusCode?: number;
  status?: number;
}

export const notFound = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error: HttpError = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  res.status(404);
  next(error);
};

export const errorHandler = (
  err: HttpError,
  req: Request,
  res: Response<ErrorResponse>,
  next: NextFunction
): void => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const environment = process.env.NODE_ENV as Environment;

  res.status(statusCode);
  res.json({
    message: err.message,
    stack: environment === "production" ? undefined : err.stack,
  });
};
