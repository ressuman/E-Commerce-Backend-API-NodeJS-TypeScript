import express, { NextFunction, Request, Response } from "express";

import {
  checkInventory,
  checkProductAvailability,
  createProduct,
  deleteProduct,
  getAllProducts,
  getDeletedProducts,
  getNewProducts,
  getProductAnalytics,
  getProductDetails,
  getProducts,
  getProductsByBrand,
  getSimilarProducts,
  getTopProducts,
  releaseStock,
  reserveStock,
  restoreProduct,
  searchProducts,
  updateProduct,
} from "@/controllers/productControllers.js";

import {
  authenticate,
  authorizeAdmin,
  authorizeInventoryManagement,
  authorizeProductManagement,
  authorizeReviewInteraction,
  authorizeReviewModification,
  requireAuth,
} from "@/middlewares/auth.js";

import {
  inventoryCheckSchema,
  productCreateSchema,
  productListingSchema,
  productSearchSchema,
  productUpdateSchema,
  reserveStockSchema,
  reviewCreateSchema,
  reviewUpdateSchema,
  validate,
} from "@/utils/validate.js";

import {
  createReview,
  deleteReview,
  dislikeReview,
  getPriceHistory,
  getReview,
  getReviews,
  likeReview,
  updateReview,
} from "@/controllers/reviewAndPriceHistoryControllers.js";

import {
  handleImageCleanup,
  handleStandaloneImageUpload,
  processImageUpload,
  uploadProductImages,
  verifyCloudinaryFolder,
} from "@/controllers/uploadControllers.js";

const router = express.Router();

// Public routes
router.get("/all-products", getProducts);
router.get("/search", validate(productSearchSchema), searchProducts);
router.get("/get-product/:productId", getProductDetails);
router.get("/similar/:productId", getSimilarProducts);
router.get("/top-products", validate(productListingSchema), getTopProducts);
router.get("/new-products", validate(productListingSchema), getNewProducts);
router.get("/brand/:brand", getProductsByBrand);
router.get("/:productId/price-history", getPriceHistory);
router.get("/:productId/get-reviews/reviews", getReviews);

// Authenticated routes  (any logged-in user)
router.use(authenticate, requireAuth);

router.post("/check-inventory", validate(inventoryCheckSchema), checkInventory);
router.post(
  "/check-availability",
  validate(reserveStockSchema),
  checkProductAvailability
);
router.post(
  "/:productId/create-review/reviews",
  validate(reviewCreateSchema),
  createReview
);
router.get("/reviews/get-review/:reviewId", getReview);
router.patch(
  "/reviews/get-review/:reviewId/like",
  authorizeReviewInteraction,
  likeReview
);
router.patch(
  "/reviews/get-review/:reviewId/dislike",
  authorizeReviewInteraction,
  dislikeReview
);

// Inventory management routes (requires product + order permissions)
router.use(authorizeInventoryManagement);

router.post(
  "/stocks/reserve-stock",
  validate(reserveStockSchema),
  reserveStock
);
router.post(
  "/stocks/release-stock",
  validate(reserveStockSchema),
  releaseStock
);

// Protected management routes (requires product permissions)(Moderators & Admins)
router.use(authorizeProductManagement);

// Image management routes
router.post(
  "/media/upload/images",
  verifyCloudinaryFolder,
  uploadProductImages,
  processImageUpload,
  handleImageCleanup,
  handleStandaloneImageUpload
);
router.post(
  "/add-product",
  verifyCloudinaryFolder,
  uploadProductImages,
  (req: Request, res: Response, next: NextFunction) => {
    req.operationType = "create-product";
    next();
  },
  processImageUpload,
  validate(productCreateSchema),
  handleImageCleanup,
  createProduct
);
router.put(
  "/update-product/:productId",
  uploadProductImages,
  processImageUpload,
  validate(productUpdateSchema),
  handleImageCleanup,
  updateProduct
);
router.delete("/delete-product/:productId", deleteProduct);

// Protected review routes (requires review permissions)
router.use(authorizeReviewModification);

router.patch(
  "/reviews/update-review/:reviewId",
  validate(reviewUpdateSchema),
  updateReview
);
router.delete("/reviews/delete-review/:reviewId", deleteReview);

// Admin-only routes
router.use(authorizeAdmin);

router.get("/analytics/dashboard", getProductAnalytics);
router.get("/fetch-all-products", getAllProducts);
router.get("/deleted/list", getDeletedProducts);
router.patch("/:productId/restore", restoreProduct);

export default router;
