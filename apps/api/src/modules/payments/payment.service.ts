import type { PaymentMethod } from "@prisma/client";
import { prisma } from "../../config/database";
import { conflict, badRequest, notFound } from "../../shared/errors/app-error";

export async function record(
  invoiceId: string,
  recordedById: string,
  input: { method: PaymentMethod; amountMinor: number; paidOn: Date; note?: string | null },
) {
  return prisma.$transaction(async (tx) => {
    // Lock the invoice so two payments can't both pass the outstanding-balance check.
    const [invoice] = await tx.$queryRaw<{ status: string; totalMinor: number; paidMinor: number }[]>`
      SELECT "status", "totalMinor", "paidMinor" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
    if (!invoice) throw notFound("Invoice");
    if (invoice.status !== "CONFIRMED") throw conflict("Payments can only be recorded against a confirmed invoice");
    const outstanding = invoice.totalMinor - invoice.paidMinor;
    if (input.amountMinor > outstanding) {
      throw badRequest(`That is more than the ₹${(outstanding / 100).toFixed(2)} outstanding`);
    }
    const payment = await tx.payment.create({ data: { ...input, invoiceId, recordedById } });
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paidMinor: { increment: input.amountMinor },
        status: input.amountMinor === outstanding ? "PAID" : undefined,
      },
    });
    return payment;
  });
}
