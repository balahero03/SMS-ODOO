import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, ErrorText, Field, FormDialog, Input, Page, Select, Table, Toggle, useAction } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { label, money, toMinor } from "../../../lib/format";
import { formValues } from "../../../lib/form";

const TYPES = ["SOFTWARE", "ADDON", "SERVICE"];

function ProductForm({ product, onDone }: { product?: any; onDone: () => void }) {
  const save = useAction((v: Record<string, string>) => {
    const body = { name: v.name, type: v.type, salesPriceMinor: toMinor(v.sales), costPriceMinor: toMinor(v.cost), notes: v.notes ?? null };
    return product ? api(`/products/${product.id}`, { method: "PATCH", body }) : api("/products", { body });
  });
  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { const v = formValues(e); save.mutate(v, { onSuccess: onDone }); }}>
      <Field label="Name"><Input name="name" required defaultValue={product?.name} /></Field>
      <Field label="Type" hint={product ? "Tax rules are matched by type, so this can change the tax on future invoices." : undefined}>
        <Select name="type" defaultValue={product?.type}>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>
      </Field>
      <Field label="Sales price (₹)" hint={product ? "Applies to new subscription lines. Existing lines keep their price." : undefined}>
        <Input name="sales" type="number" step="0.01" min="0" required defaultValue={product ? product.salesPriceMinor / 100 : undefined} />
      </Field>
      <Field label="Cost price (₹)"><Input name="cost" type="number" step="0.01" min="0" required defaultValue={product ? product.costPriceMinor / 100 : undefined} /></Field>
      <div className="md:col-span-2"><Field label="Notes"><Input name="notes" defaultValue={product?.notes ?? ""} /></Field></div>
      <div className="md:col-span-2"><ErrorText error={save.error} /></div>
      <div><Button type="submit" disabled={save.isPending}>Save</Button></div>
    </form>
  );
}

function Variants({ product, admin }: { product: any; admin: boolean }) {
  const [open, setOpen] = useState(false);
  const add = useAction((v: Record<string, string>) =>
    api(`/products/${product.id}/variants`, { body: { attribute: v.attribute, value: v.value, extraPriceMinor: toMinor(v.extra ?? 0) } }),
  );
  const remove = useAction((id: string) => api(`/products/${product.id}/variants/${id}`, { method: "DELETE" }));
  return (
    <div>
      <ul className="space-y-1">
        {product.variants.map((v: any) => (
          <li key={v.id} className="flex items-center gap-2">
            {v.attribute}: {v.value} (+{money(v.extraPriceMinor)})
            {admin && <button type="button" className="text-xs font-semibold text-red-700 hover:underline" onClick={() => { if (window.confirm(`Remove ${v.attribute}: ${v.value}? Quotation templates using it fall back to the standard product. Existing subscriptions keep their price.`)) remove.mutate(v.id); }}>Remove</button>}
          </li>
        ))}
        {!product.variants.length && <li className="text-slate-500">None</li>}
      </ul>
      {admin && <button type="button" className="mt-1 text-xs font-semibold text-[#5b3fe8] hover:underline" onClick={() => setOpen(!open)}>{open ? "Cancel" : "Add variant"}</button>}
      {open && (
        <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => { const v = formValues(e); add.mutate(v, { onSuccess: () => setOpen(false) }); }}>
          <div className="w-28"><Input name="attribute" placeholder="Brand" required aria-label="Attribute" /></div>
          <div className="w-28"><Input name="value" placeholder="Odoo" required aria-label="Value" /></div>
          <div className="w-24"><Input name="extra" type="number" step="0.01" min="0" placeholder="560" aria-label="Extra price" /></div>
          <Button type="submit" disabled={add.isPending}>Add</Button>
        </form>
      )}
      <ErrorText error={add.error ?? remove.error} />
    </div>
  );
}

export function Products() {
  const { user } = useAuth();
  const admin = user!.role === "ADMIN";
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [state, setState] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const { data, error } = useQuery({ queryKey: ["products"], queryFn: () => api("/products") });
  const toggle = useAction((p: any) => api(`/products/${p.id}`, { method: "PATCH", body: { active: !p.active } }));
  const rows = (data?.data as any[] | undefined)?.filter((p) =>
    p.name.toLowerCase().includes(q.trim().toLowerCase()) && (!type || p.type === type) && (!state || p.active === (state === "active")),
  );
  return (
    <Page title="Products">
      {admin && <Toggle label="Add product">{(close) => <ProductForm onDone={close} />}</Toggle>}
      {editing && <FormDialog title={`Edit ${editing.name}`} onClose={() => setEditing(null)}><ProductForm product={editing} onDone={() => setEditing(null)} /></FormDialog>}
      <Card>
        <div className="mb-3 flex flex-wrap gap-3">
          <div className="w-56"><Input aria-label="Search products" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="w-40"><Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select></div>
          <div className="w-40"><Select aria-label="Availability" value={state} onChange={(e) => setState(e.target.value)}><option value="">Any availability</option><option value="active">Available</option><option value="retired">Retired</option></Select></div>
        </div>
        <ErrorText error={error ?? toggle.error} />
        <Table rows={rows} empty="No products match." columns={[
          { header: "Name", cell: (p: any) => <div><p className="font-medium">{p.name}</p>{p.notes && <p className="text-xs text-slate-500">{p.notes}</p>}</div> },
          { header: "Type", cell: (p: any) => label(p.type) },
          { header: "Sales price", align: "right", cell: (p: any) => money(p.salesPriceMinor) },
          { header: "Cost price", align: "right", cell: (p: any) => money(p.costPriceMinor) },
          { header: "Variants", cell: (p: any) => <Variants product={p} admin={admin} /> },
          { header: "Available", cell: (p: any) => (p.active ? "Yes" : "Retired") },
          ...(admin ? [{ header: "", align: "right" as const, cell: (p: any) => (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(p)}>Edit</Button>
              <Button variant="secondary" disabled={toggle.isPending} onClick={() => toggle.mutate(p)}>{p.active ? "Retire" : "Restore"}</Button>
            </div>
          ) }] : []),
        ]} />
      </Card>
    </Page>
  );
}
