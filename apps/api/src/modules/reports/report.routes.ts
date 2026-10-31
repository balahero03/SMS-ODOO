import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate } from "../../middleware/authenticate";
import { team } from "../../middleware/authorize";
import { addDays, dateSchema, todayUtc } from "../../shared/utils/date";

export const reportsRoutes = Router();
reportsRoutes.use(authenticate, team);

reportsRoutes.get("/summary", async (req, res) => {
  const today = todayUtc();
  const { from, to } = z
    .object({
      from: dateSchema.default(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1)).toISOString().slice(0, 10)),
      to: dateSchema.default(today.toISOString().slice(0, 10)),
    })
    .parse(req.query);

  const [statusCounts, mrr, revenue, balances, expiringSoon, byMonth, byMethod, overdue] = await Promise.all([
    prisma.subscription.groupBy({ by: ["status"], _count: true }),
    // Normalised to a month, before tax and discounts.
    prisma.$queryRaw<{ mrr: bigint | null }[]>`
      SELECT ROUND(SUM((p."priceMinor" + COALESCE(l.total, 0)) *
        CASE p."interval"
          WHEN 'DAILY' THEN 365.0 / 12 WHEN 'WEEKLY' THEN 52.0 / 12
          WHEN 'MONTHLY' THEN 1 ELSE 1.0 / 12 END))::bigint AS mrr
      FROM "Subscription" s
      JOIN "Plan" p ON p."id" = s."planId"
      LEFT JOIN (
        SELECT "subscriptionId", SUM("quantity" * "unitPriceMinor") AS total
        FROM "SubscriptionLine" GROUP BY "subscriptionId"
      ) l ON l."subscriptionId" = s."id"
      WHERE s."status" = 'ACTIVE'`,
    prisma.payment.aggregate({ where: { paidOn: { gte: from, lte: to } }, _sum: { amountMinor: true }, _count: true }),
    prisma.$queryRaw<{ outstanding: bigint | null; overdue: bigint | null; overdue_count: bigint }[]>`
      SELECT SUM("totalMinor" - "paidMinor")::bigint AS outstanding,
             SUM("totalMinor" - "paidMinor") FILTER (WHERE "dueDate" < ${today})::bigint AS overdue,
             COUNT(*) FILTER (WHERE "dueDate" < ${today}) AS overdue_count
      FROM "Invoice" WHERE "status" = 'CONFIRMED'`,
    prisma.subscription.count({
      where: { status: "ACTIVE", expiryDate: { gte: today, lte: addDays(today, 30) } },
    }),
    prisma.$queryRaw<{ month: string; amount: bigint }[]>`
      SELECT to_char("paidOn", 'YYYY-MM') AS month, SUM("amountMinor")::bigint AS amount
      FROM "Payment" WHERE "paidOn" BETWEEN ${from} AND ${to}
      GROUP BY 1 ORDER BY 1`,
    prisma.payment.groupBy({
      by: ["method"],
      where: { paidOn: { gte: from, lte: to } },
      _sum: { amountMinor: true },
    }),
    prisma.invoice.findMany({
      where: { status: "CONFIRMED", dueDate: { lt: today } },
      select: { id: true, number: true, billToName: true, dueDate: true, totalMinor: true, paidMinor: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s._count]));
  res.json({
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    activeSubscriptions: counts.ACTIVE ?? 0,
    statusCounts: counts,
    expiringSoon,
    mrrMinor: Number(mrr[0]?.mrr ?? 0),
    revenueMinor: revenue._sum.amountMinor ?? 0,
    paymentCount: revenue._count,
    outstandingMinor: Number(balances[0]?.outstanding ?? 0),
    overdueMinor: Number(balances[0]?.overdue ?? 0),
    overdueCount: Number(balances[0]?.overdue_count ?? 0),
    revenueByMonth: byMonth.map((m) => ({ month: m.month, amountMinor: Number(m.amount) })),
    revenueByMethod: byMethod.map((m) => ({ method: m.method, amountMinor: m._sum.amountMinor ?? 0 })),
    oldestOverdue: overdue,
  });
});
