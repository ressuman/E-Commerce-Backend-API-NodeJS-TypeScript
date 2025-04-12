// src/models/cartModel.ts
import { Document, Model, Schema, model, Types, ClientSession } from "mongoose";
import Product, { IProduct } from "./productModel.js";
import User, { IUser } from "./userModel.js";
import { AppError } from "@/middlewares/asyncHandler.js";

/**
 * Cart Item Interface
 */
export interface ICartItem {
  product: Types.ObjectId | IProduct;
  quantity: number;
  priceAtAddition: number; // Price at the time of addition
  nameAtAddition: string; // Name of the product at the time of addition
  image: string; // Image URL of the product at the time of addition
  addedAt: Date;
  discount?: {
    code: string;
    amount: number; // Percentage or fixed amount
    type: "percentage" | "fixed";
  };
}

/**
 * Cart Interface
 */
export interface ICart extends Document {
  user: Types.ObjectId | IUser;
  items: ICartItem[];
  totalQuantity: number;
  totalPrice: number;
  subTotal: number; // Sum of (item price * quantity)
  currency: string;
  discounts: Types.Map<number>;
  lastUpdated: Date;
  expiresAt: Date;
  lastActive: Date; // Track when cart was last modified
  status: "active" | "abandoned" | "converted"; // Cart status
  isActive: boolean;
  isDeleted: boolean; // Flag to mark cart for deletion
  deletedAt?: Date;
  deletedBy?: Types.ObjectId | IUser;
  createdBy: Types.ObjectId | IUser;
  updatedBy?: Types.ObjectId | IUser;
  createdAt: Date;
  updatedAt: Date;
  sessionId?: string; // For guest users

  // Virtuals
  id: string;
}

export interface CartModel extends Model<ICart> {
  // Core Methods
  findByUserId(userId: string): Promise<ICart | null>;
  findActiveCart(userId: string): Promise<ICart | null>;
  getCartByUser(userId: string): Promise<ICart | null>;
  createCart(userId: string): Promise<ICart>;
  addItem(
    userId: string,
    productId: string,
    quantity: number,
    session?: ClientSession
  ): Promise<ICart>;
  removeItem(
    userId: string,
    productId: string,
    session?: ClientSession
  ): Promise<ICart | null>;
  updateItemQuantity(
    userId: string,
    productId: string,
    quantity: number,
    session?: ClientSession
  ): Promise<ICart | null>;
  refreshCartPrices(userId: string): Promise<ICart>;
  // Cart Status
  markAsAbandoned(cartId: string): Promise<ICart | null>;
  markAsConverted(cartId: string): Promise<ICart | null>;
  createOrUpdateCart(
    userId: string,
    items: Array<{ productId: string; quantity: number }>,
    session?: ClientSession
  ): Promise<ICart>;
  mergeCarts(
    userId: string,
    sessionCartId: string,
    session?: ClientSession
  ): Promise<ICart>;
  clearCart(userId: string, session?: ClientSession): Promise<ICart | null>;
  applyDiscount(
    userId: string,
    code: string,
    value: number
  ): Promise<ICart | null>;
  getCartSummary(userId: string): Promise<{
    totalItems: number;
    totalPrice: number;
    currency: string;
  }>;
  getAbandonedCarts(days: number): Promise<ICart[]>;
  getCartAnalytics(): Promise<{
    totalCarts: number;
    activeCarts: number;
    abandonedCarts: number;
    convertedCarts: number;
    averageCartValue: number;
  }>;
  reserveStock(cartId: string): Promise<boolean>;
  releaseStock(cartId: string): Promise<boolean>;
  validateCartStock(cartId: string): Promise<
    Array<{
      productId: string;
      available: boolean;
      required: number;
      availableStock: number;
    }>
  >;
  validateCart(userId: string): Promise<{
    valid: boolean;
    issues: Array<{ productId: string; message: string }>;
  }>;
  calculateCartTotals(cartId: string, session?: ClientSession): Promise<ICart>;
  convertGuestCart(userId: string, sessionId: string): Promise<ICart>;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      max: [100, "Maximum 100 items per product"],
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer",
      },
    },
    priceAtAddition: {
      type: Number,
      required: [true, "Price at add time is required"],
      min: [0, "Price cannot be negative"],
    },
    nameAtAddition: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    image: {
      type: String,
      required: [true, "Product image is required"],
      trim: true,
      validate: {
        validator: (v: string) =>
          /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(v),
        message: "Invalid image URL format",
      },
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    discount: {
      code: {
        type: String,
        maxlength: [20, "Discount code cannot exceed 20 characters"],
      },
      amount: {
        type: Number,
        min: [0, "Discount amount cannot be negative"],
      },
      type: {
        type: String,
        enum: {
          values: ["percentage", "fixed"],
          message: "Discount type must be either 'percentage' or 'fixed'",
        },
      },
    },
  },
  {
    _id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const cartSchema = new Schema<ICart, CartModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: function () {
        return !this.sessionId; // User is required unless it's a guest cart
      },
      validate: {
        validator: function (this: ICart, v: Types.ObjectId) {
          return !this.sessionId || v;
        },
        message: "User is required for authenticated carts",
      },
    },
    items: {
      type: [cartItemSchema],
      validate: {
        validator: (items: ICartItem[]) => items.length <= 100,
        message: "Maximum 100 different products in cart",
      },
    },
    totalQuantity: {
      type: Number,
      default: 0,
      min: [0, "Total quantity cannot be negative"],
    },
    totalPrice: {
      type: Number,
      default: 0,
      min: [0, "Total price cannot be negative"],
    },
    subTotal: {
      type: Number,
      default: 0,
      min: [0, "Subtotal cannot be negative"],
    },
    currency: {
      type: String,
      default: "USD",
      enum: {
        values: ["USD", "EUR", "GBP", "GHS", "NGN"],
        message: "Unsupported currency type",
      },
    },
    discounts: {
      type: Map,
      of: {
        type: Number,
        min: [0, "Discount value cannot be negative"],
        max: [100, "Discount cannot exceed 100%"],
      },
      default: {},
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      index: { expireAfterSeconds: 0 },
      validate: {
        validator: function (this: ICart, v: Date) {
          return v > new Date();
        },
        message: "Expiration date must be in the future",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: {
        values: ["active", "abandoned", "converted"],
        message: "Invalid cart status",
      },
      default: "active",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator reference is required"],
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    sessionId: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes
cartSchema.index({ user: 1, isActive: 1 });
cartSchema.index({ updatedAt: 1 });
//cartSchema.index({ "items.product": 1 });
cartSchema.index({ createdAt: -1 });

// Virtuals
cartSchema.virtual("id").get(function (this: ICart) {
  return this._id.toHexString();
});

cartSchema.virtual("itemCount").get(function (this: ICart) {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Pre-save hooks
// Pre-validate hook to check product availability
cartSchema.pre("validate", async function (next) {
  if (this.isModified("items")) {
    const productIds = this.items.map((item) => item.product);
    const products = await Product.find({
      _id: { $in: productIds },
      isDeleted: false,
      isActive: true,
    }).select("price stock availability");

    for (const item of this.items) {
      const product = products.find(
        (p) => p._id.toString() === item.product.toString()
      );
      if (!product) {
        return next(new AppError(`Product ${item.product} not found`, 404));
      }
      if (
        product.availability !== "in-stock" ||
        product.stock < item.quantity
      ) {
        return next(
          new AppError(
            `Product ${product.name} is not available in requested quantity`,
            400
          )
        );
      }
      // Set price at add time
      if (!item.priceAtAdd) {
        item.priceAtAdd = product.price;
      }
    }
  }
  next();
});

cartSchema.pre<ICart>("save", async function (next) {
  if (this.isModified("items")) {
    try {
      const productIds = this.items.map((item) => item.product);
      const products = await Product.find({
        _id: { $in: productIds },
        isDeleted: false,
      }).select("name price stock availability");

      // Validate stock and prices
      for (const item of this.items) {
        const product = products.find((p) => p._id.equals(item.product));
        if (!product) {
          return next(new AppError(`Product ${item.product} not found`, 404));
        }

        if (
          product.stock < item.quantity ||
          product.availability !== "in-stock"
        ) {
          return next(
            new AppError(
              `Insufficient stock for ${product.name}. Available: ${product.stock}`,
              400
            )
          );
        }

        // Price change validation with 10% threshold
        const priceDifference = Math.abs(item.priceAtAddition - product.price);
        if (priceDifference / item.priceAtAddition > 0.1) {
          return next(
            new AppError(
              `Price changed significantly for ${product.name} (Was: ${item.priceAtAddition}, Now: ${product.price})`,
              400
            )
          );
        }
      }
      next();
    } catch (error) {
      next(
        error instanceof Error ? error : new Error("Cart validation failed")
      );
    }
  } else {
    next();
  }
});

// 2. Combined Totals Calculation Hook (Replaces multiple calculation hooks)
cartSchema.pre<ICart>("save", async function (next) {
  if (this.isModified("items")) {
    try {
      // Calculate base totals
      this.subTotal = this.items.reduce(
        (sum, item) => sum + item.quantity * item.priceAtAddition,
        0
      );

      this.totalQuantity = this.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      // Apply discounts
      let discountedTotal = this.subTotal;

      // Item-level discounts
      discountedTotal = this.items.reduce((sum, item) => {
        let price = item.quantity * item.priceAtAddition;
        if (item.discount) {
          price =
            item.discount.type === "percentage"
              ? price * (1 - item.discount.amount / 100)
              : Math.max(price - item.discount.amount, 0);
        }
        return sum + price;
      }, 0);

      // Global discounts
      Array.from(this.discounts.entries()).forEach(([_, value]) => {
        discountedTotal *= 1 - value / 100;
      });

      // Finalize totals
      this.totalPrice = Math.round(discountedTotal * 100) / 100;
      this.lastUpdated = new Date();
      this.lastActive = new Date();

      next();
    } catch (error) {
      next(
        error instanceof Error ? error : new Error("Cart calculation error")
      );
    }
  } else {
    next();
  }
});

// Static Methods
cartSchema.statics.findActiveCart = function (userId: string) {
  return this.findOne({ user: userId, isActive: true })
    .populate({
      path: "items.product",
      select: "name price stock images",
    })
    .lean();
};

cartSchema.statics.findByUserId = async function (userId: string) {
  return this.findOne({ user: userId, isDeleted: false }).populate({
    path: "items.product",
    select: "name price images stock availability",
    match: { isDeleted: false, isActive: true },
  });
};

cartSchema.statics.createCart = async function (userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);

  // Check if user already has a cart
  const existingCart = await this.findOne({
    user: userId,
    isActive: true,
    isDeleted: false,
  });
  if (existingCart) {
    if (existingCart) throw new AppError("Active cart already exists", 400);
    return existingCart;
  }

  // Create a new cart
  return this.create({
    user: userId,
    items: [],
    lastActive: new Date(),
    createdBy: userId,
  });
};

cartSchema.statics.createOrUpdateCart = async function (
  userId: string,
  items: Array<{ productId: string; quantity: number }>,
  session?: ClientSession
) {
  const productIds = items.map((item) => new Types.ObjectId(item.productId));
  const products = await Product.find({ _id: { $in: productIds } })
    .select("price name images")
    .session(session || null);

  const cartItems = items.map((item) => {
    const product = products.find((p) => p._id.equals(item.productId));
    if (!product) {
      throw new AppError(`Product ${item.productId} not found`, 404);
    }

    // Select first image with fallback
    const productImage =
      product.images.length > 0
        ? product.images[0]
        : "/default-product-image.jpg"; // Add appropriate default

    return {
      product: product._id,
      quantity: item.quantity,
      priceAtAddition: product.price,
      nameAtAddition: product.name,
      image: productImage, // Store first image only
    };
  });

  return this.findOneAndUpdate(
    { user: userId, isActive: true },
    {
      $set: { items: cartItems },
      $setOnInsert: { user: userId, isActive: true },
    },
    {
      new: true,
      upsert: true,
      session,
      populate: {
        path: "items.product",
        select: "name price stock images",
      },
    }
  );
};

cartSchema.statics.clearCart = async function (
  userId: string,
  session?: ClientSession
) {
  const cart = await this.findOne({
    user: userId,
    isActive: true,
    isDeleted: false,
  }).session(session);
  if (!cart) throw new AppError("Cart not found", 404);

  cart.items = [];
  cart.updatedBy = userId;
  await cart.save({ session });
  return cart;
};

cartSchema.statics.mergeCarts = async function (
  userId: string,
  sessionCartId: string,
  session?: ClientSession
) {
  const sessionCart = await this.findById(sessionCartId)
    .session(session)
    .select("items");

  if (!sessionCart) throw new AppError("Session cart not found", 404);

  const userCart = await this.findOne({ user: userId })
    .session(session)
    .select("items");

  const bulkOps = [];

  // If user cart exists, merge items
  if (userCart) {
    const productIds = [
      ...new Set([
        ...userCart.items.map((i) => i.product.toString()),
        ...sessionCart.items.map((i) => i.product.toString()),
      ]),
    ];

    const products = await Product.find({ _id: { $in: productIds } })
      .session(session)
      .select("price stock availability");

    // Create update operation for each product
    productIds.forEach((productId) => {
      const sessionItem = sessionCart.items.find(
        (i) => i.product.toString() === productId
      );
      const userItem = userCart.items.find(
        (i) => i.product.toString() === productId
      );

      const product = products.find((p) => p._id.toString() === productId);

      if (!product) return;

      const newQuantity = Math.min(
        (userItem?.quantity || 0) + (sessionItem?.quantity || 0),
        product.stock
      );

      if (newQuantity > 0) {
        bulkOps.push({
          updateOne: {
            filter: {
              _id: userCart._id,
              "items.product": productId,
            },
            update: {
              $set: {
                "items.$.quantity": newQuantity,
                "items.$.priceAtAddition": product.price,
                "items.$.nameAtAddition": product.name,
                "items.$.image": product.images[0] || "",
              },
            },
          },
        });
      }
    });

    // Add new items that don't exist in user cart
    sessionCart.items.forEach((item) => {
      if (
        !userCart.items.some(
          (i) => i.product.toString() === item.product.toString()
        )
      ) {
        bulkOps.push({
          updateOne: {
            filter: { _id: userCart._id },
            update: {
              $push: {
                items: {
                  product: item.product,
                  quantity: item.quantity,
                  priceAtAddition: item.priceAtAddition,
                  nameAtAddition: item.nameAtAddition,
                  image: item.image,
                  addedAt: new Date(),
                },
              },
            },
          },
        });
      }
    });

    // Execute bulk operations
    if (bulkOps.length > 0) {
      await this.bulkWrite(bulkOps, { session });
    }

    // Delete session cart
    await this.deleteOne({ _id: sessionCartId }).session(session);

    return this.findById(userCart._id)
      .session(session)
      .populate("items.product");
  } else {
    // Convert session cart to user cart
    return this.findByIdAndUpdate(
      sessionCartId,
      {
        $set: {
          user: userId,
          sessionId: null,
          updatedBy: userId,
        },
      },
      { new: true, session }
    ).populate("items.product");
  }
};

cartSchema.statics.addItem = async function (
  userId: string,
  productId: string,
  quantity: number,
  session?: ClientSession
) {
  const product = await Product.findById(productId)
    .session(session)
    .select("price name images stock availability");

  if (!product) throw new AppError("Product not found", 404);
  if (product.stock < quantity) {
    throw new AppError(
      `Only ${product.stock} items available for ${product.name}`,
      400
    );
  }

  const cart = await this.findOneAndUpdate(
    { user: userId, isActive: true },
    {
      $setOnInsert: {
        user: userId,
        createdBy: userId,
        currency: "USD",
        isActive: true,
      },
    },
    { upsert: true, new: true, session }
  ).populate("items.product");

  const existingItemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  if (existingItemIndex > -1) {
    const newQty = cart.items[existingItemIndex].quantity + quantity;
    cart.items[existingItemIndex].quantity = Math.min(newQty, product.stock);
  } else {
    cart.items.push({
      product: product._id,
      quantity: Math.min(quantity, product.stock),
      priceAtAddition: product.price,
      nameAtAddition: product.name,
      image: product.images[0] || "",
      addedAt: new Date(),
    });
  }

  return cart.save({ session });
};

cartSchema.statics.removeItem = async function (
  userId: string,
  productId: string,
  session?: ClientSession
) {
  const cart = await this.findOne({
    user: userId,
    isActive: true,
    isDeleted: false,
  }).session(session);
  if (!cart) {
    throw new AppError("Cart not found", 404);
  }

  // Remove item from cart
  cart.items = cart.items.filter(
    (item) => item.product.toString() !== productId
  );

  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );
  if (itemIndex === -1) throw new AppError("Item not found in cart", 404);

  cart.items.splice(itemIndex, 1);
  cart.updatedBy = userId;

  await cart.save({ session });
  return cart;
};

cartSchema.statics.updateItemQuantity = async function (
  userId: string,
  productId: string,
  quantity: number,
  session?: ClientSession
) {
  const cart = await this.findOne({
    user: userId,
    isActive: true,
    isDeleted: false,
  }).session(session);
  if (!cart) {
    throw new AppError("Cart not found", 404);
  }

  // Find item in cart
  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  if (itemIndex === -1) {
    throw new AppError("Item not found in cart", 404);
  }

  // Verify stock availability
  const product = await Product.findById(productId);
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  if (quantity > product.stock) {
    throw new AppError(`Only ${product.stock} items available in stock`, 400);
  }

  if (quantity <= 0) {
    // Remove item if quantity is 0 or negative
    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );
  } else {
    // Update quantity
    cart.items[itemIndex].quantity = quantity;
  }

  if (quantity <= 0) {
    cart.items.splice(itemIndex, 1);
  } else {
    const product = await Product.findById(productId)
      .select("stock availability")
      .session(session);
    if (!product) throw new AppError("Product not found", 404);
    if (product.stock < quantity || product.availability !== "in-stock") {
      throw new AppError("Product not available in requested quantity", 400);
    }
    cart.items[itemIndex].quantity = quantity;
  }

  cart.updatedBy = userId;

  await cart.save({ session });
  return cart;
};

cartSchema.statics.refreshCartPrices = async function (userId: string) {
  const cart = await this.findOne({ user: userId }).populate({
    path: "items.product",
    select: "price name images",
  });

  if (!cart) throw new AppError("Cart not found", 404);

  let priceChanges = 0;
  const newItems = cart.items.map((item) => {
    const product = item.product as IProduct;
    if (product.price !== item.priceAtAddition) {
      priceChanges++;
      return {
        ...item.toObject(),
        priceAtAddition: product.price,
        nameAtAddition: product.name,
        image: product.images[0] || item.image,
      };
    }
    return item;
  });

  if (priceChanges > 0) {
    cart.items = newItems;
    await cart.save();
  }

  return {
    updated: priceChanges,
    cart: cart.toObject(),
  };
};

cartSchema.statics.markAsAbandoned = async function (cartId: string) {
  return this.findByIdAndUpdate(cartId, { status: "abandoned" }, { new: true });
};

cartSchema.statics.markAsConverted = async function (cartId: string) {
  return this.findByIdAndUpdate(cartId, { status: "converted" }, { new: true });
};

cartSchema.statics.getAbandonedCarts = async function (days = 3) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return this.find({
    status: "active",
    lastActive: { $lt: cutoffDate },
    items: { $exists: true, $ne: [] },
    isDeleted: false,
  })
    .populate("user", "email name")
    .populate({
      path: "items.product",
      select: "name price images",
    })
    .sort({ lastActive: 1 });
};

cartSchema.statics.getCartAnalytics = async function () {
  const aggregateResult = await this.aggregate([
    {
      $match: { isDeleted: false },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalValue: { $sum: "$subtotal" },
      },
    },
  ]);

  // Transform into desired format
  const analytics = {
    totalCarts: 0,
    activeCarts: 0,
    abandonedCarts: 0,
    convertedCarts: 0,
    averageCartValue: 0,
  };

  let totalSubtotal = 0;

  aggregateResult.forEach((result) => {
    switch (result._id) {
      case "active":
        analytics.activeCarts = result.count;
        break;
      case "abandoned":
        analytics.abandonedCarts = result.count;
        break;
      case "converted":
        analytics.convertedCarts = result.count;
        break;
    }

    analytics.totalCarts += result.count;
    totalSubtotal += result.totalValue;
  });

  if (analytics.totalCarts > 0) {
    analytics.averageCartValue = parseFloat(
      (totalSubtotal / analytics.totalCarts).toFixed(2)
    );
  }

  return analytics;
};

cartSchema.statics.reserveStock = async function (cartId: string) {
  const session = await this.startSession();
  session.startTransaction();

  try {
    const cart = await this.findById(cartId).session(session);
    if (!cart) throw new AppError("Cart not found", 404);

    // Reserve stock for each item
    await Promise.all(
      cart.items.map(async (item) => {
        const product = await Product.findById(item.product).session(session);
        if (!product) throw new AppError("Product not found", 404);

        if (product.stock < item.quantity) {
          throw new AppError(`Insufficient stock for ${product.name}`, 400);
        }

        product.stock -= item.quantity;
        await product.save({ session });
      })
    );

    await session.commitTransaction();
    return true;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

cartSchema.statics.validateCart = async function (userId: string) {
  const cart = await this.findOne({ user: userId }).populate({
    path: "items.product",
    select: "name price stock availability isActive",
    match: { isActive: true, isDeleted: false },
  });

  if (!cart)
    return {
      valid: false,
      issues: [{ code: "NO_CART", message: "Cart not found" }],
    };

  const issues = [];
  const now = new Date();

  // Price validity check (within 24 hours)
  if (cart.lastUpdated < new Date(now.setHours(now.getHours() - 24))) {
    issues.push({
      code: "PRICES_EXPIRED",
      message: "Cart prices need refreshing",
      actionRequired: true,
    });
  }

  // Inventory validation
  for (const item of cart.items) {
    const product = item.product as IProduct;

    if (!product) {
      issues.push({
        code: "PRODUCT_NOT_FOUND",
        productId: item.product.toString(),
        message: "Product no longer available",
      });
      continue;
    }

    if (product.availability !== "in-stock") {
      issues.push({
        code: "OUT_OF_STOCK",
        productId: product._id.toString(),
        message: `${product.name} is out of stock`,
      });
    }

    if (product.stock < item.quantity) {
      issues.push({
        code: "INSUFFICIENT_STOCK",
        productId: product._id.toString(),
        message: `Only ${product.stock} ${product.name} available`,
      });
    }

    if (product.price !== item.priceAtAddition) {
      issues.push({
        code: "PRICE_CHANGED",
        productId: product._id.toString(),
        message: `${product.name} price changed from ${item.priceAtAddition} to ${product.price}`,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    meta: {
      itemCount: cart.items.length,
      totalPrice: cart.totalPrice,
      currency: cart.currency,
    },
  };
};

cartSchema.statics.calculateCartTotals = async function (
  cartId: string,
  session?: ClientSession
) {
  const cart = await this.findById(cartId).session(session);
  if (!cart) throw new AppError("Cart not found", 404);

  cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  cart.totalAmount = cart.items.reduce(
    (sum, item) => sum + item.quantity * item.priceAtAdd,
    0
  );

  return cart.save({ session });
};

const Cart = model<ICart, CartModel>("Cart", cartSchema);

export default Cart;
