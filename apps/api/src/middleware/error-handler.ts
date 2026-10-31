import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../shared/errors/app-error";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) return res.status(err.status).json({ message: err.message });
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`).join("; ");
    return res.status(400).json({ message, issues: err.issues });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).json({ message: "That record already exists" });
    if (err.code === "P2025") return res.status(404).json({ message: "Resource not found" });
    if (err.code === "P2003") return res.status(409).json({ message: "That record is in use or references a missing record" });
  }
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
}
