import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate } from "../../middleware/authenticate";
import { adminOnly } from "../../middleware/authorize";
import { sendEmail } from "../../integrations/email/email";
import { badRequest, notFound } from "../../shared/errors/app-error";
import { emailSchema } from "../auth/auth.schema";
import { hashPassword, issueResetLink } from "../auth/auth.service";

export const usersRoutes = Router();
usersRoutes.use(authenticate, adminOnly);

const select = { id: true, email: true, name: true, role: true, active: true, createdAt: true } as const;

usersRoutes.get("/staff", async (_req, res) => {
  res.json({
    data: await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      select,
      orderBy: { createdAt: "asc" },
    }),
  });
});

usersRoutes.post("/staff", async (req, res) => {
  const { name, email } = z.object({ name: z.string().trim().min(1), email: emailSchema }).parse(req.body);
  const user = await prisma.user.create({
    data: { name, email, role: "STAFF", passwordHash: await hashPassword(randomBytes(32).toString("hex")) },
    select,
  });
  const link = await issueResetLink(user.id, 72);
  await sendEmail(email, "You've been added to Brightloop", `Set your password to get started:\n${link}`);
  res.status(201).json(user);
});

usersRoutes.patch("/staff/:id", async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).parse(req.body);
  if (req.params.id === req.user.id) throw badRequest("You can't deactivate your own account");
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target || target.role !== "STAFF") throw notFound("Staff member");
  res.json(await prisma.user.update({ where: { id: target.id }, data: { active }, select }));
});
