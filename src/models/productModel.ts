// src/models/productModel.ts
import { Document, Model, Schema, model, Types, ClientSession } from "mongoose";
import validator from "validator";
import Review from "./reviewModel.js";
import User, { UserRole } from "./userModel.js";
import { AppError } from "@/middlewares/asyncHandler.js";
import PriceHistory from "./priceHistoryModel.js";
import slugify from "slugify";
import { generateSKU } from "@/utils/helpers.js";

/**
 * Product Dimensions Interface
 * @param length - Product length in centimeters
 * @param width - Product width in centimeters
 * @param height - Product height in centimeters
 */
export interface ProductDimensions {
  length: number;
  width: number;
  height: number;
}

/**
 * Shipping Information Interface
 * @param weight - Product weight in grams
 * @param dimensions - Formatted dimensions string (LxWxH)
 * @param requiresShipping - Whether the product requires shipping
 */
export interface ShippingInfo {
  weight: number;
  dimensions: string;
  requiresShipping: boolean;
}

/**
 * Product Interface
 */
export interface IProduct extends Document {
  name: string; // Product display name
  slug: string; // SEO-friendly URL identifier (e.g., "premium-smartphone-2023")
  sku: string; // Unique stock keeping unit (e.g., "TSHIRT-BL-M")
  description: string; // Full product description
  price: number; // Current price in USD
  originalPrice?: number; // Original price for discounts
  images: string[]; // Array of Cloudinary URLs
  category: Types.ObjectId; // Reference to Category model
  brand: string; // Brand/manufacturer name
  manufacturer: string; // Original manufacturer
  weight: number; // Product weight in grams
  dimensions: ProductDimensions; // Physical dimensions
  stock: number; // Available quantity in inventory
  availability: "in-stock" | "out-of-stock" | "pre-order";
  tags: string[]; // Search/filter tags (e.g., ["smartphone", "android"])
  shippingInfo: ShippingInfo;
  searchScore?: number;
  ratingsAverage: number; // Calculated average rating
  ratingsQuantity: number; // Total number of ratings
  reviews: Types.ObjectId[]; // Reference to Review model
  isActive: boolean; // Product visibility
  isDeleted: boolean; // Soft delete flag
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductModel extends Model<IProduct> {
  // Query Methods
  findActive(): Promise<IProduct[]>;
  findDeleted(): Promise<IProduct[]>;
  findById(id: string): Promise<IProduct | null>;

  // CRUD Operations
  createProduct(data: Partial<IProduct>, userId: string): Promise<IProduct>;
  updateById(
    id: string,
    data: Partial<IProduct>,
    userId: string
  ): Promise<IProduct | null>;
  deleteById(id: string, userId: string): Promise<IProduct | null>;
  restoreById(id: string, userId: string): Promise<IProduct | null>;

  // Business Logic
  calculateAverageRating(productId: string): Promise<void>;
  searchProducts(
    query: string,
    filters: {
      minPrice?: number;
      maxPrice?: number;
      brands?: string[];
      categories?: string[];
    }
  ): Promise<IProduct[]>;
  findSimilarProducts(productId: string): Promise<IProduct[]>;
  isProductAvailable(id: string, quantity: number): Promise<boolean>;
  getProductsByBrand(brand: string): Promise<IProduct[]>;
  checkInventory(items: Array<{ productId: string; qty: number }>): Promise<
    Array<{
      productId: string;
      available: boolean;
      remainingStock: number;
    }>
  >;
  getProductAnalytics(): Promise<
    Array<{
      category: string;
      totalProducts: number;
      averagePrice: number;
    }>
  >;
  reserveStock(productId: string, quantity: number): Promise<boolean>;
  releaseStock(productId: string, quantity: number): Promise<boolean>;
  getTopProducts(limit?: number): Promise<IProduct[]>;
  getNewProducts(limit?: number): Promise<IProduct[]>;
  restoreById(id: string, userId: string): Promise<IProduct | null>;
  checkInventory(items: Array<{ productId: string; qty: number }>): Promise<
    Array<{
      productId: string;
      available: boolean;
      remainingStock: number;
    }>
  >;
}

const productSchema = new Schema<IProduct, ProductModel>(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
      index: "text",
    },
    slug: {
      type: String,
      unique: true,
      required: [true, "Slug is required"],
      validate: {
        validator: (v: string) => /^[a-z0-9-]+$/.test(v),
        message: "Slug must be lowercase letters, numbers, and hyphens only",
      },
    },
    sku: {
      type: String,
      unique: true,
      required: [true, "SKU is required"],
      validate: {
        validator: (v: string) => /^[A-Z0-9-]{8,}$/.test(v),
        message:
          "SKU must be uppercase letters, numbers, and hyphens (min 8 chars)",
      },
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      minlength: [50, "Description must be at least 50 characters"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0.01, "Price must be greater than 0"],
    },
    originalPrice: {
      type: Number,
      min: [0.01, "Price must be greater than 0"],
    },
    images: {
      type: [String],
      required: [true, "At least one product image is required"],
      validate: {
        validator: (images: string[]) =>
          images.every((url) => validator.isURL(url)) && images.length <= 10,
        message: "Invalid image URL(s) or maximum 10 images exceeded",
      },
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    brand: {
      type: String,
      required: [true, "Brand is required"],
      index: true,
    },
    manufacturer: {
      type: String,
      required: [true, "Manufacturer is required"],
    },
    weight: {
      type: Number,
      required: [true, "Weight is required"],
      min: [1, "Weight must be at least 1 gram"],
    },
    dimensions: {
      type: new Schema<ProductDimensions>({
        length: { type: Number, required: true, min: 1 },
        width: { type: Number, required: true, min: 1 },
        height: { type: Number, required: true, min: 1 },
      }),
      required: [true, "Dimensions are required"],
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
    },
    availability: {
      type: String,
      enum: ["in-stock", "out-of-stock", "pre-order"],
      default: "in-stock",
    },
    tags: {
      type: [String],
      required: [true, "At least one tag is required"],
      validate: {
        validator: (tags: string[]) => tags.length <= 20,
        message: "Maximum 20 tags allowed",
      },
    },
    shippingInfo: {
      type: new Schema<ShippingInfo>({
        weight: { type: Number, required: true },
        dimensions: { type: String, required: true },
        requiresShipping: { type: Boolean, default: true },
      }),
      required: [true, "Shipping information is required"],
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, "Rating must be at least 1.0"],
      max: [5, "Rating cannot exceed 5.0"],
      set: (val: number) => Math.round(val * 10) / 10, // 4.666 => 4.7
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    reviews: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Review",
        },
      ],
      validate: {
        validator: (reviews: Types.ObjectId[]) => reviews.length <= 500,
        message: "Maximum 500 reviews per product",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    searchScore: {
      type: Number,
      default: 0,
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
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
productSchema.index({ "shippingInfo.requiresShipping": 1 }); // Shipping filter
productSchema.index({ brand: 1, price: 1 }); // Brand/price filtering
productSchema.index({ reviews: 1 }); // Review lookup
productSchema.index({ category: 1, ratingsAverage: -1 }); // Category rankings
productSchema.index(
  {
    name: "text",
    description: "text",
    brand: "text",
    tags: "text",
  },
  {
    weights: {
      name: 10,
      brand: 7,
      tags: 5,
      description: 3,
    },
    name: "product_search_index",
  }
); // Combined text index

// Virtuals
productSchema.virtual("id").get(function (this: IProduct) {
  return this._id.toHexString();
});

productSchema.virtual("reviewsList", {
  ref: "Review",
  localField: "reviews",
  foreignField: "_id",
  match: { isDeleted: false },
});

// Add this to your existing pre-save hooks
productSchema.pre(/^find/, function () {
  this.populate({
    path: "reviews",
    select: "-__v -updatedAt -isDeleted",
    match: { isDeleted: false },
  });
});

// Static methods
productSchema.statics.findActive = function () {
  return this.find({ isDeleted: false, isActive: true })
    .populate("category", "id name slug")
    .populate("createdBy", "id username email")
    .lean();
};

productSchema.statics.findDeleted = function () {
  return this.find({ isDeleted: true })
    .populate("deletedBy", "username email role")
    .lean();
};

productSchema.statics.findById = function (id: string) {
  return this.findOne({ _id: id, isDeleted: false })
    .select("+stock")
    .populate("category", "id name slug")
    .populate("createdBy", "id username email");
};

productSchema.statics.createProduct = async function (
  data: Partial<IProduct>,
  userId: string
) {
  const productData = {
    ...data,
    createdBy: userId,
    updatedBy: userId,
  };

  return this.create(productData);
};

productSchema.statics.updateById = async function (
  id: string,
  data: Partial<IProduct>,
  userId: string
) {
  const product = await this.findOne({ _id: id, isDeleted: false });
  if (!product) throw new AppError("Product not found", 404);

  Object.assign(product, data);
  product.updatedBy = userId;
  return product.save();
};

productSchema.statics.deleteById = async function (id: string, userId: string) {
  const product = await this.findOne({ _id: id, isDeleted: false })
    .select("+stock")
    .populate("category", "name slug");

  if (!product) throw new AppError("Product not found", 404);
  if (product.stock > 0) {
    throw new AppError("Cannot delete product with existing stock", 400);
  }

  product.isActive = false;
  product.availability = "out-of-stock";

  product.isDeleted = true;
  product.deletedAt = new Date();
  product.deletedBy = userId;

  await product.save();
  return product;
};

productSchema.statics.findSimilarProducts = async function (productId: string) {
  const product = await this.findById(productId);
  if (!product) return [];

  return this.find({
    category: product.category, // Same category
    _id: { $ne: product._id }, // Exclude itself
    isDeleted: false,
  })
    .limit(10)
    .populate("category", "name slug");
};

productSchema.statics.getTopProducts = async function (limit = 10) {
  return this.find({
    isDeleted: false,
    isActive: true,
    ratingsAverage: { $gte: 4 }, // Only products with 4+ rating
  })
    .sort({ ratingsAverage: -1, createdAt: -1 })
    .limit(limit)
    .populate("category", "name slug")
    .populate("createdBy", "username email")
    .exec();
};

productSchema.statics.getNewProducts = async function (limit = 10) {
  return this.find({
    isDeleted: false,
    isActive: true,
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("category", "name slug")
    .populate("createdBy", "username email")
    .exec();
};

productSchema.statics.isProductAvailable = async function (
  productId: string,
  quantity: number
) {
  const product = await this.findById(productId).select("stock availability");

  return product?.stock >= quantity && product?.availability === "in-stock";
};

productSchema.statics.getProductsByBrand = function (brand: string) {
  return this.find({ brand, isDeleted: false })
    .populate("category", "name slug")
    .sort("-createdAt");
};

productSchema.statics.restoreById = async function (
  productId: string,
  userId: string
) {
  const product = await this.findOneAndUpdate(
    {
      _id: productId,
      isDeleted: true, // Only restore if product is soft-deleted
    },
    {
      $set: {
        isDeleted: false,
        isActive: true,
        availability: "in-stock",
        deletedAt: undefined,
        deletedBy: undefined,
      },
      $unset: {
        deletedAt: 1,
        deletedBy: 1,
      },
      updatedBy: userId,
    },
    { new: true }
  )
    .select("+stock")
    .populate("category", "name slug")
    .populate("createdBy", "username email");

  if (!product) return null;

  return product;
};

// 8. Review Calculation Middleware
productSchema.statics.calculateAverageRating = async function (
  productId: string,
  session: ClientSession | null = null
) {
  const stats = await Review.aggregate([
    {
      $match: {
        product: new Types.ObjectId(productId),
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: "$product",
        ratingsQuantity: { $sum: 1 },
        ratingsAverage: { $avg: "$rating" },
      },
    },
  ]).session(session!); // Enforce session usage

  const updateOps = {
    ratingsAverage: stats[0]?.ratingsAverage || 4.5,
    ratingsQuantity: stats[0]?.ratingsQuantity || 0,
  };

  await this.findByIdAndUpdate(
    productId,
    { $set: updateOps },
    { session, new: true, runValidators: true } // Maintain session context
  );
};

productSchema.statics.checkInventory = async function (
  items: Array<{ productId: string; qty: number }>
) {
  const productIds = items.map((item) => new Types.ObjectId(item.productId));

  // Get all products in single query
  const products = await this.find({
    _id: { $in: productIds },
    isDeleted: false,
  }).select("stock availability");

  return items.map((item) => {
    const product = products.find((p) => p._id.toString() === item.productId);

    const available = product
      ? product.stock >= item.qty && product.availability === "in-stock"
      : false;

    return {
      productId: item.productId,
      available,
      remainingStock: product?.stock || 0,
    };
  });
};
productSchema.statics.reserveStock = async function (
  productId: string,
  quantity: number
) {
  const product = await this.findById(productId).select("stock");

  if (!product) return null;
  if (product.stock < quantity) {
    throw new AppError("Not enough stock available", 400);
  }

  const updatedProduct = await this.findByIdAndUpdate(
    productId,
    {
      $inc: { stock: -quantity },
      $set: {
        availability:
          product.stock - quantity > 0 ? "in-stock" : "out-of-stock",
      },
    },
    { new: true }
  ).select("stock availability");

  return updatedProduct;
};

productSchema.statics.releaseStock = async function (
  productId: string,
  quantity: number
) {
  const product = await this.findById(productId).select("stock");
  if (!product) return null;

  const updatedProduct = await this.findByIdAndUpdate(
    productId,
    {
      $inc: { stock: quantity },
      $set: {
        availability:
          product.stock + quantity > 0 ? "in-stock" : "out-of-stock",
      },
    },
    { new: true }
  ).select("stock availability");

  return updatedProduct;
};

productSchema.statics.searchProducts = async function (
  query: string,
  filters = {}
) {
  return this.find(
    { $text: { $search: query }, ...filters },
    { score: { $meta: "textScore" } }
  )
    .select("+stock")
    .sort({ score: { $meta: "textScore" } })
    .populate("category", "name slug")
    .lean();
};

productSchema.statics.paginate = async function (
  filter: Record<string, any>,
  options: {
    page: number;
    limit: number;
    sort?: any;
    projection?: any;
  }
) {
  const [results, total] = await Promise.all([
    this.find(filter)
      .select(options.projection || "") // Add projection
      .sort(options.sort || "-createdAt") // Updated sorting
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .populate("category", "name slug")
      .populate("createdBy", "username email")
      .lean(),
    this.countDocuments(filter),
  ]);

  return {
    docs: results,
    total,
    pages: Math.ceil(total / options.limit),
    page: options.page,
    limit: options.limit,
  };
};
productSchema.statics.getProductAnalytics = async function () {
  return this.aggregate([
    {
      $group: {
        _id: "$category",
        totalProducts: { $sum: 1 },
        averagePrice: { $avg: "$price" },
        totalStock: { $sum: "$stock" },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: "$category",
    },
    {
      $project: {
        category: "$category.name",
        totalProducts: 1,
        averagePrice: { $round: ["$averagePrice", 2] },
        totalStock: 1,
      },
    },
  ]);
};

// 9. Post-Save Hook for Reviews
productSchema.pre("save", async function (next) {
  const session = this.$session();

  try {
    // Track if we need to recalculate ratings
    let shouldRecalculateRatings = false;

    if (!this.isNew) {
      const modifiedPaths = this.modifiedPaths();

      // 1. Price Change Handling with Authorization
      if (modifiedPaths.includes("price")) {
        const originalDoc = await this.constructor
          .findById(this._id)
          .session(session);
        const previousPrice = originalDoc?.price;

        if (previousPrice && previousPrice !== this.price) {
          // Authorization check for price decreases
          if (this.price < previousPrice) {
            const user = await User.findById(this.updatedBy)
              .select("role permissions")
              .session(session)
              .orFail(new AppError("User not found", 404));

            if (
              !(
                user.role === UserRole.ADMIN ||
                user.permissions.canManagePricing
              )
            ) {
              throw new AppError("Unauthorized price reduction", 403);
            }
          }

          // Log price history within transaction
          await PriceHistory.create(
            [
              {
                product: this._id,
                oldPrice: previousPrice,
                newPrice: this.price,
                changedBy: this.updatedBy || this.createdBy,
              },
            ],
            { session }
          );
        }
      }

      // 2. Review Updates Handling
      if (this.isModified("reviews")) {
        shouldRecalculateRatings = true;
      }
    }

    // 3. Stock Updates Handling
    if (this.isModified("stock")) {
      if (this.stock < 0) {
        throw new AppError("Stock cannot be negative", 400);
      }
      this.availability = this.stock > 0 ? "in-stock" : "out-of-stock";
    }

    // 5. Post-save operations
    if (shouldRecalculateRatings) {
      await (this.constructor as ProductModel).calculateAverageRating(
        this._id.toString(),
        session
      );
    }

    next();
  } catch (error: any) {
    next(error);
  }
});

productSchema.pre("validate", function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }

  if (!this.sku && this.name && this.category) {
    this.sku = generateSKU(this.name, this.category);
  }

  next();
});

productSchema.pre("validate", async function (next) {
  try {
    // Only run for existing documents (updates)
    if (!this.isNew && this.isModified("price")) {
      const currentPrice = this.price;
      const previousPrice = this.get("price", null, { defaults: false });

      // Only validate price decreases
      if (previousPrice !== null && currentPrice < previousPrice) {
        const user = await this.model("User")
          .findById(this.updatedBy)
          .select("role permissions");

        if (!user) return next(new Error("User not found"));

        const isAuthorized =
          user.role === UserRole.ADMIN || user.permissions.canManagePricing;

        if (!isAuthorized) {
          return next(
            new AppError(
              "Price decreases require admin privileges or pricing management permission",
              403
            )
          );
        }
      }
    }
    next();
  } catch (error: any) {
    next(error);
  }
});

const Product = model<IProduct, ProductModel>("Product", productSchema);

export default Product;
