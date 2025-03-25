// src/controllers/productControllers.ts
import { AppError, asyncHandler } from "@/middlewares/asyncHandler.js";
import Product from "@/models/productModel.js";
import { generateSKU } from "@/utils/helpers.js";
import { formatProductResponse, formatUserResponse } from "@/utils/users.js";
import {
  inventoryCheckSchema,
  productCreateSchema,
  productSearchSchema,
  productUpdateSchema,
  reserveStockSchema,
} from "@/utils/validate.js";
import { Request, Response } from "express";
import slugify from "slugify";

export const createProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user!;

    const validated = productCreateSchema.parse(req.body);

    // Generate slug if not provided
    const slug =
      validated.slug ||
      slugify(validated.name, {
        lower: true,
        strict: true,
      });

    // Generate SKU if not provided
    const sku =
      validated.sku || generateSKU(validated.name, validated.category);

    const productData = {
      ...validated,
      slug,
      sku,
      createdBy: user._id,
      availability:
        validated.availability ||
        (validated.stock > 0 ? "in-stock" : "out-of-stock"),
    };

    const product = await Product.create({
      ...productData,
      createdBy: user._id,
      updatedBy: user._id,
    });

    const populated = await Product.findById(product.id)
      .populate("category", "name slug")
      .populate("createdBy", "username email")
      .exec();

    if (!populated) throw new AppError("Product creation failed", 500);

    res.status(201).json({
      status: "success",
      data: formatProductResponse(populated),
    });
  }
);

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    search,
    category,
    minPrice,
    maxPrice,
    q: searchQuery,
  } = req.query;

  const filter: Record<string, any> = {
    isDeleted: false,
    isActive: true,
  };

  // Text search configuration
  let textSearchConfig = {};

  if (search || searchQuery) {
    const query = (search || searchQuery) as string;
    filter.$text = { $search: query };
    textSearchConfig = {
      projection: { score: { $meta: "textScore" } },
      sort: { score: { $meta: "textScore" } },
    };
  }

  if (category) filter.category = category;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const options = {
    page: parseInt(page as string),
    limit: parseInt(limit as string),
    ...textSearchConfig, // Spread text search config
    populate: [
      { path: "category", select: "name slug" },
      { path: "createdBy", select: "username email" },
    ],
  };

  const result = await Product.paginate(filter, options);

  res.json({
    status: "success",
    data: {
      ...result,
      docs: result.docs.map((p) => ({
        ...formatProductResponse(p),
        searchScore: p.score || undefined, // Now includes search score
      })),
    },
  });
});

export const getAllProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { page = 1, limit = 10 } = req.query;

    const filter: Record<string, any> = {
      isDeleted: false, // Show both active/inactive but not deleted
    };

    const options = {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      populate: [
        { path: "category", select: "name slug" },
        { path: "createdBy", select: "username email" },
      ],
    };

    const result = await Product.paginate(filter, options);

    res.json({
      status: "success",
      data: {
        ...result,
        docs: result.docs.map(formatProductResponse),
      },
    });
  }
);

export const getProductDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const product = await Product.findById(req.params.productId)
      .populate("category", "name slug")
      .populate("createdBy", "username email")
      .populate("reviews", "rating comment");

    if (!product || product.isDeleted) {
      throw new AppError("Product not found", 404);
    }

    res.json({
      status: "success",
      data: formatProductResponse(product),
    });
  }
);

export const updateProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = productUpdateSchema.parse(req.body);
    const product = await Product.updateById(
      req.params.productId,
      validated,
      req.user!._id.toString()
    );

    if (!product) throw new AppError("Product not found", 404);

    const populated = await Product.findById(product.id)
      .populate("category", "name slug")
      .populate("createdBy", "username email");

    res.json({
      status: "success",
      data: formatProductResponse(populated!),
    });
  }
);

export const reserveStock = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId, quantity } = reserveStockSchema.parse(req.body);

    const product = await Product.reserveStock(productId, quantity);

    if (!product)
      throw new AppError("Product not found or insufficient stock", 404);

    res.json({
      status: "success",
      data: {
        reserved: quantity,
        remainingStock: product.stock,
        availability: product.availability,
      },
    });
  }
);

export const releaseStock = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId, quantity } = reserveStockSchema.parse(req.body);

    const product = await Product.releaseStock(productId, quantity);

    if (!product) throw new AppError("Product not found", 404);

    res.json({
      status: "success",
      data: {
        released: quantity,
        remainingStock: product.stock,
        availability: product.availability,
      },
    });
  }
);

export const getProductsByBrand = asyncHandler(
  async (req: Request, res: Response) => {
    const products = await Product.getProductsByBrand(req.params.brand);

    res.json({
      status: "success",
      count: products.length,
      data: products.map(formatProductResponse),
    });
  }
);

export const searchProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const validated = productSearchSchema.parse(req.query); // ✅ Get from query params

    const filter: any = {
      $text: { $search: validated.q },
      isDeleted: false,
      isActive: true,
    };

    // Handle price range
    if (validated.minPrice || validated.maxPrice) {
      filter.price = {};
      if (validated.minPrice) filter.price.$gte = validated.minPrice;
      if (validated.maxPrice) filter.price.$lte = validated.maxPrice;
    }

    // Handle brands
    if (validated.brands) {
      filter.brand = { $in: validated.brands.split(",") };
    }

    const products = await Product.find(filter, {
      score: { $meta: "textScore" },
    })
      .sort({ score: { $meta: "textScore" } })
      .select("+stock")
      .populate("category", "name slug")
      .lean();

    res.json({
      status: "success",
      data: products.map((p) => ({
        ...formatProductResponse(p),
        searchScore: p.score,
      })),
    });
  }
);

export const checkProductAvailability = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId, quantity } = reserveStockSchema.parse(req.body);

    const isAvailable = await Product.isProductAvailable(productId, quantity);

    res.json({
      status: "success",
      data: {
        available: isAvailable,
        productId,
      },
    });
  }
);

export const getSimilarProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const products = await Product.findSimilarProducts(req.params.productId);

    res.json({
      status: "success",
      count: products.length,
      data: products.map(formatProductResponse),
    });
  }
);

export const getTopProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const products = await Product.getTopProducts(req.query.limit as number);

    res.json({
      status: "success",
      data: products.map(formatProductResponse),
    });
  }
);

export const getNewProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const products = await Product.getNewProducts(req.query.limit as number);

    res.json({
      status: "success",
      data: products.map(formatProductResponse),
    });
  }
);

export const deleteProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const product = await Product.deleteById(
      req.params.productId,
      req.user!._id.toString()
    );

    res.json({
      status: "success",
      data: formatProductResponse(product),
    });
  }
);

export const getDeletedProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const products = await Product.findDeleted()
      .populate("deletedBy", "username email")
      .populate("category", "name slug");

    res.json({
      status: "success",
      count: products.length,
      data: products.map(formatProductResponse),
    });
  }
);

export const restoreProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const product = await Product.restoreById(
      req.params.productId,
      req.user!._id.toString()
    );

    if (!product) throw new AppError("Product not found in deleted items", 404);

    res.json({
      status: "success",
      data: formatProductResponse(product),
    });
  }
);

export const getProductAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    const analytics = await Product.getProductAnalytics();

    res.json({ status: "success", data: analytics });
  }
);

export const checkInventory = asyncHandler(
  async (req: Request, res: Response) => {
    const items = inventoryCheckSchema.parse(req.body);
    const inventory = await Product.checkInventory(items);

    const inventoryWithProducts = await Promise.all(
      inventory.map(async (item) => ({
        ...item,
        product: item.productId
          ? formatProductResponse(await Product.findById(item.productId))
          : null,
      }))
    );

    res.json({
      status: "success",
      data: inventoryWithProducts,
    });
  }
);
