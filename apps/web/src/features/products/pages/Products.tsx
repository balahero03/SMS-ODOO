import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, ErrorText, Field, FormDialog, Input, Page, Pager, Select, Table, Toggle, useAction } from "../../../components/ui";
import { api, qs } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { label, money, toMinor } from "../../../lib/format";
import { formValues, readable } from "../../../lib/form";

const TYPES = ["SOFTWARE", "ADDON", "SERVICE"];

function ProductForm({ product, onDone }: { product?: any; onDone: (saved: any) => void }) {
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
      <div className="md:col-span-2"><ErrorText error={readable(save.error)} /></div>
      <div><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></div>
    </form>
  );
}

function VariantForm({ productId, variant, onDone }: { productId: string; variant?: any; onDone: () => void }) {
  const save = useAction((v: Record<string, string>) => {
    const body = { attribute: v.attribute, value: v.value, extraPriceMinor: toMinor(v.extra ?? 0) };
    return variant ? api(`/products/${productId}/variants/${variant.id}`, { method: "PATCH", body }) : api(`/products/${productId}/variants`, { body });
  });
  return (
    <form className="mt-2" onSubmit={(e) => { const v = formValues(e); save.mutate(v, { onSuccess: onDone }); }}>
      <div className="flex flex-wrap gap-2">
        <div className="w-28"><Input name="attribute" placeholder="Brand" required aria-label="Attribute" defaultValue={variant?.attribute} /></div>
        <div className="w-28"><Input name="value" placeholder="Odoo" required aria-label="Value" defaultValue={variant?.value} /></div>
        <div className="w-24"><Input name="extra" type="number" step="0.01" min="0" placeholder="560" aria-label="Extra price" defaultValue={variant ? variant.extraPriceMinor / 100 : undefined} /></div>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : variant ? "Save" : "Add"}</Button>
      </div>
      <ErrorText error={readable(save.error)} />
    </form>
  );
}

function Variants({ product, admin }: { product: any; admin: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const remove = useAction((id: string) => api(`/products/${product.id}/variants/${id}`, { method: "DELETE" }));
  return (
    <div>
      <ul className="space-y-1">
        {product.variants.map((v: any) => (
          <li key={v.id}>
            <div className="flex flex-wrap items-center gap-2">
              {v.attribute}: {v.value} (+{money(v.extraPriceMinor)})
              {admin && <button type="button" className="text-xs font-semibold text-[#5b3fe8] hover:underline" onClick={() => setEditing(editing === v.id ? null : v.id)}>{editing === v.id ? "Cancel" : "Edit"}</button>}
              {admin && <button type="button" className="text-xs font-semibold text-red-700 hover:underline" disabled={remove.isPending} onClick={() => { if (window.confirm(`Remove ${v.attribute}: ${v.value}? Quotation templates using it fall back to the standard product.`)) remove.mutate(v.id); }}>Remove</button>}
            </div>
            {editing === v.id && <VariantForm productId={product.id} variant={v} onDone={() => setEditing(null)} />}
          </li>
        ))}
        {!product.variants.length && <li className="text-slate-500">None</li>}
      </ul>
      {admin && <button type="button" className="mt-1 text-xs font-semibold text-[#5b3fe8] hover:underline" onClick={() => setOpen(!open)}>{open ? "Cancel" : "Add variant"}</button>}
      {open && <VariantForm productId={product.id} onDone={() => setOpen(false)} />}
      <ErrorText error={readable(remove.error)} />
    </div>
  );
}

function ProductDetails({ id, admin }: { id: string; admin: boolean }) {
  const { data: product, error } = useQuery({ queryKey: ["product", id], queryFn: () => api(`/products/${id}`) });
  if (error) return <ErrorText error={error} />;
  if (!product) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-2 gap-3">
        {[
          ["Type", label(product.type)],
          ["Available", product.active ? "Yes" : "Retired"],
          ["Sales price", money(product.salesPriceMinor)],
          ["Cost price", money(product.costPriceMinor)],
        ].map(([k, v]) => (
          <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-900">{v}</dd></div>
        ))}
        <div className="col-span-2"><dt className="text-slate-500">Notes</dt><dd className="break-words font-medium text-slate-900">{product.notes ?? "—"}</dd></div>
      </dl>
      <div>
        <h3 className="mb-1 font-semibold text-slate-900">Variants</h3>
        <Variants product={product} admin={admin} />
      </div>
    </div>
  );
}

export function Products() {
  const { user } = useAuth();
  const admin = user!.role === "ADMIN";
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const active = state === "" ? undefined : String(state === "active");
  const { data, error } = useQuery({ queryKey: ["products", q, type, state, page], queryFn: () => api(`/products${qs({ q, type, active, page })}`) });
  const toggle = useAction((p: any) => api(`/products/${p.id}`, { method: "PATCH", body: { active: !p.active } }), (p) =>
    setNotice(`${p.name} is ${p.active ? "available again" : "retired. Existing subscriptions keep billing it"}.`),
  );
  return (
    <Page title="Products">
      {admin && <Toggle label="Add product">{(close) => <ProductForm onDone={(p) => { close(); setNotice(`${p.name} was added.`); }} />}</Toggle>}
      {editing && <FormDialog title={`Edit ${editing.name}`} onClose={() => setEditing(null)}><ProductForm product={editing} onDone={(p) => { setEditing(null); setNotice(`${p.name} was saved.`); }} /></FormDialog>}
      {viewing && <FormDialog title={viewing.name} onClose={() => setViewing(null)}><ProductDetails id={viewing.id} admin={admin} /></FormDialog>}
      {notice && !toggle.error && <p role="status" className="text-sm text-slate-700">{notice}</p>}
      <Card>
        <div className="mb-3 flex flex-wrap gap-3">
          <div className="w-56"><Input aria-label="Search products" placeholder="Search by name" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} /></div>
          <div className="w-40"><Select aria-label="Type" value={type} onChange={(e) => { setPage(1); setType(e.target.value); }}><option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select></div>
          <div className="w-40"><Select aria-label="Availability" value={state} onChange={(e) => { setPage(1); setState(e.target.value); }}><option value="">Any availability</option><option value="active">Available</option><option value="retired">Retired</option></Select></div>
        </div>
        <ErrorText error={error ?? readable(toggle.error)} />
        <Table rows={data?.data as any[] | undefined} empty="No products match." columns={[
          { header: "Name", cell: (p: any) => <div><button type="button" className="text-left font-semibold text-[#5b3fe8] hover:underline" onClick={() => setViewing(p)}>{p.name}</button>{p.notes && <p className="text-xs text-slate-500">{p.notes}</p>}</div> },
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
        {data && <Pager page={page} limit={data.limit} total={data.total} onPage={setPage} />}
      </Card>
    </Page>
  );
}
