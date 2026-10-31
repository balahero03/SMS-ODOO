import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, ErrorText, Field, Input, Page, Select, Table, Toggle, useAction } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { label, money, toMinor } from "../../../lib/format";
import { formValues } from "../../../lib/form";

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
            {admin && <button className="text-xs text-red-700 hover:underline" onClick={() => remove.mutate(v.id)}>Remove</button>}
          </li>
        ))}
        {!product.variants.length && <li className="text-slate-500">None</li>}
      </ul>
      {admin && <button className="mt-1 text-xs text-indigo-700 hover:underline" onClick={() => setOpen(!open)}>{open ? "Cancel" : "Add variant"}</button>}
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
  const { data, error } = useQuery({ queryKey: ["products"], queryFn: () => api("/products") });
  const create = useAction((v: Record<string, string>) =>
    api("/products", {
      body: { name: v.name, type: v.type, salesPriceMinor: toMinor(v.sales), costPriceMinor: toMinor(v.cost), notes: v.notes },
    }),
  );
  const toggle = useAction((p: any) => api(`/products/${p.id}`, { method: "PATCH", body: { active: !p.active } }));
  return (
    <Page title="Products">
      {admin && (
        <Toggle label="Add product">
          {(close) => (
            <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { const v = formValues(e); create.mutate(v, { onSuccess: close }); }}>
              <Field label="Name"><Input name="name" required /></Field>
              <Field label="Type">
                <Select name="type">{["SOFTWARE", "ADDON", "SERVICE"].map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>
              </Field>
              <Field label="Sales price (₹)"><Input name="sales" type="number" step="0.01" min="0" required /></Field>
              <Field label="Cost price (₹)"><Input name="cost" type="number" step="0.01" min="0" required /></Field>
              <Field label="Notes"><Input name="notes" /></Field>
              <div className="md:col-span-2"><ErrorText error={create.error} /></div>
              <div><Button type="submit" disabled={create.isPending}>Save</Button></div>
            </form>
          )}
        </Toggle>
      )}
      <Card>
        <ErrorText error={error ?? toggle.error} />
        <Table rows={data?.data as any[]} empty="No products yet." columns={[
          { header: "Name", cell: (p) => <div><p className="font-medium">{p.name}</p>{p.notes && <p className="text-xs text-slate-500">{p.notes}</p>}</div> },
          { header: "Type", cell: (p) => label(p.type) },
          { header: "Sales price", align: "right", cell: (p) => money(p.salesPriceMinor) },
          { header: "Cost price", align: "right", cell: (p) => money(p.costPriceMinor) },
          { header: "Variants", cell: (p) => <Variants product={p} admin={admin} /> },
          { header: "Available", cell: (p) => (admin ? <Button variant="secondary" onClick={() => toggle.mutate(p)}>{p.active ? "Yes, retire" : "No, restore"}</Button> : p.active ? "Yes" : "No") },
        ]} />
      </Card>
    </Page>
  );
}
