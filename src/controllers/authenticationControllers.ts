// src/controllers/authenticationControllers.ts
// Dependencies
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError, asyncHandler } from "@/middlewares/asyncHandler.js";
import User, { IUser, rolePermissions, UserRole } from "@/models/userModel.js";
import {
  generateOTP,
  OTP_EXPIRY_MINUTES,
  verifyOTP,
} from "@/utils/generateOtp.js";
import {
  //createAuthToken,
  createAuthTokens,
  JwtPayload,
} from "@/middlewares/auth.js";
import sendEmail from "@/utils/email.js";
import dotenv from "dotenv";

dotenv.config();

// Type definitions
interface SignupRequest {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
}

interface VerifyEmailRequest {
  email: string;
  otp: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthStatusResponse {
  status: "authenticated" | "unauthenticated";
  user?: {
    id: string;
    username: string;
    email: string;
    role: UserRole;
    isVerified: boolean;
  };
}

interface ResendOtpRequest {
  email: string;
}

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  email: string;
  newPassword: string;
  newPasswordConfirm: string;
  resetOtp: string;
}

// Controller functions
// Signup Controller
export const signup = asyncHandler(
  async (
    req: Request<{}, {}, SignupRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { firstName, lastName, username, email, password, passwordConfirm } =
      req.body as {
        firstName: string;
        lastName: string;
        username: string;
        email: string;
        password: string;
        passwordConfirm: string;
      };

    // Manual validation
    const missingFields = [];
    if (!firstName) missingFields.push("firstName");
    if (!lastName) missingFields.push("lastName");
    if (!username) missingFields.push("username");
    if (!email) missingFields.push("email");
    if (!password) missingFields.push("password");
    if (!passwordConfirm) missingFields.push("passwordConfirm");

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: "error",
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid email format",
      });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({
        status: "error",
        message: "Passwords do not match",
      });
    }

    // Check existing user
    const existingUser = await User.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "User with this email already exists",
      });
    }

    // Generate OTP
    const {
      code: otp,
      hashedCode: hashedOtp,
      expiresAt: otpExpires,
    } = await generateOTP();

    // Check if this is the first user
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? UserRole.ADMIN : UserRole.CUSTOMER;

    // Create unverified user
    const newUser = await User.createUser({
      firstName,
      lastName,
      username,
      email,
      authentication: {
        password,
        // salt: "", // Will be populated by pre-save hook
        otp: hashedOtp,
        otpExpires,
      },
      passwordConfirm,
      role,
      isVerified: false,
      permissions: rolePermissions[role],
    });

    // Send verification email
    const verificationUrl = `${
      process.env.CLIENT_URL
    }/verify-email?email=${encodeURIComponent(email)}&otp=${otp}`;

    const emailHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .container { max-width: 600px; margin: 20px auto; padding: 30px; border: 1px solid #e0e0e0; border-radius: 8px; }
        .header { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 15px; }
        .content { margin: 25px 0; line-height: 1.6; }
        .otp { font-size: 24px; color: #3498db; letter-spacing: 3px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; }
        .footer { margin-top: 30px; color: #7f8c8d; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
         <h1>Welcome to ${process.env.APP_NAME}</h1>
          <h2>${process.env.APP_NAME || "Our Service"}</h2>
          <h3>Email Verification Required</h3>
        </div>

        <div class="content">
          <p>Dear ${firstName},</p>
          <p>Thank you for registering! Please use the following OTP to complete your verification:</p>
          <div class="otp">${otp}</div>
          <p>This code will expire in 15 minutes.</p>

          <p>Or click the button below to verify automatically:</p>
          <a href="${verificationUrl}" class="button">Verify Email Now</a>
        </div>

        <div class="footer">
          <p>If you didn't create this account, you can safely ignore this email.</p>
          <p>Best regards,<br>${process.env.APP_NAME || "The Team"}</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const emailMessage = `Dear ${username},

Your OTP for email verification is: ${otp}
This OTP is valid for 15 minutes. Please use this OTP to verify your account.

Best regards,
The Team`;

    try {
      await sendEmail({
        email: newUser.email,
        subject: "Email Verification OTP",
        html: emailHTML,
        message: emailMessage,
      });

      res.status(201).json({
        status: "success",
        message: "Verification OTP sent to email",
        action: "Please check your email for the OTP to verify your account.",
        data: {
          email: newUser.email,
          otpExpires: newUser.authentication.otpExpires,
        },
      });
    } catch (error) {
      if (error.message.includes("Passwords do not match")) {
        return res.status(400).json({
          status: "error",
          message: "Password confirmation failed",
        });
      }
      await User.deleteUserById(newUser._id);
      return next(new Error("Failed to send verification email"));
    }
  }
);

// Verify Email Controller
export const verifyEmail = asyncHandler(
  async (
    req: Request<{}, {}, VerifyEmailRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { email, otp } = req.body as { email: string; otp: string };

    if (!email || !otp) {
      return res.status(400).json({
        status: "error",
        message: "Email and OTP are required",
      });
    }

    const user = await User.getUserByEmail(email).select(
      "+authentication.otp +authentication.otpExpires"
    );

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        status: "error",
        message: "Account already verified",
      });
    }

    if (!user.authentication.otp || !user.authentication.otpExpires) {
      return res.status(400).json({
        status: "error",
        message: "No pending verification",
      });
    }

    const isValid = verifyOTP(
      otp,
      user.authentication.otp,
      user.authentication.otpExpires
    );

    if (!isValid) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired OTP",
      });
    }

    // Update user verification status
    const updatedUser = await User.updateUserById(user._id.toString(), {
      isVerified: true,
      $unset: {
        "authentication.otp": "",
        "authentication.otpExpires": "",
      },
    } as unknown as Partial<IUser>);

    if (!updatedUser) {
      return res.status(500).json({
        status: "error",
        message: "Failed to verify user",
      });
    }

    // Generate JWT token- Generate both tokens
    //createAuthToken(res, updatedUser!._id.toString());
    const tokens = await createAuthTokens(
      res,
      (updatedUser!._id as Types.ObjectId).toString()
    );

    res.status(200).json({
      status: "success",
      message: "Account verified successfully",
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      data: {
        id: updatedUser._id,
        username: user.username,
        email: updatedUser.email,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
      },
    });
  }
);

export const refreshTokens = asyncHandler(
  async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new AppError("Refresh token required", 401);
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_SECRET!
    ) as JwtPayload;

    // Check DB validity
    const user = await User.findById(decoded.userId).select(
      "+authentication.refreshToken +authentication.refreshTokenExpires"
    );

    if (!user || user.authentication.refreshToken !== refreshToken) {
      throw new AppError("Invalid refresh token", 401);
    }

    if (user.authentication.refreshTokenExpires! < new Date()) {
      throw new AppError("Refresh token expired", 401);
    }

    // Generate new tokens
    const tokens = await createAuthTokens(res, user._id.toString());

    res.status(200).json({
      status: "success",
      message: "Tokens refreshed",
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  }
);

// Login Controller
export const login = asyncHandler(
  async (
    req: Request<{}, {}, LoginRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { email, password } = req.body as { email: string; password: string };

    // 1. Check if email and password exist
    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Please provide email and password",
      });
    }

    // 2. Get user with authentication fields
    const user = await User.getUserByEmail(email).select(
      "+authentication.password +authentication.salt +isVerified"
    );

    // 3. Check if user exists and is verified
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    if (!user.isVerified) {
      return res.status(401).json({
        status: "error",
        message: "Account not verified. Please verify your email.",
      });
    }

    // 4. Check if password is correct
    const validPassword = await user.comparePassword(password);
    if (!validPassword) {
      return res.status(401).json({
        status: "error",
        message: "Invalid credentials",
      });
    }

    // 5. Generate new token and send response
    const tokens = await createAuthTokens(res, user._id.toString());

    res.status(200).json({
      status: "success",
      message: "Logged in successfully",
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  }
);

// Logout Controller
export const logout = asyncHandler(async (req: Request, res: Response) => {
  // Clear tokens from DB if user exists
  if (req.user) {
    await User.findByIdAndUpdate(req.user._id, {
      $unset: {
        "authentication.refreshToken": "",
        "authentication.refreshTokenExpires": "",
      },
    });
  }

  // Clear cookies securely
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    expires: new Date(Date.now() + 1000), // expires in 1 second
  };

  // Clear cookies
  res.cookie("accessToken", "access-token-logged-out", cookieOptions);
  res.cookie("refreshToken", "refresh-token-logged-out", cookieOptions);

  res.status(200).json({
    status: "success",
    message: "Successfully logged out",
  });
});

// Check Authentication Status Controller
export const checkAuthStatus = asyncHandler(
  async (req: Request, res: Response<AuthStatusResponse>) => {
    if (!req.user) {
      return res.json({ status: "unauthenticated" });
    }

    res.json({
      status: "success",
      message: "authenticated",
      user: {
        id: req.user._id.toString(),
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        isVerified: req.user.isVerified,
      },
    });
  }
);

// Add these to your existing controller exports
export const resendOtp = asyncHandler(
  async (
    req: Request<{}, {}, ResendOtpRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { email } = req.body as { email: string };

    if (!email) {
      return res.status(400).json({
        status: "error",
        message: "Email is required",
      });
    }

    const user = await User.getUserByEmail(email).select(
      "+authentication.otp +authentication.otpExpires +isVerified"
    );

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        status: "error",
        message: "Account already verified",
      });
    }

    // Generate new OTP
    const {
      code: newOtp,
      hashedCode: hashedNewOtp,
      expiresAt: newOtpExpires,
    } = await generateOTP();

    // Update user with new OTP
    const updatedUser = await User.updateUserById(user._id.toString(), {
      "authentication.otp": hashedNewOtp,
      "authentication.otpExpires": newOtpExpires,
    });

    // Send email using the same pattern as signup
    const verificationUrl = `${
      process.env.CLIENT_URL
    }/verify-email?email=${encodeURIComponent(email)}&otp=${newOtp}`;
    const VerificationLink = `${req.protocol}://${req.get(
      "host"
    )}/api/v1/auth/verify-email?email=${encodeURIComponent(
      email
    )}&otp=${newOtp}`;

    // Send email
    const emailHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .container { max-width: 600px; margin: 20px auto; padding: 30px; border: 1px solid #e0e0e0; border-radius: 8px; }
        .header { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 15px; }
        .content { margin: 25px 0; line-height: 1.6; }
        .otp { font-size: 24px; color: #3498db; letter-spacing: 3px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; }
        .footer { margin-top: 30px; color: #7f8c8d; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Verification OTP</h2>
        </div>

        <div class="content">
          <p>Your new verification OTP is:</p>
          <div class="otp">${newOtp}</div>
          <p>This code will expire in ${OTP_EXPIRY_MINUTES} minutes.</p>

          <p>Or click the button below to verify automatically:</p>
          <a href="${verificationUrl}" class="button">Verify Email Now</a>
          <p>Or click <a href="${VerificationLink}">here</a> to verify your email. This link expires in 10 minutes.</p>
        </div>

        <div class="footer">
          <p>If you didn't request this OTP, please contact support.</p>
          <p>Best regards,<br>${process.env.APP_NAME || "The Team"}</p>
        </div>
      </div>
    </body>
    </html>
    `;

    await sendEmail({
      email: user.email,
      subject: "New Verification OTP",
      html: emailHTML,
      message: `Your new OTP is: ${newOtp} (valid for ${OTP_EXPIRY_MINUTES} minutes)`,
    });

    res.status(200).json({
      status: "success",
      message: "New OTP sent successfully",
      data: {
        email: user.email,
        otpExpires: newOtpExpires,
      },
    });
  }
);

export const forgotPassword = asyncHandler(
  async (
    req: Request<{}, {}, ForgotPasswordRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { email } = req.body as { email: string };

    if (!email) {
      return res.status(400).json({
        status: "error",
        message: "Email is required",
      });
    }

    const user = await User.getUserByEmail(email).select("+isVerified");
    if (!user || !user.isVerified) {
      return res.status(404).json({
        status: "error",
        message: "No verified user found with this email",
      });
    }

    const existingUser = await User.getUserByEmail(email).select(
      "+authentication.resetPasswordToken +authentication.resetPasswordExpires"
    );
    if (!existingUser) {
      return res.status(404).json({
        status: "error",
        message: "No user found with this email",
      });
    }

    // Generate reset OTP
    const {
      code: resetOtp,
      hashedCode: hashedResetOtp,
      expiresAt: resetOtpExpires,
    } = await generateOTP();

    // Update user with reset OTP
    const updatedUser = await User.updateUserById(user._id.toString(), {
      "authentication.resetPasswordToken": hashedResetOtp,
      "authentication.resetPasswordExpires": resetOtpExpires,
    });

    // Send reset email
    const resetUrl = `${
      process.env.CLIENT_URL
    }/reset-password?email=${encodeURIComponent(email)}&otp=${resetOtp}`;
    const resetLink = `${req.protocol}://${req.get(
      "host"
    )}/api/v1/auth/reset-password?email=${encodeURIComponent(
      email
    )}&otp=${resetOtp}`;

    const emailHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .container { max-width: 600px; margin: 20px auto; padding: 30px; border: 1px solid #e0e0e0; border-radius: 8px; }
        .header { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 15px; }
        .content { margin: 25px 0; line-height: 1.6; }
        .otp { font-size: 24px; color: #3498db; letter-spacing: 3px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; }
        .footer { margin-top: 30px; color: #7f8c8d; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Password Reset Request</h2>
        </div>

        <div class="content">
          <p>Your password reset OTP is:</p>
          <div class="otp">${resetOtp}</div>
          <p>This code will expire in ${OTP_EXPIRY_MINUTES} minutes.</p>

          <p>Or click the button below to reset your password:</p>
          <a href="${resetUrl}" class="button">Reset Password Now</a>
          <p>Or click <a href="${resetLink}">here</a> to reset your password. This link expires in 10 minutes.</p>
        </div>

        <div class="footer">
          <p>If you didn't request this password reset, please secure your account.</p>
          <p>Best regards,<br>${process.env.APP_NAME || "The Team"}</p>
        </div>
      </div>
    </body>
    </html>
    `;

    await sendEmail({
      email: user.email,
      subject: "Password Reset OTP",
      html: emailHTML,
      message: `Your password reset OTP is: ${resetOtp} (valid for ${OTP_EXPIRY_MINUTES} minutes)`,
    });

    res.status(200).json({
      status: "success",
      message: "Password reset OTP sent",
      data: {
        email: user.email,
        resetOtpExpires: resetOtpExpires,
      },
    });
  }
);

export const resetPassword = asyncHandler(
  async (
    req: Request<{}, {}, ResetPasswordRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { email, newPassword, newPasswordConfirm, resetOtp } = req.body as {
      email: string;
      newPassword: string;
      newPasswordConfirm: string;
      resetOtp: string;
    };

    if (!email || !newPassword || !newPasswordConfirm || !resetOtp) {
      return res.status(400).json({
        status: "error",
        message: "All fields are required",
      });
    }

    if (newPassword !== newPasswordConfirm) {
      return res.status(400).json({
        status: "error",
        message: "Passwords do not match",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 8 characters long",
      });
    }

    try {
      const user = await User.getUserByEmail(email).select(
        "+authentication.resetPasswordToken +authentication.resetPasswordExpires"
      );

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        });
      }

      if (
        !user.authentication.resetPasswordToken ||
        !user.authentication.resetPasswordExpires
      ) {
        return res.status(400).json({
          status: "error",
          message: "No active password reset request",
        });
      }

      // Verify OTP
      const isValid = verifyOTP(
        resetOtp,
        user.authentication.resetPasswordToken,
        user.authentication.resetPasswordExpires
      );

      if (!isValid) {
        return res.status(400).json({
          status: "error",
          message: "Invalid or expired OTP",
        });
      }

      // Get user document for proper hook execution
      const userToUpdate = await User.getUserById(user._id.toString());
      if (!userToUpdate) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        });
      }

      // Set new password and confirmation
      userToUpdate.authentication.password = newPassword;
      userToUpdate.passwordConfirm = newPasswordConfirm;

      // Save with hook execution
      await userToUpdate.save();

      // Clear reset token and invalidate sessions
      await User.updateUserById(user._id.toString(), {
        "authentication.resetPasswordToken": null,
        "authentication.resetPasswordExpires": null,
        "authentication.sessionToken": null,
      });

      // Send confirmation email
      const loginUrl = `${process.env.FRONTEND_URL}/login`;
      const loginLink = `${req.protocol}://${
        req.headers.host
      }?email=${encodeURIComponent(user.email)}`;

      const emailHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .container { max-width: 600px; margin: 20px auto; padding: 30px; border: 1px solid #e0e0e0; border-radius: 8px; }
        .header { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 15px; }
        .content { margin: 25px 0; line-height: 1.6; }
        .footer { margin-top: 30px; color: #7f8c8d; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Password Updated Successfully</h2>
        </div>

        <div class="content">
          <p>Your password was successfully updated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}.</p>
          <p>Click the link below to log in to your account:</p>
          <a href="${loginUrl}" class="button">Log In Now</a>
          <p>Click <a href="${loginLink}">here</a> to log in to your account.</p>
          <p>All existing sessions have been terminated for security reasons.</p>
        </div>

        <div class="footer">
          <p>If you didn't make this change, please contact support immediately.</p>
          <p>Best regards,<br>${process.env.APP_NAME || "The Team"}</p>
        </div>
      </div>
    </body>
    </html>
    `;

      // Send confirmation email
      await sendEmail({
        email: user.email,
        subject: "Password Changed Successfully",
        message: `<p>Your password was successfully updated at ${new Date().toLocaleString()}</p>`,
        html: emailHTML,
      });

      res.status(200).json({
        status: "success",
        message: "Password reset successful",
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Password reset failed",
        error: error.message,
      });
    }
  }
);
