import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../config/database";
import { AppError } from "../shared/errors/app-error";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  customerId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) throw new AppError(401, "Unauthorized");
  let claims: jwt.JwtPayload;
  try {
    claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, "Invalid token");
  }
  // The role always comes from the database, never from the client or a stale token.
  const user = await prisma.user.findUnique({
    where: { id: String(claims.sub) },
    include: { customer: { select: { id: true } } },
  });
  if (!user || !user.active || user.tokenVersion !== claims.ver) throw new AppError(401, "Invalid token");
  req.user = { id: user.id, email: user.email, name: user.name, role: user.role, customerId: user.customer?.id ?? null };
  next();
}
