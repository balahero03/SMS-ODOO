import { z } from "zod";
import { dateSchema } from "../../shared/utils/date";

const line = z.object({
  productId: z.string(),
  variantId: z.string().nullish(),
  quantity: z.number().int().min(1),
  unitPriceMinor: z.number().int().min(0).optional(),
});

const base = {
  customerId: z.string(),
  startDate: dateSchema,
  expiryDate: dateSchema.nullish(),
  paymentTermsDays: z.number().int().min(0).default(30),
};

export const createSchema = z.object({
  ...base,
  planId: z.string(),
  validityDays: z.number().int().min(1).default(30),
  lines: z.array(line).default([]),
});

export const fromTemplateSchema = z.object({ ...base, templateId: z.string() });

export const updateDraftSchema = z.object({
  startDate: dateSchema,
  expiryDate: dateSchema.nullish(),
  paymentTermsDays: z.number().int().min(0),
  lines: z.array(line),
});

export const listSchema = z.object({
  status: z.enum(["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "PAUSED", "CLOSED"]).optional(),
  customerId: z.string().optional(),
  q: z.string().trim().optional(),
});

export const renewSchema = z.object({ expiryDate: dateSchema.optional() });

export type LineInput = z.infer<typeof line>;
