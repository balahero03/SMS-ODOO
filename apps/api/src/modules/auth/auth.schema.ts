import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email();

export const passwordSchema = z
  .string()
  .min(9, "Password must be more than eight characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Z]/, "Password needs an uppercase letter")
  .regex(/[a-z]/, "Password needs a lowercase letter")
  .regex(/[^A-Za-z0-9]/, "Password needs a special character")
  // bcrypt ignores everything past 72 bytes, and accented letters and emoji take more than one.
  .refine((p) => Buffer.byteLength(p) <= 72, "Password is too long");

export const signupSchema = z.object({
  name: z.string().trim().min(1),
  email: emailSchema,
  password: passwordSchema,
  companyName: z.string().trim().optional(),
});

export const loginSchema = z.object({ email: emailSchema, password: z.string() });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ token: z.string().min(1), password: passwordSchema });
