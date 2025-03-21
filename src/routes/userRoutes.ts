import {
  createUser,
  deactivateUser,
  deleteUser,
  getAllUsers,
  getMyProfile,
  getUserById,
  //getUserProfile,
  updateMyProfile,
  updateOwnPassword,
  updateUser,
  updateUserPassword,
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
  adminPasswordUpdateSchema,
  createUserSchema,
  deactivationSchema,
  permissionsSchema,
  roleUpdateSchema,
  updateUserSchema,
  userPasswordUpdateSchema,
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

router.patch(
  "/update-my-password",
  authenticate,
  requireAuth,
  validate(userPasswordUpdateSchema),
  updateOwnPassword
);

// Admin-only routes // Admin Management Routes
router.use(authenticate, requireAuth, authorizeAdmin);

router.post("/create-user", validate(createUserSchema), createUser);

router.get("/all-users", getAllUsers);

router.get("/get-user/:id", getUserById);

router.patch("/update-user/:id", validate(updateUserSchema), updateUser);

router.patch(
  "/update-user/:id/password",
  validate(adminPasswordUpdateSchema),
  updateUserPassword
);

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

export default router;
