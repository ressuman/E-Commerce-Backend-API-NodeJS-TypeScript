// src/models/userModel.ts
import { Document, Model, QueryWithHelpers, Schema, model } from "mongoose";
import bcrypt from "bcryptjs";

// 1. Define user roles with enum and type
export enum UserRole {
  CUSTOMER = "customer",
  MODERATOR = "moderator",
  SUPPORT = "support",
  ADMIN = "admin",
}

export type UserPermissions = {
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
  isActive: boolean;
  deactivationReason?: string;
  deactivatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  passwordConfirm?: string;
  // Virtual type definitions
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface PasswordConfirmUser extends IUser {
  passwordConfirm?: string;
}

// 3. Role-based permissions configuration
export const rolePermissions: Record<UserRole, UserPermissions> = {
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
    },
    permissions: {
      type: {
        canManageProducts: Boolean,
        canManageOrders: Boolean,
        canManageUsers: Boolean,
        canManageCategories: Boolean,
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
    isActive: {
      type: Boolean,
      default: true,
    },
    deactivationReason: String,
    deactivatedAt: Date,
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
    return (this as IUser & { _passwordConfirm?: string })._passwordConfirm;
  })
  .set(function (this: IUser, value: string) {
    (this as IUser & { _passwordConfirm?: string })._passwordConfirm = value;
  });

// UserSchema.virtual("passwordConfirm")
//   .get(function (this: PasswordConfirmUser) {
//     return this.passwordConfirm;
//   })
//   .set(function (this: PasswordConfirmUser, value: string) {
//     this.passwordConfirm = value;
//   });

UserSchema.pre<IUser>("validate", async function (next) {
  if (this.isModified("authentication.password") || this.isNew) {
    // Manual password confirmation check
    if (
      !this.passwordConfirm ||
      this.authentication.password !== this.passwordConfirm
    ) {
      return next(new Error("Passwords do not match"));
    }

    try {
      const salt = await bcrypt.genSalt(12);
      this.authentication.salt = salt;
      this.authentication.password = await bcrypt.hash(
        this.authentication.password,
        salt
      );
      this.passwordConfirm = undefined;
      next();
    } catch (error: unknown) {
      next(
        error instanceof Error ? error : new Error("Password hashing failed")
      );
    }
  } else {
    next();
  }
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.authentication.password);
};

// 7. Static methods with TypeScript types
export interface UserModel extends Model<IUser> {
  getUsers(): Promise<IUser[]>;
  getUserById(id: string): Promise<IUser | null>;
  getUserByEmail(email: string): ReturnType<Model<IUser>["findOne"]>;
  getUserBySessionToken(sessionToken: string): Promise<IUser | null>;
  createUser(
    values: Omit<
      IUser,
      keyof Document | "comparePassword" | "authentication.salt"
    > & {
      authentication: Omit<IUser["authentication"], "salt"> & {
        password: string;
      };
    }
  ): Promise<IUser>;
  updateUserById(
    id: string,
    values: Partial<Omit<IUser, keyof Document | "comparePassword">>
  ): QueryWithHelpers<IUser | null, IUser>;
  deleteUserById(id: string): Promise<IUser | null>;
  forcePasswordReset(id: string, newPassword: string): Promise<IUser | null>;
}

UserSchema.statics.getUsers = function () {
  return this.find({}).select(
    "firstName lastName username email role permissions isVerified isActive createdAt updatedAt"
  );
};

UserSchema.statics.getUserById = function (id: string) {
  return this.findById(id).select(
    "firstName lastName username email role permissions isVerified isActive createdAt updatedAt"
  );
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
  values: Partial<
    Omit<
      IUser,
      keyof Document | "comparePassword" | "authentication" | "passwordConfirm"
    >
  >
) {
  return this.findByIdAndUpdate(id, values, { new: true });
};

UserSchema.statics.deleteUserById = function (id: string) {
  return this.findByIdAndDelete(id);
};

UserSchema.statics.forcePasswordReset = async function (
  id: string,
  newPassword: string
) {
  const user = (await this.findById(id)) as PasswordConfirmUser;
  if (!user) return null;

  // Clear existing sessions
  user.authentication.sessionToken = undefined;
  user.authentication.resetPasswordToken = undefined;
  user.authentication.resetPasswordExpires = undefined;

  const userWithConfirm = user as PasswordConfirmUser;
  userWithConfirm.authentication.password = newPassword;
  userWithConfirm.passwordConfirm = newPassword;

  await userWithConfirm.save();
  return userWithConfirm;
};

// 9. Add virtual ID field
UserSchema.virtual("id").get(function (this: IUser) {
  return (this._id as unknown as { toHexString: () => string }).toHexString();
});

// 8. Export the model
const User = model<IUser, UserModel>("User", UserSchema);
export default User;
