// src/controllers/OrderControllers.ts
import { AppError, asyncHandler } from "@/middlewares/asyncHandler.js";
import Order, {
  Currency,
  FulfillmentInfo,
  OrderStatus,
  PaymentResult,
  PaymentStatus,
} from "@/models/orderModel.js";
import Product from "@/models/productModel.js";
import { formatOrderResponse } from "@/utils/users.js";
import {
  dateRangeSchema,
  fulfillOrderSchema,
  orderCreateSchema,
  processPaymentSchema,
  salesByPeriodSchema,
  updateOrderStatusSchema,
} from "@/utils/validate.js";
import { Request, Response } from "express";
import mongoose from "mongoose";

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const validated = orderCreateSchema.parse(req.body);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Generate order number
    const orderNumber = Order.generateOrderNumber();

    // Validate product availability
    const products = await Product.find({
      _id: { $in: validated.orderItems.map((item) => item.product) },
    }).session(session);

    if (products.length !== validated.orderItems.length) {
      throw new AppError("One or more products not found", 404);
    }

    // Prepare order items
    const orderItems = validated.orderItems.map((item) => {
      const product = products.find((p) => p._id.toString() === item.product);
      if (!product)
        throw new AppError(`Product ${item.product} not found`, 404);
      if (!Product.isProductAvailable(product.id, item.quantity)) {
        throw new AppError(`Insufficient stock for ${product.name}`, 400);
      }
      return {
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        price: product.price,
        image: product.images[0] || "",
        sku: product.sku,
      };
    });

    // Reserve stock
    await Promise.all(
      validated.orderItems.map((item) =>
        Product.reserveStock(item.product, item.quantity)
      )
    );

    // Calculate totals with discount
    const shippingPrice = 10; // Replace with actual shipping calculation
    const { itemsPrice, taxPrice, totalPrice } = Order.calculateOrderTotals(
      orderItems,
      shippingPrice,
      validated.taxRate || 0.1,
      validated.discountInfo?.amount || 0
    );

    // Create order with all fields
    const order = await Order.createOrder(
      {
        orderNumber,
        ...validated,
        orderItems,
        shippingAddress: validated.shippingAddress,
        billingAddress: validated.billingAddress,
        paymentMethod: validated.paymentMethod,
        shippingMethod: validated.shippingMethod,
        itemsPrice,
        taxPrice,
        shippingPrice,
        totalPrice,
        discountPrice: validated.discountInfo?.amount || 0,
        discountInfo: validated.discountInfo,
        taxInfo: {
          taxRate: validated.taxRate || 0.1,
          taxAmount: taxPrice,
        },
        currency: validated.currency || Currency.USD,
        paymentStatus: PaymentStatus.PENDING,
        notes: validated.notes,
        tags: validated.tags,
        isPaid: false,
        isDelivered: false,
        user: user._id,
        createdBy: user._id,
        status: OrderStatus.PENDING,
      },
      user._id.toString(),
      session
    );

    await session.commitTransaction();

    // Send confirmation email
    await order.sendOrderConfirmationEmail();

    res.status(201).json({
      status: "success",
      data: formatOrderResponse(order),
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export const getOrderById = asyncHandler(
  async (req: Request, res: Response) => {
    const order = await Order.getOrderById(req.params.orderId);

    if (!order) throw new AppError("Order not found", 404);

    res.json({
      status: "success",
      data: formatOrderResponse(order),
    });
  }
);

export const getAllOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const { status, page = 1, limit = 25 } = req.query;

    const orders = await Order.findWithStatus(status as OrderStatus)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Order.countDocuments(status ? { status } : {});

    res.json({
      status: "success",
      count: orders.length,
      total,
      pages: Math.ceil(total / Number(limit)),
      data: orders.map(formatOrderResponse),
    });
  }
);

export const getOrderByOrderNumber = asyncHandler(
  async (req: Request, res: Response) => {
    const order = await Order.findByOrderNumber(req.params.orderNumber);

    if (!order) throw new AppError("Order not found", 404);

    res.json({
      status: "success",
      data: formatOrderResponse(order),
    });
  }
);

export const getUserOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user!;
    const orders = await Order.getOrdersByUser(user._id.toString());

    res.json({
      status: "success",
      count: orders.length,
      data: orders.map(formatOrderResponse),
    });
  }
);

export const getPendingOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const orders = await Order.findPendingOrders();

    res.json({
      status: "success",
      count: orders.length,
      data: orders.map(formatOrderResponse),
    });
  }
);

export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { status, cancellationReason } = req.body;

    if (!Object.values(OrderStatus).includes(status)) {
      throw new AppError("Invalid order status", 400);
    }

    const validated = updateOrderStatusSchema.parse(req.body);

    const order = await Order.updateOrderStatus(
      req.params.orderId,
      validated.status as OrderStatus,
      validated.cancellationReason
    );

    order.addStatusHistoryEvent(
      status,
      req.body.description || `Status updated to ${status}`,
      req.user.id
    );

    if (!order) throw new AppError("Order not found", 404);

    await order.save();

    res.json({
      status: "success",
      data: formatOrderResponse(order),
    });
  }
);

export const updateOrderToPaid = asyncHandler(
  async (req: Request, res: Response) => {
    const paymentResult: PaymentResult = {
      paymentId: `manual-${Date.now()}`,
      status: "completed",
      updateTime: new Date(),
      email: req.user.email,
      currency: Currency.USD,
      amountReceived: 0, // Should get from request body in real implementation
    };

    const order = await Order.processPayment(req.params.id, paymentResult);

    if (!order) throw new AppError("Order not found", 404);

    res.json({
      status: "success",
      data: formatOrderResponse(order),
    });
  }
);

export const updateOrderToDelivered = asyncHandler(
  async (req: Request, res: Response) => {
    const order = await Order.updateOrderStatus(
      req.params.id,
      OrderStatus.DELIVERED,
      "Marked as delivered by admin"
    );

    if (!order) throw new AppError("Order not found", 404);

    res.json({
      status: "success",
      data: formatOrderResponse(order),
    });
  }
);

export const processPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = processPaymentSchema.parse(req.body);

    const paymentResult: PaymentResult = {
      paymentId: validated.paymentId,
      status: validated.status,
      updateTime: new Date(),
      email: validated.email,
      amountReceived: validated.amountReceived,
      currency: validated.currency || Currency.USD, // Adjust based on order
    };

    const order = await Order.processPayment(req.params.orderId, paymentResult);
    if (!order) throw new AppError("Order not found", 404);

    res.json({
      status: "success",
      data: formatOrderResponse(order),
    });
  }
);

export const addTrackingInfo = asyncHandler(
  async (req: Request, res: Response) => {
    const { trackingNumber, shippingProvider } = req.body;

    const order = await Order.fulfillOrder(req.params.id, {
      trackingNumber,
      shippingProvider: shippingProvider || "Standard Shipping",
    });

    if (!order) throw new AppError("Order not found", 404);

    res.json({
      status: "success",
      data: formatOrderResponse(order),
    });
  }
);

export const refundOrder = asyncHandler(async (req: Request, res: Response) => {
  const { amount, reason } = req.body;

  if (!amount || !reason) {
    throw new AppError("Amount and reason are required", 400);
  }

  const order = await Order.cancelOrder(
    req.params.id,
    reason,
    req.user.id,
    amount // Would need to update model method signature to accept amount
  );

  if (!order) throw new AppError("Order not found", 404);

  res.json({
    status: "success",
    data: formatOrderResponse(order),
  });
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;
  if (!reason) throw new AppError("Cancellation reason is required", 400);

  const order = await Order.cancelOrder(
    req.params.orderId,
    reason,
    req.user!._id.toString()
  );
  if (!order) throw new AppError("Order not found", 404);

  res.json({
    status: "success",
    data: formatOrderResponse(order),
  });
});

export const getSalesByPeriod = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = salesByPeriodSchema.parse(req.query);

    const period = req.params.period as "day" | "week" | "month" | "year";

    if (!["day", "week", "month", "year"].includes(period)) {
      throw new AppError("Invalid period. Use day, week, month or year", 400);
    }

    const sales = await Order.getSalesByPeriod(validated.period);

    res.json({
      status: "success",
      data: sales,
    });
  }
);

export const fulfillOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = fulfillOrderSchema.parse(req.body);

    const fulfillmentDetails: Partial<FulfillmentInfo> = {
      trackingNumber: validated.trackingNumber,
      shippingProvider: validated.shippingProvider,
      fulfillmentDate: new Date(),
    };

    const order = await Order.fulfillOrder(
      req.params.orderId,
      fulfillmentDetails
    );
    if (!order) throw new AppError("Order not found", 404);

    res.json({
      status: "success",
      data: formatOrderResponse(order),
    });
  }
);

export const getShippingLabel = asyncHandler(
  async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    const label = await order.getShippingLabel();

    res.status(200).json({
      success: true,
      data: label,
    });
  }
);

export const getInvoicePdf = asyncHandler(
  async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    // Check if the order belongs to the user or the user is an admin
    if (order.user.toString() !== req.user.id && req.user.role !== "admin") {
      throw new AppError("Not authorized to access this order", 403);
    }

    const invoice = await order.getInvoicePdf();

    // Set appropriate headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${order.orderNumber}.pdf`
    );

    res.send(invoice);
  }
);

export const updateOrderNotes = asyncHandler(
  async (req: Request, res: Response) => {
    const { notes } = req.body;

    if (!notes) {
      throw new AppError("Notes cannot be empty", 400);
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        notes,
        updatedBy: req.user.id,
      },
      { new: true }
    );

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  }
);

export const updateOrderTags = asyncHandler(
  async (req: Request, res: Response) => {
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      throw new AppError("Tags must be provided as an array", 400);
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        tags,
        updatedBy: req.user.id,
      },
      { new: true }
    );

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  }
);

// Admin Controllers
export const getSalesAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = dateRangeSchema.parse(req.query);

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(new Date().setMonth(new Date().getMonth() - 1));

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const analytics = await Order.getSalesAnalytics(
      new Date(validated.startDate),
      new Date(validated.endDate)
    );

    res.json({
      status: "success",
      data: analytics,
    });
  }
);

export const bulkUpdateOrdersStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderIds, status } = req.body;

    if (
      !Array.isArray(orderIds) ||
      !Object.values(OrderStatus).includes(status)
    ) {
      throw new AppError("Invalid order IDs or status", 400);
    }

    const result = await Order.bulkUpdateOrdersStatus(
      orderIds,
      status as OrderStatus
    );

    //  const result = await Order.updateMany(
    //    { _id: { $in: orderIds } },
    //    {
    //      $set: {
    //        status,
    //        updatedBy: req.user.id,
    //      },
    //      $push: {
    //        statusHistory: {
    //          status,
    //          timestamp: new Date(),
    //          description: `Bulk update to ${status}`,
    //          userId: req.user.id,
    //        },
    //      },
    //    }
    //  );

    res.json({
      status: "success",
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  }
);

export const getOrderStats = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = dateRangeSchema.parse(req.query);

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(new Date().setMonth(new Date().getMonth() - 1));

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const stats = await Order.getOrderStats(
      new Date(validated.startDate),
      new Date(validated.endDate)
    );

    res.json({
      status: "success",
      data: stats,
    });
  }
);

export const getOrdersByStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const status = req.params.status as OrderStatus;

    if (!Object.values(OrderStatus).includes(status)) {
      throw new AppError("Invalid order status", 400);
    }

    const orders = await Order.findWithStatus(status);

    res.json({
      status: "success",
      count: orders.length,
      data: orders.map(formatOrderResponse),
    });
  }
);

export const getRecentOrdersAdmin = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;

    const orders = await Order.findRecentOrders(limit);

    res.json({
      status: "success",
      count: orders.length,
      data: orders.map(formatOrderResponse),
    });
  }
);

// Inventory Controllers
export const checkInventory = asyncHandler(
  async (req: Request, res: Response) => {
    const items = req.body.items;
    const inventoryStatus = await Product.checkInventory(items);

    res.json({
      status: "success",
      data: inventoryStatus,
    });
  }
);

// Utility Controllers
export const generateOrderNumber = asyncHandler(
  async (req: Request, res: Response) => {
    const orderNumber = Order.generateOrderNumber();

    res.json({
      status: "success",
      data: { orderNumber },
    });
  }
);

export const calculateOrderTotals = asyncHandler(
  async (req: Request, res: Response) => {
    const { items, shippingPrice, taxRate, discountAmount } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError(
        "Order items must be provided as a non-empty array",
        400
      );
    }

    if (typeof shippingPrice !== "number" || shippingPrice < 0) {
      throw new AppError("Shipping price must be a non-negative number", 400);
    }

    if (typeof taxRate !== "number" || taxRate < 0 || taxRate > 1) {
      throw new AppError("Tax rate must be a number between 0 and 1", 400);
    }

    if (typeof discountAmount !== "number" || discountAmount < 0) {
      throw new AppError("Discount amount must be a non-negative number", 400);
    }

    const totals = Order.calculateOrderTotals(
      items,
      shippingPrice,
      taxRate,
      discountAmount
    );

    res.json({
      status: "success",
      data: totals,
    });
  }
);

export const sendOrderConfirmation = asyncHandler(
  async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.id).populate(
      "user",
      "email firstName lastName"
    );

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    const result = await order.sendOrderConfirmationEmail();

    res.status(200).json({
      success: result,
      message: result ? "Email sent successfully" : "Failed to send email",
    });
  }
);
