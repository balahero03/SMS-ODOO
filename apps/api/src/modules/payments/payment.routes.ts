import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { authenticate } from "../../middleware/authenticate";
import { team } from "../../middleware/authorize";
import { dateSchema } from "../../shared/utils/date";
import { pageArgs, pageSchema } from "../../shared/utils/pagination";
import { record } from "./payment.service";

export const paymentsRoutes = Router();
paymentsRoutes.use(authenticate, team);

const methods = z.enum(["CASH", "BANK_TRANSFER", "CARD", "UPI", "CHEQUE"]);

paymentsRoutes.get("/", async (req, res) => {
  const page = pageSchema.parse(req.query);
  const { from, to, method } = z
    .object({ from: dateSchema.optional(), to: dateSchema.optional(), method: methods.optional() })
    .parse(req.query);
  const where: Prisma.PaymentWhereInput = { method, paidOn: from || to ? { gte: from, lte: to } : undefined };
  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { invoice: { select: { id: true, number: true, billToName: true } } },
      orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
      ...pageArgs(page),
    }),
    prisma.payment.count({ where }),
  ]);
  res.json({ data, total, ...page });
});

paymentsRoutes.post("/invoice/:invoiceId", async (req, res) => {
  const input = z
    .object({
      method: methods,
      amountMinor: z.number().int().positive(),
      paidOn: dateSchema,
      note: z.string().trim().nullish(),
    })
    .parse(req.body);
  res.status(201).json(await record(req.params.invoiceId, req.user.id, input));
});
