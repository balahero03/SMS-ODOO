import type { BillingInterval } from "@prisma/client";
import { z } from "zod";

// Business dates are calendar dates, handled in UTC to match Postgres DATE columns.
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .transform((s) => new Date(`${s}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "Invalid date");

export function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function addMonthsClamped(date: Date, months: number): Date {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

export function addIntervals(anchor: Date, interval: BillingInterval, count: number): Date {
  switch (interval) {
    case "DAILY":
      return addDays(anchor, count);
    case "WEEKLY":
      return addDays(anchor, count * 7);
    case "MONTHLY":
      return addMonthsClamped(anchor, count);
    case "YEARLY":
      return addMonthsClamped(anchor, count * 12);
  }
}
