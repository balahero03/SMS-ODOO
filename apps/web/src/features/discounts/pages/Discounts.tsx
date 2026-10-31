import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, ErrorText, Field, FormDialog, Input, Page, Select, Table, Toggle, useAction } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { date, money, percent, today, toMinor } from "../../../lib/format";
import { formValues } from "../../../lib/form";

export function discountState(d: any) {
  const now = today();
  if (d.usageLimit && d.usedCount >= d.usageLimit) return "Used up";
  if (d.endDate.slice(0, 10) < now) return "Expired";
  if (d.startDate.slice(0, 10) > now) return "Scheduled";
  return "Running";
}

function DiscountForm({ discount, onDone }: { discount?: any; onDone: () => void }) {
  const [type, setType] = useState<string>(discount?.type ?? "PERCENT");
  const [productIds, setProductIds] = useState<string[]>(discount?.products.map((p: any) => p.id) ?? []);
  const products = useQuery({ queryKey: ["products"], queryFn: () => api("/products") });
  const save = useAction((v: Record<string, string>) => {
    const body = {
      name: v.name,
      type,
      value: type === "PERCENT" ? Math.round(Number(v.value) * 100) : toMinor(v.value),
      minPurchaseMinor: toMinor(v.minPurchase ?? 0),
      minQuantity: Number(v.minQuantity ?? 0),
      startDate: v.startDate,
      endDate: v.endDate,
      usageLimit: v.usageLimit ? Number(v.usageLimit) : null,
      productIds,
    };
    return discount ? api(`/discounts/${discount.id}`, { method: "PATCH", body }) : api("/discounts", { body });
  });
  const toggleProduct = (id: string) => setProductIds(productIds.includes(id) ? productIds.filter((p) => p !== id) : [...productIds, id]);
  return (
    <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { const v = formValues(e); save.mutate(v, { onSuccess: onDone }); }}>
      <Field label="Name"><Input name="name" required defaultValue={discount?.name} /></Field>
      <Field label="Type">
        <Select value={type} onChange={(e) => setType(e.target.value)}><option value="PERCENT">Percentage</option><option value="FIXED">Fixed amount</option></Select>
      </Field>
      <Field label={type === "PERCENT" ? "Percent off" : "Amount off (₹)"}>
        <Input key={type} name="value" type="number" step="0.01" min="0.01" max={type === "PERCENT" ? 100 : undefined} required defaultValue={discount && discount.type === type ? discount.value / 100 : undefined} />
      </Field>
      <Field label="Minimum purchase (₹)"><Input name="minPurchase" type="number" step="0.01" min="0" defaultValue={discount?.minPurchaseMinor ? discount.minPurchaseMinor / 100 : undefined} /></Field>
      <Field label="Minimum quantity"><Input name="minQuantity" type="number" min="0" defaultValue={discount?.minQuantity || undefined} /></Field>
      <Field label="Usage limit" hint={discount ? `Used ${discount.usedCount} times so far. Blank means no limit.` : "Each invoice counts as one use. Blank means no limit."}>
        <Input name="usageLimit" type="number" min={Math.max(1, discount?.usedCount ?? 1)} defaultValue={discount?.usageLimit ?? undefined} />
      </Field>
      <Field label="Start date"><Input name="startDate" type="date" required defaultValue={discount ? discount.startDate.slice(0, 10) : today()} /></Field>
      <Field label="End date"><Input name="endDate" type="date" required defaultValue={discount?.endDate.slice(0, 10)} /></Field>
      <fieldset className="text-sm md:col-span-3">
        <legend className="mb-1 font-medium text-slate-700">Applies to</legend>
        <p className="mb-2 text-xs text-slate-500">Select specific products, or leave them all clear to discount the whole subscription.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {(products.data?.data as any[])?.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-slate-700"><input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} /> {p.name}</label>
          ))}
        </div>
      </fieldset>
      <div className="md:col-span-3"><ErrorText error={save.error} /></div>
      <div><Button type="submit" disabled={save.isPending}>Save</Button></div>
    </form>
  );
}

export function Discounts() {
  const { user } = useAuth();
  const admin = user!.role === "ADMIN";
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const { data, error } = useQuery({ queryKey: ["discounts"], queryFn: () => api("/discounts") });
  const rows = (data?.data as any[] | undefined)?.filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()) && (!state || discountState(d) === state));
  return (
    <Page title="Discounts">
      {admin && <Toggle label="Add discount">{(close) => <DiscountForm onDone={close} />}</Toggle>}
      {editing && <FormDialog title={`Edit ${editing.name}`} onClose={() => setEditing(null)}><DiscountForm discount={editing} onDone={() => setEditing(null)} /></FormDialog>}
      <Card>
        <p className="mb-3 text-sm text-slate-600">Apply a discount from a subscription's page. It then appears on each invoice by itself until it expires or runs out. To stop one early, set its end date to an earlier date.</p>
        <div className="mb-3 flex flex-wrap gap-3">
          <div className="w-56"><Input aria-label="Search discounts" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="w-40"><Select aria-label="Status" value={state} onChange={(e) => setState(e.target.value)}><option value="">Any status</option>{["Running", "Scheduled", "Expired", "Used up"].map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
        </div>
        <ErrorText error={error} />
        <Table rows={rows} empty="No discounts match." columns={[
          { header: "Name", cell: (d: any) => d.name },
          { header: "Value", align: "right", cell: (d: any) => (d.type === "PERCENT" ? percent(d.value) : money(d.value)) },
          { header: "Minimums", cell: (d: any) => [d.minPurchaseMinor > 0 && money(d.minPurchaseMinor), d.minQuantity > 0 && `${d.minQuantity} units`].filter(Boolean).join(", ") || "None" },
          { header: "Dates", cell: (d: any) => `${date(d.startDate)} to ${date(d.endDate)}` },
          { header: "Used", align: "right", cell: (d: any) => `${d.usedCount}${d.usageLimit ? ` of ${d.usageLimit}` : ""}` },
          { header: "Applies to", cell: (d: any) => d.products.map((p: any) => p.name).join(", ") || "Whole subscription" },
          { header: "Status", cell: (d: any) => discountState(d) },
          ...(admin ? [{ header: "", align: "right" as const, cell: (d: any) => <Button variant="secondary" onClick={() => setEditing(d)}>Edit</Button> }] : []),
        ]} />
      </Card>
    </Page>
  );
}
