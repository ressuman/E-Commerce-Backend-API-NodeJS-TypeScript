// src/middlewares/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser, UserPermissions, UserRole } from "@/models/userModel.js";
import { AppError, asyncHandler } from "./asyncHandler.js";

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
  iat: number;
  exp: number;
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

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export const authenticate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    //const token = req.cookies?.jwt;
    const accessToken = req.cookies?.accessToken;

    // if (token) {
    //   try {
    //     const decoded = jwt.verify(
    //       token,
    //       process.env.JWT_SECRET!
    //     ) as JwtPayload;

    //     const user = await User.findById(decoded.userId).select(
    //       "+authentication.password +authentication.salt"
    //     );

    //     if (user && user.isVerified) {
    //       req.user = user; // Attach lean user object
    //     }
    //   } catch (error) {
    //     // Silent failure - just don't attach user
    //     console.error("Authentication error:", error);
    //     res.clearCookie("jwt");
    //   }
    // }
    if (accessToken) {
      try {
        const decoded = jwt.verify(
          accessToken,
          process.env.JWT_SECRET!
        ) as JwtPayload;

        const user = await User.findById(decoded.userId).select(
          "+authentication.password +authentication.salt"
        );

        if (user && user.isVerified) {
          req.user = user; // Attach lean user object
        }
      } catch (error) {
        // Handle token expiration specifically
        if (error.name === "TokenExpiredError") {
          return next(new AppError("Access token expired", 401));
        }

        console.error("Authentication error:", error);

        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
      }
    }
    next();
  }
);

export const authorize = (
  requiredRoles: UserRole[] = [],
  requiredPermissions?: Partial<UserPermissions>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError("Authorization required: No user in request", 403);
    }

    // Role-based check
    if (requiredRoles.length > 0 && !requiredRoles.includes(req.user.role)) {
      throw new AppError(
        `Insufficient privileges: Requires ${requiredRoles.join(", ")} role(s)`,
        403
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
        throw new AppError(
          `Missing permissions: ${missingPermissions.join(", ")}`,
          403
        );
      }
    }

    next();
  };
};

export const createAuthTokens = async (
  res: Response,
  userId: string
): Promise<TokenPair> => {
  if (!process.env.JWT_SECRET) {
    throw new AppError("JWT_SECRET environment variable not defined", 500);
  }

  // const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
  //   expiresIn: "14d",
  //   algorithm: "HS256",
  // });

  // Access Token (15 minutes)
  // Generate access token (short-lived)
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: "15m", // 15 minutes
    algorithm: "HS256",
  });

  // Refresh Token (7 days)
  // Generate refresh token (long-lived)
  const refreshToken = jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: "7d", // 7 days
    algorithm: "HS256",
  });

  // const cookieOptions: AuthCookieOptions = {
  //   httpOnly: true,
  //   secure: process.env.NODE_ENV === "production",
  //   sameSite:
  //     process.env.NODE_ENV === "production"
  //       ? SameSiteOptions.None
  //       : SameSiteOptions.Lax,
  //   maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
  // };

  // Set cookies
  const accessCookieOptions: AuthCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite:
      process.env.NODE_ENV === "production"
        ? SameSiteOptions.None
        : SameSiteOptions.Lax,
    maxAge: 15 * 60 * 1000, // 15 minutes
  };

  const refreshCookieOptions: AuthCookieOptions = {
    ...accessCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  //res.cookie("jwt", token, cookieOptions);
  res.cookie("accessToken", accessToken, accessCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
  //return token;
  // Store refresh token in DB
  await User.findByIdAndUpdate(userId, {
    "authentication.refreshToken": refreshToken,
    "authentication.refreshTokenExpires": new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ), //  // 7 days
  });

  return { accessToken, refreshToken };
};

export const requireAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError("Not authenticated", 401);
    }

    // Refresh user data from database
    const freshUser = await User.findById(req.user._id).select(
      "+authentication.sessionToken"
    );

    if (!freshUser?.isActive) {
      res.clearCookie("jwt");
      throw new AppError("Account deactivated", 403);
    }

    req.user = freshUser;

    next();
  }
);

// Specific role authorizers
export const authorizeAdmin = authorize([UserRole.ADMIN]);
export const authorizeModerator = authorize([UserRole.MODERATOR]);
export const authorizeSupport = authorize([UserRole.SUPPORT]);

// Example permission-based authorizer
export const authorizeProductManagement = authorize([], {
  canManageProducts: true,
});

export const authorizeInventoryManagement = authorize([], {
  canManageProducts: true,
  canManageOrders: true,
});

export const authorizeReviewModification = authorize(
  [UserRole.MODERATOR, UserRole.ADMIN],
  {
    canManageProducts: true,
  }
);

export const authorizeReviewInteraction = authorize(
  [UserRole.CUSTOMER, UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPPORT],
  {
    canManageProducts: false, // Customers can interact without full product permissions
  }
);

export const authorizeOrderManagement = authorize(
  [UserRole.ADMIN, UserRole.SUPPORT, UserRole.MODERATOR],
  {
    canManageOrders: true,
    canProcessPayments: true,
    canUpdateOrderStatus: true,
  }
);

export const authorizePaymentProcessing = authorize(
  [UserRole.ADMIN, UserRole.MODERATOR],
  {
    canProcessPayments: true,
  }
);

export const authorizeFulfillment = authorize(
  [UserRole.ADMIN, UserRole.SUPPORT],
  {
    canManageFulfillment: true,
  }
);
