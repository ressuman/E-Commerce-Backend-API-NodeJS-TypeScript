// src/models/priceHistoryModel.ts
import { Document, Model, Schema, model, Types } from "mongoose";

/**
 * Price History Interface
 */
export interface IPriceHistory extends Document {
  product: Types.ObjectId;
  oldPrice: number;
  newPrice: number;
  changedBy: Types.ObjectId;
  createdAt: Date;
}

export interface PriceHistoryModel extends Model<IPriceHistory> {
  logPriceChange(
    productId: string,
    oldPrice: number,
    newPrice: number,
    userId: string
  ): Promise<IPriceHistory>;
  getPriceHistory(productId: string): Promise<IPriceHistory[]>;
}

const priceHistorySchema = new Schema<IPriceHistory>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    oldPrice: {
      type: Number,
      required: [true, "Old price is required"],
      min: [0, "Old price cannot be negative"],
    },
    newPrice: {
      type: Number,
      required: [true, "New price is required"],
      min: [0, "New price cannot be negative"],
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

priceHistorySchema.index({ product: 1, createdAt: -1 }); // Price history lookup

priceHistorySchema.statics.logPriceChange = function (
  productId,
  oldPrice,
  newPrice,
  userId
) {
  return this.create({
    product: productId,
    oldPrice,
    newPrice,
    changedBy: userId,
  });
};

priceHistorySchema.statics.getPriceHistory = function (productId: string) {
  return this.find({ product: productId })
    .populate("changedBy", "username email role")
    .sort("-createdAt");
};

const PriceHistory = model<IPriceHistory>("PriceHistory", priceHistorySchema);

export default PriceHistory;
