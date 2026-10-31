import { describe, expect, it } from "vitest";
import { calculateInvoice, qualifies, type CalcDiscount, type CalcLine } from "../../src/modules/billing/calculators/invoice.calculator";
import { addIntervals } from "../../src/shared/utils/date";
import { passwordSchema } from "../../src/modules/auth/auth.schema";
import { canTransition } from "../../src/modules/subscriptions/subscription.constants";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
const line = (over: Partial<CalcLine> = {}): CalcLine => ({ key: "a", productId: "p1", quantity: 1, unitPriceMinor: 100000, taxRateBp: 1800, ...over });
const discount = (over: Partial<CalcDiscount> = {}): CalcDiscount => ({ id: "d", name: "D", type: "PERCENT", value: 1000, minPurchaseMinor: 0, minQuantity: 0, productIds: [], ...over });

describe("billing dates", () => {
  it("keeps month-end anchors without drifting", () => {
    const start = d("2026-01-31");
    expect(iso(addIntervals(start, "MONTHLY", 1))).toBe("2026-02-28");
    expect(iso(addIntervals(start, "MONTHLY", 2))).toBe("2026-03-31");
  });
  it("handles every interval, including leap days", () => {
    expect(iso(addIntervals(d("2026-12-31"), "DAILY", 1))).toBe("2027-01-01");
    expect(iso(addIntervals(d("2026-12-30"), "WEEKLY", 1))).toBe("2027-01-06");
    expect(iso(addIntervals(d("2024-02-29"), "YEARLY", 1))).toBe("2025-02-28");
    expect(iso(addIntervals(d("2024-02-29"), "YEARLY", 4))).toBe("2028-02-29");
  });
});

describe("invoice calculation", () => {
  it("matches the worked example: 1000 + 18% = 1180", () => {
    expect(calculateInvoice([line()], []).totalMinor).toBe(118000);
  });
  it("taxes the discounted amount", () => {
    const r = calculateInvoice([line()], [discount()]);
    expect(r).toMatchObject({ subtotalMinor: 100000, discountMinor: 10000, taxMinor: 16200, totalMinor: 106200 });
  });
  it("limits a product discount to that product's lines", () => {
    const r = calculateInvoice([line(), line({ key: "b", productId: "p2" })], [discount({ productIds: ["p2"] })]);
    expect(r.lines[0].discountMinor).toBe(0);
    expect(r.lines[1].discountMinor).toBe(10000);
  });
  it("never discounts below zero", () => {
    expect(calculateInvoice([line()], [discount({ type: "FIXED", value: 999999 })]).totalMinor).toBe(0);
  });
  it("allocates a fixed discount across lines to the exact paisa", () => {
    const lines = [line({ unitPriceMinor: 333 }), line({ key: "b", unitPriceMinor: 333 }), line({ key: "c", unitPriceMinor: 334 })];
    const r = calculateInvoice(lines, [discount({ type: "FIXED", value: 101 })]);
    expect(r.discountMinor).toBe(101);
    expect(r.lines.every((l) => l.discountMinor >= 0 && l.discountMinor <= l.quantity * l.unitPriceMinor)).toBe(true);
  });
  it("keeps stacked discounts within the line totals", () => {
    const r = calculateInvoice([line({ unitPriceMinor: 100 }), line({ key: "b", unitPriceMinor: 1 })], [discount({ type: "FIXED", value: 100 }), discount({ id: "e", type: "FIXED", value: 1 })]);
    expect(r.discountMinor).toBe(101);
    expect(r.totalMinor).toBe(0);
  });
  it("applies minimum quantity and purchase thresholds", () => {
    expect(qualifies([line({ quantity: 9 })], discount({ minQuantity: 10 }))).toBe(false);
    expect(qualifies([line({ quantity: 10 })], discount({ minQuantity: 10 }))).toBe(true);
    expect(qualifies([line()], discount({ minPurchaseMinor: 100001 }))).toBe(false);
  });
});

describe("password rule", () => {
  it.each([
    ["Abcdef@1", false], // exactly eight: the rule says more than eight
    ["Abcdefg@1", true],
    ["abcdefg@1", false],
    ["ABCDEFG@1", false],
    ["Abcdefgh1", false],
  ])("%s -> %s", (password, valid) => {
    expect(passwordSchema.safeParse(password).success).toBe(valid);
  });
});

describe("status machine", () => {
  it("follows the specified path and can't leave Closed", () => {
    expect(canTransition("DRAFT", "QUOTATION")).toBe(true);
    expect(canTransition("DRAFT", "ACTIVE")).toBe(false);
    expect(canTransition("QUOTATION", "ACTIVE")).toBe(false);
    expect(canTransition("CLOSED", "ACTIVE")).toBe(false);
  });
});
