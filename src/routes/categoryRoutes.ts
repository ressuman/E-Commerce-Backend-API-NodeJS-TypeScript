// src/routes/categoryRoutes.ts
import express from "express";

import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategory,
  restoreCategory,
  updateCategory,
} from "@/controllers/categoryControllers.js";

import { authenticate, authorize, requireAuth } from "@/middlewares/auth.js";

import {
  categoryCreateSchema,
  categoryUpdateSchema,
  validate,
} from "@/utils/validate.js";

import { UserRole } from "@/models/userModel.js";

const router = express.Router();

// Public routes
router.get("/all-categories", getAllCategories);

router.get("/get-category/:id", getCategory);

// Protected routes
router.use(authenticate, requireAuth);

// Category management routes
router.post(
  "/create-category",
  validate(categoryCreateSchema),
  authorize([UserRole.ADMIN, UserRole.MODERATOR]),
  createCategory
);

router.patch(
  "/update-category/:id",
  validate(categoryUpdateSchema),
  authorize([UserRole.ADMIN, UserRole.MODERATOR]),
  updateCategory
);

router.delete(
  "/delete-category/:id",
  authorize([UserRole.ADMIN, UserRole.MODERATOR]),
  deleteCategory
);

router.post(
  "/update/:id/restore",
  authorize([UserRole.ADMIN]),
  restoreCategory
);

export default router;
