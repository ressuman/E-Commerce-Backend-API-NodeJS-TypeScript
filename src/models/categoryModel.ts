// src/models/categoryModel.ts
import { Document, Model, Schema, model, Types } from "mongoose";
import { IUser } from "@/models/userModel.js";
import { AppError } from "@/middlewares/asyncHandler.js";

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId | IUser;
  createdBy: Types.ObjectId | IUser;
  updatedBy?: Types.ObjectId | IUser;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryModel extends Model<ICategory> {
  findActive(): Promise<ICategory[]>;
  findDeleted(): Promise<ICategory[]>;
  findById(id: string): Promise<ICategory | null>;
  updateById(
    id: string,
    data: Partial<ICategory>,
    userId: string
  ): Promise<ICategory | null>;
  deleteById(id: string, userId: string): Promise<ICategory | null>;
  isNameOrSlugExists(
    name: string,
    slug: string,
    excludeId?: string
  ): Promise<boolean>;
}

const categorySchema = new Schema<ICategory, CategoryModel>(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: [50, "Category name cannot exceed 50 characters"],
      unique: true,
      index: true,
    },
    slug: {
      type: String,
      unique: true,
      index: true,
      validate: {
        validator: (v: string) => /^[a-z0-9-]+$/.test(v),
        message: "Slug must be lowercase letters, numbers, and hyphens only",
      },
    },
    description: {
      type: String,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
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
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (doc, ret) => {
        delete ret._id;
        delete ret.isDeleted;
      },
    },
  }
);

// Indexes
categorySchema.index({ name: 1, isActive: 1 });
categorySchema.index({ slug: 1, isActive: 1 });

// Virtuals
categorySchema.virtual("id").get(function (this: ICategory) {
  return this._id.toHexString();
});

// Static methods
categorySchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isDeleted: false, isActive: true })
    .populate("createdBy", "_id username email")
    .lean();
};

categorySchema.statics.findDeleted = function () {
  return this.find({ isDeleted: true }).populate(
    "deletedBy",
    "username email role"
  );
};

categorySchema.statics.findById = function (id: string) {
  return this.findOne({ _id: id, isDeleted: false })
    .populate("createdBy", "_id username email")
    .exec();
};

categorySchema.statics.updateById = async function (
  id: string,
  data: Partial<ICategory>,
  userId: string
) {
  const category = await this.findOne({ _id: id, isDeleted: false });
  if (!category) return null;

  // Check for duplicates
  const newName = data.name || category.name;
  const newSlug = data.slug || category.slug;
  const exists = await this.isNameOrSlugExists(newName, newSlug, id);
  if (exists) {
    throw new AppError("Category name or slug already exists", 400);
  }

  // Auto-generate slug if name changes
  if (data.name && data.name !== category.name) {
    data.slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  Object.assign(category, data);
  category.updatedBy = userId;
  return category.save();
};

categorySchema.statics.deleteById = async function (
  id: string,
  userId: string
) {
  const category = await this.findOne({ _id: id, isDeleted: false });
  if (!category) return null;

  category.isDeleted = true;
  category.deletedAt = new Date();
  category.deletedBy = userId;
  return category.save();
};

categorySchema.statics.isNameOrSlugExists = async function (
  name: string,
  slug: string,
  excludeId?: string
) {
  const query: any = {
    $or: [{ name: { $regex: new RegExp(`^${name}$`, "i") } }, { slug }],
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return !!(await this.findOne(query).select("_id").lean());
};

// Pre-save hook for slug generation
categorySchema.pre<ICategory>("save", function (next) {
  if (!this.slug || this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "") // Remove invalid chars
      .replace(/\s+/g, "-") // Replace spaces with -
      .replace(/-+/g, "-"); // Replace multiple - with single -
  }
  next();
});

const Category = model<ICategory, CategoryModel>("Category", categorySchema);

export default Category;
