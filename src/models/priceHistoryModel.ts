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
priceHistorySchema.index({ changedBy: 1 });

priceHistorySchema.statics.logPriceChange = async function (
  productId: string,
  oldPrice: number,
  newPrice: number,
  userId: string
) {
  return this.create({
    product: new Types.ObjectId(productId),
    oldPrice,
    newPrice,
    changedBy: new Types.ObjectId(userId),
  });
};

priceHistorySchema.statics.getPriceHistory = function (productId: string) {
  return this.find({ product: new Types.ObjectId(productId) })
    .populate({
      path: "changedBy",
      select: "username email role",
      model: "User",
    })
    .sort("-createdAt")
    .lean();
};

const PriceHistory = model<IPriceHistory>("PriceHistory", priceHistorySchema);

export default PriceHistory;
