import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { PrismaClient, type BillingInterval, type SubscriptionStatus } from "@prisma/client";

// Set SEED_SUBS to load-test volumes, e.g. SEED_SUBS=5000 npm run db:seed
const prisma = new PrismaClient();
const SUBS = Number(process.env.SEED_SUBS ?? 300);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo accounts in production");
  if (await prisma.user.count()) throw new Error("Database already has data. Run `npx prisma migrate reset` first.");

  const now = new Date();
  const today = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const hash = await bcrypt.hash("Demo@12345", 10);

  await prisma.user.create({ data: { email: "admin@brightloop.test", name: "Asha Admin", role: "ADMIN", passwordHash: hash } });
  await prisma.user.create({ data: { email: "staff@brightloop.test", name: "Sam Staff", role: "STAFF", passwordHash: hash } });
  await prisma.taxRule.create({ data: { name: "GST 18%", rateBp: 1800 } });

  const crm = await prisma.product.create({
    data: {
      name: "Brightloop CRM",
      type: "SOFTWARE",
      salesPriceMinor: 120000,
      costPriceMinor: 30000,
      notes: "Per-seat business software",
      variants: { create: [{ attribute: "Brand", value: "Odoo", extraPriceMinor: 56000 }, { attribute: "Brand", value: "Standard" }] },
    },
    include: { variants: true },
  });
  const addon = await prisma.product.create({
    data: { name: "Analytics add-on", type: "ADDON", salesPriceMinor: 45000, costPriceMinor: 5000 },
  });

  const from = utc(today.getUTCFullYear() - 3, 0, 1);
  const monthly = await prisma.plan.create({ data: { name: "Monthly", priceMinor: 0, interval: "MONTHLY", availableFrom: from } });
  const yearly = await prisma.plan.create({ data: { name: "Yearly", priceMinor: 500000, interval: "YEARLY", availableFrom: from, pausable: false } });
  await prisma.discount.create({
    data: {
      name: "10% off 10+ seats",
      type: "PERCENT",
      value: 1000,
      minQuantity: 10,
      startDate: from,
      endDate: utc(today.getUTCFullYear() + 2, 0, 1),
      usageLimit: 100,
    },
  });
  await prisma.quotationTemplate.create({
    data: {
      name: "Enterprise yearly",
      validityDays: 30,
      planId: yearly.id,
      lines: { create: [{ productId: crm.id, variantId: crm.variants[0].id, quantity: 25 }, { productId: addon.id, quantity: 25 }] },
    },
  });

  await prisma.user.create({
    data: {
      email: "customer@brightloop.test",
      name: "Priya Shah",
      role: "CUSTOMER",
      passwordHash: hash,
      customer: { create: { companyName: "Shah Retail", address: "12 MG Road, Bengaluru" } },
    },
  });

  // Bulk data bypasses the services for speed, but keeps the same shape they produce.
  const customers = Array.from({ length: Math.max(1, Math.ceil(SUBS / 3)) }, (_, i) => ({ id: randomUUID(), i }));
  await prisma.user.createMany({
    data: customers.map((c) => ({ id: c.id, email: `customer${c.i}@example.test`, name: `Customer ${c.i}`, role: "CUSTOMER" as const, passwordHash: hash })),
  });
  await prisma.customer.createMany({ data: customers.map((c) => ({ id: c.id, userId: c.id, companyName: `Company ${c.i} Pvt Ltd` })) });
  const demo = await prisma.customer.findFirstOrThrow({ where: { user: { email: "customer@brightloop.test" } } });

  const subs = [];
  const lines = [];
  const invoices = [];
  const invoiceLines = [];
  const payments = [];
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  let invoiceNo = 0;

  for (let i = 0; i < SUBS; i++) {
    const customerId = i % 50 === 0 ? demo.id : customers[i % customers.length].id;
    const plan = i % 5 === 0 ? yearly : monthly;
    const interval: BillingInterval = plan.interval;
    const status: SubscriptionStatus = i % 20 === 19 ? "CLOSED" : i % 20 === 18 ? "PAUSED" : i % 20 === 17 ? "QUOTATION" : "ACTIVE";
    const monthsAgo = 1 + (i % 11);
    const start = utc(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, 1 + (i % 28));
    const id = randomUUID();
    const quantity = 1 + (i % 15);
    const unit = crm.salesPriceMinor;
    const running = status === "ACTIVE" || status === "PAUSED";
    const billed = running && interval === "MONTHLY" ? monthsAgo : running ? 1 : 0;
    // Every 25th subscription is left due, so the billing run has work to do in a demo.
    const dueNow = i % 25 === 0 && running;
    const cycles = dueNow ? billed - 1 : billed;
    const step = interval === "MONTHLY" ? 1 : 12;

    subs.push({
      id,
      number: `SUB-${String(i + 1).padStart(6, "0")}`,
      customerId,
      planId: plan.id,
      status,
      startDate: start,
      expiryDate: utc(start.getUTCFullYear() + 2, start.getUTCMonth(), start.getUTCDate()),
      nextBillingDate: running ? utc(start.getUTCFullYear(), start.getUTCMonth() + cycles * step, start.getUTCDate()) : null,
      billingCycles: cycles,
      quotationValidUntil: status === "QUOTATION" ? utc(today.getUTCFullYear(), today.getUTCMonth() + 1, 1) : null,
      pausedAt: status === "PAUSED" ? today : null,
      closedAt: status === "CLOSED" ? today : null,
      closedReason: status === "CLOSED" ? "Closed by customer" : null,
    });
    lines.push({ subscriptionId: id, productId: crm.id, description: crm.name, quantity, unitPriceMinor: unit, taxRateBp: 1800 });

    for (let c = 0; c < cycles; c++) {
      const periodStart = utc(start.getUTCFullYear(), start.getUTCMonth() + c * step, start.getUTCDate());
      const periodEnd = utc(start.getUTCFullYear(), start.getUTCMonth() + (c + 1) * step, start.getUTCDate() - 1);
      const due = new Date(periodStart.getTime() + 30 * 86_400_000);
      const fee = plan.priceMinor;
      const subtotal = quantity * unit + fee;
      const tax = Math.round((subtotal * 1800) / 10000);
      const total = subtotal + tax;
      const isOld = due < today;
      const unpaid = (i + c) % 12 === 0;
      const paid = isOld ? !unpaid : (i + c) % 2 === 0;
      const invoiceId = randomUUID();
      invoiceNo += 1;
      invoices.push({
        id: invoiceId,
        number: `INV-${String(invoiceNo).padStart(6, "0")}`,
        subscriptionId: id,
        customerId,
        status: paid ? ("PAID" as const) : ("CONFIRMED" as const),
        periodStart,
        periodEnd,
        issueDate: periodStart,
        dueDate: due,
        subtotalMinor: subtotal,
        discountMinor: 0,
        taxMinor: tax,
        totalMinor: total,
        paidMinor: paid ? total : 0,
        billToName: customerId === demo.id ? "Shah Retail" : `Company ${i % customers.length} Pvt Ltd`,
        billToEmail: customerId === demo.id ? "customer@brightloop.test" : `customer${i % customers.length}@example.test`,
      });
      invoiceLines.push({ invoiceId, description: crm.name, quantity, unitPriceMinor: unit, discountMinor: 0, taxRateBp: 1800, taxMinor: Math.round((quantity * unit * 1800) / 10000), amountMinor: quantity * unit + Math.round((quantity * unit * 1800) / 10000) });
      if (fee) invoiceLines.push({ invoiceId, description: `${plan.name} plan fee`, quantity: 1, unitPriceMinor: fee, discountMinor: 0, taxRateBp: 1800, taxMinor: Math.round((fee * 1800) / 10000), amountMinor: fee + Math.round((fee * 1800) / 10000) });
      if (paid) {
        const paidOn = new Date(Math.min(periodStart.getTime() + ((i % 25) + 1) * 86_400_000, today.getTime()));
        payments.push({ invoiceId, method: (["BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "CASH"] as const)[i % 5], amountMinor: total, paidOn, recordedById: admin.id });
      }
    }
  }

  const chunks = async <T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += 2000) await insert(rows.slice(i, i + 2000));
  };
  await chunks(subs, (data) => prisma.subscription.createMany({ data }));
  await chunks(lines, (data) => prisma.subscriptionLine.createMany({ data }));
  await chunks(invoices, (data) => prisma.invoice.createMany({ data }));
  await chunks(invoiceLines, (data) => prisma.invoiceLine.createMany({ data }));
  await chunks(payments, (data) => prisma.payment.createMany({ data }));
  await prisma.counter.createMany({ data: [{ name: "SUB", value: SUBS }, { name: "INV", value: invoiceNo }] });

  console.log(`Seeded ${SUBS} subscriptions, ${invoices.length} invoices, ${payments.length} payments.`);
  console.log("Logins (password Demo@12345): admin@brightloop.test, staff@brightloop.test, customer@brightloop.test");
}

main().finally(() => prisma.$disconnect());
