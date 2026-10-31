import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { team } from "../../middleware/authorize";
import { dateSchema } from "../../shared/utils/date";
import { pageArgs, pageSchema } from "../../shared/utils/pagination";
import * as invoices from "./invoice.service";

export const invoicesRoutes = Router();
invoicesRoutes.use(authenticate);

const listSchema = z.object({
  status: z.enum(["DRAFT", "CONFIRMED", "PAID", "CANCELLED"]).optional(),
  overdue: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  q: z.string().trim().optional(),
  customerId: z.string().optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

invoicesRoutes.get("/", async (req, res) => {
  const page = pageSchema.parse(req.query);
  res.json({ ...(await invoices.list(req.user, listSchema.parse(req.query), pageArgs(page))), ...page });
});

invoicesRoutes.post("/confirm-drafts", team, async (_req, res) => {
  res.json(await invoices.confirmAllDrafts());
});

invoicesRoutes.get("/:id", async (req, res) => {
  res.json(await invoices.get(req.user, req.params.id));
});

invoicesRoutes.post("/:id/confirm", team, async (req, res) => {
  res.json(await invoices.confirm(req.user, req.params.id));
});

invoicesRoutes.post("/:id/cancel", team, async (req, res) => {
  res.json(await invoices.cancel(req.user, req.params.id));
});

invoicesRoutes.post("/:id/send", team, async (req, res) => {
  res.json(await invoices.send(req.user, req.params.id));
});
