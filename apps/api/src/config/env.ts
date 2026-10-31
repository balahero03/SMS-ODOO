import { z } from "zod";

export const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    WEB_ORIGIN: z.string().default("http://localhost:5173"),
    PORT: z.coerce.number().default(4000),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("Brightloop <billing@example.com>"),
  })
  .parse(process.env);
