// src/routes/orderRoutes.ts
import express from "express";

import {
  addTrackingInfo,
  bulkUpdateOrdersStatus,
  calculateOrderTotals,
  cancelOrder,
  checkInventory,
  createOrder,
  fulfillOrder,
  generateOrderNumber,
  getAllOrders,
  getInvoicePdf,
  getOrderById,
  getOrderByOrderNumber,
  getOrdersByStatus,
  getOrderStats,
  getPendingOrders,
  getRecentOrdersAdmin,
  getSalesAnalytics,
  getSalesByPeriod,
  getShippingLabel,
  getUserOrders,
  processPayment,
  refundOrder,
  sendOrderConfirmation,
  updateOrderNotes,
  updateOrderStatus,
  updateOrderTags,
  updateOrderToDelivered,
  updateOrderToPaid,
} from "@/controllers/OrderControllers.js";

import {
  authenticate,
  authorizeAdmin,
  authorizeInventoryManagement,
  authorizeOrderManagement,
  authorizeSupport,
  requireAuth,
} from "@/middlewares/auth.js";

import {
  dateRangeSchema,
  orderCreateSchema,
  processPaymentSchema,
  salesByPeriodSchema,
  updateOrderStatusSchema,
  validate,
} from "@/utils/validate.js";

const router = express.Router();

// Public routes (order lookup by number)
router.get("/:orderNumber", getOrderByOrderNumber);

// Authenticated routes (any logged-in user)
router.use(authenticate, requireAuth);

// Customer-specific routes
router.post("/", validate(orderCreateSchema), createOrder);
router.get("/user/orders", getUserOrders);
router.post("/:orderId/cancel", cancelOrder);
router.get("/:id/invoice", getInvoicePdf);

// Inventory management routes
router.use(authorizeInventoryManagement);

router.post("/check-inventory", checkInventory);

// Order management routes (Moderators+ with order permissions)
router.use(authorizeOrderManagement);

router.put(
  "/:orderId/status",
  validate(updateOrderStatusSchema),
  updateOrderStatus
);
router.post("/:orderId/fulfill", fulfillOrder);
router.get("/status/:status", getOrdersByStatus);
router.post("/:id/tracking", addTrackingInfo);
router.post(
  "/:orderId/process-payment",
  validate(processPaymentSchema),
  processPayment
);
router.get(
  "/analytics/period",
  validate(salesByPeriodSchema),
  getSalesByPeriod
);
router.get("/pending", getPendingOrders);

// Support team routes
router.use(authorizeSupport);

router.get("/recent", getRecentOrdersAdmin);
router.post("/:id/send-confirmation", sendOrderConfirmation);

// Admin-only routes
router.use(authorizeAdmin);

router.get("/", getAllOrders);
router.get(
  "/analytics/sales",
  validate(salesByPeriodSchema),
  getSalesAnalytics
);
router.get("/analytics/stats", validate(dateRangeSchema), getOrderStats);
router.put("/bulk-update/status", bulkUpdateOrdersStatus);
router.put("/:id/mark-paid", updateOrderToPaid);
router.put("/:id/mark-delivered", updateOrderToDelivered);
router.post("/:id/refund", refundOrder);

// Utility routes (available to all authenticated users)
router.get("/id/:orderId", getOrderById);
router.get("/generate/number", generateOrderNumber);
router.post("/calculate/totals", calculateOrderTotals);
router.get("/:id/shipping-label", getShippingLabel);
router.put("/:id/notes", updateOrderNotes);
router.put("/:id/tags", updateOrderTags);

// Universal order access
router.get("/:id", getOrderById);
router.get("/status/:status", getOrdersByStatus);

export default router;
