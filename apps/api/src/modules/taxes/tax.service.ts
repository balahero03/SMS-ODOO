import type { Prisma, ProductType, TaxRule } from "@prisma/client";

export function taxRateFor(rules: Pick<TaxRule, "rateBp" | "productType">[], type: ProductType | null): number {
  return rules.filter((r) => r.productType === null || r.productType === type).reduce((sum, r) => sum + r.rateBp, 0);
}

export const activeTaxRules = (db: Prisma.TransactionClient) => db.taxRule.findMany({ where: { active: true } });
