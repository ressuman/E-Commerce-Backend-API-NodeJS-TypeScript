import express from "express";

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
  reviewIdSchema,
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
router.get(
  "/reviews/:reviewId/get-review",
  validate(reviewIdSchema),
  getReview
);
router.patch(
  "/reviews/:reviewId/like",
  validate(reviewIdSchema),
  authorizeReviewInteraction,
  likeReview
);
router.patch(
  "/reviews/:reviewId/dislike",
  validate(reviewIdSchema),
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

router.post("/add-product", validate(productCreateSchema), createProduct);
router.put(
  "/update-product/:productId",
  validate(productUpdateSchema),
  updateProduct
);
router.delete("/delete-product/:productId", deleteProduct);

// Protected review routes (requires review permissions)
router.use(authorizeReviewModification);

router.patch(
  "/update-reviews/:reviewId/reviews",
  validate(reviewUpdateSchema),
  updateReview
);
router.delete("/delete-reviews/:reviewId/reviews", deleteReview);

// Admin-only routes
router.use(authorizeAdmin);

router.get("/analytics/dashboard", getProductAnalytics);
router.get("/fetch-all-products", getAllProducts);
router.get("/deleted/list", getDeletedProducts);
router.patch("/:productId/restore", restoreProduct);

export default router;
