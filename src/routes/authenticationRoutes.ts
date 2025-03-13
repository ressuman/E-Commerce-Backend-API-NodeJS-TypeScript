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

// // Example admin route for role updates
// router.patch('/users/:id/role',
//   authenticate,
//   authorizeAdmin,
//   asyncHandler(async (req, res) => {
//     const user = await User.findByIdAndUpdate(
//       req.params.id,
//       { role: req.body.role },
//       { new: true }
//     );
//     // ... return updated user
//   })
// );

// // Add this in a separate admin controller
// router.patch('/users/:id/role',
//   authenticate,
//   authorizeAdmin,
//   asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     const { role } = req.body;

//     const updatedUser = await User.updateUserById(id, {
//       role,
//       permissions: rolePermissions[role]
//     });

//     res.json({
//       status: 'success',
//       data: updatedUser
//     });
//   })
// );
