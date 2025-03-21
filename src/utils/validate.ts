// src/utils/validate.ts
import { UserRole } from "@/models/userModel.js";
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ZodError, ZodSchema } from "zod";

export const validate =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          status: "error",
          errors: err.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
      }
      next(err);
    }
  };

export const signupSchema = z
  .object({
    firstName: z.string().min(1, "First name is required").max(50),
    lastName: z.string().min(1, "Last name is required").max(50),
    username: z
      .string()
      .min(3)
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Only letters, numbers and underscores allowed"
      ),
    email: z.string().email(),
    password: z.string().min(8),
    passwordConfirm: z.string().min(8),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
  });

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const resendOtpSchema = z.object({
  email: z.string().email(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z
  .object({
    email: z.string().email(),
    newPassword: z.string().min(8),
    newPasswordConfirm: z.string().min(8),
    resetOtp: z.string().length(6, "OTP must be 6 digits"),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: "Passwords do not match",
    path: [" newPasswordConfirm"],
  });

export const createUserSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    username: z
      .string()
      .min(3)
      .regex(/^[a-zA-Z0-9_]+$/),
    email: z.string().email(),
    role: z.nativeEnum(UserRole).default(UserRole.CUSTOMER),
    password: z.string().min(8),
    passwordConfirm: z.string().min(8),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
  });

export const updateUserSchema = z
  .object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores allowed")
      .optional(),
    email: z.string().email("Invalid email format").optional(),
    role: z.nativeEnum(UserRole).optional(),
    isActive: z.boolean().optional(),
    isVerified: z.boolean().optional(),
  })
  .strict();

export const roleUpdateSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export const adminPasswordUpdateSchema = z.object({
  newPassword: z.string().min(8),
  forceLogout: z.boolean().default(true),
});

export const userPasswordUpdateSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8),
    newPasswordConfirm: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: "Passwords do not match",
    path: ["newPasswordConfirm"],
  });

export const permissionsSchema = z.object({
  permissions: z.object({
    canManageProducts: z.boolean(),
    canManageOrders: z.boolean(),
    canManageUsers: z.boolean(),
    canManageCategories: z.boolean(),
    canAccessAnalytics: z.boolean(),
  }),
});

export const deactivationSchema = z.object({
  reason: z.string().min(10).max(500),
});
