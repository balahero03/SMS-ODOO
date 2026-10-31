import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../../middleware/authenticate";
import { forgotSchema, loginSchema, resetSchema, signupSchema } from "./auth.schema";
import * as auth from "./auth.service";

export const authRoutes = Router();
const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

authRoutes.post("/signup", limiter, async (req, res) => {
  res.status(201).json(await auth.signup(signupSchema.parse(req.body)));
});

authRoutes.post("/login", limiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  res.json(await auth.login(email, password));
});

authRoutes.post("/forgot-password", limiter, async (req, res) => {
  const { email } = forgotSchema.parse(req.body);
  // Not awaited, so response time and failures can't reveal whether the account exists.
  void auth.forgotPassword(email).catch((err) => console.error("Password reset email failed", err));
  res.json({ message: "If that email has an account, a reset link is on its way" });
});

authRoutes.post("/reset-password", limiter, async (req, res) => {
  const { token, password } = resetSchema.parse(req.body);
  await auth.resetPassword(token, password);
  res.json({ message: "Password updated" });
});

authRoutes.post("/logout", authenticate, async (req, res) => {
  await auth.logout(req.user.id);
  res.status(204).end();
});

authRoutes.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});
