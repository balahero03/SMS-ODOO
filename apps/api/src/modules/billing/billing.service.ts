import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { nextNumber } from "../../shared/utils/counters";
import { addDays, addIntervals } from "../../shared/utils/date";
import { activeTaxRules, taxRateFor } from "../taxes/tax.service";
import { calculateInvoice, qualifies, type CalcDiscount, type CalcLine } from "./calculators/invoice.calculator";

const BATCH_SIZE = 200;

const dueWhere = (asOf: Date): Prisma.SubscriptionWhereInput => ({
  status: "ACTIVE",
  nextBillingDate: { lte: asOf },
});

/**
 * Bills one period of one subscription. A single transaction covers the row lock, the invoice,
 * the discount claims and the advance of nextBillingDate, so a crash leaves all of them undone.
 * SKIP LOCKED stops concurrent runners from waiting on each other, and the unique index on
 * (subscriptionId, periodStart) is the final guard against a double bill.
 */
export async function billSubscription(id: string, asOf: Date): Promise<"billed" | "skipped"> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Subscription"
      WHERE "id" = ${id} AND "status" = 'ACTIVE' AND "nextBillingDate" <= ${asOf}
      FOR UPDATE SKIP LOCKED`;
    if (!locked.length) return "skipped";

    const sub = await tx.subscription.findUniqueOrThrow({
      where: { id },
      include: {
        plan: true,
        lines: { include: { product: { select: { type: true } } } },
        customer: { include: { user: true } },
        discounts: { include: { discount: { include: { products: { select: { id: true } } } } }, orderBy: { createdAt: "asc" } },
      },
    });
    const periodStart = sub.nextBillingDate!;
    const cycles = sub.billingCycles + 1;
    const nextBillingDate = addIntervals(sub.startDate, sub.plan.interval, cycles);
    const advance = { billingCycles: cycles, nextBillingDate };

    // Past the end of the contract: nothing to bill. Closing or renewing is decided separately.
    if (sub.expiryDate && periodStart >= sub.expiryDate) return "skipped";

    const existing = await tx.invoice.findUnique({ where: { subscriptionId_periodStart: { subscriptionId: id, periodStart } } });
    if (existing) {
      await tx.subscription.update({ where: { id }, data: advance });
      return "skipped";
    }

    const rules = await activeTaxRules(tx);
    const lines: CalcLine[] = sub.lines.map((l) => ({
      key: l.id,
      productId: l.productId,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      taxRateBp: taxRateFor(rules, l.product.type),
    }));
    if (sub.plan.priceMinor > 0) {
      lines.unshift({ key: "plan", productId: null, quantity: 1, unitPriceMinor: sub.plan.priceMinor, taxRateBp: taxRateFor(rules, null) });
    }

    const discounts: CalcDiscount[] = [];
    for (const { discount: d } of sub.discounts) {
      const candidate: CalcDiscount = { ...d, productIds: d.products.map((p) => p.id) };
      if (periodStart < d.startDate || periodStart > d.endDate || !qualifies(lines, candidate)) continue;
      // Atomic claim: the limit holds across every subscription billed at once.
      const { count } = await tx.discount.updateMany({
        where: { id: d.id, OR: [{ usageLimit: null }, { usedCount: { lt: d.usageLimit ?? 0 } }] },
        data: { usedCount: { increment: 1 } },
      });
      if (count) discounts.push(candidate);
    }

    const calc = calculateInvoice(lines, discounts);
    const description = new Map(sub.lines.map((l) => [l.id, l.description]));
    await tx.invoice.create({
      data: {
        number: await nextNumber(tx, "INV"),
        subscriptionId: id,
        customerId: sub.customerId,
        periodStart,
        periodEnd: addDays(nextBillingDate, -1),
        issueDate: asOf,
        dueDate: addDays(asOf, sub.paymentTermsDays),
        subtotalMinor: calc.subtotalMinor,
        discountMinor: calc.discountMinor,
        taxMinor: calc.taxMinor,
        totalMinor: calc.totalMinor,
        billToName: sub.customer.companyName ?? sub.customer.user.name,
        billToEmail: sub.customer.user.email,
        billToAddress: sub.customer.address,
        lines: {
          create: calc.lines.map((l) => ({
            description: l.key === "plan" ? `${sub.plan.name} plan fee` : description.get(l.key)!,
            quantity: l.quantity,
            unitPriceMinor: l.unitPriceMinor,
            discountMinor: l.discountMinor,
            taxRateBp: l.taxRateBp,
            taxMinor: l.taxMinor,
            amountMinor: l.amountMinor,
          })),
        },
        discounts: { create: calc.applied.map((a) => ({ discountId: a.id, name: a.name, amountMinor: a.amountMinor })) },
      },
    });
    await tx.subscription.update({ where: { id }, data: advance });
    return "billed";
  });
}

export async function closeEnded(asOf: Date) {
  const { count } = await prisma.subscription.updateMany({
    where: {
      status: { in: ["ACTIVE", "PAUSED"] },
      expiryDate: { lt: asOf },
      plan: { autoClose: true },
    },
    data: { status: "CLOSED", closedAt: asOf, closedReason: "Expired" },
  });
  return count;
}

/** Bills every due period, including any missed by earlier downtime, then closes what has ended. */
export async function runBilling(asOf: Date) {
  const attempted = new Set<string>();
  const failures: { subscriptionId: string; error: string }[] = [];
  let billed = 0;

  for (;;) {
    const batch = await prisma.subscription.findMany({
      where: {
        ...dueWhere(asOf),
        id: { notIn: [...attempted] },
      },
      select: { id: true },
      take: BATCH_SIZE,
    });
    if (!batch.length) break;
    for (const { id } of batch) {
      try {
        const result = await billSubscription(id, asOf);
        if (result === "billed") billed += 1;
        // A billed subscription stays eligible so it can catch up on further missed periods.
        else attempted.add(id);
      } catch (err) {
        // One bad subscription must not stop the rest. It stays due and retries next run.
        attempted.add(id);
        failures.push({ subscriptionId: id, error: err instanceof Error ? err.message : String(err) });
        console.error(`[billing] ${id} failed`, err);
      }
    }
  }

  const closed = await closeEnded(asOf);
  return { asOf: asOf.toISOString().slice(0, 10), billed, closed, failed: failures.length, failures };
}
