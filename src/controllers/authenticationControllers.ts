import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "@/middlewares/asyncHandler.js";
import User, { IUser, rolePermissions, UserRole } from "@/models/userModel.js";
import { generateOTP, verifyOTP } from "@/utils/generateOtp.js";
import { createAuthToken } from "@/middlewares/auth.js";
import sendEmail from "@/utils/email.js";

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

    // Generate JWT token
    //createAuthToken(res, updatedUser!._id.toString());
    createAuthToken(res, (updatedUser!._id as Types.ObjectId).toString());

    res.status(200).json({
      status: "success",
      message: "Account verified successfully",
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
