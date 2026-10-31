import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app";
import { env } from "../../src/config/env";
import { prisma } from "../../src/config/database";
import { hashPassword } from "../../src/modules/auth/auth.service";

const api = "/api/v1";
const url = `${api}/customers`;
const PASSWORD = "Str0ng@Pass";
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
let admin: string, staff: string, customerToken: string, customerId: string, planId: string;
let seq = 0;
let deliver = true;

const email = () => `cust-${++seq}@test.dev`;
const login = async (address: string) => (await request(app).post(`${api}/auth/login`).send({ email: address, password: PASSWORD }).expect(200)).body.token as string;
const create = (body: Record<string, unknown> = {}, token = admin) => request(app).post(url).set(as(token)).send({ name: "Priya", email: email(), ...body });

async function subscribe(id: string, status: "DRAFT" | "ACTIVE" | "CLOSED") {
  const sub = await request(app).post(`${api}/subscriptions`).set(as(admin)).send({ customerId: id, planId, startDate: "2026-01-01", lines: [] }).expect(201);
  await prisma.subscription.update({ where: { id: sub.body.id }, data: { status } });
  return sub.body.id as string;
}

beforeAll(async () => {
  env.RESEND_API_KEY = "test-key";
  vi.stubGlobal("fetch", async () => {
    if (!deliver) throw new Error("provider down");
    return { ok: true };
  });
  const passwordHash = await hashPassword(PASSWORD);
  await prisma.user.createMany({
    data: [
      { email: "cust-admin@test.dev", name: "A", role: "ADMIN", passwordHash },
      { email: "cust-staff@test.dev", name: "S", role: "STAFF", passwordHash },
    ],
  });
  admin = await login("cust-admin@test.dev");
  staff = await login("cust-staff@test.dev");
  const signup = await request(app).post(`${api}/auth/signup`).send({ name: "Own", email: "cust-own@test.dev", password: PASSWORD }).expect(201);
  customerToken = signup.body.token;
  customerId = signup.body.user.customerId;
  const plan = await request(app).post(`${api}/plans`).set(as(admin)).send({ name: "Cust plan", priceMinor: 1000, interval: "MONTHLY", availableFrom: "2020-01-01" }).expect(201);
  planId = plan.body.id;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await prisma.$disconnect();
});

describe("creating a customer", () => {
  it("creates a CUSTOMER login and profile for admin and staff, whatever the payload claims", async () => {
    for (const token of [admin, staff]) {
      const address = email();
      const res = await create({ email: address, companyName: " Shah Retail ", phone: "+91 98765-43210", address: "Pune", role: "ADMIN" }, token);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ companyName: "Shah Retail", phone: "+91 98765-43210", address: "Pune", inviteSent: true, user: { email: address, active: true } });
      expect(JSON.stringify(res.body)).not.toContain("passwordHash");
      const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
      expect(user.role).toBe("CUSTOMER");
    }
  });

  it("refuses missing and invalid fields", async () => {
    expect((await create({ name: " " })).status).toBe(400);
    expect((await create({ phone: "-------" })).status).toBe(400);
    expect((await create({ phone: "+(((((((" })).status).toBe(400);
    expect((await create({ phone: "123-45 6" })).status).toBe(400);
    expect((await create({ phone: "(020) 1234567" })).status).toBe(201);
    expect((await create({ name: undefined })).status).toBe(400);
    expect((await create({ email: undefined })).status).toBe(400);
    expect((await create({ email: "nope" })).status).toBe(400);
    expect((await create({ phone: "call me" })).status).toBe(400);
    expect((await create({ phone: "123" })).status).toBe(400);
    expect((await create({ companyName: "x".repeat(201) })).status).toBe(400);
  });

  it("refuses a duplicate email in any case", async () => {
    const address = email();
    await create({ email: address });
    const res = await create({ email: address.toUpperCase() });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("That email already has an account");
  });

  it("stores blank optional fields as empty, not as blank strings", async () => {
    const res = await create({ companyName: " ", phone: "", address: null });
    expect(res.body).toMatchObject({ companyName: null, phone: null, address: null });
  });

  it("reports an invite that couldn't be delivered, and keeps the customer", async () => {
    deliver = false;
    const res = await create();
    deliver = true;
    expect(res.status).toBe(201);
    expect(res.body.inviteSent).toBe(false);
  });
});

describe("reading customers", () => {
  it("gets one customer, with a 404 for a missing one", async () => {
    const created = (await create({ companyName: "Solo Ltd" })).body;
    const res = await request(app).get(`${url}/${created.id}`).set(as(staff)).expect(200);
    expect(res.body).toMatchObject({ id: created.id, companyName: "Solo Ltd" });
    await request(app).get(`${url}/missing`).set(as(staff)).expect(404);
  });

  it("paginates and searches by name, company and email", async () => {
    const tag = `Needle${Date.now()}`;
    const first = (await create({ name: `${tag} one` })).body;
    await create({ companyName: `${tag} Ltd` });
    const address = `${tag.toLowerCase()}@test.dev`;
    await create({ email: address });
    const all = await request(app).get(`${url}?q=${tag}`).set(as(admin)).expect(200);
    expect(all.body).toMatchObject({ total: 3, page: 1, limit: 20 });
    const page1 = await request(app).get(`${url}?q=${tag}&limit=2&page=1`).set(as(admin)).expect(200);
    const page2 = await request(app).get(`${url}?q=${tag}&limit=2&page=2`).set(as(admin)).expect(200);
    const ids = [...page1.body.data, ...page2.body.data].map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toContain(first.id);
    await request(app).get(`${url}?limit=101`).set(as(admin)).expect(400);
  });
});

describe("updating a customer", () => {
  it("changes only submitted fields, and clears fields sent as null or blank", async () => {
    const { id } = (await create({ companyName: "Old Ltd", phone: "9876543210", address: "Pune" })).body;
    const renamed = await request(app).patch(`${url}/${id}`).set(as(staff)).send({ name: "Renamed", companyName: "New Ltd" }).expect(200);
    expect(renamed.body).toMatchObject({ companyName: "New Ltd", phone: "9876543210", address: "Pune", user: { name: "Renamed" } });
    const cleared = await request(app).patch(`${url}/${id}`).set(as(staff)).send({ phone: null, address: "" }).expect(200);
    expect(cleared.body).toMatchObject({ companyName: "New Ltd", phone: null, address: null });
  });

  it("refuses invalid details and missing customers, and can't change email or role", async () => {
    const { id, user } = (await create()).body;
    await request(app).patch(`${url}/${id}`).set(as(admin)).send({ name: "" }).expect(400);
    await request(app).patch(`${url}/${id}`).set(as(admin)).send({ phone: "nope" }).expect(400);
    await request(app).patch(`${url}/missing`).set(as(admin)).send({ name: "X" }).expect(404);
    const res = await request(app).patch(`${url}/${id}`).set(as(admin)).send({ email: "changed@test.dev", role: "ADMIN", active: false }).expect(200);
    expect(res.body.user).toMatchObject({ email: user.email, active: true });
    const row = await prisma.user.findUniqueOrThrow({ where: { email: user.email } });
    expect(row.role).toBe("CUSTOMER");
  });
});

describe("customer access control", () => {
  it("refuses anonymous callers and customers on every route", async () => {
    await request(app).get(url).expect(401);
    await request(app).post(url).send({ name: "X", email: email() }).expect(401);
    await request(app).get(`${url}/${customerId}`).expect(401);
    await request(app).patch(`${url}/${customerId}`).send({ name: "X" }).expect(401);
    await request(app).patch(`${url}/${customerId}/access`).send({ active: false }).expect(401);
    await request(app).get(url).set(as(customerToken)).expect(403);
    await create({}, customerToken).expect(403);
    // Including their own record.
    await request(app).get(`${url}/${customerId}`).set(as(customerToken)).expect(403);
    await request(app).patch(`${url}/${customerId}`).set(as(customerToken)).send({ name: "X" }).expect(403);
    await request(app).patch(`${url}/${customerId}/access`).set(as(customerToken)).send({ active: true }).expect(403);
  });

  it("keeps deactivation to the admin", async () => {
    const { id } = (await create()).body;
    await request(app).patch(`${url}/${id}/access`).set(as(staff)).send({ active: false }).expect(403);
    const row = await prisma.customer.findUniqueOrThrow({ where: { id }, include: { user: true } });
    expect(row.user.active).toBe(true);
  });

  it("offers no way to delete a customer", async () => {
    const { id } = (await create()).body;
    await request(app).delete(`${url}/${id}`).set(as(admin)).expect(404);
  });
});

describe("deactivating a customer", () => {
  it("ends their sessions and blocks sign-in, and old tokens stay dead after reactivation", async () => {
    const address = email();
    const { id } = (await create({ email: address })).body;
    await prisma.user.update({ where: { email: address }, data: { passwordHash: await hashPassword(PASSWORD) } });
    const token = await login(address);
    const off = await request(app).patch(`${url}/${id}/access`).set(as(admin)).send({ active: false }).expect(200);
    expect(off.body.user.active).toBe(false);
    await request(app).get(`${api}/auth/me`).set(as(token)).expect(401);
    await request(app).post(`${api}/auth/login`).send({ email: address, password: PASSWORD }).expect(401);
    await request(app).patch(`${url}/${id}/access`).set(as(admin)).send({ active: true }).expect(200);
    await request(app).get(`${api}/auth/me`).set(as(token)).expect(401);
    await login(address);
  });

  it("is refused while a subscription is open, and keeps history once allowed", async () => {
    const { id } = (await create()).body;
    const subId = await subscribe(id, "ACTIVE");
    const refused = await request(app).patch(`${url}/${id}/access`).set(as(admin)).send({ active: false }).expect(409);
    expect(refused.body.message).toContain("open subscriptions");
    await prisma.subscription.update({ where: { id: subId }, data: { status: "CLOSED" } });
    await request(app).patch(`${url}/${id}/access`).set(as(admin)).send({ active: false }).expect(200);
    const history = await request(app).get(`${api}/subscriptions?customerId=${id}`).set(as(admin)).expect(200);
    expect(history.body.data.map((s: { id: string }) => s.id)).toEqual([subId]);
  });

  it("isn't blocked by an unsent draft", async () => {
    const { id } = (await create()).body;
    await subscribe(id, "DRAFT");
    await request(app).patch(`${url}/${id}/access`).set(as(admin)).send({ active: false }).expect(200);
  });

  it("refuses bad input and missing customers", async () => {
    const { id } = (await create()).body;
    await request(app).patch(`${url}/${id}/access`).set(as(admin)).send({ active: "no" }).expect(400);
    await request(app).patch(`${url}/${id}/access`).set(as(admin)).send({}).expect(400);
    await request(app).patch(`${url}/missing/access`).set(as(admin)).send({ active: false }).expect(404);
  });
});
