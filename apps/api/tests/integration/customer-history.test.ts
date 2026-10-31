import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";
import { hashPassword } from "../../src/modules/auth/auth.service";
import { billSubscription } from "../../src/modules/billing/billing.service";

const api = "/api/v1";
const PASSWORD = "Str0ng@Pass";
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ids = (res: request.Response) => res.body.data.map((r: { id: string }) => r.id);
let admin: string, staff: string, planId: string, productId: string;

interface History {
  token: string;
  customerId: string;
  subscriptionId: string;
  invoiceId: string;
}
let first: History, second: History;

const login = async (email: string) => (await request(app).post(`${api}/auth/login`).send({ email, password: PASSWORD }).expect(200)).body.token as string;

async function customerWithHistory(email: string): Promise<History> {
  const signup = await request(app).post(`${api}/auth/signup`).send({ name: email, email, password: PASSWORD }).expect(201);
  const customerId = signup.body.user.customerId as string;
  const sub = await request(app).post(`${api}/subscriptions`).set(as(admin)).send({ customerId, planId, startDate: "2026-01-01", lines: [{ productId, quantity: 1 }] }).expect(201);
  await prisma.subscription.update({ where: { id: sub.body.id }, data: { status: "ACTIVE", nextBillingDate: day("2026-01-01") } });
  expect(await billSubscription(sub.body.id, day("2026-01-01"))).toBe("billed");
  const invoice = await prisma.invoice.findFirstOrThrow({ where: { subscriptionId: sub.body.id } });
  await request(app).post(`${api}/invoices/${invoice.id}/confirm`).set(as(admin)).expect(200);
  return { token: signup.body.token, customerId, subscriptionId: sub.body.id, invoiceId: invoice.id };
}

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);
  await prisma.user.createMany({
    data: [
      { email: "hist-admin@test.dev", name: "A", role: "ADMIN", passwordHash },
      { email: "hist-staff@test.dev", name: "S", role: "STAFF", passwordHash },
    ],
  });
  admin = await login("hist-admin@test.dev");
  staff = await login("hist-staff@test.dev");
  const plan = await request(app).post(`${api}/plans`).set(as(admin)).send({ name: "History plan", priceMinor: 0, interval: "MONTHLY", availableFrom: "2020-01-01" }).expect(201);
  planId = plan.body.id;
  const product = await request(app).post(`${api}/products`).set(as(admin)).send({ name: "History product", type: "SOFTWARE", salesPriceMinor: 5000, costPriceMinor: 100 }).expect(201);
  productId = product.body.id;
  first = await customerWithHistory("hist-first@test.dev");
  second = await customerWithHistory("hist-second@test.dev");
});

afterAll(() => prisma.$disconnect());

describe("subscription history", () => {
  it("returns only the selected customer's records, with the fields the page shows", async () => {
    for (const token of [admin, staff]) {
      const res = await request(app).get(`${api}/subscriptions?customerId=${first.customerId}&limit=10`).set(as(token)).expect(200);
      expect(ids(res)).toEqual([first.subscriptionId]);
      expect(res.body).toMatchObject({ total: 1, page: 1, limit: 10 });
      expect(res.body.data[0]).toMatchObject({ status: "ACTIVE", plan: { name: "History plan" } });
      expect(res.body.data[0].number).toBeTruthy();
    }
  });

  it("returns nothing for an unknown customer rather than everyone's records", async () => {
    const res = await request(app).get(`${api}/subscriptions?customerId=missing`).set(as(admin)).expect(200);
    expect(res.body).toMatchObject({ data: [], total: 0 });
  });

  it("can't be widened by a customer naming someone else", async () => {
    const res = await request(app).get(`${api}/subscriptions?customerId=${second.customerId}`).set(as(first.token)).expect(200);
    expect(res.body).toMatchObject({ data: [], total: 0 });
    await request(app).get(`${api}/subscriptions/${second.subscriptionId}`).set(as(first.token)).expect(404);
  });
});

describe("invoice history", () => {
  it("returns only the selected customer's records, with the fields the page shows", async () => {
    for (const token of [admin, staff]) {
      const res = await request(app).get(`${api}/invoices?customerId=${second.customerId}&limit=10`).set(as(token)).expect(200);
      expect(ids(res)).toEqual([second.invoiceId]);
      expect(res.body).toMatchObject({ total: 1, page: 1, limit: 10 });
      expect(res.body.data[0]).toMatchObject({ status: "CONFIRMED", paidMinor: 0 });
      expect(res.body.data[0].subscription.number).toBeTruthy();
    }
  });

  it("returns nothing for an unknown customer rather than everyone's records", async () => {
    const res = await request(app).get(`${api}/invoices?customerId=missing`).set(as(admin)).expect(200);
    expect(res.body).toMatchObject({ data: [], total: 0 });
  });

  it("can't be widened by a customer naming someone else", async () => {
    const res = await request(app).get(`${api}/invoices?customerId=${second.customerId}`).set(as(first.token)).expect(200);
    expect(res.body).toMatchObject({ data: [], total: 0 });
    await request(app).get(`${api}/invoices/${second.invoiceId}`).set(as(first.token)).expect(404);
  });
});

describe("history access", () => {
  it("refuses anonymous callers", async () => {
    await request(app).get(`${api}/customers/${first.customerId}`).expect(401);
    await request(app).get(`${api}/subscriptions?customerId=${first.customerId}`).expect(401);
    await request(app).get(`${api}/invoices?customerId=${first.customerId}`).expect(401);
    await request(app).get(`${api}/payments`).expect(401);
  });

  it("keeps the customer record and payments list from customers", async () => {
    await request(app).get(`${api}/customers/${first.customerId}`).set(as(first.token)).expect(403);
    await request(app).get(`${api}/payments`).set(as(first.token)).expect(403);
  });
});

describe("payment history", () => {
  it("shows a payment on its invoice, to the team and the owner only, without internal fields", async () => {
    await request(app).post(`${api}/payments/invoice/${first.invoiceId}`).set(as(staff)).send({ method: "UPI", amountMinor: 100, paidOn: "2026-01-05" }).expect(201);
    for (const token of [admin, staff, first.token]) {
      const res = await request(app).get(`${api}/invoices/${first.invoiceId}`).set(as(token)).expect(200);
      expect(res.body.payments).toHaveLength(1);
      expect(res.body.payments[0]).toMatchObject({ method: "UPI", amountMinor: 100 });
      expect(res.body.payments[0].recordedById).toBeUndefined();
    }
    await request(app).get(`${api}/invoices/${first.invoiceId}`).set(as(second.token)).expect(404);
  });

  // Blocked on the finance module. Until then the filter is ignored, so the customer page must not call it.
  it.todo("GET /payments?customerId= returns only that customer's payments");
});
