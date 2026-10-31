import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate } from "../../middleware/authenticate";
import { adminOnly, team } from "../../middleware/authorize";

export const templatesRoutes = Router();
templatesRoutes.use(authenticate, team);

const schema = z.object({
  name: z.string().trim().min(1),
  validityDays: z.number().int().min(1),
  planId: z.string(),
  lines: z
    .array(z.object({ productId: z.string(), variantId: z.string().nullish(), quantity: z.number().int().min(1) }))
    .min(1),
});
const include = {
  plan: { select: { id: true, name: true } },
  lines: { include: { product: { select: { name: true } }, variant: { select: { attribute: true, value: true } } } },
} as const;

templatesRoutes.get("/", async (_req, res) => {
  res.json({ data: await prisma.quotationTemplate.findMany({ include, orderBy: { name: "asc" } }) });
});

templatesRoutes.post("/", adminOnly, async (req, res) => {
  const { lines, ...data } = schema.parse(req.body);
  res.status(201).json(await prisma.quotationTemplate.create({ data: { ...data, lines: { create: lines } }, include }));
});

templatesRoutes.delete("/:id", adminOnly, async (req, res) => {
  await prisma.quotationTemplate.delete({ where: { id: String(req.params.id) } });
  res.status(204).end();
});
