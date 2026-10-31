import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";
import { hashPassword } from "../../src/modules/auth/auth.service";
import { billSubscription, runBilling } from "../../src/modules/billing/billing.service";

const api = "/api/v1";
const PASSWORD = "Str0ng@Pass";
let admin: string, staff: string, productId: string, planId: string;
let seq = 0;

const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const date = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());

async function signup() {
  seq += 1;
  const res = await request(app).post(`${api}/auth/signup`).send({ name: `C${seq}`, email: `c${seq}@test.dev`, password: PASSWORD });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, customerId: res.body.user.customerId as string, email: res.body.user.email as string };
}

async function activeSub(customerId: string, over: Record<string, unknown> = {}, plan = planId) {
  const created = await request(app)
    .post(`${api}/subscriptions`)
    .set(as(admin))
    .send({ customerId, planId: plan, startDate: "2026-01-01", lines: [{ productId, quantity: 2 }], ...over });
  expect(created.status).toBe(201);
  const id = created.body.id as string;
  await request(app).post(`${api}/subscriptions/${id}/send`).set(as(admin)).expect(200);
  await request(app).post(`${api}/subscriptions/${id}/confirm`).set(as(admin)).expect(200);
  // Activate directly so each test controls when billing runs.
  await prisma.subscription.update({ where: { id }, data: { status: "ACTIVE", nextBillingDate: date((over.startDate as string) ?? "2026-01-01") } });
  return id;
}

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);
  await prisma.user.createMany({
    data: [
      { email: "admin@test.dev", name: "A", role: "ADMIN", passwordHash },
      { email: "staff@test.dev", name: "S", role: "STAFF", passwordHash },
    ],
  });
  const login = async (email: string) => (await request(app).post(`${api}/auth/login`).send({ email, password: PASSWORD }).expect(200)).body.token;
  admin = await login("admin@test.dev");
  staff = await login("staff@test.dev");
  await request(app).post(`${api}/taxes`).set(as(admin)).send({ name: "GST", rateBp: 1800 }).expect(201);
  const product = await request(app).post(`${api}/products`).set(as(admin)).send({
    name: "CRM",
    type: "SOFTWARE",
    salesPriceMinor: 100000,
    costPriceMinor: 10000,
    variants: [{ attribute: "Brand", value: "Odoo", extraPriceMinor: 56000 }],
  });
  productId = product.body.id;
  const plan = await request(app).post(`${api}/plans`).set(as(admin)).send({ name: "Monthly", priceMinor: 0, interval: "MONTHLY", availableFrom: "2020-01-01" });
  planId = plan.body.id;
});

afterAll(() => prisma.$disconnect());

describe("accounts", () => {
  it("rejects duplicate emails, case-insensitively, and weak passwords", async () => {
    const c = await signup();
    await request(app).post(`${api}/auth/signup`).send({ name: "x", email: c.email.toUpperCase(), password: PASSWORD }).expect(409);
    await request(app).post(`${api}/auth/signup`).send({ name: "x", email: "weak@test.dev", password: "Abcdef@1" }).expect(400);
  });

  it("resets a password with a single-use link and revokes old sessions", async () => {
    const c = await signup();
    await request(app).post(`${api}/auth/forgot-password`).send({ email: c.email }).expect(200);
    const mail = await prisma.emailLog.findFirstOrThrow({ where: { to: c.email }, orderBy: { createdAt: "desc" } });
    const token = /token=(\w+)/.exec(mail.body)![1];
    await request(app).post(`${api}/auth/reset-password`).send({ token, password: "N3w@Password" }).expect(200);
    await request(app).post(`${api}/auth/reset-password`).send({ token, password: "N3w@Password2" }).expect(400);
    await request(app).get(`${api}/auth/me`).set(as(c.token)).expect(401);
    await request(app).post(`${api}/auth/login`).send({ email: c.email, password: "N3w@Password" }).expect(200);
  });

  it("doesn't reveal whether an email exists", async () => {
    await request(app).post(`${api}/auth/forgot-password`).send({ email: "nobody@test.dev" }).expect(200);
  });
});

describe("access control", () => {
  it("lets only the admin add staff and manage the catalogue", async () => {
    const c = await signup();
    const staffBody = { name: "New", email: "new-staff@test.dev" };
    await request(app).post(`${api}/users/staff`).set(as(staff)).send(staffBody).expect(403);
    await request(app).post(`${api}/users/staff`).set(as(c.token)).send(staffBody).expect(403);
    await request(app).post(`${api}/users/staff`).set(as(admin)).send(staffBody).expect(201);
    const discount = { name: "D", type: "FIXED", value: 1, startDate: "2026-01-01", endDate: "2026-02-01" };
    await request(app).post(`${api}/discounts`).set(as(staff)).send(discount).expect(403);
    await request(app).get(`${api}/products`).set(as(c.token)).expect(403);
    await request(app).get(`${api}/reports/summary`).set(as(c.token)).expect(403);
    await request(app).get(`${api}/products`).expect(401);
  });

  it("isolates customers from each other's records and hides drafts", async () => {
    const a = await signup();
    const b = await signup();
    const id = await activeSub(a.customerId);
    await billSubscription(id, date("2026-01-01"));
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { subscriptionId: id } });

    await request(app).get(`${api}/invoices/${invoice.id}`).set(as(a.token)).expect(404); // still a draft
    await request(app).post(`${api}/invoices/${invoice.id}/confirm`).set(as(admin)).expect(200);
    await request(app).get(`${api}/invoices/${invoice.id}`).set(as(a.token)).expect(200);

    await request(app).get(`${api}/invoices/${invoice.id}`).set(as(b.token)).expect(404);
    await request(app).get(`${api}/subscriptions/${id}`).set(as(b.token)).expect(404);
    await request(app).post(`${api}/subscriptions/${id}/close`).set(as(b.token)).expect(404);
    const list = await request(app).get(`${api}/subscriptions?customerId=${a.customerId}`).set(as(b.token)).expect(200);
    expect(list.body.total).toBe(0);
  });

  it("stops a customer recording payments or confirming invoices", async () => {
    const c = await signup();
    await request(app).post(`${api}/payments/invoice/x`).set(as(c.token)).send({}).expect(403);
    await request(app).post(`${api}/invoices/x/confirm`).set(as(c.token)).expect(403);
  });
});

describe("subscription lifecycle", () => {
  it("prices a variant at base + extra and enforces the plan's minimum quantity", async () => {
    const c = await signup();
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: { variants: true } });
    const sub = await request(app).post(`${api}/subscriptions`).set(as(admin)).send({
      customerId: c.customerId,
      planId,
      startDate: "2026-01-01",
      lines: [{ productId, variantId: product.variants[0].id, quantity: 1 }],
    });
    expect(sub.body.lines[0]).toMatchObject({ unitPriceMinor: 156000, taxRateBp: 1800 });

    const plan = await request(app).post(`${api}/plans`).set(as(admin)).send({ name: "Bulk", priceMinor: 0, interval: "MONTHLY", minQuantity: 5, availableFrom: "2020-01-01" });
    await request(app).post(`${api}/subscriptions`).set(as(admin))
      .send({ customerId: c.customerId, planId: plan.body.id, startDate: "2026-01-01", lines: [{ productId, quantity: 4 }] })
      .expect(400);
  });

  it("creates from a template and refuses out-of-order transitions", async () => {
    const c = await signup();
    const t = await request(app).post(`${api}/templates`).set(as(admin)).send({ name: "T", validityDays: 10, planId, lines: [{ productId, quantity: 3 }] }).expect(201);
    const sub = await request(app).post(`${api}/subscriptions/from-template`).set(as(staff)).send({ templateId: t.body.id, customerId: c.customerId, startDate: "2026-01-01" }).expect(201);
    expect(sub.body.status).toBe("DRAFT");
    expect(sub.body.lines[0].quantity).toBe(3);
    await request(app).post(`${api}/subscriptions/${sub.body.id}/activate`).set(as(admin)).expect(409);
    await request(app).post(`${api}/subscriptions/${sub.body.id}/confirm`).set(as(admin)).expect(409);
    const sent = await request(app).post(`${api}/subscriptions/${sub.body.id}/send`).set(as(staff)).expect(200);
    expect(sent.body.status).toBe("QUOTATION");
    expect(iso(new Date(sent.body.quotationValidUntil))).toBe(iso(new Date(Date.now() + 10 * 86_400_000)));
    await request(app).post(`${api}/subscriptions/${sub.body.id}/confirm`).set(as(c.token)).expect(200);
  });

  it("refuses an expired quotation", async () => {
    const c = await signup();
    const sub = await request(app).post(`${api}/subscriptions`).set(as(admin)).send({ customerId: c.customerId, planId, startDate: "2026-01-01", lines: [{ productId, quantity: 1 }] });
    await request(app).post(`${api}/subscriptions/${sub.body.id}/send`).set(as(admin)).expect(200);
    await prisma.subscription.update({ where: { id: sub.body.id }, data: { quotationValidUntil: date("2020-01-01") } });
    await request(app).post(`${api}/subscriptions/${sub.body.id}/confirm`).set(as(admin)).expect(409);
  });

  it("honours plan-by-plan pause, close and renew flags, and Closed is final", async () => {
    const c = await signup();
    const locked = await request(app).post(`${api}/plans`).set(as(admin)).send({ name: "Locked", priceMinor: 100, interval: "MONTHLY", availableFrom: "2020-01-01", pausable: false, closable: false, renewable: false });
    const id = await activeSub(c.customerId, { expiryDate: "2027-01-01" }, locked.body.id);
    await request(app).post(`${api}/subscriptions/${id}/pause`).set(as(admin)).expect(409);
    await request(app).post(`${api}/subscriptions/${id}/close`).set(as(admin)).expect(409);
    await request(app).post(`${api}/subscriptions/${id}/renew`).set(as(admin)).expect(409);

    const free = await activeSub(c.customerId);
    await request(app).post(`${api}/subscriptions/${free}/close`).set(as(c.token)).expect(200);
    await request(app).post(`${api}/subscriptions/${free}/resume`).set(as(admin)).expect(409);
    await request(app).post(`${api}/subscriptions/${free}/activate`).set(as(admin)).expect(409);
  });

  it("doesn't bill periods that start during a pause", async () => {
    const c = await signup();
    const id = await activeSub(c.customerId);
    await prisma.subscription.update({
      where: { id },
      data: { status: "PAUSED", pausedAt: date("2026-02-15"), nextBillingDate: date("2026-03-01"), billingCycles: 2 },
    });
    await billSubscription(id, date("2026-04-15"));
    expect(await prisma.invoice.count({ where: { subscriptionId: id } })).toBe(0);
    const resumed = await request(app).post(`${api}/subscriptions/${id}/resume`).set(as(admin)).expect(200);
    expect(new Date(resumed.body.nextBillingDate) >= date(today())).toBe(true);
  });

  it("extends a renewal by the original term", async () => {
    const c = await signup();
    const id = await activeSub(c.customerId, { startDate: "2026-01-01", expiryDate: "2026-02-01" });
    const res = await request(app).post(`${api}/subscriptions/${id}/renew`).set(as(admin)).expect(200);
    expect(iso(new Date(res.body.expiryDate))).toBe("2026-03-04");
  });
});

describe("billing day", () => {
  it("creates a complete invoice with snapshot details", async () => {
    const c = await signup();
    const id = await activeSub(c.customerId);
    expect(await billSubscription(id, date("2026-01-01"))).toBe("billed");
    const inv = await prisma.invoice.findFirstOrThrow({ where: { subscriptionId: id }, include: { lines: true } });
    expect(inv).toMatchObject({ status: "DRAFT", subtotalMinor: 200000, taxMinor: 36000, totalMinor: 236000, billToEmail: c.email });
    expect(iso(inv.periodEnd)).toBe("2026-01-31");
    expect(iso(inv.dueDate)).toBe("2026-01-31");
    expect(inv.lines).toHaveLength(1);
  });

  it("never double-bills under concurrent runs, across hundreds of subscriptions", async () => {
    const c = await signup();
    const template = await activeSub(c.customerId);
    const source = await prisma.subscription.findUniqueOrThrow({ where: { id: template } });
    const rows = Array.from({ length: 300 }, (_, i) => ({
      number: `LOAD-${i}`,
      customerId: c.customerId,
      planId: source.planId,
      status: "ACTIVE" as const,
      startDate: date("2026-01-01"),
      nextBillingDate: date("2026-01-01"),
      paymentTermsDays: 30,
    }));
    await prisma.subscription.createMany({ data: rows });
    const asOf = date("2026-03-01");

    const results = await Promise.all([runBilling(asOf), runBilling(asOf), runBilling(asOf)]);
    // A runner that lost a lock may leave periods for the others; one more pass must finish cleanly.
    await runBilling(asOf);
    expect(results.every((r) => r.failed === 0)).toBe(true);

    const load = await prisma.subscription.findMany({ where: { number: { startsWith: "LOAD-" } }, include: { invoices: true } });
    for (const sub of load) {
      // January, February and March: none skipped, none duplicated.
      expect(sub.invoices.map((i) => iso(i.periodStart)).sort()).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    }
    const numbers = await prisma.invoice.findMany({ select: { number: true } });
    expect(new Set(numbers.map((n) => n.number)).size).toBe(numbers.length);
    expect((await runBilling(asOf)).billed).toBe(0);
  });

  it("recovers if nextBillingDate lags behind an existing invoice", async () => {
    const c = await signup();
    const id = await activeSub(c.customerId);
    await billSubscription(id, date("2026-01-01"));
    await prisma.subscription.update({ where: { id }, data: { nextBillingDate: date("2026-01-01"), billingCycles: 0 } });
    expect(await billSubscription(id, date("2026-01-01"))).toBe("skipped");
    expect(await prisma.invoice.count({ where: { subscriptionId: id } })).toBe(1);
    expect(iso((await prisma.subscription.findUniqueOrThrow({ where: { id } })).nextBillingDate!)).toBe("2026-02-01");
  });

  it("stops at the expiry date and auto-closes only plans set to", async () => {
    const c = await signup();
    const auto = await request(app).post(`${api}/plans`).set(as(admin)).send({ name: "Auto", priceMinor: 0, interval: "MONTHLY", availableFrom: "2020-01-01", autoClose: true });
    const closing = await activeSub(c.customerId, { expiryDate: "2026-03-01" }, auto.body.id);
    const staying = await activeSub(c.customerId, { expiryDate: "2026-03-01" });
    await runBilling(date("2026-06-01"));
    for (const id of [closing, staying]) expect(await prisma.invoice.count({ where: { subscriptionId: id } })).toBe(2);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: closing } })).status).toBe("CLOSED");
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: staying } })).status).toBe("ACTIVE");
  });
});

describe("discounts", () => {
  const create = async (over: object) =>
    (await request(app).post(`${api}/discounts`).set(as(admin)).send({ name: "Seats", type: "PERCENT", value: 1000, startDate: "2026-01-01", endDate: "2026-12-31", ...over }).expect(201)).body.id as string;

  it("appears automatically, stops when it runs out, and is released on cancel", async () => {
    const c = await signup();
    const id = await activeSub(c.customerId);
    const discountId = await create({ usageLimit: 1 });
    await request(app).post(`${api}/subscriptions/${id}/discounts`).set(as(staff)).send({ discountId }).expect(200);

    await billSubscription(id, date("2026-02-01"));
    await billSubscription(id, date("2026-02-01"));
    const invoices = await prisma.invoice.findMany({ where: { subscriptionId: id }, orderBy: { periodStart: "asc" }, include: { discounts: true } });
    expect(invoices[0].discountMinor).toBe(20000);
    expect(invoices[0].discounts[0].name).toBe("Seats");
    expect(invoices[1].discountMinor).toBe(0);

    await request(app).post(`${api}/invoices/${invoices[0].id}/cancel`).set(as(admin)).expect(200);
    expect((await prisma.discount.findUniqueOrThrow({ where: { id: discountId } })).usedCount).toBe(0);
  });

  it("stops at its end date and respects minimum quantity", async () => {
    const c = await signup();
    const id = await activeSub(c.customerId);
    const ending = await create({ endDate: "2026-01-15" });
    const big = await create({ minQuantity: 10 });
    for (const discountId of [ending, big]) await request(app).post(`${api}/subscriptions/${id}/discounts`).set(as(admin)).send({ discountId }).expect(200);
    await billSubscription(id, date("2026-02-01"));
    await billSubscription(id, date("2026-02-01"));
    const invoices = await prisma.invoice.findMany({ where: { subscriptionId: id }, orderBy: { periodStart: "asc" } });
    expect(invoices.map((i) => i.discountMinor)).toEqual([20000, 0]);
  });

  it("holds its usage limit when many subscriptions bill concurrently", async () => {
    const c = await signup();
    const discountId = await create({ name: "Limited", usageLimit: 5 });
    const ids = await Promise.all(Array.from({ length: 12 }, () => activeSub(c.customerId)));
    await prisma.subscriptionDiscount.createMany({ data: ids.map((subscriptionId) => ({ subscriptionId, discountId })) });
    await Promise.all(ids.map((id) => billSubscription(id, date("2026-01-01"))));
    expect((await prisma.discount.findUniqueOrThrow({ where: { id: discountId } })).usedCount).toBe(5);
    expect(await prisma.invoiceDiscount.count({ where: { discountId } })).toBe(5);
  });
});

describe("invoices and payments", () => {
  async function confirmedInvoice() {
    const c = await signup();
    const id = await activeSub(c.customerId);
    await billSubscription(id, date("2026-01-01"));
    const inv = await prisma.invoice.findFirstOrThrow({ where: { subscriptionId: id } });
    await request(app).post(`${api}/invoices/${inv.id}/confirm`).set(as(staff)).expect(200);
    return inv.id;
  }
  const pay = (invoiceId: string, amountMinor: number) =>
    request(app).post(`${api}/payments/invoice/${invoiceId}`).set(as(staff)).send({ method: "UPI", amountMinor, paidOn: "2026-01-10", note: "ref" });

  it("moves Draft -> Confirmed -> Paid across partial payments", async () => {
    const id = await confirmedInvoice();
    await pay(id, 100000).expect(201);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe("CONFIRMED");
    await pay(id, 136001).expect(400);
    await pay(id, 136000).expect(201);
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "PAID", paidMinor: 236000 });
    await pay(id, 1).expect(409);
  });

  it("can't overpay through concurrent payments", async () => {
    const id = await confirmedInvoice();
    const results = await Promise.all([pay(id, 236000), pay(id, 236000), pay(id, 236000)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).paidMinor).toBe(236000);
  });

  it("refuses payment on a draft and cancelling a part-paid invoice", async () => {
    const c = await signup();
    const sub = await activeSub(c.customerId);
    await billSubscription(sub, date("2026-01-01"));
    const draft = await prisma.invoice.findFirstOrThrow({ where: { subscriptionId: sub } });
    await pay(draft.id, 1).expect(409);
    const id = await confirmedInvoice();
    await pay(id, 1).expect(201);
    await request(app).post(`${api}/invoices/${id}/cancel`).set(as(staff)).expect(409);
  });

  it("only sends confirmed invoices", async () => {
    const c = await signup();
    const sub = await activeSub(c.customerId);
    await billSubscription(sub, date("2026-01-01"));
    const draft = await prisma.invoice.findFirstOrThrow({ where: { subscriptionId: sub } });
    await request(app).post(`${api}/invoices/${draft.id}/send`).set(as(staff)).expect(409);
    await request(app).post(`${api}/invoices/${draft.id}/confirm`).set(as(staff)).expect(200);
    const sent = await request(app).post(`${api}/invoices/${draft.id}/send`).set(as(staff)).expect(200);
    expect(sent.body.sentAt).toBeTruthy();
  });

  it("reports overdue invoices and revenue", async () => {
    const id = await confirmedInvoice();
    const overdue = await request(app).get(`${api}/invoices?overdue=true&limit=100`).set(as(staff)).expect(200);
    expect(overdue.body.total).toBeGreaterThan(0);
    await pay(id, 1000).expect(201);
    const report = await request(app).get(`${api}/reports/summary?from=2026-01-01&to=2026-01-31`).set(as(staff)).expect(200);
    expect(report.body.revenueMinor).toBeGreaterThanOrEqual(1000);
    expect(report.body.overdueCount).toBeGreaterThan(0);
    expect(report.body.mrrMinor).toBeGreaterThan(0);
  });
});
