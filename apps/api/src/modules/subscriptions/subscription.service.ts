import type { Plan, Prisma, Subscription, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../config/database";
import type { AuthUser } from "../../middleware/authenticate";
import { nextNumber } from "../../shared/utils/counters";
import { addDays, addIntervals, todayUtc } from "../../shared/utils/date";
import { sendEmail } from "../../integrations/email/email";
import { badRequest, conflict, notFound } from "../../shared/errors/app-error";
import { activeTaxRules, taxRateFor } from "../taxes/tax.service";
import { canTransition } from "./subscription.constants";
import type { LineInput } from "./subscription.schema";

const detailInclude = {
  customer: { include: { user: { select: { name: true, email: true } } } },
  plan: true,
  lines: true,
  discounts: { include: { discount: { include: { products: { select: { id: true, name: true } } } } } },
  invoices: {
    select: { id: true, number: true, status: true, periodStart: true, periodEnd: true, totalMinor: true, paidMinor: true, dueDate: true },
    orderBy: { periodStart: "desc" },
    take: 24,
  },
} satisfies Prisma.SubscriptionInclude;

async function resolveLines(tx: Prisma.TransactionClient, plan: Plan, lines: LineInput[]) {
  const rules = await activeTaxRules(tx);
  return Promise.all(
    lines.map(async (line) => {
      if (line.quantity < plan.minQuantity) throw badRequest(`${plan.name} needs a quantity of at least ${plan.minQuantity}`);
      const product = await tx.product.findUnique({ where: { id: line.productId }, include: { variants: true } });
      if (!product?.active) throw badRequest("A selected product is unavailable");
      const variant = line.variantId ? product.variants.find((v) => v.id === line.variantId) : undefined;
      if (line.variantId && !variant) throw badRequest(`That variant does not belong to ${product.name}`);
      return {
        productId: product.id,
        variantId: variant?.id ?? null,
        description: variant ? `${product.name} (${variant.attribute}: ${variant.value})` : product.name,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor ?? product.salesPriceMinor + (variant?.extraPriceMinor ?? 0),
        taxRateBp: taxRateFor(rules, product.type),
      };
    }),
  );
}

// A plan set to close on its own caps every subscription at the plan's end date.
function effectiveExpiry(plan: Plan, expiry: Date | null | undefined) {
  if (!plan.autoClose || !plan.availableUntil) return expiry ?? null;
  return expiry && expiry < plan.availableUntil ? expiry : plan.availableUntil;
}

function assertPlanAvailable(plan: Plan, start: Date) {
  if (!plan.active || start < plan.availableFrom || (plan.availableUntil && start > plan.availableUntil)) {
    throw badRequest(`${plan.name} is not available on that start date`);
  }
}

function assertDates(start: Date, expiry: Date | null) {
  if (expiry && expiry <= start) throw badRequest("Expiry date must be after the start date");
}

export async function create(input: {
  customerId: string;
  planId: string;
  startDate: Date;
  expiryDate?: Date | null;
  paymentTermsDays: number;
  validityDays: number;
  lines: LineInput[];
}) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findUnique({ where: { id: input.planId } });
    if (!plan) throw notFound("Plan");
    if (!(await tx.customer.findUnique({ where: { id: input.customerId } }))) throw notFound("Customer");
    assertPlanAvailable(plan, input.startDate);
    const expiryDate = effectiveExpiry(plan, input.expiryDate);
    assertDates(input.startDate, expiryDate);
    return tx.subscription.create({
      data: {
        number: await nextNumber(tx, "SUB"),
        customerId: input.customerId,
        planId: plan.id,
        startDate: input.startDate,
        expiryDate,
        paymentTermsDays: input.paymentTermsDays,
        validityDays: input.validityDays,
        lines: { create: await resolveLines(tx, plan, input.lines) },
      },
      include: detailInclude,
    });
  });
}

export async function createFromTemplate(input: {
  templateId: string;
  customerId: string;
  startDate: Date;
  expiryDate?: Date | null;
  paymentTermsDays: number;
}) {
  const { templateId, ...rest } = input;
  const template = await prisma.quotationTemplate.findUnique({ where: { id: templateId }, include: { lines: true } });
  if (!template) throw notFound("Template");
  return create({
    ...rest,
    planId: template.planId,
    validityDays: template.validityDays,
    lines: template.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
  });
}

function scope(user: AuthUser): Prisma.SubscriptionWhereInput {
  // Customers only ever see their own subscriptions, and never unsent drafts.
  return user.role === "CUSTOMER" ? { customerId: user.customerId!, status: { not: "DRAFT" } } : {};
}

export async function list(
  user: AuthUser,
  filter: { status?: SubscriptionStatus; customerId?: string; q?: string },
  page: { skip: number; take: number },
) {
  const where: Prisma.SubscriptionWhereInput = {
    AND: [
      scope(user),
      {
        status: filter.status,
        customerId: filter.customerId,
        number: filter.q ? { contains: filter.q, mode: "insensitive" } : undefined,
      },
    ],
  };
  const [data, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: {
        customer: { select: { companyName: true, user: { select: { name: true } } } },
        plan: { select: { name: true, interval: true } },
      },
      orderBy: { createdAt: "desc" },
      ...page,
    }),
    prisma.subscription.count({ where }),
  ]);
  return { data, total };
}

export async function get(user: AuthUser, id: string) {
  const sub = await prisma.subscription.findFirst({ where: { id, ...scope(user) }, include: detailInclude });
  if (!sub) throw notFound("Subscription");
  if (user.role !== "CUSTOMER") return sub;
  return { ...sub, invoices: sub.invoices.filter((i) => i.status !== "DRAFT") };
}

export async function updateDraft(
  id: string,
  input: { startDate: Date; expiryDate?: Date | null; paymentTermsDays: number; lines: LineInput[] },
) {
  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { id }, include: { plan: true } });
    if (!sub) throw notFound("Subscription");
    assertPlanAvailable(sub.plan, input.startDate);
    const expiryDate = effectiveExpiry(sub.plan, input.expiryDate);
    assertDates(input.startDate, expiryDate);
    const lines = await resolveLines(tx, sub.plan, input.lines);
    const { count } = await tx.subscription.updateMany({
      where: { id, status: "DRAFT" },
      data: { startDate: input.startDate, expiryDate, paymentTermsDays: input.paymentTermsDays },
    });
    if (!count) throw conflict("Only draft subscriptions can be edited");
    await tx.subscriptionLine.deleteMany({ where: { subscriptionId: id } });
    await tx.subscriptionLine.createMany({ data: lines.map((l) => ({ ...l, subscriptionId: id })) });
    return tx.subscription.findUniqueOrThrow({ where: { id }, include: detailInclude });
  });
}

// The status in the WHERE clause makes each transition atomic: of two racing requests, one gets a 409.
async function move(sub: Subscription, to: SubscriptionStatus, data: Prisma.SubscriptionUncheckedUpdateManyInput = {}) {
  if (!canTransition(sub.status, to)) throw conflict(`A ${sub.status.toLowerCase()} subscription can't become ${to.toLowerCase()}`);
  const { count } = await prisma.subscription.updateMany({ where: { id: sub.id, status: sub.status }, data: { ...data, status: to } });
  if (!count) throw conflict("This subscription was just changed by someone else; reload and try again");
}

async function load(user: AuthUser, id: string) {
  const sub = await prisma.subscription.findFirst({ where: { id, ...scope(user) }, include: { plan: true, lines: true, customer: { include: { user: true } } } });
  if (!sub) throw notFound("Subscription");
  return sub;
}

export async function sendQuotation(user: AuthUser, id: string) {
  const sub = await load(user, id);
  if (!sub.lines.length && !sub.plan.priceMinor) throw badRequest("Add at least one line before sending this quotation");
  const validUntil = addDays(todayUtc(), sub.validityDays);
  await move(sub, "QUOTATION", { quotationValidUntil: validUntil });
  await sendEmail(
    sub.customer.user.email,
    `Your Brightloop quotation ${sub.number}`,
    `Your quotation ${sub.number} is ready to review in the portal. It is valid until ${validUntil.toISOString().slice(0, 10)}.`,
  );
  return get(user, id);
}

export async function confirm(user: AuthUser, id: string) {
  const sub = await load(user, id);
  if (sub.status === "QUOTATION" && sub.quotationValidUntil && sub.quotationValidUntil < todayUtc()) {
    throw conflict("This quotation has expired");
  }
  await move(sub, "CONFIRMED");
  return get(user, id);
}

export async function activate(user: AuthUser, id: string) {
  const sub = await load(user, id);
  await move(sub, "ACTIVE", { nextBillingDate: sub.startDate, billingCycles: 0 });
}

export async function pause(user: AuthUser, id: string) {
  const sub = await load(user, id);
  if (!sub.plan.pausable) throw conflict(`${sub.plan.name} can't be paused`);
  if (sub.status !== "ACTIVE") throw conflict("Only an active subscription can be paused");
  await move(sub, "PAUSED", { pausedAt: todayUtc() });
  return get(user, id);
}

export async function resume(user: AuthUser, id: string) {
  const sub = await load(user, id);
  if (sub.status !== "PAUSED") throw conflict("Only a paused subscription can be resumed");
  const today = todayUtc();
  let { billingCycles, nextBillingDate } = sub;
  // Periods starting while paused are not billed. Anything already due before the pause still is.
  while (sub.pausedAt && nextBillingDate && nextBillingDate >= sub.pausedAt && nextBillingDate < today) {
    billingCycles += 1;
    nextBillingDate = addIntervals(sub.startDate, sub.plan.interval, billingCycles);
  }
  await move(sub, "ACTIVE", { billingCycles, nextBillingDate, pausedAt: null });
  return get(user, id);
}

export async function renew(user: AuthUser, id: string, requested?: Date) {
  const sub = await load(user, id);
  if (!sub.plan.renewable) throw conflict(`${sub.plan.name} can't be renewed`);
  if (sub.status !== "ACTIVE" && sub.status !== "PAUSED") throw conflict("Only a running subscription can be renewed");
  if (!sub.expiryDate) throw conflict("This subscription has no expiry date to extend");
  // Without an explicit date, extend by the original term.
  const term = sub.expiryDate.getTime() - sub.startDate.getTime();
  const expiryDate = requested ?? new Date(sub.expiryDate.getTime() + term);
  if (expiryDate <= sub.expiryDate) throw badRequest("The new expiry date must be after the current one");
  if (sub.plan.autoClose && sub.plan.availableUntil && expiryDate > sub.plan.availableUntil) {
    throw conflict(`${sub.plan.name} ends on ${sub.plan.availableUntil.toISOString().slice(0, 10)}, so it can't be renewed past that date`);
  }
  await prisma.subscription.update({ where: { id }, data: { expiryDate } });
  return get(user, id);
}

export async function close(user: AuthUser, id: string) {
  const sub = await load(user, id);
  if ((sub.status === "ACTIVE" || sub.status === "PAUSED") && !sub.plan.closable) {
    throw conflict(`${sub.plan.name} can't be closed early`);
  }
  await move(sub, "CLOSED", { closedAt: todayUtc(), closedReason: `Closed by ${user.role.toLowerCase()}` });
  return get(user, id);
}

export async function attachDiscount(user: AuthUser, id: string, discountId: string) {
  const sub = await load(user, id);
  if (sub.status === "CLOSED") throw conflict("This subscription is closed");
  await prisma.subscriptionDiscount.create({ data: { subscriptionId: sub.id, discountId } });
  return get(user, id);
}

export async function detachDiscount(user: AuthUser, id: string, discountId: string) {
  await prisma.subscriptionDiscount.delete({ where: { subscriptionId_discountId: { subscriptionId: id, discountId } } });
  return get(user, id);
}
