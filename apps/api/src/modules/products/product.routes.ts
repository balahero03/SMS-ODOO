import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate } from "../../middleware/authenticate";
import { adminOnly, team } from "../../middleware/authorize";
import { conflict, notFound } from "../../shared/errors/app-error";
import { pageArgs, pageSchema } from "../../shared/utils/pagination";

export const productsRoutes = Router();
productsRoutes.use(authenticate, team);

const types = z.enum(["SOFTWARE", "ADDON", "SERVICE"]);
// Prices are stored in a 32-bit integer column.
const money = z.number().int().min(0).max(2_147_483_647);
const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: types,
  salesPriceMinor: money,
  costPriceMinor: money,
  notes: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((v) => (v === "" ? null : v)),
  active: z.boolean().optional(),
});
const variantSchema = z.object({
  attribute: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(100),
  extraPriceMinor: money.default(0),
});
const variantPatchSchema = z.object({
  attribute: variantSchema.shape.attribute.optional(),
  value: variantSchema.shape.value.optional(),
  extraPriceMinor: money.optional(),
});
const duplicateVariant = "This product already has a variant with that attribute and value";

function isDuplicate(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// Without page or limit this returns every match, because selection lists elsewhere need the whole catalogue.
productsRoutes.get("/", async (req, res) => {
  const { q, type, active } = z
    .object({ q: z.string().trim().optional(), type: types.optional(), active: z.enum(["true", "false"]).optional() })
    .parse(req.query);
  const where: Prisma.ProductWhereInput = {
    name: q ? { contains: q, mode: "insensitive" } : undefined,
    type,
    active: active === undefined ? undefined : active === "true",
  };
  const query = { where, include: { variants: true }, orderBy: [{ name: "asc" as const }, { id: "asc" as const }] };
  if (req.query.page === undefined && req.query.limit === undefined) {
    return void res.json({ data: await prisma.product.findMany(query) });
  }
  const page = pageSchema.parse(req.query);
  const [data, total] = await Promise.all([
    prisma.product.findMany({ ...query, ...pageArgs(page) }),
    prisma.product.count({ where }),
  ]);
  res.json({ data, total, page: page.page, limit: page.limit });
});

productsRoutes.post("/", adminOnly, async (req, res) => {
  const { variants, ...data } = productSchema
    .extend({
      variants: z
        .array(variantSchema)
        .default([])
        .refine((list) => new Set(list.map((v) => JSON.stringify([v.attribute, v.value]))).size === list.length, duplicateVariant),
    })
    .parse(req.body);
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
  const data = variantSchema.parse(req.body);
  const productId = String(req.params.id);
  if (!(await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }))) throw notFound("Product");
  const variant = await prisma.productVariant.create({ data: { ...data, productId } }).catch((err) => {
    throw isDuplicate(err) ? conflict(duplicateVariant) : err;
  });
  res.status(201).json(variant);
});

// Existing subscription lines keep their own price and description, so an edit only affects new lines.
productsRoutes.patch("/:id/variants/:variantId", adminOnly, async (req, res) => {
  const data = variantPatchSchema.parse(req.body);
  const where = { id: String(req.params.variantId), productId: String(req.params.id) };
  if (!(await prisma.productVariant.findFirst({ where, select: { id: true } }))) throw notFound("Variant");
  const variant = await prisma.productVariant.update({ where, data }).catch((err) => {
    throw isDuplicate(err) ? conflict(duplicateVariant) : err;
  });
  res.json(variant);
});

productsRoutes.delete("/:id/variants/:variantId", adminOnly, async (req, res) => {
  const where = { id: String(req.params.variantId), productId: String(req.params.id) };
  await prisma.$transaction(async (tx) => {
    if (!(await tx.productVariant.findFirst({ where, select: { id: true } }))) throw notFound("Variant");
    // Deleting would silently clear the variant from these lines, losing which option was sold.
    if (await tx.subscriptionLine.count({ where: { variantId: where.id } })) {
      throw conflict("This variant is used on subscriptions, so it can't be removed");
    }
    await tx.productVariant.delete({ where });
  });
  res.status(204).end();
});
