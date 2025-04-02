// src/controllers/uploadControllers.ts
import cloudinary from "@/config/cloudinary.js";
import { AppError, asyncHandler } from "@/middlewares/asyncHandler.js";
import { Request, Response, NextFunction } from "express";
import multer from "multer";
//import { CloudinaryStorage } from "multer-storage-cloudinary";
//import mongoose from "mongoose";

declare module "express" {
  interface Request {
    operationType?: "create-product";
    files?: Express.Multer.File[];
    cloudinaryResources?: Array<{ secure_url: string; public_id: string }>;
  }
}

const MAX_SIZE_MB = 20;
const MAX_FILES = 6;

// Memory storage for temporary file handling
const memoryStorage = multer.memoryStorage();

const fileFilter = (
  _: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(file.mimetype)) {
    (req as any).fileValidationError = `Invalid file type: ${
      file.mimetype
    }. Allowed types: ${validTypes.join(", ")}`;
    return cb(null, false);
  }
  cb(null, true);
};

const upload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_MB * 1024 * 1024,
    files: MAX_FILES,
  },
});

export const uploadProductImages = upload.array("images", MAX_FILES);

export const verifyCloudinaryFolder = asyncHandler(async (req, res, next) => {
  try {
    await cloudinary.api.create_folder("webuy-ecommerce/products");
  } catch (error: any) {
    if (!error.message.includes("already exists")) {
      console.error("Cloudinary folder error:", error);
      throw new AppError("Cloudinary configuration failed", 500);
    }
  }
  next();
});

export const processImageUpload = asyncHandler(async (req, res, next) => {
  // Handle product creation image requirements
  if (req.operationType === "create-product") {
    if (!req.files?.length) {
      return next(new AppError("At least one product image is required", 400));
    }
  }

  // Handle validation errors from multer
  if ((req as any).fileValidationError) {
    return next(new AppError((req as any).fileValidationError, 400));
  }

  // Skip processing if no files
  if (!req.files?.length) return next();

  // Proceed with Cloudinary upload
  try {
    req.cloudinaryResults = await uploadToCloudinary(req.files);
    next();
  } catch (error) {
    await rollbackCloudinaryUploads(req.cloudinaryResults || []);
    next(error);
  }
});

export const handleImageCleanup = asyncHandler(async (req, res, next) => {
  try {
    next();
  } finally {
    // Cleanup on any subsequent errors
    if (req.cloudinaryResults?.length && res.headersSent) {
      await rollbackCloudinaryUploads(req.cloudinaryResults);
    }
  }
});

export const uploadToCloudinary = async (files: Express.Multer.File[]) => {
  const uploadPromises = files.map((file) => {
    return cloudinary.uploader.upload(
      `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
      {
        folder: "webuy-ecommerce/products",
        public_id: `shop_imgs/${Date.now()}_${file.originalname
          .replace(/\.[^/.]+$/, "")
          .replace(/[^a-z0-9-]/gi, "_")}`,
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: { width: 1600, height: 1600, crop: "limit" },
        quality: "auto:best",
        format: "webp",
        overwrite: false, // Prevent duplicate overwrites
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        type: "upload",
        invalidate: true,
      }
    );
  });

  return Promise.all(uploadPromises);
};

export const rollbackCloudinaryUploads = async (results: any[]) => {
  await Promise.all(
    results.map((result) => cloudinary.uploader.destroy(result.public_id))
  );
};

export const handleStandaloneImageUpload = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.files?.length) {
      throw new AppError("No images provided", 400);
    }

    try {
      const results = await uploadToCloudinary(req.files);
      res.status(200).json({
        status: "success",
        data: {
          images: results.map((r) => ({
            url: r.secure_url,
            public_id: r.public_id,
          })),
          count: results.length,
        },
      });
    } catch (error) {
      await rollbackCloudinaryUploads(results);
      throw error;
    }
  }
);
