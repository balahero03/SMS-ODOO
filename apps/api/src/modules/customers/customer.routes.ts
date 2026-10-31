import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { authenticate } from "../../middleware/authenticate";
import { adminOnly, team } from "../../middleware/authorize";
import { sendEmail } from "../../integrations/email/email";
import { conflict, notFound } from "../../shared/errors/app-error";
import { pageArgs, pageSchema } from "../../shared/utils/pagination";
import { emailSchema } from "../auth/auth.schema";
import { hashPassword, issueResetLink } from "../auth/auth.service";

export const customersRoutes = Router();
customersRoutes.use(authenticate, team);

const include = { user: { select: { email: true, name: true, active: true } } } as const;
const blankToNull = (value: string | null | undefined) => (value === "" ? null : value);
const name = z.string().trim().min(1).max(100);
const details = {
  companyName: z.string().trim().max(200).nullish().transform(blankToNull),
  phone: z
    .string()
    .trim()
    .regex(/^((?=(?:\D*\d){7})\+?[0-9 ()-]{7,20})?$/, "Enter a valid phone number")
    .nullish()
    .transform(blankToNull),
  address: z.string().trim().max(500).nullish().transform(blankToNull),
};
// A customer in any of these still needs the portal, and an active one keeps being billed.
const OPEN_STATUSES = ["QUOTATION", "CONFIRMED", "ACTIVE", "PAUSED"] as const;

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
    prisma.customer.findMany({ where, include, orderBy: [{ createdAt: "desc" }, { id: "asc" }], ...pageArgs(query) }),
    prisma.customer.count({ where }),
  ]);
  res.json({ data, total, page: query.page, limit: query.limit });
});

// Team-created customers get an emailed link to set their own password. Portal access is
// never granted by matching a self-signup's unverified email to an existing customer.
customersRoutes.post("/", async (req, res) => {
  const { email, ...fields } = z.object({ name, email: emailSchema, ...details }).parse(req.body);
  const { name: contact, ...rest } = fields;
  if (await prisma.user.findUnique({ where: { email } })) throw conflict("That email already has an account");
  const user = await prisma.user.create({
    data: {
      name: contact,
      email,
      role: "CUSTOMER",
      passwordHash: await hashPassword(randomBytes(32).toString("hex")),
      customer: { create: rest },
    },
    include: { customer: { include } },
  });
  const link = await issueResetLink(user.id, 72);
  const inviteSent = await sendEmail(email, "Your Brightloop portal account", `Set your password to see your subscriptions and invoices:\n${link}`);
  res.status(201).json({ ...user.customer, inviteSent });
});

customersRoutes.get("/:id", async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id }, include });
  if (!customer) throw notFound("Customer");
  res.json(customer);
});

customersRoutes.patch("/:id", async (req, res) => {
  const { name: contact, ...rest } = z.object({ name: name.optional(), ...details }).parse(req.body);
  res.json(
    await prisma.customer.update({
      where: { id: req.params.id },
      data: { ...rest, user: contact ? { update: { name: contact } } : undefined },
      include,
    }),
  );
});

// Customers are deactivated, not deleted: their subscriptions and invoices are permanent records.
customersRoutes.patch("/:id/access", adminOnly, async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).parse(req.body);
  const customer = await prisma.customer.findUnique({ where: { id: String(req.params.id) } });
  if (!customer) throw notFound("Customer");
  if (!active) {
    const open = await prisma.subscription.count({ where: { customerId: customer.id, status: { in: [...OPEN_STATUSES] } } });
    if (open) throw conflict("This customer has open subscriptions. Close them before deactivating the customer");
  }
  // Bumping the version ends their sessions, and old tokens stay dead after a reactivation.
  const revoke = active ? {} : { tokenVersion: { increment: 1 } };
  res.json(
    await prisma.customer.update({
      where: { id: customer.id },
      data: { user: { update: { active, ...revoke } } },
      include,
    }),
  );
});
