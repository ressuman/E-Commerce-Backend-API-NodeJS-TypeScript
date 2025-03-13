// src/middlewares/asyncHandler.ts
import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncFunction<T = void> = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<T>;

export const asyncHandler = <T = void>(
  fn: AsyncFunction<T>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Key Professional Considerations:

// Role Management:

// typescript
// Copy
// role: UserRole.CUSTOMER // Default role
// Public signups always create CUSTOMER roles

// Elevated roles (ADMIN/MODERATOR/SUPPORT) should be assigned through:

// Internal admin interfaces

// Invitation-only systems

// Automated business logic (e.g., first user becomes admin)
//
//  **Security**: Prevent role assignment during public signup to avoid privilege escalation.
// - **Role Assignment**: Public signup should default to Customer. Other roles should be assigned through an admin interface or a secure invitation system, not during regular signup.
