// src/controllers/reviewAndPriceHistoryControllers.ts
import { Request, Response } from "express";
import Product from "@/models/productModel.js";
import Review from "@/models/reviewModel.js";
import PriceHistory from "@/models/priceHistoryModel.js";
import {
  paramsSchema,
  reviewCreateSchema,
  reviewUpdateSchema,
} from "@/utils/validate.js";
import { formatReviewResponse, formatUserResponse } from "@/utils/users.js";
import { AppError, asyncHandler } from "@/middlewares/asyncHandler.js";

export const createReview = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user!;
    const productId = req.params.productId;

    // Validate and prepare data FIRST
    const validated = reviewCreateSchema.parse({
      ...req.body,
      product: productId,
      user: user._id.toString(),
    });

    // Transaction handled in model
    const review = await Review.createReview(validated, user._id.toString());

    // Independent query outside transaction
    const updatedProduct = await Product.findById(productId)
      .select("ratingsAverage ratingsQuantity")
      .lean();

    res.status(201).json({
      status: "success",
      data: {
        review: await formatReviewResponse(review),
        productStats: updatedProduct,
      },
    });
  }
);

export const getReviews = asyncHandler(async (req: Request, res: Response) => {
  const reviews = await Review.getProductReviews(req.params.productId);

  res.json({
    status: "success",
    count: reviews.length,
    data: await Promise.all(reviews.map(formatReviewResponse)),
  });
});

export const getReview = asyncHandler(async (req: Request, res: Response) => {
  const reviewId = req.params.reviewId;

  const review = await Review.getReviewById(reviewId);

  if (!review || review.isDeleted) {
    throw new AppError("Review not found", 404);
  }

  res.json({
    status: "success",
    data: await formatReviewResponse(review),
  });
});

export const updateReview = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user!;
    const validated = reviewUpdateSchema.parse(req.body);

    const review = await Review.updateReview(
      req.params.reviewId,
      validated,
      user._id.toString()
    );

    if (!review) throw new AppError("Review not found", 404);

    res.json({
      status: "success",
      data: await formatReviewResponse(review),
    });
  }
);

export const deleteReview = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user!;
    const review = await Review.deleteReview(
      req.params.reviewId,
      user._id.toString()
    );

    if (!review) throw new AppError("Review not found", 404);

    res.status(204).json({
      status: "success",
      data: null,
    });
  }
);

export const likeReview = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const review = await Review.toggleLike(
    req.params.reviewId,
    user._id.toString()
  );

  if (!review) throw new AppError("Review not found", 404);

  res.json({
    status: "success",
    data: await formatReviewResponse(review, user._id.toString()), // Pass current user ID
  });
});

export const dislikeReview = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user!;
    const review = await Review.toggleDislike(
      req.params.reviewId,
      user._id.toString()
    );

    res.json({
      status: "success",
      data: await formatReviewResponse(review, user._id.toString()), // Pass current user ID
    });
  }
);

export const getPriceHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const history = await PriceHistory.getPriceHistory(req.params.productId);

    res.json({
      status: "success",
      data: history.map((entry) => ({
        oldPrice: entry.oldPrice,
        newPrice: entry.newPrice,
        changedBy: entry.changedBy ? formatUserResponse(entry.changedBy) : null,
        changedAt: entry.createdAt,
      })),
    });
  }
);
