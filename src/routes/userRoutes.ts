import {
  createUser,
  deactivateUser,
  deleteUser,
  getAllUsers,
  getMyProfile,
  getUserById,
  //getUserProfile,
  updateMyProfile,
  updateUser,
  updateUserPermissions,
  //updateUserProfile,
  updateUserRole,
} from "@/controllers/userControllers.js";

import {
  authenticate,
  authorizeAdmin,
  requireAuth,
} from "@/middlewares/auth.js";

import {
  createUserSchema,
  deactivationSchema,
  permissionsSchema,
  roleUpdateSchema,
  updateUserSchema,
  validate,
} from "@/utils/validate.js";

import express from "express";

const router = express.Router();

// Protected User Routes (Self-service)
router.get("/get-my-profile", authenticate, requireAuth, getMyProfile);

router.patch(
  "/update-my-profile",
  authenticate,
  requireAuth,
  validate(updateUserSchema),
  updateMyProfile
);

// Admin-only routes // Admin Management Routes
router.use(authenticate, requireAuth, authorizeAdmin);

router.post("/create-user", validate(createUserSchema), createUser);

router.get("/all-users", getAllUsers);

router.get("/get-user/:id", getUserById);

router.patch("/update-user/:id", validate(updateUserSchema), updateUser);

router.patch(
  "/update-user/:id/role",
  validate(roleUpdateSchema),
  updateUserRole
);

router.patch(
  "/update-user/:id/permissions",
  validate(permissionsSchema),
  updateUserPermissions
);
router.patch(
  "/update-user/:id/deactivate-user",
  validate(deactivationSchema),
  deactivateUser
);

router.delete("/delete-user/:id", deleteUser);

// Mixed authorization routes

// router.patch(
//   "/update-profile",
//   authenticate,
//   validate(updateUserSchema),
//   updateUserProfile
// );

export default router;
