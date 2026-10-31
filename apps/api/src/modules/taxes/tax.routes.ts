import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate } from "../../middleware/authenticate";
import { adminOnly, team } from "../../middleware/authorize";

export const taxesRoutes = Router();
taxesRoutes.use(authenticate, team);

const schema = z.object({
  name: z.string().trim().min(1),
  rateBp: z.number().int().min(0).max(10000),
  productType: z.enum(["SOFTWARE", "ADDON", "SERVICE"]).nullish(),
  active: z.boolean().optional(),
});

taxesRoutes.get("/", async (_req, res) => {
  res.json({ data: await prisma.taxRule.findMany({ orderBy: { name: "asc" } }) });
});

taxesRoutes.post("/", adminOnly, async (req, res) => {
  res.status(201).json(await prisma.taxRule.create({ data: schema.parse(req.body) }));
});

taxesRoutes.patch("/:id", adminOnly, async (req, res) => {
  res.json(await prisma.taxRule.update({ where: { id: req.params.id }, data: schema.partial().parse(req.body) }));
});
