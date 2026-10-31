import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any> & { id: string; name: string };

// Routes run for real against an in-memory stand-in, so these tests need no database.
const db = vi.hoisted(() => ({ plans: [] as any[], nextId: 1 }));

vi.mock("../../src/config/database", () => ({
  prisma: {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const role = where.id.toUpperCase();
        return { id: where.id, email: `${where.id}@test.dev`, name: where.id, role, active: true, tokenVersion: 0, customer: null };
      },
    },
    plan: {
      findMany: async ({ orderBy, skip = 0, take = Infinity }: { orderBy: Record<string, "asc">[]; skip?: number; take?: number }) => {
        const keys = orderBy.map((o) => Object.keys(o)[0]);
        const sorted = [...db.plans].sort((a: Row, b: Row) => {
          for (const k of keys) if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
          return 0;
        });
        return sorted.slice(skip, skip + take);
      },
      count: async () => db.plans.length,
      findUnique: async ({ where }: { where: { id: string } }) => db.plans.find((p: Row) => p.id === where.id) ?? null,
      create: async ({ data }: { data: Row }) => {
        const plan = { availableUntil: null, ...data, id: `plan-${db.nextId++}` };
        db.plans.push(plan);
        return plan;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const plan = db.plans.find((p: Row) => p.id === where.id);
        return Object.assign(plan, data);
      },
    },
  },
}));

const { app } = await import("../../src/app");
const { env } = await import("../../src/config/env");

const url = "/api/v1/plans";
const as = (id: "admin" | "staff" | "customer") => ({
  Authorization: `Bearer ${jwt.sign({ ver: 0 }, env.JWT_SECRET, { subject: id, algorithm: "HS256" })}`,
});
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const body = { name: "Monthly", priceMinor: 1000, interval: "MONTHLY", availableFrom: "2026-01-10" };
const seed = (over: Partial<Row> = {}) => {
  const plan: Row = {
    id: `plan-${db.nextId++}`,
    name: "Monthly",
    availableFrom: day("2026-01-10"),
    availableUntil: day("2026-06-30"),
    pausable: false,
    ...over,
  };
  db.plans.push(plan);
  return plan;
};

beforeEach(() => {
  db.plans.length = 0;
  db.nextId = 1;
});

describe("creating a plan", () => {
  it("accepts a range that ends on or after its start", async () => {
    await request(app).post(url).set(as("admin")).send({ ...body, availableUntil: "2026-01-10" }).expect(201);
    await request(app).post(url).set(as("admin")).send({ ...body, availableUntil: "2026-02-01" }).expect(201);
    await request(app).post(url).set(as("admin")).send(body).expect(201);
  });

  it("refuses a range that ends before its start", async () => {
    const res = await request(app).post(url).set(as("admin")).send({ ...body, availableUntil: "2026-01-09" }).expect(400);
    expect(res.body.message).toContain("availableUntil must not be before availableFrom");
    expect(db.plans).toHaveLength(0);
  });
});

describe("partially updating a plan's dates", () => {
  it("checks a new end date against the stored start date", async () => {
    const plan = seed();
    const res = await request(app).patch(`${url}/${plan.id}`).set(as("admin")).send({ availableUntil: "2026-01-09" }).expect(400);
    expect(res.body.message).toBe("availableUntil must not be before availableFrom");
    expect(plan.availableUntil).toEqual(day("2026-06-30"));
  });

  it("checks a new start date against the stored end date", async () => {
    const plan = seed();
    await request(app).patch(`${url}/${plan.id}`).set(as("admin")).send({ availableFrom: "2026-07-01" }).expect(400);
    expect(plan.availableFrom).toEqual(day("2026-01-10"));
  });

  it("refuses a reversed range when both dates are submitted", async () => {
    const plan = seed();
    await request(app).patch(`${url}/${plan.id}`).set(as("admin")).send({ availableFrom: "2026-03-02", availableUntil: "2026-03-01" }).expect(400);
  });

  it("accepts valid changes, including an end date equal to the stored start", async () => {
    const plan = seed();
    await request(app).patch(`${url}/${plan.id}`).set(as("admin")).send({ availableUntil: "2026-01-10" }).expect(200);
    expect(plan.availableUntil).toEqual(day("2026-01-10"));
    await request(app).patch(`${url}/${plan.id}`).set(as("admin")).send({ availableFrom: "2026-01-01" }).expect(200);
    expect(plan.availableFrom).toEqual(day("2026-01-01"));
  });

  it("lets a later start date through when the end date is cleared in the same request", async () => {
    const plan = seed();
    await request(app).patch(`${url}/${plan.id}`).set(as("admin")).send({ availableFrom: "2027-01-01", availableUntil: null }).expect(200);
    expect(plan.availableUntil).toBeNull();
  });

  it("allows any start date on a plan with no end date", async () => {
    const plan = seed({ availableUntil: null });
    await request(app).patch(`${url}/${plan.id}`).set(as("admin")).send({ availableFrom: "2030-01-01" }).expect(200);
  });

  it("leaves omitted fields alone", async () => {
    const plan = seed();
    await request(app).patch(`${url}/${plan.id}`).set(as("admin")).send({ name: "Renamed" }).expect(200);
    expect(plan).toMatchObject({ name: "Renamed", pausable: false, availableUntil: day("2026-06-30") });
  });

  it("returns 404 for a missing plan", async () => {
    const res = await request(app).patch(`${url}/missing`).set(as("admin")).send({ name: "X" }).expect(404);
    expect(res.body.message).toBe("Plan not found");
  });
});

describe("reading one plan", () => {
  it("returns an existing plan to the team", async () => {
    const plan = seed({ name: "Yearly" });
    for (const role of ["admin", "staff"] as const) {
      const res = await request(app).get(`${url}/${plan.id}`).set(as(role)).expect(200);
      expect(res.body).toMatchObject({ id: plan.id, name: "Yearly" });
    }
  });

  it("returns 404 for a missing plan", async () => {
    const res = await request(app).get(`${url}/missing`).set(as("admin")).expect(404);
    expect(res.body.message).toBe("Plan not found");
  });
});

describe("listing plans", () => {
  it("returns every plan without paging, for selection lists", async () => {
    for (let i = 0; i < 25; i += 1) seed({ name: `Plan ${String(i).padStart(2, "0")}` });
    const res = await request(app).get(url).set(as("staff")).expect(200);
    expect(res.body.data).toHaveLength(25);
    expect(res.body.total).toBeUndefined();
  });

  it("uses the default page size once paging is requested", async () => {
    for (let i = 0; i < 25; i += 1) seed({ name: `Plan ${String(i).padStart(2, "0")}` });
    const res = await request(app).get(`${url}?page=1`).set(as("staff")).expect(200);
    expect(res.body).toMatchObject({ total: 25, page: 1, limit: 20 });
    expect(res.body.data).toHaveLength(20);
    expect(res.body.data[0].name).toBe("Plan 00");
  });

  it("walks every plan exactly once, even with duplicate names", async () => {
    for (let i = 0; i < 5; i += 1) seed({ name: "Same" });
    const first = await request(app).get(`${url}?limit=2&page=1`).set(as("admin")).expect(200);
    const second = await request(app).get(`${url}?limit=2&page=2`).set(as("admin")).expect(200);
    const third = await request(app).get(`${url}?limit=2&page=3`).set(as("admin")).expect(200);
    const ids = [...first.body.data, ...second.body.data, ...third.body.data].map((p: Row) => p.id);
    expect(new Set(ids).size).toBe(5);
    expect(second.body).toMatchObject({ total: 5, page: 2, limit: 2 });
  });

  it("returns an empty page past the end", async () => {
    seed();
    const res = await request(app).get(`${url}?page=2`).set(as("admin")).expect(200);
    expect(res.body).toMatchObject({ data: [], total: 1, page: 2 });
  });

  it("refuses invalid paging values", async () => {
    for (const q of ["page=0", "limit=0", "limit=101", "page=abc"]) {
      await request(app).get(`${url}?${q}`).set(as("admin")).expect(400);
    }
  });
});

describe("plan access", () => {
  it("lets only the admin write", async () => {
    const plan = seed();
    for (const role of ["staff", "customer"] as const) {
      await request(app).post(url).set(as(role)).send(body).expect(403);
      await request(app).patch(`${url}/${plan.id}`).set(as(role)).send({ name: "X" }).expect(403);
    }
    expect(db.plans).toHaveLength(1);
    expect(plan.name).toBe("Monthly");
  });

  it("requires a token, and keeps customers out of reads", async () => {
    const plan = seed();
    await request(app).get(url).expect(401);
    await request(app).get(`${url}/${plan.id}`).expect(401);
    await request(app).post(url).send(body).expect(401);
    await request(app).patch(`${url}/${plan.id}`).send({ name: "X" }).expect(401);
    await request(app).get(url).set(as("customer")).expect(403);
    await request(app).get(`${url}/${plan.id}`).set(as("customer")).expect(403);
  });
});
