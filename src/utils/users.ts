import { IUser, UserPermissions, UserRole } from "@/models/userModel.js";
import { Types, Document } from "mongoose";

export interface UserProfileResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  role: UserRole;
  isVerified: boolean;
  permissions: UserPermissions;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const formatUserResponse = (user: IUser): UserProfileResponse => ({
  id: user._id.toString(),
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  username: user.username,
  role: user.role,
  isVerified: user.isVerified,
  permissions: user.permissions,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    username: string;
    email: string;
  };
  updatedBy?: string;
}

export const formatCategoryResponse = (category: any): CategoryResponse => ({
  id: category._id.toString(),
  name: category.name,
  slug: category.slug,
  description: category.description,
  isActive: category.isActive,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
  createdBy: {
    id: category.createdBy._id.toString(),
    username: category.createdBy.username,
    email: category.createdBy.email,
  },
  updatedBy: category.updatedBy,
});

export interface ProductResponse {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: {
    id: string;
    name: string;
    slug: string;
  };
  stock: number;
  ratingsAverage?: number;
  ratingsQuantity?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    username: string;
    email: string;
  };
  searchScore?: number;
}

export const formatProductResponse = (product: any): ProductResponse => ({
  id: product._id.toString(),
  name: product.name,
  description: product.description,
  price: product.price,
  images: product.images,
  category: {
    id: product.category._id.toString(),
    name: product.category.name,
    slug: product.category.slug,
  },
  stock: product.stock,
  ratingsAverage: product.ratingsAverage,
  ratingsQuantity: product.ratingsQuantity,
  isActive: product.isActive,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
  createdBy: {
    id: product.createdBy._id.toString(),
    username: product.createdBy.username,
    email: product.createdBy.email,
  },
  searchScore: product.score ? Number(product.score.toFixed(3)) : undefined,
});

export interface ReviewResponse {
  id: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  likes: number;
  dislikes: number;
  userReaction: {
    liked: boolean;
    disliked: boolean;
  };
  user: {
    id: string;
    username: string;
    email: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export const formatReviewResponse = async (
  review: any,
  currentUserId?: string // Add current user ID parameter
) => {
  const currentUserObj = currentUserId
    ? new Types.ObjectId(currentUserId)
    : null;

  return {
    id: review._id.toString(),
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    verifiedPurchase: review.verifiedPurchase,
    likes: review.likes,
    dislikes: review.dislikes,
    userReaction: {
      liked: currentUserObj
        ? review.likedBy.some((id: Types.ObjectId) => id.equals(currentUserObj))
        : false,
      disliked: currentUserObj
        ? review.dislikedBy.some((id: Types.ObjectId) =>
            id.equals(currentUserObj)
          )
        : false,
    },
    user: review.user
      ? {
          id: review.user._id.toString(),
          username: review.user.username,
          email: review.user.email,
        }
      : null,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
};

export interface OrderResponse {
  id: string;
  orderNumber: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  status: string;
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    description: string;
  }>;
  totalPrice: number;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export const formatOrderResponse = (order: any): OrderResponse => ({
  id: order._id.toString(),
  orderNumber: order.orderNumber,
  user: {
    id: order.user._id.toString(),
    name: `${order.user.firstName} ${order.user.lastName}`,
    email: order.user.email,
  },
  status: order.status,
  statusHistory: order.statusHistory.map((h: any) => ({
    status: h.status,
    timestamp: h.timestamp,
    description: h.description,
  })),
  totalPrice: order.totalPrice,
  items: order.orderItems.map((item: any) => ({
    productId: item.product._id.toString(),
    name: item.name,
    quantity: item.quantity,
    price: item.price,
  })),
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

export interface CartItemResponse {
  product: ReturnType<typeof formatProductResponse>;
  quantity: number;
  priceAtAddition: number;
  nameAtAddition: string;
  image: string;
}

export interface CartResponse {
  id: string;
  items: CartItemResponse[];
  totalQuantity: number;
  totalPrice: number;
  subTotal: number;
  currency: string;
  discounts: Record<string, number>;
  lastUpdated: Date;
  status: "active" | "abandoned" | "converted";
  createdAt: Date;
  updatedAt: Date;
}

export const formatCartItem = (item: any): CartItemResponse => ({
  product: item.product ? formatProductResponse(item.product) : null,
  quantity: item.quantity,
  priceAtAddition: item.priceAtAddition,
  nameAtAddition: item.nameAtAddition,
  image: item.image,
});

export const formatCartResponse = (cart: any): CartResponse => ({
  id: cart._id.toString(),
  items: cart.items.map(formatCartItem),
  totalQuantity: cart.totalQuantity,
  totalPrice: cart.totalPrice,
  subTotal: cart.subTotal,
  currency: cart.currency,
  discounts: Object.fromEntries(cart.discounts),
  lastUpdated: cart.lastUpdated,
  status: cart.status,
  createdAt: cart.createdAt,
  updatedAt: cart.updatedAt,
});
