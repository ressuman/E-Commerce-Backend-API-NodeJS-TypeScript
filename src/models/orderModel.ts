// src/models/orderModel.ts
import { Document, Model, Schema, model, Types, ClientSession } from "mongoose";
import User, { IUser } from "./userModel.js";
import { AppError } from "@/middlewares/asyncHandler.js";
import Product, { IProduct } from "./productModel.js";
import sendEmail from "@/utils/email.js";

export enum OrderStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SHIPPED = "shipped",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
  RETURNED = "returned",
  REFUNDED = "refunded",
  ON_HOLD = "on_hold",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum PaymentStatus {
  PENDING = "pending",
  PAID = "paid",
  FAILED = "failed",
  REFUNDED = "refunded",
  PARTIALLY_REFUNDED = "partially_refunded",
}

export enum PaymentMethod {
  CARD = "card",
  PAYPAL = "paypal",
  STRIPE = "stripe",
  MOBILE_MONEY = "mobile_money",
  BANK_TRANSFER = "bank_transfer",
  CASH_ON_DELIVERY = "cash_on_delivery",
}

export enum Currency {
  USD = "USD",
  GBP = "GBP",
  EUR = "EUR",
  GHS = "GHS",
  NGN = "NGN",
}

export enum ShippingMethod {
  STANDARD = "standard",
  EXPRESS = "express",
  OVERNIGHT = "overnight",
  LOCAL_PICKUP = "local_pickup",
  FREE_SHIPPING = "free_shipping",
}

export interface OrderItem {
  product: Types.ObjectId | IProduct;
  name: string;
  quantity: number;
  price: number;
  image: string;
  sku: string;
}

export interface ShippingAddress {
  fullName: string;
  street: string;
  address: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phoneNumber: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface PaymentResult {
  paymentId: string;
  status: string;
  updateTime: Date;
  email: string;
  currency: Currency;
  amountReceived: number;
  created?: Date;
}

export interface TaxInfo {
  taxRate: number;
  taxAmount: number;
  taxId?: string;
  taxType?: string;
  taxCategory?: string;
}

export interface DiscountInfo {
  code?: string;
  amount: number;
  type: "percentage" | "fixed";
  description?: string;
}

export interface FulfillmentInfo {
  fulfillmentDate?: Date;
  shippingProvider?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  notes?: string;
}

export interface OrderHistoryEvent {
  status: OrderStatus;
  timestamp: Date;
  description: string;
  userId?: Types.ObjectId | IUser;
}

export interface IOrder extends Document {
  user: Types.ObjectId | IUser;
  orderItems: OrderItem[];
  orderNumber: string;
  shippingAddress: ShippingAddress;
  billingAddress?: ShippingAddress;
  paymentMethod: PaymentMethod;
  paymentResult?: PaymentResult;
  paymentStatus: PaymentStatus;
  shippingMethod: ShippingMethod;
  itemsPrice: number; // Sum of item prices (before tax/shipping)
  taxPrice: number; // Calculated tax amount
  taxRate: number; // Tax rate applied (e.g., 0.1 for 10%)
  shippingPrice: number; // Shipping cost
  totalPrice: number; // Total cost (items + tax + shipping)
  discountPrice: number; // Discount applied (if any)
  discountInfo?: DiscountInfo; // Details of any discount applied
  taxInfo?: TaxInfo; // Details of any tax applied
  fulfillmentInfo?: FulfillmentInfo; // Details of order fulfillment
  currency: Currency;
  status: OrderStatus;
  statusHistory: OrderHistoryEvent[]; // History of status changes
  isPaid: boolean;
  paidAt?: Date;
  notes?: string; // Additional notes
  tags?: string[];
  isDelivered: boolean;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isCancelled: boolean;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId | IUser;
  cancellationReason?: string;
  createdBy: Types.ObjectId | IUser;
  updatedBy?: Types.ObjectId | IUser;
  estimatedDelivery?: Date;
  trackingNumber?: string;
  discount?: number;
  version: number;
}

export interface OrderModel extends Model<IOrder> {
  // Core CRUD Operations
  createOrder(
    orderData: Omit<IOrder, "status" | "isPaid" | "isDelivered" | "version">,
    userId: string,
    session?: ClientSession
  ): Promise<IOrder>;
  getOrderById(id: string): Promise<IOrder | null>;
  findByUser(userId: string): Promise<IOrder[]>;
  findWithStatus(status: OrderStatus): Promise<IOrder[]>;
  findPendingOrders(): Promise<IOrder[]>;
  findRecentOrders(limit?: number): Promise<IOrder[]>;

  updateOrderStatus(
    id: string,
    newStatus: OrderStatus,
    cancellationReason?: string
  ): Promise<IOrder | null>;

  // Payment Handling
  processPayment(
    orderId: string,
    paymentData: PaymentResult
  ): Promise<IOrder | null>;
  capturePayment(orderId: string): Promise<IOrder | null>;

  // Query Methods
  getOrdersByUser(userId: string): Promise<IOrder[]>;
  getRecentOrders(limit?: number): Promise<IOrder[]>;
  getOrdersByStatus(status: OrderStatus): Promise<IOrder[]>;

  // Business Logic
  calculateTotals(items: OrderItem[]): Promise<{
    itemsPrice: number;
    taxPrice: number;
    shippingPrice: number;
    totalPrice: number;
  }>;
  cancelOrder(orderId: string, reason: string): Promise<IOrder | null>;
  returnOrder(orderId: string): Promise<IOrder | null>;
  addTrackingInfo(
    orderId: string,
    trackingNumber: string
  ): Promise<IOrder | null>;

  // Admin Operations
  bulkUpdateOrdersStatus(
    orderIds: string[],
    newStatus: OrderStatus
  ): Promise<{ modifiedCount: number }>;
  getSalesAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSales: number;
    averageOrderValue: number;
    statusDistribution: Record<OrderStatus, number>;
  }>;
  findByOrderNumber(orderNumber: string): Promise<IOrder | null>;
  generateOrderNumber(): string;
  calculateOrderTotals(
    items: OrderItem[],
    shippingPrice: number,
    taxRate: number,
    discountAmount?: number
  ): {
    itemsPrice: number;
    taxPrice: number;
    discountPrice: number;
    totalPrice: number;
  };
  fulfillOrder(
    orderId: string,
    fulfillmentDetails: Partial<FulfillmentInfo>
  ): Promise<IOrder | null>;
  getOrderStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    topProducts: Array<{
      productId: string;
      name: string;
      totalSold: number;
      revenue: number;
    }>;
  }>;
  getSalesByPeriod(period: "day" | "week" | "month" | "year"): Promise<
    Array<{
      period: string;
      orders: number;
      revenue: number;
    }>
  >;
}

const orderSchema = new Schema<IOrder, OrderModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    orderNumber: {
      type: String,
      required: [true, "Order number is required"],
      trim: true,
    },
    orderItems: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: [true, "Product reference is required"],
        },
        name: {
          type: String,
          required: [true, "Product name is required"],
          trim: true,
        },
        quantity: {
          type: Number,
          required: [true, "Quantity is required"],
          min: [1, "Quantity must be at least 1"],
        },
        price: {
          type: Number,
          required: [true, "Price is required"],
          min: [0.01, "Price must be greater than 0"],
        },
        image: {
          type: String,
          required: [true, "Product image is required"],
          validate: {
            validator: (v: string) =>
              /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/.test(v),
            message: "Invalid image URL format",
          },
        },
        sku: {
          type: String,
          required: [true, "SKU is required"],
          validate: {
            validator: (v: string) => /^[A-Z0-9-]{8,}$/.test(v),
            message: "Invalid SKU format",
          },
        },
      },
    ],
    shippingAddress: {
      fullName: {
        type: String,
        required: [true, "Full name is required"],
        trim: true,
      },
      street: {
        type: String,
        required: [true, "Street address is required"],
        trim: true,
        maxlength: [200, "Street address too long"],
      },
      address: {
        type: String,
        required: [true, "Address is required"],
        trim: true,
        maxlength: [200, "Address too long"],
      },
      city: {
        type: String,
        required: [true, "City is required"],
        trim: true,
        maxlength: [100, "City name too long"],
      },
      state: {
        type: String,
        trim: true,
        maxlength: [100, "State name too long"],
      },
      postalCode: {
        type: String,
        required: [true, "Postal code is required"],
        trim: true,
        maxlength: [20, "Postal code too long"],
      },
      country: {
        type: String,
        required: [true, "Country is required"],
        trim: true,
        maxlength: [100, "Country name too long"],
      },
      phoneNumber: {
        type: String,
        required: [true, "Phone number is required"],
        trim: true,
      },
      coordinates: {
        lat: { type: Number, min: -90, max: 90 },
        lng: { type: Number, min: -180, max: 180 },
      },
    },
    billingAddress: {
      fullName: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
      phoneNumber: String,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: [true, "Payment method is required"],
    },
    shippingMethod: {
      type: String,
      enum: Object.values(ShippingMethod),
      required: [true, "Shipping method is required"],
    },
    paymentResult: {
      paymentId: String,
      status: String,
      updateTime: Date,
      email: String,
      currency: {
        type: String,
        enum: Object.values(Currency),
      },
      amountReceived: Number,
      created: Date,
    },
    itemsPrice: {
      type: Number,
      required: true,
      min: [0, "Items price cannot be negative"],
    },
    taxPrice: {
      type: Number,
      required: true,
      min: [0, "Tax price cannot be negative"],
    },
    shippingPrice: {
      type: Number,
      required: true,
      min: [0, "Shipping price cannot be negative"],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, "Total price cannot be negative"],
    },
    discountPrice: {
      type: Number,
      default: 0,
      min: [0, "Discount price cannot be negative"],
    },
    currency: {
      type: String,
      enum: Object.values(Currency),
      default: Currency.USD,
    },
    taxInfo: {
      taxRate: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      taxId: { type: String },
      taxType: { type: String },
      taxCategory: { type: String },
    },
    discountInfo: {
      code: { type: String },
      amount: { type: Number, default: 0 },
      type: { type: String, enum: ["percentage", "fixed"], default: "fixed" },
      description: { type: String },
    },
    fulfillmentInfo: {
      fulfillmentDate: { type: Date },
      shippingProvider: { type: String },
      trackingNumber: { type: String },
      trackingUrl: { type: String },
      estimatedDeliveryDate: { type: Date },
      actualDeliveryDate: { type: Date },
      notes: { type: String },
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
      index: true,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: Object.values(OrderStatus),
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        description: {
          type: String,
          required: true,
        },
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: Date,
    isDelivered: {
      type: Boolean,
      default: false,
    },
    deliveredAt: Date,
    cancellationReason: {
      type: String,
      maxlength: [500, "Reason too long"],
    },
    estimatedDelivery: Date,
    trackingNumber: {
      type: String,
      index: true,
    },
    discount: {
      type: Number,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100%"],
    },
    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    tags: [String],
    version: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

// Indexes
orderSchema.index({ createdAt: -1 });
orderSchema.index({ "shippingAddress.country": 1, status: 1 });
orderSchema.index({ totalPrice: 1, status: 1 });
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ "orderItems.product": 1 });
orderSchema.index({ isPaid: 1, isDelivered: 1 });
orderSchema.index({ paymentStatus: 1 });

// Virtuals
orderSchema.virtual("id").get(function (this: IOrder) {
  return this._id.toHexString();
});

orderSchema.virtual("formattedDate").get(function (this: IOrder) {
  return this.createdAt.toISOString().split("T")[0];
});

// Static Methods
orderSchema.statics.createOrder = async function (
  orderData,
  userId,
  session = null
) {
  const user = await User.findById(userId).session(session);
  if (!user) throw new AppError("User not found", 404);

  // Reserve product stock
  await Promise.all(
    orderData.orderItems.map(async (item) => {
      const product = await Product.findById(item.product).session(session);
      if (!product)
        throw new AppError(`Product ${item.product} not found`, 404);
      if (!(await Product.isProductAvailable(product.id, item.quantity))) {
        throw new AppError(`Insufficient stock for ${product.name}`, 400);
      }
      await Product.reserveStock(product.id, item.quantity);
    })
  );

  const order = new this({
    ...orderData,
    user: userId,
    version: 0,
  });

  return order.save({ session });
};

orderSchema.statics.getOrderById = function (id: string) {
  return this.findById(id)
    .populate("user", "firstName lastName email")
    .populate("orderItems.product", "name price images")
    .lean();
};

orderSchema.statics.updateOrderStatus = async function (
  id: string,
  newStatus: OrderStatus,
  cancellationReason = ""
) {
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
    [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
    [OrderStatus.REFUNDED]: [],
  };

  const order = await this.findById(id);
  if (!order) return null;

  if (!validTransitions[order.status].includes(newStatus)) {
    throw new AppError(
      `Invalid status transition from ${order.status} to ${newStatus}`,
      400
    );
  }

  order.status = newStatus;
  order.version += 1;

  if (newStatus === OrderStatus.CANCELLED) {
    order.cancellationReason = cancellationReason;
    // Release reserved stock
    await Promise.all(
      order.orderItems.map(async (item) => {
        await Product.releaseStock(item.product.toString(), item.quantity);
      })
    );
  }

  return order.save();
};

orderSchema.statics.processPayment = async function (orderId, paymentData) {
  const order = await this.findById(orderId);
  if (!order) return null;

  if (order.isPaid) throw new AppError("Order already paid", 400);

  order.paymentResult = paymentData;
  order.isPaid = true;
  order.paidAt = new Date();
  order.version += 1;

  return order.save();
};

orderSchema.statics.getOrdersByUser = function (userId: string) {
  return this.find({ user: userId })
    .sort("-createdAt")
    .populate("orderItems.product", "name price images");
};

orderSchema.methods.calculateTotals = function () {
  this.itemsPrice = this.orderItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
  if (this.taxInfo?.taxRate) {
    this.taxPrice = +(this.itemsPrice * this.taxInfo.taxRate).toFixed(2);
    this.taxInfo.taxAmount = this.taxPrice;
  }
  if (this.discountInfo) {
    this.discountPrice =
      this.discountInfo.type === "percentage"
        ? +(this.itemsPrice * (this.discountInfo.amount / 100)).toFixed(2)
        : +Math.min(this.discountInfo.amount, this.itemsPrice).toFixed(2);
  }
  this.totalPrice = +(
    this.itemsPrice +
    this.taxPrice +
    this.shippingPrice -
    this.discountPrice
  ).toFixed(2);
};

orderSchema.statics.getSalesAnalytics = async function (startDate, endDate) {
  const result = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $nin: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$totalPrice" },
        count: { $sum: 1 },
        statusCounts: { $push: "$status" },
      },
    },
    {
      $project: {
        totalSales: 1,
        averageOrderValue: { $divide: ["$totalSales", "$count"] },
        statusDistribution: {
          $arrayToObject: {
            $map: {
              input: Object.values(OrderStatus),
              as: "status",
              in: {
                k: "$$status",
                v: {
                  $size: {
                    $filter: {
                      input: "$statusCounts",
                      as: "s",
                      cond: { $eq: ["$$s", "$$status"] },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  ]);

  return (
    result[0] || {
      totalSales: 0,
      averageOrderValue: 0,
      statusDistribution: Object.fromEntries(
        Object.values(OrderStatus).map((s) => [s, 0]) as Record<
          OrderStatus,
          number
        >
      ),
    }
  );
};

// Instance methods
orderSchema.methods.addStatusHistoryEvent = function (
  this: IOrder,
  status: OrderStatus,
  description: string,
  userId?: string
) {
  const historyEvent: OrderHistoryEvent = {
    status,
    timestamp: new Date(),
    description,
  };

  if (userId) {
    historyEvent.userId = new Types.ObjectId(userId);
  }

  this.statusHistory.push(historyEvent);
  this.status = status;

  if (status === OrderStatus.DELIVERED) {
    this.isDelivered = true;
    this.deliveredAt = new Date();
  } else if (status === OrderStatus.COMPLETED) {
    this.isDelivered = true;
    if (!this.deliveredAt) {
      this.deliveredAt = new Date();
    }
  }
};

orderSchema.methods.canBeCancelled = function (this: IOrder): boolean {
  const nonCancellableStatuses = [
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ];

  return !nonCancellableStatuses.includes(this.status);
};

orderSchema.methods.canBeRefunded = function (this: IOrder): boolean {
  // Can only refund paid orders that have been delivered less than 30 days ago
  if (!this.isPaid || !this.deliveredAt) {
    return false;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return (
    this.deliveredAt > thirtyDaysAgo &&
    ![OrderStatus.REFUNDED, OrderStatus.CANCELLED].includes(this.status)
  );
};

orderSchema.methods.getShippingLabel = async function (
  this: IOrder
): Promise<string> {
  // Implementation would integrate with shipping API
  // This is a stub for demonstration
  return `Shipping label for order ${this.orderNumber}`;
};

orderSchema.methods.getInvoicePdf = async function (
  this: IOrder
): Promise<Buffer> {
  // Implementation would generate PDF invoice
  // This is a stub for demonstration
  return Buffer.from(`Invoice for order ${this.orderNumber}`);
};

orderSchema.methods.sendOrderConfirmationEmail = async function (
  this: IOrder
): Promise<boolean> {
  try {
    const user = this.user as IUser;
    const order = this as IOrder;

    if (!user.email) {
      throw new Error("User email not available");
    }

    const orderDate = this.createdAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Generate HTML content
    const itemsListHTML = this.orderItems
      .map(
        (item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${this.currency} ${item.price.toFixed(2)}</td>
        <td>${this.currency} ${(item.quantity * item.price).toFixed(2)}</td>
      </tr>
    `
      )
      .join("");

    const totalsHTML = `
      <tr>
        <td colspan="3" style="text-align: right;">Subtotal:</td>
        <td>${this.currency} ${this.itemsPrice.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="3" style="text-align: right;">Shipping:</td>
        <td>${this.currency} ${this.shippingPrice.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="3" style="text-align: right;">Tax:</td>
        <td>${this.currency} ${this.taxPrice.toFixed(2)}</td>
      </tr>
      ${
        this.discountPrice > 0
          ? `
      <tr>
        <td colspan="3" style="text-align: right;">Discount:</td>
        <td>-${this.currency} ${this.discountPrice.toFixed(2)}</td>
      </tr>`
          : ""
      }
      <tr>
        <td colspan="3" style="text-align: right; font-weight: bold;">Total:</td>
        <td style="font-weight: bold;">${
          this.currency
        } ${this.totalPrice.toFixed(2)}</td>
      </tr>
    `;

    const viewOrderUrl = `${process.env.CLIENT_URL}/orders/${this.orderNumber}`;

    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 20px auto; padding: 30px; border: 1px solid #e0e0e0; border-radius: 8px; }
          .header { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 15px; }
          .content { margin: 25px 0; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
          th { background-color: #f5f5f5; }
          .footer { margin-top: 30px; color: #7f8c8d; font-size: 14px; }
          .button { display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${process.env.APP_NAME || "Your Store"} Order Confirmation</h1>
            <h3>Order #${this.orderNumber}</h3>
          </div>

          <div class="content">
            <p>Hello ${user.firstName},</p>
            <p>Thank you for your order! Here are your order details:</p>

            <h4>Order Summary</h4>
            <p>Date: ${orderDate}</p>

            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsListHTML}
              </tbody>
              <tfoot>
                ${totalsHTML}
              </tfoot>
            </table>

            <h4>Shipping Details</h4>
            <p>${this.shippingAddress.fullName}<br>
            ${this.shippingAddress.address}<br>
            ${this.shippingAddress.city}, ${this.shippingAddress.state} ${
      this.shippingAddress.postalCode
    }<br>
            ${this.shippingAddress.country}<br>
            📞 ${this.shippingAddress.phoneNumber}</p>

            <h4>Payment Method</h4>
            <p>${this.paymentMethod}</p>

            <a href="${viewOrderUrl}" class="button">View Order Status</a>

            <div class="footer">
              <p>Need help? Contact our <a href="mailto:${
                process.env.SUPPORT_EMAIL
              }">support team</a></p>
              <p>Best regards,<br>${process.env.APP_NAME || "The Team"}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Plain text version
    const message = `
      Order Confirmation - #${this.orderNumber}
      ======================================

      Hello ${user.firstName},

      Thank you for your order! Here are your order details:

      Order Summary:
      --------------
      Date: ${orderDate}

      Items:
      ${this.orderItems
        .map(
          (item) => `
      - ${item.name}
        Quantity: ${item.quantity}
        Price: ${this.currency} ${item.price.toFixed(2)}
        Total: ${this.currency} ${(item.quantity * item.price).toFixed(2)}
      `
        )
        .join("\n")}

      Subtotal: ${this.currency} ${this.itemsPrice.toFixed(2)}
      Shipping: ${this.currency} ${this.shippingPrice.toFixed(2)}
      Tax: ${this.currency} ${this.taxPrice.toFixed(2)}
      ${
        this.discountPrice > 0
          ? `Discount: -${this.currency} ${this.discountPrice.toFixed(2)}\n`
          : ""
      }
      Total: ${this.currency} ${this.totalPrice.toFixed(2)}

      Shipping Details:
      -----------------
      ${this.shippingAddress.fullName}
      ${this.shippingAddress.address}
      ${this.shippingAddress.city}, ${this.shippingAddress.state} ${
      this.shippingAddress.postalCode
    }
      ${this.shippingAddress.country}
      Phone: ${this.shippingAddress.phoneNumber}

      Payment Method: ${this.paymentMethod}

      View your order: ${viewOrderUrl}

      Best regards,
      ${process.env.APP_NAME || "The Team"}
    `;

    await sendEmail({
      email: user.email,
      subject: `Order Confirmation - #${this.orderNumber}`,
      html: emailHTML,
      message: message,
    });

    return true;
  } catch (error) {
    console.error("Order confirmation email error:", error);
    return false;
  }
};

orderSchema.statics.findByOrderNumber = function (
  orderNumber: string
): Promise<IOrder | null> {
  return this.findOne({ orderNumber })
    .populate("user", "id email firstName lastName")
    .populate("orderItems.product")
    .populate("statusHistory.userId", "id username email");
};

orderSchema.statics.findByUser = function (userId: string): Promise<IOrder[]> {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate("orderItems.product", "id name images")
    .select("-__v");
};

orderSchema.statics.findWithStatus = function (
  status: OrderStatus
): Promise<IOrder[]> {
  return this.find({ status })
    .sort({ createdAt: -1 })
    .populate("user", "id email firstName lastName");
};

orderSchema.statics.findPendingOrders = function (): Promise<IOrder[]> {
  return this.find({
    status: {
      $in: [OrderStatus.PENDING, OrderStatus.PROCESSING],
    },
  }).sort({ createdAt: 1 });
};

orderSchema.statics.findRecentOrders = function (
  limit = 10
): Promise<IOrder[]> {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("user", "id email firstName lastName");
};

orderSchema.statics.generateOrderNumber = function (): string {
  // Format: ORD-YEAR-RANDOMSTRING
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  return `ORD-${year}-${random}`;
};

orderSchema.statics.calculateOrderTotals = function (
  items: OrderItem[],
  shippingPrice: number,
  taxRate: number,
  discountAmount = 0
) {
  const itemsPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const taxPrice = +(itemsPrice * taxRate).toFixed(2);
  const discountPrice = +Math.min(discountAmount, itemsPrice).toFixed(2);
  const totalPrice = +(
    itemsPrice +
    taxPrice +
    shippingPrice -
    discountPrice
  ).toFixed(2);

  return {
    itemsPrice,
    taxPrice,
    discountPrice,
    totalPrice,
  };
};

orderSchema.statics.processPayment = async function (
  orderId: string,
  paymentDetails: any
): Promise<PaymentResult> {
  // This would integrate with a payment gateway like Stripe or PayPal
  // This is a stub implementation for demonstration
  const order = await this.findById(orderId);

  if (!order) {
    throw new Error("Order not found");
  }

  // Simulate payment processing
  const paymentResult: PaymentResult = {
    id: `PAY-${Date.now()}`,
    status: "COMPLETED",
    updateTime: new Date().toISOString(),
    paymentMethod: paymentDetails.method || PaymentMethod.CREDIT_CARD,
  };

  if (paymentDetails.email) {
    paymentResult.emailAddress = paymentDetails.email;
  }

  // Update order
  order.paymentResult = paymentResult;
  order.isPaid = true;
  order.paidAt = new Date();
  order.paymentStatus = PaymentStatus.PAID;
  order.addStatusHistoryEvent(
    OrderStatus.PROCESSING,
    "Payment processed successfully"
  );

  await order.save();
  return paymentResult;
};

orderSchema.statics.cancelOrder = async function (
  orderId: string,
  reason: string,
  userId: string
): Promise<IOrder | null> {
  const order = await this.findById(orderId);

  if (!order) {
    return null;
  }

  if (!order.canBeCancelled()) {
    throw new Error(`Order cannot be cancelled in status: ${order.status}`);
  }

  order.addStatusHistoryEvent(
    OrderStatus.CANCELLED,
    `Order cancelled: ${reason}`,
    userId
  );

  // If order was paid, handle refund logic
  if (order.isPaid) {
    // In a real system, this would integrate with payment gateway for refunds
    order.paymentStatus = PaymentStatus.REFUNDED;
  }

  // Release inventory
  await Promise.all(
    order.orderItems.map((item) =>
      import("../models/productModel.js").then(({ default: Product }) =>
        Product.releaseStock(item.product.toString(), item.quantity)
      )
    )
  );

  // Add refund handling
  if (refundAmount) {
    order.paymentStatus =
      refundAmount === order.totalPrice
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;
    order.addStatusHistoryEvent(
      OrderStatus.REFUNDED,
      `Refund processed: ${reason} (Amount: ${refundAmount})`,
      userId
    );
  }

  return order.save();
};

orderSchema.statics.fulfillOrder = async function (
  orderId: string,
  fulfillmentDetails: Partial<FulfillmentInfo>
): Promise<IOrder | null> {
  const order = await this.findById(orderId);

  if (!order) {
    return null;
  }

  if (
    order.status !== OrderStatus.PROCESSING &&
    order.status !== OrderStatus.PENDING
  ) {
    throw new Error(`Order cannot be fulfilled in status: ${order.status}`);
  }

  // Update fulfillment info
  order.fulfillmentInfo = {
    ...order.fulfillmentInfo,
    ...fulfillmentDetails,
    fulfillmentDate: fulfillmentDetails.fulfillmentDate || new Date(),
  };

  // Update order status
  if (fulfillmentDetails.trackingNumber) {
    order.addStatusHistoryEvent(
      OrderStatus.SHIPPED,
      `Order shipped with tracking number: ${fulfillmentDetails.trackingNumber}`
    );
  }

  return order.save();
};

orderSchema.statics.getOrderStats = async function (
  startDate: Date,
  endDate: Date
) {
  const result = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $nin: [OrderStatus.CANCELLED, OrderStatus.FAILED] },
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$totalPrice" },
        averageOrderValue: { $avg: "$totalPrice" },
      },
    },
  ]);

  // Get top products in this date range
  const topProducts = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $nin: [OrderStatus.CANCELLED, OrderStatus.FAILED] },
      },
    },
    { $unwind: "$orderItems" },
    {
      $group: {
        _id: "$orderItems.product",
        name: { $first: "$orderItems.name" },
        totalSold: { $sum: "$orderItems.quantity" },
        revenue: {
          $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] },
        },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 0,
        productId: { $toString: "$_id" },
        name: 1,
        totalSold: 1,
        revenue: { $round: ["$revenue", 2] },
      },
    },
  ]);

  return {
    totalOrders: result.length > 0 ? result[0].totalOrders : 0,
    totalRevenue: result.length > 0 ? result[0].totalRevenue : 0,
    averageOrderValue: result.length > 0 ? result[0].averageOrderValue : 0,
    topProducts,
  };
};

orderSchema.statics.getSalesByPeriod = async function (
  period: "day" | "week" | "month" | "year"
) {
  let dateFormat;
  let groupBy;

  switch (period) {
    case "day":
      dateFormat = "%Y-%m-%d";
      groupBy = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
      break;
    case "week":
      dateFormat = "%Y-W%U";
      groupBy = {
        year: { $year: "$createdAt" },
        week: { $week: "$createdAt" },
      };
      break;
    case "month":
      dateFormat = "%Y-%m";
      groupBy = {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
      break;
    case "year":
      dateFormat = "%Y";
      groupBy = { year: { $year: "$createdAt" } };
      break;
  }

  return this.aggregate([
    {
      $match: {
        status: { $nin: [OrderStatus.CANCELLED, OrderStatus.FAILED] },
      },
    },
    {
      $group: {
        _id: groupBy,
        period: {
          $first: { $dateToString: { format: dateFormat, date: "$createdAt" } },
        },
        orders: { $sum: 1 },
        revenue: { $sum: "$totalPrice" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 } },
    {
      $project: {
        _id: 0,
        period: 1,
        orders: 1,
        revenue: { $round: ["$revenue", 2] },
      },
    },
  ]);
};

// Middleware: Pre-save
orderSchema.pre("save", function (this: IOrder, next) {
  // Set billing address same as shipping if not provided
  if (!this.billingAddress && this.shippingAddress) {
    this.billingAddress = this.shippingAddress;
  }

  // Ensure status history is maintained
  if (this.isNew) {
    this.addStatusHistoryEvent(
      OrderStatus.PENDING,
      "Order created, awaiting payment"
    );
  }

  // Recalculate totals if order items changed
  if (
    this.isModified("orderItems") ||
    this.isModified("shippingPrice") ||
    this.isModified("taxInfo.taxRate") ||
    this.isModified("discountInfo")
  ) {
    this.calculateTotals();
  }

  // Update availability based on payment
  if (this.isModified("isPaid") && this.isPaid && this.paidAt === undefined) {
    this.paidAt = new Date();
  }

  // Update delivery status
  if (
    this.isModified("isDelivered") &&
    this.isDelivered &&
    this.deliveredAt === undefined
  ) {
    this.deliveredAt = new Date();
  }

  next();
});

const Order = model<IOrder, OrderModel>("Order", orderSchema);

export default Order;
