import { Request, Response } from "express";
import Product from "@/models/productModel.js";
import Review from "@/models/reviewModel.js";
import PriceHistory from "@/models/priceHistoryModel.js";
import { reviewCreateSchema } from "@/utils/validate.js";
import { formatReviewResponse, formatUserResponse } from "@/utils/users.js";
import { AppError, asyncHandler } from "@/middlewares/asyncHandler.js";

export const createReview = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user!;
    const product = await Product.findById(req.params.productId);

    if (!product) throw new AppError("Product not found", 404);

    const validated = reviewCreateSchema.parse(req.body);
    const review = await Review.createReview(
      {
        ...validated,
        product: product._id,
        user: user._id,
      },
      user._id.toString()
    );

    res.status(201).json({
      status: "success",
      data: await formatReviewResponse(review),
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
  const review = await Review.getReviewById(req.params.reviewId);

  if (!review || review.isDeleted) {
    throw new AppError("Review not found", 404);
  }

  res.json({
    status: "success",
    data: await formatReviewResponse(review),
  });
});

export const updateReview = asyncHandler(async (req, res) => {
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
});

export const deleteReview = asyncHandler(async (req, res) => {
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
});

export const likeReview = asyncHandler(async (req, res) => {
  const user = req.user!;
  const review = await Review.toggleLike(
    req.params.reviewId,
    user._id.toString()
  );

  if (!review) throw new AppError("Review not found", 404);

  res.json({
    status: "success",
    data: await formatReviewResponse(review),
  });
});

export const dislikeReview = asyncHandler(async (req, res) => {
  const user = req.user!;
  const review = await Review.toggleDislike(
    req.params.reviewId,
    user._id.toString()
  );

  if (!review) throw new AppError("Review not found", 404);

  res.json({
    status: "success",
    data: await formatReviewResponse(review),
  });
});

export const getPriceHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const history = await PriceHistory.getPriceHistory(req.params.productId);

    res.json({
      status: "success",
      data: history.map((entry) => ({
        oldPrice: entry.oldPrice,
        newPrice: entry.newPrice,
        changedBy: formatUserResponse(entry.changedBy),
        changedAt: entry.createdAt,
      })),
    });
  }
);
