import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";
import { hashPassword } from "../../src/modules/auth/auth.service";
import { billSubscription } from "../../src/modules/billing/billing.service";

const api = "/api/v1";
const url = `${api}/plans`;
const PASSWORD = "Str0ng@Pass";
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
let admin: string, staff: string, customer: string, customerId: string, productId: string;
let seq = 0;

const login = async (email: string) => (await request(app).post(`${api}/auth/login`).send({ email, password: PASSWORD }).expect(200)).body.token as string;
const body = (over: Record<string, unknown> = {}) => ({ name: `Plan ${++seq}`, priceMinor: 1000, interval: "MONTHLY", availableFrom: "2020-01-01", ...over });
const create = (over: Record<string, unknown> = {}) => request(app).post(url).set(as(admin)).send(body(over));
const subscribe = (planId: string) =>
  request(app).post(`${api}/subscriptions`).set(as(admin)).send({ customerId, planId, startDate: "2026-01-01", lines: [{ productId, quantity: 1 }] });

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);
  await prisma.user.createMany({
    data: [
      { email: "plan-admin@test.dev", name: "A", role: "ADMIN", passwordHash },
      { email: "plan-staff@test.dev", name: "S", role: "STAFF", passwordHash },
    ],
  });
  admin = await login("plan-admin@test.dev");
  staff = await login("plan-staff@test.dev");
  const signup = await request(app).post(`${api}/auth/signup`).send({ name: "C", email: "plan-cust@test.dev", password: PASSWORD }).expect(201);
  customer = signup.body.token;
  customerId = signup.body.user.customerId;
  const product = await request(app).post(`${api}/products`).set(as(admin)).send({ name: "Plan test product", type: "SOFTWARE", salesPriceMinor: 5000, costPriceMinor: 100 }).expect(201);
  productId = product.body.id;
});

afterAll(() => prisma.$disconnect());

describe("creating plans", () => {
  it("applies defaults and stores the billing configuration", async () => {
    const res = await create({ availableUntil: "2030-12-31" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ priceMinor: 1000, interval: "MONTHLY", minQuantity: 1, autoClose: false, closable: true, pausable: true, renewable: true, active: true });
    expect(res.body.availableFrom.slice(0, 10)).toBe("2020-01-01");
    expect(res.body.availableUntil.slice(0, 10)).toBe("2030-12-31");
  });

  it.each(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"])("accepts %s billing", async (interval) => {
    expect((await create({ interval })).status).toBe(201);
  });

  it("allows a zero fee, and the largest the column can hold", async () => {
    expect((await create({ priceMinor: 0 })).status).toBe(201);
    expect((await create({ priceMinor: 2_147_483_647 })).status).toBe(201);
  });

  it.each([
    ["a blank name", { name: " " }],
    ["a negative price", { priceMinor: -1 }],
    ["a fractional price", { priceMinor: 1.5 }],
    ["a price beyond the column's range", { priceMinor: 2_147_483_648 }],
    ["a string price", { priceMinor: "1000" }],
    ["an unknown interval", { interval: "HOURLY" }],
    ["a zero minimum quantity", { minQuantity: 0 }],
    ["a badly formatted date", { availableFrom: "01/02/2026" }],
    ["an impossible date", { availableFrom: "2026-13-45" }],
    ["an end before the start", { availableFrom: "2026-02-01", availableUntil: "2026-01-31" }],
  ])("refuses %s, and creates nothing", async (_name, over) => {
    const name = `Refused ${++seq}`;
    expect((await create({ name, ...over })).status).toBe(400);
    expect(await prisma.plan.count({ where: { name } })).toBe(0);
  });

  it("requires name, price, interval and start date", async () => {
    for (const field of ["name", "priceMinor", "interval", "availableFrom"]) {
      expect((await create({ [field]: undefined })).status).toBe(400);
    }
  });
});

describe("listing and reading plans", () => {
  it("returns every plan without paging, for selection lists", async () => {
    const res = await request(app).get(url).set(as(staff)).expect(200);
    expect(res.body.data).toHaveLength(await prisma.plan.count());
    expect(res.body.total).toBeUndefined();
  });

  it("paginates once page or limit is given, within a filter", async () => {
    const tag = `Pager${Date.now()}`;
    for (const n of [1, 2, 3]) await create({ name: `${tag} ${n}` });
    const page1 = await request(app).get(`${url}?q=${tag}&limit=2`).set(as(admin)).expect(200);
    expect(page1.body).toMatchObject({ total: 3, page: 1, limit: 2 });
    const page2 = await request(app).get(`${url}?q=${tag}&limit=2&page=2`).set(as(admin)).expect(200);
    const names = [...page1.body.data, ...page2.body.data].map((p: { name: string }) => p.name);
    expect(names).toEqual([`${tag} 1`, `${tag} 2`, `${tag} 3`]);
    await request(app).get(`${url}?limit=101`).set(as(admin)).expect(400);
    await request(app).get(`${url}?page=0`).set(as(admin)).expect(400);
  });

  it("filters by name in any case, interval and status", async () => {
    const tag = `Filter${Date.now()}`;
    const monthly = (await create({ name: `${tag} a` })).body;
    const yearly = (await create({ name: `${tag} b`, interval: "YEARLY", active: false })).body;
    const ids = async (query: string) => (await request(app).get(`${url}?q=${tag.toUpperCase()}${query}`).set(as(admin)).expect(200)).body.data.map((p: { id: string }) => p.id);
    expect(await ids("")).toEqual([monthly.id, yearly.id]);
    expect(await ids("&interval=YEARLY")).toEqual([yearly.id]);
    expect(await ids("&active=true")).toEqual([monthly.id]);
    expect(await ids("&active=false")).toEqual([yearly.id]);
    await request(app).get(`${url}?interval=HOURLY`).set(as(admin)).expect(400);
    await request(app).get(`${url}?active=maybe`).set(as(admin)).expect(400);
  });

  it("gets one plan with its usage, with a 404 for a missing one", async () => {
    const { id } = (await create()).body;
    await subscribe(id).expect(201);
    const res = await request(app).get(`${url}/${id}`).set(as(staff)).expect(200);
    expect(res.body).toMatchObject({ id, _count: { subscriptions: 1, templates: 0 } });
    await request(app).get(`${url}/missing`).set(as(staff)).expect(404);
  });
});

describe("updating plans", () => {
  it("changes only submitted fields", async () => {
    const { id } = (await create({ pausable: false, minQuantity: 5 })).body;
    const res = await request(app).patch(`${url}/${id}`).set(as(admin)).send({ name: "Renamed" }).expect(200);
    expect(res.body).toMatchObject({ name: "Renamed", pausable: false, minQuantity: 5, closable: true, active: true });
  });

  it("checks partial date updates against the stored dates in the real database", async () => {
    const { id } = (await create({ availableFrom: "2026-01-10", availableUntil: "2026-06-30" })).body;
    await request(app).patch(`${url}/${id}`).set(as(admin)).send({ availableUntil: "2026-01-09" }).expect(400);
    await request(app).patch(`${url}/${id}`).set(as(admin)).send({ availableFrom: "2026-07-01" }).expect(400);
    await request(app).patch(`${url}/${id}`).set(as(admin)).send({ availableUntil: "2026-01-10" }).expect(200);
    await request(app).patch(`${url}/${id}`).set(as(admin)).send({ availableFrom: "2027-01-01", availableUntil: null }).expect(200);
  });

  it("refuses invalid values and missing plans", async () => {
    const { id } = (await create()).body;
    for (const change of [{ name: "" }, { priceMinor: -1 }, { priceMinor: 2_147_483_648 }, { minQuantity: 0 }, { interval: "HOURLY" }]) {
      await request(app).patch(`${url}/${id}`).set(as(admin)).send(change).expect(400);
    }
    await request(app).patch(`${url}/missing`).set(as(admin)).send({ name: "X" }).expect(404);
  });

  it("refuses to change the billing interval, but allows resending the same one", async () => {
    const { id } = (await create({ interval: "MONTHLY" })).body;
    const res = await request(app).patch(`${url}/${id}`).set(as(admin)).send({ interval: "YEARLY" }).expect(409);
    expect(res.body.message).toContain("can't be changed");
    await request(app).patch(`${url}/${id}`).set(as(admin)).send({ interval: "MONTHLY", name: "Same" }).expect(200);
    expect((await prisma.plan.findUniqueOrThrow({ where: { id } })).interval).toBe("MONTHLY");
  });

  it("offers no way to delete a plan", async () => {
    const { id } = (await create()).body;
    await request(app).delete(`${url}/${id}`).set(as(admin)).expect(404);
  });
});

describe("retiring plans", () => {
  it("blocks new subscriptions but leaves existing ones, and can be restored", async () => {
    const { id } = (await create()).body;
    const existing = (await subscribe(id).expect(201)).body;
    const retired = await request(app).patch(`${url}/${id}`).set(as(admin)).send({ active: false }).expect(200);
    expect(retired.body.active).toBe(false);
    await subscribe(id).expect(400);
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: existing.id } });
    expect(sub.planId).toBe(id);
    await request(app).patch(`${url}/${id}`).set(as(admin)).send({ active: true }).expect(200);
    await subscribe(id).expect(201);
  });
});

describe("pricing history", () => {
  it("leaves issued invoices alone when the fee changes; the next invoice uses the new fee", async () => {
    const { id: planId } = (await create({ priceMinor: 1000 })).body;
    const { id } = (await subscribe(planId).expect(201)).body;
    await prisma.subscription.update({ where: { id }, data: { status: "ACTIVE", nextBillingDate: day("2026-01-01") } });
    const lineBefore = await prisma.subscriptionLine.findFirstOrThrow({ where: { subscriptionId: id } });
    expect(await billSubscription(id, day("2026-01-01"))).toBe("billed");
    const first = await prisma.invoice.findFirstOrThrow({ where: { subscriptionId: id } });

    await request(app).patch(`${url}/${planId}`).set(as(admin)).send({ priceMinor: 9000 }).expect(200);

    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: first.id } })).totalMinor).toBe(first.totalMinor);
    const lineAfter = await prisma.subscriptionLine.findFirstOrThrow({ where: { subscriptionId: id } });
    expect(lineAfter.unitPriceMinor).toBe(lineBefore.unitPriceMinor);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id } })).planId).toBe(planId);

    expect(await billSubscription(id, day("2026-02-01"))).toBe("billed");
    const second = await prisma.invoice.findFirstOrThrow({ where: { subscriptionId: id, id: { not: first.id } } });
    expect(second.totalMinor).toBeGreaterThan(first.totalMinor);
  });
});

describe("plan access control", () => {
  it("refuses anonymous callers and customers on every route", async () => {
    const { id } = (await create()).body;
    const calls = (token?: string) => {
      const set = (r: request.Test) => (token ? r.set(as(token)) : r);
      return [
        set(request(app).get(url)),
        set(request(app).get(`${url}/${id}`)),
        set(request(app).post(url)).send(body()),
        set(request(app).patch(`${url}/${id}`)).send({ name: "X" }),
      ];
    };
    for (const call of calls()) expect((await call).status).toBe(401);
    for (const call of calls(customer)) expect((await call).status).toBe(403);
  });

  it("lets staff read but not write", async () => {
    const plan = (await create()).body;
    await request(app).get(url).set(as(staff)).expect(200);
    await request(app).get(`${url}/${plan.id}`).set(as(staff)).expect(200);
    await request(app).post(url).set(as(staff)).send(body()).expect(403);
    await request(app).patch(`${url}/${plan.id}`).set(as(staff)).send({ active: false }).expect(403);
    expect((await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).active).toBe(true);
  });
});
