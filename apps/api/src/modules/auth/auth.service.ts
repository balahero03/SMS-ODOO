import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { User } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../config/database";
import { sendEmail } from "../../integrations/email/email";
import { AppError, badRequest, conflict } from "../../shared/errors/app-error";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const hashPassword = (password: string) => bcrypt.hash(password, 10);
// Compared against on unknown emails so login timing doesn't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync(randomBytes(16).toString("hex"), 10);

function publicUser(user: User, customerId: string | null) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, customerId };
}

function sign(user: User) {
  return jwt.sign({ ver: user.tokenVersion }, env.JWT_SECRET, { subject: user.id, expiresIn: "12h", algorithm: "HS256" });
}

export async function signup(input: { name: string; email: string; password: string; companyName?: string }) {
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw conflict("That email already has an account");
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      role: "CUSTOMER",
      passwordHash: await hashPassword(input.password),
      customer: { create: { companyName: input.companyName } },
    },
    include: { customer: true },
  });
  return { token: sign(user), user: publicUser(user, user.customer!.id) };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email }, include: { customer: true } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) throw new AppError(401, "Incorrect email or password");
  return { token: sign(user), user: publicUser(user, user.customer?.id ?? null) };
}

export async function issueResetLink(userId: string, hours = 1) {
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + hours * 3_600_000) },
  });
  return `${env.WEB_ORIGIN}/reset-password?token=${token}`;
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return;
  const link = await issueResetLink(user.id);
  await sendEmail(user.email, "Reset your Brightloop password", `Use this link within an hour to reset your password:\n${link}`);
}

export async function resetPassword(token: string, password: string) {
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    // Conditional update makes the token single-use even under concurrent requests.
    const claimed = await tx.passwordResetToken.updateManyAndReturn({
      where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.length !== 1) throw badRequest("This reset link is invalid or has expired");
    await tx.user.update({
      where: { id: claimed[0].userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
  });
}
