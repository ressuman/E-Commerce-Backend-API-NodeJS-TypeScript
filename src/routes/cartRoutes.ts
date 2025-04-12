// src/routes/cartRoutes.ts
import {
  addItemToCart,
  applyDiscount,
  checkCartInventory,
  clearCart,
  createCart,
  getAbandonedCarts,
  getCart,
  getCartAnalytics,
  markCartAsAbandoned,
  markCartAsConverted,
  mergeCarts,
  refreshCartPrices,
  removeCartItem,
  reserveCart,
  updateCartItem,
  validateCart,
} from "@/controllers/cartControllers.js";

import { authenticate, authorize, requireAuth } from "@/middlewares/auth.js";

import { UserRole } from "@/models/userModel.js";

import {
  addToCartSchema,
  updateCartItemSchema,
  validate,
} from "@/utils/validate.js";
import express from "express";

const router = express.Router();

// Protected user routes
router.use(authenticate, requireAuth);

// Cart management
router.get("/", getCart);
router.post("/create", createCart);
router.post("/items", validate(addToCartSchema), addItemToCart);
router.patch(
  "/items/:productId",
  validate(updateCartItemSchema),
  updateCartItem
);
router.delete("/items/:productId", removeCartItem);
router.delete("/clear", clearCart);
router.get("/validate", validateCart);
router.patch("/discount", applyDiscount);
router.post("/merge", mergeCarts);
router.patch("/refresh-prices", refreshCartPrices);
router.post("/reserve", reserveCart);
router.get("/check-inventory", checkCartInventory);

// Admin management routes
router.get(
  "/abandoned",
  authorize([UserRole.ADMIN, UserRole.MODERATOR]),
  getAbandonedCarts
);

router.patch(
  "/:cartId/abandon",
  authorize([UserRole.ADMIN]),
  markCartAsAbandoned
);

router.patch(
  "/:cartId/convert",
  authorize([UserRole.ADMIN]),
  markCartAsConverted
);

router.get(
  "/analytics",
  authorize([UserRole.ADMIN, UserRole.MODERATOR]),
  getCartAnalytics
);

export default router;
