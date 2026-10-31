import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate } from "../../middleware/authenticate";
import { adminOnly, team } from "../../middleware/authorize";
import { dateSchema } from "../../shared/utils/date";

export const discountsRoutes = Router();
discountsRoutes.use(authenticate, team);

const schema = z
  .object({
    name: z.string().trim().min(1),
    type: z.enum(["FIXED", "PERCENT"]),
    value: z.number().int().positive(),
    minPurchaseMinor: z.number().int().min(0).default(0),
    minQuantity: z.number().int().min(0).default(0),
    startDate: dateSchema,
    endDate: dateSchema,
    usageLimit: z.number().int().positive().nullish(),
    productIds: z.array(z.string()).default([]),
  })
  .refine((d) => d.endDate >= d.startDate, { message: "End date must not be before start date", path: ["endDate"] })
  .refine((d) => d.type !== "PERCENT" || d.value <= 10000, { message: "A percentage can't exceed 100%", path: ["value"] });

const include = { products: { select: { id: true, name: true } } } as const;

discountsRoutes.get("/", async (_req, res) => {
  res.json({ data: await prisma.discount.findMany({ include, orderBy: { createdAt: "desc" } }) });
});

discountsRoutes.post("/", adminOnly, async (req, res) => {
  const { productIds, ...data } = schema.parse(req.body);
  res.status(201).json(
    await prisma.discount.create({
      data: { ...data, products: { connect: productIds.map((id) => ({ id })) } },
      include,
    }),
  );
});

discountsRoutes.patch("/:id", adminOnly, async (req, res) => {
  const { productIds, ...data } = schema.parse(req.body);
  res.json(
    await prisma.discount.update({
      where: { id: req.params.id },
      data: { ...data, products: { set: productIds.map((id) => ({ id })) } },
      include,
    }),
  );
});
