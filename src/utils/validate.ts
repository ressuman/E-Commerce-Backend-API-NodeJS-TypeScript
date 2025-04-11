// src/utils/validate.ts
import {
  Currency,
  OrderStatus,
  PaymentMethod,
  ShippingMethod,
} from "@/models/orderModel.js";
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
  price: z.coerce.number().min(0.01, "Price must be at least 0.01").positive(),
  originalPrice: z.coerce
    .number()
    .min(0.01, "Original price must be greater than 0")
    .optional(),
  category: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid category ID"),
  brand: z.string().min(1, "Brand is required"),
  manufacturer: z.string().min(1, "Manufacturer is required"),
  weight: z.coerce.number().min(1, "Weight must be at least 1 gram").positive(),
  dimensions: z.object({
    length: z.coerce.number().min(1, "Length must be at least 1 cm").positive(),
    width: z.coerce.number().min(1, "Width must be at least 1 cm").positive(),
    height: z.coerce.number().min(1, "Height must be at least 1 cm").positive(),
  }),
  stock: z.coerce
    .number()
    .int("Stock must be an integer")
    .min(0, "Stock cannot be negative"),
  tags: z
    .string()
    .transform((val) => {
      try {
        return JSON.parse(val);
      } catch {
        return val.split(",");
      }
    })
    .pipe(z.array(z.string()).min(1, "At least one tag required").max(20)),
  shippingInfo: z.object({
    weight: z.coerce
      .number()
      .min(1, "Shipping weight must be at least 1 gram")
      .positive(),
    dimensions: z
      .string()
      .min(1, "Shipping dimensions are required")
      .regex(/^\d+x\d+x\d+$/, "Invalid dimensions format"),
    requiresShipping: z.coerce
      .boolean()
      .or(z.enum(["1", "0"]).transform((val) => val === "1"))
      .default(true),
  }),
  availability: z.enum(["in-stock", "out-of-stock", "pre-order"]).optional(),
  isActive: z.boolean().optional(),
  reviews: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/))
    .max(500)
    .optional(),
});

export const productUpdateSchema = productCreateSchema
  .omit({ slug: true, sku: true, createdBy: true })
  .extend({
    replaceImages: z.coerce.boolean().optional(),
  })
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

export const orderCreateSchema = z.object({
  orderItems: z
    .array(
      z.object({
        product: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID"),
        name: z.string().min(2),
        quantity: z.number().int().min(1, "Quantity must be at least 1"),
        price: z.number().min(0.01),
        image: z.string().url(),
        sku: z.string().regex(/^[A-Z0-9-]{8,}$/),
      })
    )
    .min(1, "At least one order item is required"),
  shippingAddress: z.object({
    fullName: z.string().min(2, "Full name is required"),
    street: z.string().min(2, "Street is required"),
    address: z.string().min(2, "Address is required"),
    city: z.string().min(2, "City is required"),
    state: z.string().optional(),
    postalCode: z.string().min(3, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
    phoneNumber: z.string().min(6, "Phone number is required"),
    coordinates: z
      .object({
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
      })
      .optional(),
  }),
  paymentMethod: z.nativeEnum(PaymentMethod),
  shippingMethod: z.nativeEnum(ShippingMethod),
  currency: z.nativeEnum(Currency).optional(),
  taxRate: z.number().min(0, "Tax rate cannot be negative").optional(),
  taxInfo: z
    .object({
      taxRate: z.number().min(0).max(1).optional(),
      taxId: z.string().optional(),
    })
    .optional(),
  discountInfo: z
    .object({
      code: z.string().optional(),
      amount: z.number().min(0),
      type: z.enum(["percentage", "fixed"]),
    })
    .optional(),
});

export const orderUpdateSchema = orderCreateSchema.partial();

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  cancellationReason: z.string().optional(),
});

export const processPaymentSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  status: z.string().min(1, "Payment status is required"),
  email: z.string().email("Invalid email format"),
  amountReceived: z.number().min(0, "Amount received cannot be negative"),
});

export const fulfillOrderSchema = z.object({
  trackingNumber: z.string().min(1, "Tracking number is required"),
  shippingProvider: z.string().min(1, "Shipping provider is required"),
});

export const dateRangeSchema = z.object({
  startDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Invalid start date"),
  endDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Invalid end date"),
});

export const salesByPeriodSchema = z.object({
  period: z.enum(["day", "week", "month", "year"], {
    errorMap: () => ({ message: "Invalid period" }),
  }),
});
