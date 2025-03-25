// src/models/reviewModel.ts
import { Document, Model, Schema, model, Types } from "mongoose";
import Product from "./productModel.js";

/**
 * Product Review Interface
 */
export interface IReview extends Document {
  product: Types.ObjectId; // Reference to Product
  user: Types.ObjectId; // Reference to User
  rating: number; // 1-5 rating
  title: string; // Review title
  comment: string; // Detailed review
  verifiedPurchase: boolean; // Whether user bought the product
  likes: number; // Helpful votes
  dislikes: number; // Unhelpful votes
  likedBy: Types.ObjectId[]; // Users who liked the review
  dislikedBy: Types.ObjectId[]; // Users who disliked the review
  isDeleted: boolean;
  version: number;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewModel extends Model<IReview> {
  createReview(data: Partial<IReview>, userId: string): Promise<IReview>;
  updateReview(
    reviewId: string,
    data: Partial<IReview>,
    userId: string
  ): Promise<IReview | null>;
  deleteReview(reviewId: string, userId: string): Promise<IReview | null>;
  getProductReviews(productId: string): Promise<IReview[]>;
  getReviewById(id: string): Promise<IReview | null>;
  toggleLike(reviewId: string, userId: string): Promise<IReview | null>;
  toggleDislike(reviewId: string, userId: string): Promise<IReview | null>;
}

const reviewSchema = new Schema<IReview>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    title: {
      type: String,
      required: [true, "Review title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    comment: {
      type: String,
      required: [true, "Review comment is required"],
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },
    verifiedPurchase: {
      type: Boolean,
      default: false,
    },
    likes: {
      type: Number,
      default: 0,
      min: [0, "Likes cannot be negative"],
    },
    dislikes: {
      type: Number,
      default: 0,
      min: [0, "Dislikes cannot be negative"],
    },
    likedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    dislikedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    version: {
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
      required: [true, "Creator reference is required"],
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

// Indexes for optimized querying
reviewSchema.index({ product: 1, createdAt: -1 }); // Product reviews sorting
reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // Prevent duplicate reviews
reviewSchema.index({ rating: 1 }); // Rating filter

reviewSchema.statics.createReview = async function (data, userId) {
  const review = await this.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });

  await Product.calculateAverageRating(data.product.toString());
  return review;
};

reviewSchema.statics.updateReview = async function (reviewId, data, userId) {
  const review = await this.findByIdAndUpdate(
    reviewId,
    {
      ...data,
      updatedBy: userId,
      $inc: {
        version: 1, // For optimistic concurrency control
      },
    },
    { new: true }
  );

  if (review) {
    await Product.calculateAverageRating(review.product.toString());
  }
  return review;
};

reviewSchema.statics.deleteReview = async function (reviewId, userId) {
  const review = await this.findByIdAndUpdate(
    reviewId,
    {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId,
    },
    { new: true }
  );

  if (review) {
    await Product.calculateAverageRating(review.product.toString());
  }
  return review;
};

reviewSchema.statics.getProductReviews = function (productId) {
  return this.find({ product: productId, isDeleted: false })
    .populate("user", "username avatar")
    .populate("createdBy", "username")
    .sort("-createdAt");
};

reviewSchema.statics.getReviewById = function (id: string) {
  return this.findById(id)
    .populate("user", "username avatar")
    .populate("createdBy", "username");
};

reviewSchema.statics.toggleLike = async function (reviewId, userId) {
  const review = await this.findById(reviewId);
  if (!review) return null;

  const userIndex = review.likedBy.indexOf(userId);
  if (userIndex === -1) {
    review.likes += 1;
    review.likedBy.push(userId);
    // Remove dislike if exists
    const dislikeIndex = review.dislikedBy.indexOf(userId);
    if (dislikeIndex !== -1) {
      review.dislikes -= 1;
      review.dislikedBy.splice(dislikeIndex, 1);
    }
  } else {
    review.likes -= 1;
    review.likedBy.splice(userIndex, 1);
  }

  return review.save();
};

reviewSchema.statics.toggleDislike = async function (reviewId, userId) {
  const review = await this.findById(reviewId);
  if (!review) return null;

  const userIndex = review.dislikedBy.indexOf(userId);
  if (userIndex === -1) {
    review.dislikes += 1;
    review.dislikedBy.push(userId);
    // Remove like if exists
    const likeIndex = review.likedBy.indexOf(userId);
    if (likeIndex !== -1) {
      review.likes -= 1;
      review.likedBy.splice(likeIndex, 1);
    }
  } else {
    review.dislikes -= 1;
    review.dislikedBy.splice(userIndex, 1);
  }

  return review.save();
};

const Review = model<IReview>("Review", reviewSchema);

export default Review;
