import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate } from "../../middleware/authenticate";
import { adminOnly, team } from "../../middleware/authorize";
import { notFound } from "../../shared/errors/app-error";

export const productsRoutes = Router();
productsRoutes.use(authenticate, team);

const money = z.number().int().min(0);
const productSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["SOFTWARE", "ADDON", "SERVICE"]),
  salesPriceMinor: money,
  costPriceMinor: money,
  notes: z.string().trim().nullish(),
  active: z.boolean().optional(),
});
const variantSchema = z.object({
  attribute: z.string().trim().min(1),
  value: z.string().trim().min(1),
  extraPriceMinor: money.default(0),
});

productsRoutes.get("/", async (_req, res) => {
  res.json({ data: await prisma.product.findMany({ include: { variants: true }, orderBy: { name: "asc" } }) });
});

productsRoutes.post("/", adminOnly, async (req, res) => {
  const { variants, ...data } = productSchema.extend({ variants: z.array(variantSchema).default([]) }).parse(req.body);
  res.status(201).json(
    await prisma.product.create({ data: { ...data, variants: { create: variants } }, include: { variants: true } }),
  );
});

productsRoutes.get("/:id", async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id }, include: { variants: true } });
  if (!product) throw notFound("Product");
  res.json(product);
});

productsRoutes.patch("/:id", adminOnly, async (req, res) => {
  res.json(
    await prisma.product.update({
      where: { id: String(req.params.id) },
      data: productSchema.partial().parse(req.body),
      include: { variants: true },
    }),
  );
});

productsRoutes.post("/:id/variants", adminOnly, async (req, res) => {
  res.status(201).json(
    await prisma.productVariant.create({ data: { ...variantSchema.parse(req.body), productId: String(req.params.id) } }),
  );
});

productsRoutes.delete("/:id/variants/:variantId", adminOnly, async (req, res) => {
  await prisma.productVariant.delete({ where: { id: String(req.params.variantId), productId: String(req.params.id) } });
  res.status(204).end();
});
