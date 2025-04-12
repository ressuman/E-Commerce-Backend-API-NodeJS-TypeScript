// src/controllers/cartController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import { AppError, asyncHandler } from "@/middlewares/asyncHandler.js";
import { formatCartResponse } from "@/utils/users.js";
import Cart from "@/models/cartModel.js";
import { addToCartSchema, updateCartItemSchema } from "@/utils/validate.js";
import Product from "@/models/productModel.js";

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  let cart = await Cart.findActiveCart(userId);

  if (!cart) {
    // Automatically create a new empty cart if none exists
    cart = await Cart.createCart(userId);
  }

  res.json({
    status: "success",
    data: formatCartResponse(cart),
  });
});

export const createCart = asyncHandler(async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cart = await Cart.createCart(req.user!._id.toString());
    await session.commitTransaction();

    res.status(201).json({
      status: "success",
      data: formatCartResponse(cart),
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export const addItemToCart = asyncHandler(
  async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { productId, quantity } = addToCartSchema.parse(req.body);

      if (!productId) {
        throw new AppError("Product ID is required", 400);
      }

      // Validate quantity
      if (quantity < 1) {
        throw new AppError("Quantity must be at least 1", 400);
      }

      const cart = await Cart.addItem(
        req.user!._id.toString(),
        productId,
        quantity,
        session
      );

      await session.commitTransaction();

      res.status(200).json({
        status: "success",
        data: formatCartResponse(cart),
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
);

export const updateCartItem = asyncHandler(
  async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { productId } = req.params;
      const { quantity } = updateCartItemSchema.parse(req.body);

      if (!quantity || quantity < 0) {
        throw new AppError("Quantity must be at least 0", 400);
      }

      if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
        throw new AppError("Invalid product ID", 400);
      }

      const cart = await Cart.updateItemQuantity(
        req.user!._id.toString(),
        productId,
        quantity,
        session
      );
      if (!cart) {
        throw new AppError("Cart or item not found", 404);
      }

      await session.commitTransaction();

      res.json({
        status: "success",
        data: formatCartResponse(cart),
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
);

export const removeCartItem = asyncHandler(
  async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { productId } = req.params;

      if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
        throw new AppError("Invalid product ID", 400);
      }

      const cart = await Cart.removeItem(
        req.user!._id.toString(),
        productId,
        session
      );
      if (!cart) {
        throw new AppError("Cart or item not found", 404);
      }

      await session.commitTransaction();

      res.json({
        status: "success",
        data: cart ? formatCartResponse(cart) : null,
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
);

export const clearCart = asyncHandler(async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cart = await Cart.clearCart(req.user!._id.toString(), session);
    if (!cart) {
      throw new AppError("Cart not found", 404);
    }

    await session.commitTransaction();

    res.json({
      status: "success",
      data: cart ? formatCartResponse(cart) : null,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export const validateCart = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await Cart.validateCart(req.user!._id.toString());

    res.json({
      status: "success",
      data: {
        valid: result.valid,
        issues: result.issues,
        meta: result.meta,
      },
    });
  }
);

export const applyDiscount = asyncHandler(
  async (req: Request, res: Response) => {
    const { code, value } = req.body;
    const cart = await Cart.applyDiscount(
      req.user!._id.toString(),
      code,
      value
    );

    res.json({
      status: "success",
      data: formatCartResponse(cart!),
    });
  }
);

export const getCartAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    const analytics = await Cart.getCartAnalytics();

    res.json({
      status: "success",
      data: analytics,
    });
  }
);

export const mergeCarts = asyncHandler(async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { sessionCartId } = req.body;
    const cart = await Cart.mergeCarts(
      req.user!._id.toString(),
      sessionCartId,
      session
    );

    await session.commitTransaction();

    res.json({
      status: "success",
      data: formatCartResponse(cart),
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export const refreshCartPrices = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await Cart.refreshCartPrices(req.user!._id.toString());

    res.json({
      status: "success",
      message: "Cart prices have been updated with current product prices",
      data: {
        updated: result.updated,
        cart: formatCartResponse(result.cart),
      },
    });
  }
);

export const reserveCart = asyncHandler(async (req: Request, res: Response) => {
  const { cartId } = req.params;
  const success = await Cart.reserveStock(cartId);

  res.json({
    status: "success",
    data: { reserved: success },
  });
});

export const markCartAsAbandoned = asyncHandler(
  async (req: Request, res: Response) => {
    const { cartId } = req.params;

    const cart = await Cart.markAsAbandoned(cartId);
    if (!cart) {
      throw new AppError("Cart not found", 404);
    }

    res.json({
      status: "success",
      message: "Cart marked as abandoned",
      data: formatCartResponse(cart!),
    });
  }
);

export const markCartAsConverted = asyncHandler(
  async (req: Request, res: Response) => {
    const { cartId } = req.params;

    const cart = await Cart.markAsConverted(cartId);
    if (!cart) {
      throw new AppError("Cart not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Cart marked as converted",
      data: formatCartResponse(cart),
    });
  }
);

export const getAbandonedCarts = asyncHandler(
  async (req: Request, res: Response) => {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 3;

    const abandonedCarts = await Cart.getAbandonedCarts(days);

    res.status(200).json({
      success: true,
      count: abandonedCarts.length,
      data: formatCartResponse(abandonedCarts),
      message: `Found ${abandonedCarts.length} abandoned carts older than ${days} days`,
    });
  }
);

export const checkCartInventory = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user.id;

    // Get user's cart
    const cart = await Cart.findByUserId(userId);

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: true,
        available: true,
        items: [],
        message: "Cart is empty",
      });
    }

    // Prepare items for inventory check
    const itemsToCheck = cart.items.map((item) => ({
      productId: item.product.toString(),
      qty: item.quantity,
    }));

    // Check inventory
    const inventoryStatus = await Product.checkInventory(itemsToCheck);

    // Check if any item is unavailable
    const allAvailable = inventoryStatus.every((item) => item.available);

    res.status(200).json({
      success: true,
      available: allAvailable,
      items: inventoryStatus,
      message: allAvailable
        ? "All items in cart are available"
        : "Some items in your cart are unavailable or insufficient stock",
    });
  }
);
