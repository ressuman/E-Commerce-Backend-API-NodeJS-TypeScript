// src/controllers/uploadControllers.ts
import { Request, Response, NextFunction } from "express";
import multer, { FileFilterCallback } from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

// Type definitions
interface CloudinaryStorageOptions {
  cloudinary: typeof cloudinary;
  params: {
    folder: string;
    allowed_formats: string[];
    transformation?: Array<{ [key: string]: any }>;
  };
}

interface File extends Express.Multer.File {
  path: string;
}

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "webuy-ecommerce/products",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif", "svg", "avif"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  } as CloudinaryStorageOptions["params"],
});

// File filter configuration
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".svg",
    ".avif",
  ];
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "image/avif",
  ];

  const extname = path.extname(file.originalname).toLowerCase();
  const { mimetype } = file;

  if (
    allowedExtensions.includes(extname) &&
    allowedMimeTypes.includes(mimetype)
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPG, JPEG, PNG, WEBP, GIF, SVG, and AVIF images are allowed."
      )
    );
  }
};

// Configure Multer with TypeScript types
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
    files: 6, // Maximum 6 files
  },
});

// Middleware for handling multiple uploads
export const uploadProductImages = upload.array("images", 6);

// Type for successful upload response
interface UploadResponse {
  message: string;
  images: string[];
  count: number;
}

// Controller with proper TypeScript typing
export const handleImageUpload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  uploadProductImages(req, res, (err: unknown) => {
    try {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
              message: "File too large. Maximum size is 20MB per image.",
            });
          }
          if (err.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({
              message: "Maximum 6 images allowed per product.",
            });
          }
          return res
            .status(400)
            .json({ message: `Upload error: ${err.message}` });
        }

        if (err instanceof Error) {
          return res.status(400).json({ message: err.message });
        }

        return res
          .status(500)
          .json({ message: "Unknown upload error occurred" });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No images provided" });
      }

      const files = req.files as File[];
      const imageUrls = files.map((file) => file.path);

      const response: UploadResponse = {
        message: "Images uploaded successfully",
        images: imageUrls,
        count: imageUrls.length,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  });
};
