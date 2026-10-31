import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, ErrorText, Field, Input, Page, Select, Table, Toggle, useAction } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { date, money, percent, today, toMinor } from "../../../lib/format";
import { formValues } from "../../../lib/form";

export function Discounts() {
  const { user } = useAuth();
  const admin = user!.role === "ADMIN";
  const [type, setType] = useState("PERCENT");
  const [productIds, setProductIds] = useState<string[]>([]);
  const { data, error } = useQuery({ queryKey: ["discounts"], queryFn: () => api("/discounts") });
  const products = useQuery({ queryKey: ["products"], queryFn: () => api("/products") });
  const create = useAction((v: Record<string, string>) =>
    api("/discounts", {
      body: {
        name: v.name,
        type,
        value: type === "PERCENT" ? Math.round(Number(v.value) * 100) : toMinor(v.value),
        minPurchaseMinor: toMinor(v.minPurchase ?? 0),
        minQuantity: Number(v.minQuantity ?? 0),
        startDate: v.startDate,
        endDate: v.endDate,
        usageLimit: v.usageLimit ? Number(v.usageLimit) : null,
        productIds,
      },
    }),
  );
  return (
    <Page title="Discounts">
      {admin && (
        <Toggle label="Add discount">
          {(close) => (
            <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { const v = formValues(e); create.mutate(v, { onSuccess: () => { setProductIds([]); close(); } }); }}>
              <Field label="Name"><Input name="name" required /></Field>
              <Field label="Type">
                <Select value={type} onChange={(e) => setType(e.target.value)}><option value="PERCENT">Percentage</option><option value="FIXED">Fixed amount</option></Select>
              </Field>
              <Field label={type === "PERCENT" ? "Percent off" : "Amount off (₹)"}><Input name="value" type="number" step="0.01" min="0.01" max={type === "PERCENT" ? 100 : undefined} required /></Field>
              <Field label="Minimum purchase (₹)"><Input name="minPurchase" type="number" step="0.01" min="0" /></Field>
              <Field label="Minimum quantity"><Input name="minQuantity" type="number" min="0" /></Field>
              <Field label="Usage limit" hint="Each invoice counts as one use. Blank means no limit."><Input name="usageLimit" type="number" min="1" /></Field>
              <Field label="Start date"><Input name="startDate" type="date" defaultValue={today()} required /></Field>
              <Field label="End date"><Input name="endDate" type="date" required /></Field>
              <Field label="Products" hint="None selected means the whole subscription.">
                <select multiple aria-label="Products" className="w-full rounded-md border border-slate-300 p-1 text-sm" value={productIds} onChange={(e) => setProductIds([...e.target.selectedOptions].map((o) => o.value))}>
                  {(products.data?.data as any[])?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div className="md:col-span-3"><ErrorText error={create.error} /></div>
              <div><Button type="submit" disabled={create.isPending}>Save</Button></div>
            </form>
          )}
        </Toggle>
      )}
      <Card>
        <p className="mb-3 text-sm text-slate-600">Apply a discount from a subscription's page. It then appears on each invoice by itself until it expires or runs out.</p>
        <ErrorText error={error} />
        <Table rows={data?.data as any[]} empty="No discounts yet." columns={[
          { header: "Name", cell: (d) => d.name },
          { header: "Value", align: "right", cell: (d) => (d.type === "PERCENT" ? percent(d.value) : money(d.value)) },
          { header: "Minimums", cell: (d) => [d.minPurchaseMinor > 0 && money(d.minPurchaseMinor), d.minQuantity > 0 && `${d.minQuantity} units`].filter(Boolean).join(", ") || "None" },
          { header: "Dates", cell: (d) => `${date(d.startDate)} to ${date(d.endDate)}` },
          { header: "Used", align: "right", cell: (d) => `${d.usedCount}${d.usageLimit ? ` of ${d.usageLimit}` : ""}` },
          { header: "Applies to", cell: (d) => d.products.map((p: any) => p.name).join(", ") || "Whole subscription" },
        ]} />
      </Card>
    </Page>
  );
}
