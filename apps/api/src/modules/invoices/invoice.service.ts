import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { AuthUser } from "../../middleware/authenticate";
import { todayUtc } from "../../shared/utils/date";
import { sendEmail } from "../../integrations/email/email";
import { AppError, conflict, notFound } from "../../shared/errors/app-error";

function scope(user: AuthUser): Prisma.InvoiceWhereInput {
  return user.role === "CUSTOMER" ? { customerId: user.customerId!, status: { not: "DRAFT" } } : {};
}

export async function list(
  user: AuthUser,
  filter: { status?: Prisma.InvoiceWhereInput["status"]; overdue?: boolean; q?: string; customerId?: string; from?: Date; to?: Date },
  page: { skip: number; take: number },
) {
  const where: Prisma.InvoiceWhereInput = {
    AND: [
      scope(user),
      {
        status: filter.overdue ? "CONFIRMED" : filter.status,
        dueDate: filter.overdue ? { lt: todayUtc() } : undefined,
        customerId: filter.customerId,
        number: filter.q ? { contains: filter.q, mode: "insensitive" } : undefined,
        issueDate: filter.from || filter.to ? { gte: filter.from, lte: filter.to } : undefined,
      },
    ],
  };
  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { subscription: { select: { number: true } } },
      orderBy: [{ createdAt: "desc" }, { number: "desc" }],
      ...page,
    }),
    prisma.invoice.count({ where }),
  ]);
  return { data, total };
}

export async function get(user: AuthUser, id: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, ...scope(user) },
    include: {
      lines: true,
      discounts: true,
      subscription: { select: { id: true, number: true } },
      payments: { select: { id: true, method: true, amountMinor: true, paidOn: true, note: true }, orderBy: { paidOn: "desc" } },
    },
  });
  if (!invoice) throw notFound("Invoice");
  return invoice;
}

export async function confirm(user: AuthUser, id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw notFound("Invoice");
  // Nothing to collect on a fully discounted invoice.
  const { count } = await prisma.invoice.updateMany({
    where: { id, status: "DRAFT" },
    data: { status: invoice.totalMinor === 0 ? "PAID" : "CONFIRMED" },
  });
  if (!count) throw conflict("Only a draft invoice can be confirmed");
  return get(user, id);
}

export async function confirmAllDrafts() {
  const [paid, confirmed] = await prisma.$transaction([
    prisma.invoice.updateMany({ where: { status: "DRAFT", totalMinor: 0 }, data: { status: "PAID" } }),
    prisma.invoice.updateMany({ where: { status: "DRAFT" }, data: { status: "CONFIRMED" } }),
  ]);
  return { confirmed: paid.count + confirmed.count };
}

export async function cancel(user: AuthUser, id: string) {
  await prisma.$transaction(async (tx) => {
    // A payment locks the invoice row in the same way, so these can't interleave.
    const { count } = await tx.invoice.updateMany({
      where: { id, status: { in: ["DRAFT", "CONFIRMED"] }, paidMinor: 0 },
      data: { status: "CANCELLED" },
    });
    if (!count) throw conflict("Only an unpaid draft or confirmed invoice can be cancelled");
    // A cancelled invoice no longer counts as a use of its discounts.
    const applied = await tx.invoiceDiscount.findMany({ where: { invoiceId: id } });
    await tx.discount.updateMany({
      where: { id: { in: applied.map((a) => a.discountId) }, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });
  return get(user, id);
}

export async function send(user: AuthUser, id: string) {
  const invoice = await get(user, id);
  if (invoice.status !== "CONFIRMED" && invoice.status !== "PAID") throw conflict("Confirm the invoice before sending it");
  const body = [
    `Invoice ${invoice.number} for ${invoice.periodStart.toISOString().slice(0, 10)} to ${invoice.periodEnd.toISOString().slice(0, 10)}.`,
    `Total: ₹${(invoice.totalMinor / 100).toFixed(2)}. Due ${invoice.dueDate.toISOString().slice(0, 10)}.`,
  ].join("\n");
  if (!(await sendEmail(invoice.billToEmail, `Invoice ${invoice.number} from Brightloop`, body))) {
    throw new AppError(502, "The email could not be sent; try again");
  }
  await prisma.invoice.update({ where: { id }, data: { sentAt: new Date() } });
  return get(user, id);
}
