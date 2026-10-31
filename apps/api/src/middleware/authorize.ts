import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { AppError } from "../shared/errors/app-error";

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) throw new AppError(403, "Forbidden");
    next();
  };

export const adminOnly = authorize("ADMIN");
export const team = authorize("ADMIN", "STAFF");
