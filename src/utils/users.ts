import { IUser, UserPermissions, UserRole } from "@/models/userModel.js";

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
