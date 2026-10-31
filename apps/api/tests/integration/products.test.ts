import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/config/database";
import { hashPassword } from "../../src/modules/auth/auth.service";

const api = "/api/v1";
const url = `${api}/products`;
const PASSWORD = "Str0ng@Pass";
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
let admin: string, staff: string, customer: string, customerId: string, planId: string;
let seq = 0;

const login = async (email: string) => (await request(app).post(`${api}/auth/login`).send({ email, password: PASSWORD }).expect(200)).body.token as string;
const body = (over: Record<string, unknown> = {}) => ({ name: `Product ${++seq}`, type: "SOFTWARE", salesPriceMinor: 100000, costPriceMinor: 10000, ...over });
const create = (over: Record<string, unknown> = {}) => request(app).post(url).set(as(admin)).send(body(over));
const variant = { attribute: "Brand", value: "Odoo", extraPriceMinor: 56000 };

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);
  await prisma.user.createMany({
    data: [
      { email: "prod-admin@test.dev", name: "A", role: "ADMIN", passwordHash },
      { email: "prod-staff@test.dev", name: "S", role: "STAFF", passwordHash },
    ],
  });
  admin = await login("prod-admin@test.dev");
  staff = await login("prod-staff@test.dev");
  const signup = await request(app).post(`${api}/auth/signup`).send({ name: "C", email: "prod-cust@test.dev", password: PASSWORD }).expect(201);
  customer = signup.body.token;
  customerId = signup.body.user.customerId;
  const plan = await request(app).post(`${api}/plans`).set(as(admin)).send({ name: "Prod plan", priceMinor: 0, interval: "MONTHLY", availableFrom: "2020-01-01" }).expect(201);
  planId = plan.body.id;
});

afterAll(() => prisma.$disconnect());

describe("creating products", () => {
  it("creates a product with its variants", async () => {
    const res = await create({ notes: " Hosted ", variants: [variant, { attribute: "Brand", value: "Other" }] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ notes: "Hosted", active: true });
    expect(res.body.variants).toHaveLength(2);
    expect(res.body.variants.find((v: { value: string }) => v.value === "Other").extraPriceMinor).toBe(0);
  });

  it.each([
    ["a blank name", { name: " " }],
    ["an unknown type", { type: "HARDWARE" }],
    ["a negative price", { salesPriceMinor: -1 }],
    ["a fractional price", { costPriceMinor: 1.5 }],
    ["a price beyond the column's range", { salesPriceMinor: 2_147_483_648 }],
    ["a string price", { salesPriceMinor: "100" }],
    ["a blank variant value", { variants: [{ attribute: "Brand", value: " " }] }],
    ["the same variant twice", { variants: [variant, variant] }],
  ])("refuses %s, and creates nothing", async (_name, over) => {
    const name = `Refused ${++seq}`;
    expect((await create({ name, ...over })).status).toBe(400);
    expect(await prisma.product.count({ where: { name } })).toBe(0);
  });

  it("accepts the largest price the column can hold", async () => {
    expect((await create({ salesPriceMinor: 2_147_483_647 })).status).toBe(201);
  });
});

describe("listing and reading products", () => {
  it("returns every product without paging, for selection lists", async () => {
    const res = await request(app).get(url).set(as(staff)).expect(200);
    expect(res.body.data).toHaveLength(await prisma.product.count());
    expect(res.body.total).toBeUndefined();
  });

  it("paginates once page or limit is given", async () => {
    const tag = `Pager${Date.now()}`;
    for (const n of [1, 2, 3]) await create({ name: `${tag} ${n}` });
    const page1 = await request(app).get(`${url}?q=${tag}&limit=2`).set(as(admin)).expect(200);
    expect(page1.body).toMatchObject({ total: 3, page: 1, limit: 2 });
    const page2 = await request(app).get(`${url}?q=${tag}&limit=2&page=2`).set(as(admin)).expect(200);
    const names = [...page1.body.data, ...page2.body.data].map((p: { name: string }) => p.name);
    expect(names).toEqual([`${tag} 1`, `${tag} 2`, `${tag} 3`]);
    const defaults = await request(app).get(`${url}?page=1`).set(as(admin)).expect(200);
    expect(defaults.body.limit).toBe(20);
    await request(app).get(`${url}?limit=101`).set(as(admin)).expect(400);
    await request(app).get(`${url}?page=0`).set(as(admin)).expect(400);
  });

  it("filters by name in any case, type and availability", async () => {
    const tag = `Filter${Date.now()}`;
    const software = (await create({ name: `${tag} a` })).body;
    const addon = (await create({ name: `${tag} b`, type: "ADDON", active: false })).body;
    const ids = async (query: string) => (await request(app).get(`${url}?q=${tag.toUpperCase()}${query}`).set(as(admin)).expect(200)).body.data.map((p: { id: string }) => p.id);
    expect(await ids("")).toEqual([software.id, addon.id]);
    expect(await ids("&type=ADDON")).toEqual([addon.id]);
    expect(await ids("&active=true")).toEqual([software.id]);
    expect(await ids("&active=false")).toEqual([addon.id]);
    await request(app).get(`${url}?type=NOPE`).set(as(admin)).expect(400);
    await request(app).get(`${url}?active=maybe`).set(as(admin)).expect(400);
  });

  it("gets one product with its variants, with a 404 for a missing one", async () => {
    const { id } = (await create({ variants: [variant] })).body;
    const res = await request(app).get(`${url}/${id}`).set(as(staff)).expect(200);
    expect(res.body.variants[0]).toMatchObject({ attribute: "Brand", value: "Odoo" });
    await request(app).get(`${url}/missing`).set(as(staff)).expect(404);
  });
});

describe("updating products", () => {
  it("changes only submitted fields and clears blank notes", async () => {
    const { id } = (await create({ notes: "Keep", salesPriceMinor: 500 })).body;
    const renamed = await request(app).patch(`${url}/${id}`).set(as(admin)).send({ name: "Renamed" }).expect(200);
    expect(renamed.body).toMatchObject({ name: "Renamed", notes: "Keep", salesPriceMinor: 500, active: true });
    const cleared = await request(app).patch(`${url}/${id}`).set(as(admin)).send({ notes: "" }).expect(200);
    expect(cleared.body.notes).toBeNull();
  });

  it("refuses invalid values and missing products", async () => {
    const { id } = (await create()).body;
    await request(app).patch(`${url}/${id}`).set(as(admin)).send({ name: "" }).expect(400);
    await request(app).patch(`${url}/${id}`).set(as(admin)).send({ salesPriceMinor: -1 }).expect(400);
    await request(app).patch(`${url}/missing`).set(as(admin)).send({ name: "X" }).expect(404);
  });

  it("retires and restores; a retired product can't go on a new subscription, and an existing line stays", async () => {
    const { id } = (await create()).body;
    const line = { customerId, planId, startDate: "2026-01-01", lines: [{ productId: id, quantity: 1 }] };
    const sub = await request(app).post(`${api}/subscriptions`).set(as(admin)).send(line).expect(201);
    await request(app).patch(`${url}/${id}`).set(as(admin)).send({ active: false }).expect(200);
    await request(app).post(`${api}/subscriptions`).set(as(admin)).send(line).expect(400);
    const kept = await prisma.subscriptionLine.findMany({ where: { subscriptionId: sub.body.id } });
    expect(kept).toHaveLength(1);
    await request(app).patch(`${url}/${id}`).set(as(admin)).send({ active: true }).expect(200);
    await request(app).post(`${api}/subscriptions`).set(as(admin)).send(line).expect(201);
  });

  it("offers no way to delete a product", async () => {
    const { id } = (await create()).body;
    await request(app).delete(`${url}/${id}`).set(as(admin)).expect(404);
    expect(await prisma.product.findUnique({ where: { id } })).not.toBeNull();
  });
});

describe("variants", () => {
  it("adds a variant, and refuses a duplicate on the same product only", async () => {
    const first = (await create()).body.id;
    const second = (await create()).body.id;
    const res = await request(app).post(`${url}/${first}/variants`).set(as(admin)).send(variant).expect(201);
    expect(res.body).toMatchObject({ ...variant, productId: first });
    const duplicate = await request(app).post(`${url}/${first}/variants`).set(as(admin)).send(variant).expect(409);
    expect(duplicate.body.message).toContain("already has a variant");
    await request(app).post(`${url}/${second}/variants`).set(as(admin)).send(variant).expect(201);
  });

  it("refuses invalid input and a missing product", async () => {
    const { id } = (await create()).body;
    await request(app).post(`${url}/${id}/variants`).set(as(admin)).send({ attribute: "", value: "x" }).expect(400);
    await request(app).post(`${url}/${id}/variants`).set(as(admin)).send({ ...variant, extraPriceMinor: -1 }).expect(400);
    await request(app).post(`${url}/missing/variants`).set(as(admin)).send(variant).expect(404);
  });

  it("updates a variant, leaving existing subscription lines' prices alone", async () => {
    const product = (await create({ variants: [variant] })).body;
    const variantId = product.variants[0].id;
    const sub = await request(app).post(`${api}/subscriptions`).set(as(admin)).send({ customerId, planId, startDate: "2026-01-01", lines: [{ productId: product.id, variantId, quantity: 1 }] }).expect(201);
    const before = await prisma.subscriptionLine.findFirstOrThrow({ where: { subscriptionId: sub.body.id } });
    const res = await request(app).patch(`${url}/${product.id}/variants/${variantId}`).set(as(admin)).send({ extraPriceMinor: 1 }).expect(200);
    expect(res.body).toMatchObject({ attribute: "Brand", value: "Odoo", extraPriceMinor: 1 });
    const after = await prisma.subscriptionLine.findFirstOrThrow({ where: { subscriptionId: sub.body.id } });
    expect(after.unitPriceMinor).toBe(before.unitPriceMinor);
  });

  it("refuses an update that would duplicate another variant, or bad references", async () => {
    const product = (await create({ variants: [variant, { attribute: "Brand", value: "Other" }] })).body;
    const other = product.variants.find((v: { value: string }) => v.value === "Other").id;
    await request(app).patch(`${url}/${product.id}/variants/${other}`).set(as(admin)).send({ value: "Odoo" }).expect(409);
    await request(app).patch(`${url}/${product.id}/variants/${other}`).set(as(admin)).send({ value: "" }).expect(400);
    await request(app).patch(`${url}/${product.id}/variants/missing`).set(as(admin)).send({ value: "X" }).expect(404);
    const stranger = (await create()).body.id;
    await request(app).patch(`${url}/${stranger}/variants/${other}`).set(as(admin)).send({ value: "X" }).expect(404);
  });

  it("removes an unused variant, but not through another product or twice", async () => {
    const product = (await create({ variants: [variant] })).body;
    const variantId = product.variants[0].id;
    const stranger = (await create()).body.id;
    await request(app).delete(`${url}/${stranger}/variants/${variantId}`).set(as(admin)).expect(404);
    await request(app).delete(`${url}/${product.id}/variants/${variantId}`).set(as(admin)).expect(204);
    await request(app).delete(`${url}/${product.id}/variants/${variantId}`).set(as(admin)).expect(404);
  });

  it("refuses to remove a variant used on a subscription, and keeps the line's link", async () => {
    const product = (await create({ variants: [variant] })).body;
    const variantId = product.variants[0].id;
    const sub = await request(app).post(`${api}/subscriptions`).set(as(admin)).send({ customerId, planId, startDate: "2026-01-01", lines: [{ productId: product.id, variantId, quantity: 1 }] }).expect(201);
    const res = await request(app).delete(`${url}/${product.id}/variants/${variantId}`).set(as(admin)).expect(409);
    expect(res.body.message).toContain("used on subscriptions");
    const line = await prisma.subscriptionLine.findFirstOrThrow({ where: { subscriptionId: sub.body.id } });
    expect(line.variantId).toBe(variantId);
  });
});

describe("product access control", () => {
  it("refuses anonymous callers and customers on every route", async () => {
    const product = (await create({ variants: [variant] })).body;
    const variantUrl = `${url}/${product.id}/variants/${product.variants[0].id}`;
    const calls = (token?: string) => {
      const set = (r: request.Test) => (token ? r.set(as(token)) : r);
      return [
        set(request(app).get(url)),
        set(request(app).get(`${url}/${product.id}`)),
        set(request(app).post(url)).send(body()),
        set(request(app).patch(`${url}/${product.id}`)).send({ name: "X" }),
        set(request(app).post(`${url}/${product.id}/variants`)).send({ attribute: "A", value: "B" }),
        set(request(app).patch(variantUrl)).send({ value: "B" }),
        set(request(app).delete(variantUrl)),
      ];
    };
    for (const call of calls()) expect((await call).status).toBe(401);
    for (const call of calls(customer)) expect((await call).status).toBe(403);
  });

  it("lets staff read but not write", async () => {
    const product = (await create({ variants: [variant] })).body;
    const variantUrl = `${url}/${product.id}/variants/${product.variants[0].id}`;
    await request(app).get(url).set(as(staff)).expect(200);
    await request(app).get(`${url}/${product.id}`).set(as(staff)).expect(200);
    await request(app).post(url).set(as(staff)).send(body()).expect(403);
    await request(app).patch(`${url}/${product.id}`).set(as(staff)).send({ name: "X" }).expect(403);
    await request(app).post(`${url}/${product.id}/variants`).set(as(staff)).send({ attribute: "A", value: "B" }).expect(403);
    await request(app).patch(variantUrl).set(as(staff)).send({ value: "B" }).expect(403);
    await request(app).delete(variantUrl).set(as(staff)).expect(403);
    const after = await request(app).get(`${url}/${product.id}`).set(as(admin)).expect(200);
    expect(after.body).toMatchObject({ name: product.name, variants: [expect.objectContaining({ value: "Odoo" })] });
  });
});
