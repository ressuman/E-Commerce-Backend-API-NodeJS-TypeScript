import { Request, Response } from "express";
import { AppError, asyncHandler } from "@/middlewares/asyncHandler.js";
import User, { IUser, rolePermissions, UserRole } from "@/models/userModel.js";
import { formatUserResponse } from "@/utils/users.js";
import { omit, pick } from "lodash";

// Admin: Create User (Manual creation)
export const createUser = asyncHandler(async (req, res) => {
  const userData = req.body;
  const newUser = await User.createUser({
    ...userData,
    isVerified: true, // Admin-created users auto-verified
  });

  res.status(201).json({
    status: "success",
    data: formatUserResponse(newUser),
  });
});

// Admin: Get all users
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await User.getUsers()
    .select("-authentication -__v")
    .lean<IUser[]>();

  const response = users.map((user) => formatUserResponse(user));
  res.status(200).json({ status: "success", data: response });
});

// Admin: Get User by ID
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.getUserById(req.params.id)
    .select("-authentication -__v")
    .lean<IUser>();

  if (!user) throw new AppError("User not found", 404);
  res.json({ status: "success", data: formatUserResponse(user) });
});

// Get current user profile // Self: Get Profile
export const getMyProfile = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) throw new AppError("User not found", 404);
    res
      .status(200)
      .json({ status: "success", data: formatUserResponse(req.user) });
  }
);

// // Update user profile (self or admin)
// export const updateUserProfile = asyncHandler(
//   async (req: Request, res: Response) => {
//     const userId = req.user?._id.toString();
//     const updates = req.body;

//     // Prevent role/permission changes from non-admins
//     if (req.user?.role !== UserRole.ADMIN) {
//       delete updates.role;
//       delete updates.permissions;
//     }

//     const updatedUser = await User.updateUserById(userId, updates)
//       .select("-authentication -__v")
//       .lean<IUser>();

//     if (!updatedUser) throw new AppError("User not found", 404);
//     res
//       .status(200)
//       .json({ status: "success", data: formatUserResponse(updatedUser) });
//   }
// );

// Update Any User (Admin)
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const restrictedUpdates = [
    "role",
    "permissions",
    "isVerified",
    "authentication",
  ];
  const filteredUpdates = omit(req.body, restrictedUpdates);

  if (Object.keys(filteredUpdates).length === 0) {
    throw new AppError("No valid fields to update", 400);
  }

  const updatedUser = await User.updateUserById(id, filteredUpdates)
    .select("-authentication -__v")
    .lean<IUser>();

  if (!updatedUser) {
    throw new AppError("User not found", 404);
  }

  res.status(200).json({
    status: "success",
    data: formatUserResponse(updatedUser),
  });
});

// Update My Profile (Self-service)
export const updateMyProfile = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    const allowedUpdates = ["firstName", "lastName", "username"];
    const filteredUpdates = pick(req.body, allowedUpdates);

    if (Object.keys(filteredUpdates).length === 0) {
      throw new AppError("No valid fields to update", 400);
    }

    const updatedUser = await User.updateUserById(
      req.user._id.toString(),
      filteredUpdates
    )
      .select("-authentication -__v")
      .lean<IUser>();

    if (!updatedUser) {
      throw new AppError("User not found", 404);
    }

    res.status(200).json({
      status: "success",
      data: formatUserResponse(updatedUser),
    });
  }
);

// Update User Role (Admin Only)
export const updateUserRole = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!Object.values(UserRole).includes(role)) {
      throw new AppError("Invalid user role", 400);
    }

    const updatedUser = await User.updateUserById(id, {
      role,
      permissions: rolePermissions[role],
    })
      .select("-authentication -__v")
      .lean<IUser>();

    if (!updatedUser) {
      throw new AppError("User not found", 404);
    }

    res.status(200).json({
      status: "success",
      data: formatUserResponse(updatedUser),
    });
  }
);

// Admin: Update user permissions
export const updateUserPermissions = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { permissions } = req.body;

    const updatedUser = await User.updateUserById(id, { permissions })
      .select("-authentication -__v")
      .lean<IUser>();

    if (!updatedUser) throw new AppError("User not found", 404);
    res
      .status(200)
      .json({ status: "success", data: formatUserResponse(updatedUser) });
  }
);

// Deactivate user (soft delete)
export const deactivateUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    const updatedUser = await User.updateUserById(id, {
      isActive: false,
      deactivationReason: reason,
      deactivatedAt: new Date(),
    });

    if (!updatedUser) throw new AppError("User not found", 404);
    res.status(204).json({ status: "success", data: null });
  }
);

// Admin: Delete user (hard delete)
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await User.deleteUserById(id);
  if (!user) throw new AppError("User not found", 404);
  res.status(204).json({ status: "success", data: null });
});
