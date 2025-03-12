// src/routes/authRoutes.ts
import {
  signup,
  verifyEmail,
} from "@/controllers/authenticationControllers.js";

import { signupSchema, validate, verifyEmailSchema } from "@/utils/validate.js";
import express from "express";
// import { signup, verifyEmail } from "../controllers/authController";

const router = express.Router();

router.post("/signup", validate(signupSchema), signup);

router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);

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
