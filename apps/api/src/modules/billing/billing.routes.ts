import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { adminOnly } from "../../middleware/authorize";
import { dateSchema, todayUtc } from "../../shared/utils/date";
import { runBilling } from "./billing.service";

export const billingRoutes = Router();
billingRoutes.use(authenticate, adminOnly);

billingRoutes.post("/run", async (req, res) => {
  const { asOf } = z.object({ asOf: dateSchema.optional() }).parse(req.body ?? {});
  res.json(await runBilling(asOf ?? todayUtc()));
});
