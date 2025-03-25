// src/controllers/categoryControllers.ts
import { Request, Response } from "express";
import { AppError, asyncHandler } from "@/middlewares/asyncHandler.js";
import Category from "@/models/categoryModel.js";
import { formatCategoryResponse } from "@/utils/users.js";
import { UserRole, IUser } from "@/models/userModel.js";

// Create Category
export const createCategory = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.permissions.canManageCategories) {
      throw new AppError("Not authorized to manage categories", 403);
    }

    const { name, slug } = req.body;

    // Check for existing category
    if (await Category.isNameOrSlugExists(name, slug)) {
      throw new AppError("Category name or slug already exists", 400);
    }

    const category = await Category.create({
      ...req.body,
      createdBy: req.user._id,
    });

    const populatedCategory = await Category.findById(category.id);
    // .populate("createdBy", "_id username email")
    // .lean();

    res.status(201).json({
      status: "success",
      data: formatCategoryResponse(populatedCategory),
    });
  }
);

// Get All Categories (with pagination and filtering)
export const getAllCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const { limit = 50, skip = 0, search, isActive } = req.query;

    const filter: any = {};

    if (search) filter.name = { $regex: search, $options: "i" };
    if (isActive) filter.isActive = isActive === "true";

    const [categories, total] = await Promise.all([
      Category.findActive(filter).limit(Number(limit)).skip(Number(skip)),
      Category.countDocuments({ ...filter, isDeleted: false }),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        total,
        results: categories.map(formatCategoryResponse),
      },
    });
  }
);

// Get Single Category
export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const category = await Category.findById(id);

  if (!category) throw new AppError("Category not found", 404);

  res.status(200).json({
    status: "success",
    data: formatCategoryResponse(category),
  });
});

// Update Category
export const updateCategory = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.permissions.canManageCategories) {
      throw new AppError("Not authorized to manage categories", 403);
    }

    const category = await Category.updateById(
      req.params.id,
      req.body,
      req.user._id.toString()
    );

    if (!category) throw new AppError("Category not found", 404);

    // Admins can update any category, others only their own

    res.status(200).json({
      status: "success",
      data: formatCategoryResponse(category),
    });
  }
);

// Soft Delete Category
// Delete Category
export const deleteCategory = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.permissions.canManageCategories) {
      throw new AppError("Not authorized to manage categories", 403);
    }

    const category = await Category.deleteById(
      req.params.id,
      req.user._id.toString()
    );
    if (!category) throw new AppError("Category not found", 404);
    res.status(204).json({ status: "success", data: null });
  }
);

// Restore Category
export const restoreCategory = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.permissions.canManageCategories) {
      throw new AppError("Not authorized to manage categories", 403);
    }

    const category = await Category.findOne({
      _id: req.params.id,
      isDeleted: true, // Only look for deleted categories
    });
    if (!category) throw new AppError("Category not found or not deleted", 404);

    if (!category.isDeleted) throw new AppError("Category is not deleted", 400);

    category.isDeleted = false;
    category.deletedAt = undefined;
    category.deletedBy = undefined;
    await category.save();

    res.json({
      status: "success",
      data: formatCategoryResponse(await Category.findById(category.id)),
    });
  }
);
