import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { authenticate } from "../../middleware/authenticate";
import { team } from "../../middleware/authorize";
import { sendEmail } from "../../integrations/email/email";
import { notFound } from "../../shared/errors/app-error";
import { pageArgs, pageSchema } from "../../shared/utils/pagination";
import { emailSchema } from "../auth/auth.schema";
import { hashPassword, issueResetLink } from "../auth/auth.service";

export const customersRoutes = Router();
customersRoutes.use(authenticate, team);

const include = { user: { select: { email: true, name: true, active: true } } } as const;
const details = {
  companyName: z.string().trim().nullish(),
  phone: z.string().trim().nullish(),
  address: z.string().trim().nullish(),
};

customersRoutes.get("/", async (req, res) => {
  const query = pageSchema.extend({ q: z.string().trim().optional() }).parse(req.query);
  const where: Prisma.CustomerWhereInput = query.q
    ? {
        OR: [
          { companyName: { contains: query.q, mode: "insensitive" } },
          { user: { name: { contains: query.q, mode: "insensitive" } } },
          { user: { email: { contains: query.q, mode: "insensitive" } } },
        ],
      }
    : {};
  const [data, total] = await Promise.all([
    prisma.customer.findMany({ where, include, orderBy: { createdAt: "desc" }, ...pageArgs(query) }),
    prisma.customer.count({ where }),
  ]);
  res.json({ data, total, page: query.page, limit: query.limit });
});

// Team-created customers get an emailed link to set their own password. Portal access is
// never granted by matching a self-signup's unverified email to an existing customer.
customersRoutes.post("/", async (req, res) => {
  const { name, email, ...rest } = z
    .object({ name: z.string().trim().min(1), email: emailSchema, ...details })
    .parse(req.body);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      role: "CUSTOMER",
      passwordHash: await hashPassword(randomBytes(32).toString("hex")),
      customer: { create: rest },
    },
    include: { customer: { include } },
  });
  const link = await issueResetLink(user.id, 72);
  await sendEmail(email, "Your Brightloop portal account", `Set your password to see your subscriptions and invoices:\n${link}`);
  res.status(201).json(user.customer);
});

customersRoutes.get("/:id", async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id }, include });
  if (!customer) throw notFound("Customer");
  res.json(customer);
});

customersRoutes.patch("/:id", async (req, res) => {
  const { name, ...rest } = z.object({ name: z.string().trim().min(1).optional(), ...details }).parse(req.body);
  res.json(
    await prisma.customer.update({
      where: { id: req.params.id },
      data: { ...rest, user: name ? { update: { name } } : undefined },
      include,
    }),
  );
});
