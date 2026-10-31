import type { Prisma } from "@prisma/client";

// Row-locked counter: gap-free within committed transactions, unlike a Postgres sequence.
export async function nextNumber(tx: Prisma.TransactionClient, name: "SUB" | "INV"): Promise<string> {
  const [row] = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("name", "value") VALUES (${name}, 1)
    ON CONFLICT ("name") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return `${name}-${String(row.value).padStart(6, "0")}`;
}
