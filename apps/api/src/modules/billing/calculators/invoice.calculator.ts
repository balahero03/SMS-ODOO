export interface CalcLine {
  key: string;
  productId: string | null;
  quantity: number;
  unitPriceMinor: number;
  taxRateBp: number;
}

export interface CalcDiscount {
  id: string;
  name: string;
  type: "FIXED" | "PERCENT";
  value: number;
  minPurchaseMinor: number;
  minQuantity: number;
  productIds: string[];
}

const gross = (l: CalcLine) => l.quantity * l.unitPriceMinor;

function eligibleLines(lines: CalcLine[], d: CalcDiscount) {
  return d.productIds.length ? lines.filter((l) => l.productId && d.productIds.includes(l.productId)) : lines;
}

// Thresholds are judged on the lines the discount covers, before any other discount.
export function qualifies(lines: CalcLine[], d: CalcDiscount): boolean {
  const eligible = eligibleLines(lines, d);
  const value = eligible.reduce((sum, l) => sum + gross(l), 0);
  const quantity = eligible.reduce((sum, l) => sum + l.quantity, 0);
  return value > 0 && value >= d.minPurchaseMinor && quantity >= d.minQuantity;
}

export function calculateInvoice(lines: CalcLine[], discounts: CalcDiscount[]) {
  const lineDiscount = new Map(lines.map((l) => [l.key, 0]));
  const applied: { id: string; name: string; amountMinor: number }[] = [];

  for (const d of discounts) {
    const eligible = eligibleLines(lines, d);
    const remaining = (l: CalcLine) => gross(l) - lineDiscount.get(l.key)!;
    const base = eligible.reduce((sum, l) => sum + remaining(l), 0);
    const amount = Math.min(base, d.type === "FIXED" ? d.value : Math.round((base * d.value) / 10000));
    if (amount <= 0) continue;
    // Split proportionally, with the rounding remainder going to the last line that has room.
    let left = amount;
    eligible.forEach((l, i) => {
      const share = i === eligible.length - 1 ? left : Math.min(left, Math.round((amount * remaining(l)) / base));
      lineDiscount.set(l.key, lineDiscount.get(l.key)! + share);
      left -= share;
    });
    for (const l of eligible) {
      if (left <= 0) break;
      const room = Math.min(left, remaining(l));
      lineDiscount.set(l.key, lineDiscount.get(l.key)! + room);
      left -= room;
    }
    applied.push({ id: d.id, name: d.name, amountMinor: amount });
  }

  const computed = lines.map((l) => {
    const discountMinor = lineDiscount.get(l.key)!;
    const taxMinor = Math.round(((gross(l) - discountMinor) * l.taxRateBp) / 10000);
    return { ...l, discountMinor, taxMinor, amountMinor: gross(l) - discountMinor + taxMinor };
  });
  const subtotalMinor = lines.reduce((sum, l) => sum + gross(l), 0);
  const discountMinor = computed.reduce((sum, l) => sum + l.discountMinor, 0);
  const taxMinor = computed.reduce((sum, l) => sum + l.taxMinor, 0);
  return { lines: computed, applied, subtotalMinor, discountMinor, taxMinor, totalMinor: subtotalMinor - discountMinor + taxMinor };
}
