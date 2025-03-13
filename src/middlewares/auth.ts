// src/middlewares/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser, UserPermissions, UserRole } from "@/models/userModel.js";
import { asyncHandler } from "./asyncHandler.js";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      JWT_SECRET: string;
      NODE_ENV: "development" | "production";
    }
  }
}

declare module "express" {
  interface Request {
    user?: IUser;
  }
}

export interface JwtPayload {
  userId: string;
}

export enum SameSiteOptions {
  Lax = "lax",
  Strict = "strict",
  None = "none",
}

export type AuthCookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: SameSiteOptions;
  maxAge: number;
};

export const authenticate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.jwt;

    if (!token) {
      res.status(401);
      throw new Error("Authorization failed: No authentication token");
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
      const user = await User.findById(decoded.userId)
        .select("-authentication")
        .lean<IUser>();

      if (!user || !user.isVerified) {
        res.status(401);
        throw new Error("Authorization failed: User not verified or not found");
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(401);
      throw new Error("Authorization failed: Invalid or expired token");
    }
  }
);

export const authorize = (
  requiredRoles: UserRole[] = [],
  requiredPermissions?: Partial<UserPermissions>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(403);
      throw new Error("Authorization required: No user in request");
    }

    // Role-based check
    if (requiredRoles.length > 0 && !requiredRoles.includes(req.user.role)) {
      res.status(403);
      throw new Error(
        `Insufficient privileges: Requires ${requiredRoles.join(", ")} role(s)`
      );
    }

    // Permission-based check
    if (requiredPermissions) {
      const missingPermissions = Object.entries(requiredPermissions)
        .filter(
          ([perm, required]) =>
            required && !req.user!.permissions[perm as keyof UserPermissions]
        )
        .map(([perm]) => perm);

      if (missingPermissions.length > 0) {
        res.status(403);
        throw new Error(
          `Missing permissions: ${missingPermissions.join(", ")}`
        );
      }
    }

    next();
  };
};

export const createAuthToken = (res: Response, userId: string): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable not defined");
  }

  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "14d",
    algorithm: "HS256",
  });

  const cookieOptions: AuthCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite:
      process.env.NODE_ENV === "production"
        ? SameSiteOptions.None
        : SameSiteOptions.Lax,
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
  };

  res.cookie("jwt", token, cookieOptions);
  return token;
};

// Specific role authorizers
export const authorizeAdmin = authorize([UserRole.ADMIN]);
export const authorizeModerator = authorize([UserRole.MODERATOR]);
export const authorizeSupport = authorize([UserRole.SUPPORT]);

// Example permission-based authorizer
export const authorizeProductManagement = authorize([], {
  canManageProducts: true,
});
