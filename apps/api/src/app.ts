import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { notFoundHandler } from "./middleware/not-found";
import { errorHandler } from "./middleware/error-handler";
import { authRoutes } from "./modules/auth/auth.routes";
import { billingRoutes } from "./modules/billing/billing.routes";
import { customersRoutes } from "./modules/customers/customer.routes";
import { discountsRoutes } from "./modules/discounts/discount.routes";
import { invoicesRoutes } from "./modules/invoices/invoice.routes";
import { paymentsRoutes } from "./modules/payments/payment.routes";
import { plansRoutes } from "./modules/plans/plan.routes";
import { productsRoutes } from "./modules/products/product.routes";
import { reportsRoutes } from "./modules/reports/report.routes";
import { subscriptionRoutes } from "./modules/subscriptions/subscription.routes";
import { taxesRoutes } from "./modules/taxes/tax.routes";
import { templatesRoutes } from "./modules/quotations/quotation.routes";
import { usersRoutes } from "./modules/users/user.routes";

export const app = express();
// Behind one hosting proxy, so rate limiting sees client IPs rather than the proxy's.
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN }));
app.use(express.json({ limit: "100kb" }));

const api = Router();
api.get("/health", (_req, res) => {
  res.json({ ok: true });
});
api.use("/auth", authRoutes);
api.use("/users", usersRoutes);
api.use("/customers", customersRoutes);
api.use("/products", productsRoutes);
api.use("/plans", plansRoutes);
api.use("/taxes", taxesRoutes);
api.use("/discounts", discountsRoutes);
api.use("/templates", templatesRoutes);
api.use("/subscriptions", subscriptionRoutes);
api.use("/billing", billingRoutes);
api.use("/invoices", invoicesRoutes);
api.use("/payments", paymentsRoutes);
api.use("/reports", reportsRoutes);
app.use("/api/v1", api);
app.use(notFoundHandler);
app.use(errorHandler);
