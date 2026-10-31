import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { team } from "../../middleware/authorize";
import { pageArgs, pageSchema } from "../../shared/utils/pagination";
import { billSubscription } from "../billing/billing.service";
import { todayUtc } from "../../shared/utils/date";
import { createSchema, fromTemplateSchema, listSchema, renewSchema, updateDraftSchema } from "./subscription.schema";
import * as subs from "./subscription.service";

export const subscriptionRoutes = Router();
subscriptionRoutes.use(authenticate);

subscriptionRoutes.get("/", async (req, res) => {
  const page = pageSchema.parse(req.query);
  res.json({ ...(await subs.list(req.user, listSchema.parse(req.query), pageArgs(page))), ...page });
});

subscriptionRoutes.post("/", team, async (req, res) => {
  res.status(201).json(await subs.create(createSchema.parse(req.body)));
});

subscriptionRoutes.post("/from-template", team, async (req, res) => {
  res.status(201).json(await subs.createFromTemplate(fromTemplateSchema.parse(req.body)));
});

subscriptionRoutes.get("/:id", async (req, res) => {
  res.json(await subs.get(req.user, req.params.id));
});

subscriptionRoutes.put("/:id", team, async (req, res) => {
  res.json(await subs.updateDraft(req.params.id, updateDraftSchema.parse(req.body)));
});

subscriptionRoutes.post("/:id/send", team, async (req, res) => {
  res.json(await subs.sendQuotation(req.user, req.params.id));
});

// The rest are open to customers too; subs.* only loads records within the caller's scope.
subscriptionRoutes.post("/:id/confirm", async (req, res) => {
  res.json(await subs.confirm(req.user, req.params.id));
});

subscriptionRoutes.post("/:id/activate", team, async (req, res) => {
  await subs.activate(req.user, req.params.id);
  // Bill straight away if the first period has already started.
  await billSubscription(req.params.id, todayUtc());
  res.json(await subs.get(req.user, req.params.id));
});

subscriptionRoutes.post("/:id/pause", async (req, res) => {
  res.json(await subs.pause(req.user, req.params.id));
});

subscriptionRoutes.post("/:id/resume", async (req, res) => {
  res.json(await subs.resume(req.user, req.params.id));
});

subscriptionRoutes.post("/:id/renew", async (req, res) => {
  res.json(await subs.renew(req.user, req.params.id, renewSchema.parse(req.body ?? {}).expiryDate));
});

subscriptionRoutes.post("/:id/close", async (req, res) => {
  res.json(await subs.close(req.user, req.params.id));
});

subscriptionRoutes.post("/:id/discounts", team, async (req, res) => {
  const { discountId } = z.object({ discountId: z.string() }).parse(req.body);
  res.json(await subs.attachDiscount(req.user, req.params.id, discountId));
});

subscriptionRoutes.delete("/:id/discounts/:discountId", team, async (req, res) => {
  res.json(await subs.detachDiscount(req.user, req.params.id, req.params.discountId));
});
