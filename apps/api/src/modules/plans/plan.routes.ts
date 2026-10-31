import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate } from "../../middleware/authenticate";
import { adminOnly, team } from "../../middleware/authorize";
import { badRequest, conflict, notFound } from "../../shared/errors/app-error";
import { dateSchema } from "../../shared/utils/date";
import { pageArgs, pageSchema } from "../../shared/utils/pagination";

export const plansRoutes = Router();
plansRoutes.use(authenticate, team);

const intervals = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
// These are stored in 32-bit integer columns.
const MAX_INT = 2_147_483_647;
const fields = z.object({
  name: z.string().trim().min(1).max(200),
  priceMinor: z.number().int().min(0).max(MAX_INT),
  interval: intervals,
  minQuantity: z.number().int().min(1).max(MAX_INT).default(1),
  availableFrom: dateSchema,
  availableUntil: dateSchema.nullish(),
  autoClose: z.boolean().default(false),
  closable: z.boolean().default(true),
  pausable: z.boolean().default(true),
  renewable: z.boolean().default(true),
  active: z.boolean().default(true),
});
const validDates = (p: { availableFrom?: Date; availableUntil?: Date | null }) =>
  !p.availableFrom || !p.availableUntil || p.availableUntil >= p.availableFrom;
const message = { message: "availableUntil must not be before availableFrom", path: ["availableUntil"] };

// Without page or limit this returns every match, because selection lists elsewhere need all plans.
plansRoutes.get("/", async (req, res) => {
  const { q, interval, active } = z
    .object({ q: z.string().trim().optional(), interval: intervals.optional(), active: z.enum(["true", "false"]).optional() })
    .parse(req.query);
  const where: Prisma.PlanWhereInput = {
    name: q ? { contains: q, mode: "insensitive" } : undefined,
    interval,
    active: active === undefined ? undefined : active === "true",
  };
  // id breaks ties so duplicate names can't repeat or vanish across pages.
  const list = { where, orderBy: [{ name: "asc" as const }, { id: "asc" as const }] };
  if (req.query.page === undefined && req.query.limit === undefined) {
    return void res.json({ data: await prisma.plan.findMany(list) });
  }
  const query = pageSchema.parse(req.query);
  const [data, total] = await Promise.all([
    prisma.plan.findMany({ ...list, ...pageArgs(query) }),
    prisma.plan.count({ where }),
  ]);
  res.json({ data, total, page: query.page, limit: query.limit });
});

plansRoutes.get("/:id", async (req, res) => {
  const plan = await prisma.plan.findUnique({
    where: { id: String(req.params.id) },
    include: { _count: { select: { subscriptions: true, templates: true } } },
  });
  if (!plan) throw notFound("Plan");
  res.json(plan);
});

plansRoutes.post("/", adminOnly, async (req, res) => {
  res.status(201).json(await prisma.plan.create({ data: fields.refine(validDates, message).parse(req.body) }));
});

plansRoutes.patch("/:id", adminOnly, async (req, res) => {
  // partial() alone would keep the defaults and silently reset omitted flags.
  const shape = Object.fromEntries(
    Object.entries(fields.shape).map(([k, v]) => [k, (v instanceof z.ZodDefault ? v.removeDefault() : v).optional()]),
  ) as { [K in keyof typeof fields.shape]: z.ZodOptional<z.ZodTypeAny> };
  const data = z.object(shape).refine(validDates, message).parse(req.body);
  const plan = await prisma.plan.findUnique({ where: { id: String(req.params.id) } });
  if (!plan) throw notFound("Plan");
  // Billing dates are worked out from the interval, so changing it would disturb them.
  if (data.interval && data.interval !== plan.interval) throw conflict("A plan's billing interval can't be changed. Create a new plan instead");
  // A partial update must still leave a valid range with the stored dates. Null clears availableUntil.
  const effective = {
    availableFrom: data.availableFrom ?? plan.availableFrom,
    availableUntil: data.availableUntil === undefined ? plan.availableUntil : data.availableUntil,
  };
  if (!validDates(effective)) throw badRequest(message.message);
  res.json(await prisma.plan.update({ where: { id: plan.id }, data }));
});
