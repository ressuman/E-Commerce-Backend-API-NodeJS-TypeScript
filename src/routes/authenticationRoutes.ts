// src/routes/authenticationRoutes.ts
import express from "express";
import {
  checkAuthStatus,
  logout,
  signup,
  verifyEmail,
  resendOtp,
  forgotPassword,
  resetPassword,
  login,
} from "@/controllers/authenticationControllers.js";

import { authenticate } from "@/middlewares/auth.js";

import {
  forgotPasswordSchema,
  loginSchema,
  resendOtpSchema,
  resetPasswordSchema,
  signupSchema,
  validate,
  verifyEmailSchema,
} from "@/utils/validate.js";

const router = express.Router();

router.post("/signup", validate(signupSchema), signup);

router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);

router.post("/login", validate(loginSchema), login);

router.post("/logout", logout);

router.get("/check-auth", authenticate, checkAuthStatus);

router.post("/resend-otp", validate(resendOtpSchema), resendOtp);

router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);

router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

export default router;
