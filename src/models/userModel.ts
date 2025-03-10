import { Document, Model, Schema, model } from "mongoose";
import bcrypt from "bcryptjs";

// 1. Define user roles with enum and type
export enum UserRole {
  CUSTOMER = "customer",
  MODERATOR = "moderator",
  SUPPORT = "support",
  ADMIN = "admin",
}

type UserPermissions = {
  canManageProducts: boolean;
  canManageOrders: boolean;
  canManageUsers: boolean;
  canManageCategories: boolean;
  canAccessAnalytics: boolean;
};

// 2. Define interface for TypeScript type checking
export interface IUser extends Document {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: UserPermissions;
  authentication: {
    password: string;
    salt: string;
    sessionToken?: string;
    otp?: string;
    otpExpires?: Date;
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
  };
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 3. Role-based permissions configuration
const rolePermissions: Record<UserRole, UserPermissions> = {
  [UserRole.CUSTOMER]: {
    canManageProducts: false,
    canManageOrders: false,
    canManageUsers: false,
    canManageCategories: false,
    canAccessAnalytics: false,
  },
  [UserRole.MODERATOR]: {
    canManageProducts: true,
    canManageOrders: true,
    canManageUsers: false,
    canManageCategories: true,
    canAccessAnalytics: true,
  },
  [UserRole.SUPPORT]: {
    canManageProducts: false,
    canManageOrders: true,
    canManageUsers: false,
    canManageCategories: false,
    canAccessAnalytics: false,
  },
  [UserRole.ADMIN]: {
    canManageProducts: true,
    canManageOrders: true,
    canManageUsers: true,
    canManageCategories: true,
    canAccessAnalytics: true,
  },
};

// 4. Schema definition with enhanced validations
const UserSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      match: [
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers and underscores",
      ],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CUSTOMER,
      set: function (role: UserRole) {
        this.permissions = rolePermissions[role];
        return role;
      },
    },
    permissions: {
      type: {
        canManageProducts: Boolean,
        canManageOrders: Boolean,
        canManageUsers: Boolean,
        canAccessAnalytics: Boolean,
      },
      default: rolePermissions[UserRole.CUSTOMER],
    },
    authentication: {
      password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [8, "Password must be at least 8 characters"],
        select: false,
        validate: {
          validator: function (this: IUser, value: string) {
            // Only validate when password is modified or new
            if (!this.isModified("authentication.password")) return true;
            return value === (this as any).passwordConfirm;
          },
          message: "Passwords do not match!",
        },
      },
      salt: {
        type: String,
        required: true,
        select: false,
      },
      sessionToken: {
        type: String,
        select: false,
      },
      otp: {
        type: String,
        select: false,
      },
      otpExpires: {
        type: Date,
        select: false,
      },
      resetPasswordToken: {
        type: String,
        select: false,
      },
      resetPasswordExpires: {
        type: Date,
        select: false,
      },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (doc, ret) => {
        delete ret.authentication;
        delete ret._id;
        return ret;
      },
    },
  }
);

// 5. Add virtual field for password confirmation
UserSchema.virtual("passwordConfirm")
  .get(function (this: IUser) {
    return this.authentication.password;
  })
  .set(function (this: IUser, value: string) {
    this.authentication.password = value;
  });

// 6. Add indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });

// 7. Static methods with TypeScript types
interface UserModel extends Model<IUser> {
  getUsers(): Promise<IUser[]>;
  getUserById(id: string): Promise<IUser | null>;
  getUserByEmail(email: string): Promise<IUser | null>;
  getUserBySessionToken(sessionToken: string): Promise<IUser | null>;
  createUser(values: Record<string, any>): Promise<IUser>;
  updateUserById(
    id: string,
    values: Record<string, any>
  ): Promise<IUser | null>;
  deleteUserById(id: string): Promise<IUser | null>;
}

UserSchema.statics.getUsers = function () {
  return this.find({});
};

UserSchema.statics.getUserById = function (id: string) {
  return this.findById(id);
};

UserSchema.statics.getUserByEmail = function (email: string) {
  return this.findOne({ email });
};

UserSchema.statics.getUserBySessionToken = function (sessionToken: string) {
  return this.findOne({ "authentication.sessionToken": sessionToken });
};

UserSchema.statics.createUser = function (values: Record<string, any>) {
  return new this(values).save();
};

UserSchema.statics.updateUserById = function (
  id: string,
  values: Record<string, any>
) {
  return this.findByIdAndUpdate(id, values, { new: true });
};

UserSchema.statics.deleteUserById = function (id: string) {
  return this.findByIdAndDelete(id);
};

// 8. Export the model
const User = model<IUser, UserModel>("User", UserSchema);
export default User;
