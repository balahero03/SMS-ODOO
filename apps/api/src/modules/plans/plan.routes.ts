import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate } from "../../middleware/authenticate";
import { adminOnly, team } from "../../middleware/authorize";
import { badRequest, notFound } from "../../shared/errors/app-error";
import { dateSchema } from "../../shared/utils/date";
import { pageArgs, pageSchema } from "../../shared/utils/pagination";

export const plansRoutes = Router();
plansRoutes.use(authenticate, team);

const fields = z.object({
  name: z.string().trim().min(1),
  priceMinor: z.number().int().min(0),
  interval: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  minQuantity: z.number().int().min(1).default(1),
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

plansRoutes.get("/", async (req, res) => {
  const query = pageSchema.parse(req.query);
  const [data, total] = await Promise.all([
    // id breaks ties so duplicate names can't repeat or vanish across pages.
    prisma.plan.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }], ...pageArgs(query) }),
    prisma.plan.count(),
  ]);
  res.json({ data, total, page: query.page, limit: query.limit });
});

plansRoutes.get("/:id", async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: String(req.params.id) } });
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
  // A partial update must still leave a valid range with the stored dates. Null clears availableUntil.
  const effective = {
    availableFrom: data.availableFrom ?? plan.availableFrom,
    availableUntil: data.availableUntil === undefined ? plan.availableUntil : data.availableUntil,
  };
  if (!validDates(effective)) throw badRequest(message.message);
  res.json(await prisma.plan.update({ where: { id: plan.id }, data }));
});
