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

export const categoryCreateSchema = z.object({
  name: z
    .string()
    .min(2, "Category name is required")
    .max(50, "Category name cannot exceed 50 characters"),
  description: z
    .string()
    .max(200, "Description cannot exceed 200 characters")
    .optional(),
  parent: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid parent ID")
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
});

export const categoryUpdateSchema = z
  .object({
    name: z
      .string()
      .min(2, "Category name is required")
      .max(50, "Category name cannot exceed 50 characters")
      .optional(),
    description: z
      .string()
      .max(200, "Description cannot exceed 200 characters")
      .optional()
      .nullable(),
    parent: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional()
      .nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
    path: [],
  });

export const productCreateSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name cannot exceed 200 characters"),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Invalid slug format")
    .optional(),
  sku: z
    .string()
    .regex(/^[A-Z0-9-]{8,}$/, "Invalid SKU format")
    .optional(),
  description: z
    .string()
    .min(50, "Description must be at least 50 characters")
    .max(2000, "Description cannot exceed 2000 characters"),
  price: z.number().min(0.01, "Price must be at least 0.01").positive(),
  originalPrice: z
    .number()
    .min(0.01, "Original price must be greater than 0")
    .optional(),
  images: z
    .array(z.string().url("Invalid image URL"))
    .min(1, "At least one image is required")
    .max(10, "Maximum 10 images allowed"),
  category: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid category ID"),
  brand: z.string().min(1, "Brand is required"),
  manufacturer: z.string().min(1, "Manufacturer is required"),
  weight: z.number().min(1, "Weight must be at least 1 gram").positive(),
  dimensions: z.object({
    length: z.number().min(1, "Length must be at least 1 cm").positive(),
    width: z.number().min(1, "Width must be at least 1 cm").positive(),
    height: z.number().min(1, "Height must be at least 1 cm").positive(),
  }),
  stock: z
    .number()
    .int("Stock must be an integer")
    .min(0, "Stock cannot be negative"),
  tags: z.array(z.string().min(1)).min(1, "At least one tag required").max(20),
  shippingInfo: z.object({
    weight: z
      .number()
      .min(1, "Shipping weight must be at least 1 gram")
      .positive(),
    dimensions: z
      .string()
      .min(1, "Shipping dimensions are required")
      .regex(/^\d+x\d+x\d+$/, "Invalid dimensions format"),
    requiresShipping: z.boolean().default(true),
  }),
  availability: z.enum(["in-stock", "out-of-stock", "pre-order"]).optional(),
  isActive: z.boolean().optional(),
});

export const productUpdateSchema = productCreateSchema
  .omit({ slug: true, sku: true, createdBy: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
    path: [],
  });

export const productListingSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
});

export const inventoryCheckSchema = z
  .array(
    z.object({
      productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID"),
      qty: z
        .number()
        .int()
        .min(1, "Minimum quantity is 1")
        .positive("Quantity must be a positive integer"),
    })
  )
  .min(1, "At least one item required");

export const reserveStockSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID"),
  quantity: z.number().int().min(1, "Minimum quantity is 1"),
});

export const productSearchSchema = z
  .object({
    //q: z.string().min(1, "Search query is required"),
    q: z.coerce.string().min(1, "Search query is required"), // ✅ Handle type conversion
    minPrice: z.coerce.number().optional(), // ✅ Handle string→number conversion
    maxPrice: z.coerce.number().optional(),
    brands: z
      .string()
      .regex(/^[a-zA-Z0-9_,-]+$/, "Invalid brand format")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.minPrice && data.maxPrice) {
        return data.maxPrice > data.minPrice;
      }
      return true;
    },
    {
      message: "Max price must be greater than min price",
      path: ["maxPrice"],
    }
  );

export const reviewCreateSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().min(5).max(100),
  comment: z.string().min(10).max(1000),
  verifiedPurchase: z.boolean().optional(),
  // Add these to preserve reference IDs
  product: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID")
    .optional(),
  user: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID")
    .optional(),
});

export const reviewUpdateSchema = reviewCreateSchema
  .partial()
  .refine((data) => {
    return Object.keys(data).length > 0;
  }, "At least one field must be provided");

export const priceChangeSchema = z.object({
  newPrice: z.number().min(0.01),
  reason: z.string().min(10).max(500).optional(),
});
