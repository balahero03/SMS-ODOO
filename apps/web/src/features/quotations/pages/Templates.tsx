import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, ErrorText, Field, FormDialog, Input, Page, Select, Table, Toggle, useAction } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { money } from "../../../lib/format";
import { formValues } from "../../../lib/form";

const blank = (quantity = 1) => ({ productId: "", variantId: "", quantity });

function TemplateForm({ template, onDone }: { template?: any; onDone: () => void }) {
  const [planId, setPlanId] = useState<string>(template?.planId ?? "");
  const [lines, setLines] = useState(template ? template.lines.map((l: any) => ({ productId: l.productId, variantId: l.variantId ?? "", quantity: l.quantity })) : [blank()]);
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => api("/plans") });
  const products = useQuery({ queryKey: ["products"], queryFn: () => api("/products") });
  const planList: any[] = plans.data?.data ?? [];
  const list: any[] = products.data?.data ?? [];
  const minQuantity: number = planList.find((p) => p.id === planId)?.minQuantity ?? 1;
  const chosen = lines.filter((l: any) => l.productId);
  const save = useAction(async (v: Record<string, string>) => {
    const created = await api("/templates", {
      body: {
        name: v.name,
        validityDays: Number(v.validityDays),
        planId,
        lines: chosen.map((l: any) => ({ productId: l.productId, variantId: l.variantId || null, quantity: l.quantity })),
      },
    });
    // The API has no template update. Removing the old one last means a failure can't lose it.
    if (template) await api(`/templates/${template.id}`, { method: "DELETE" });
    return created;
  });
  const setLine = (i: number, patch: object) => setLines(lines.map((l: any, j: number) => (j === i ? { ...l, ...patch } : l)));
  const problem = !chosen.length ? "Add at least one product." : chosen.some((l: any) => l.quantity < minQuantity) ? `This plan needs a quantity of at least ${minQuantity} on each line.` : "";
  return (
    <form className="space-y-3" onSubmit={(e) => { const v = formValues(e); save.mutate(v, { onSuccess: onDone }); }}>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Name"><Input name="name" required defaultValue={template?.name} /></Field>
        <Field label="Valid for (days)"><Input name="validityDays" type="number" min="1" required defaultValue={template?.validityDays ?? 30} /></Field>
        <Field label="Plan">
          <Select required value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Select…</option>
            {planList.filter((p) => p.active || p.id === planId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      </div>
      {lines.map((l: any, i: number) => {
        const product = list.find((p) => p.id === l.productId);
        return (
          <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_1fr_6rem_auto]">
            <Select aria-label="Product" value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value, variantId: "" })}>
              <option value="">Product…</option>
              {list.filter((p) => p.active || p.id === l.productId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select aria-label="Variant" value={l.variantId} disabled={!product?.variants.length} onChange={(e) => setLine(i, { variantId: e.target.value })}>
              <option value="">No variant</option>
              {product?.variants.map((v: any) => <option key={v.id} value={v.id}>{v.attribute}: {v.value} (+{money(v.extraPriceMinor)})</option>)}
            </Select>
            <Input aria-label="Quantity" type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
            <Button variant="secondary" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_: any, j: number) => j !== i))}>Remove</Button>
          </div>
        );
      })}
      <Button variant="secondary" onClick={() => setLines([...lines, blank(minQuantity)])}>Add line</Button>
      {problem && <p className="text-sm text-slate-600">{problem}</p>}
      <ErrorText error={save.error} />
      <div><Button type="submit" disabled={save.isPending || !!problem}>Save</Button></div>
    </form>
  );
}

export function Templates() {
  const { user } = useAuth();
  const admin = user!.role === "ADMIN";
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const { data, error } = useQuery({ queryKey: ["templates"], queryFn: () => api("/templates") });
  const remove = useAction((id: string) => api(`/templates/${id}`, { method: "DELETE" }));
  const rows = (data?.data as any[] | undefined)?.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Page title="Quotation templates">
      {admin && <Toggle label="Add template">{(close) => <TemplateForm onDone={close} />}</Toggle>}
      {editing && <FormDialog title={`Edit ${editing.name}`} onClose={() => setEditing(null)}><TemplateForm template={editing} onDone={() => setEditing(null)} /></FormDialog>}
      <Card>
        <p className="mb-3 text-sm text-slate-600">Editing or deleting a template doesn't change subscriptions already made from it.</p>
        <div className="mb-3 w-56"><Input aria-label="Search templates" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <ErrorText error={error ?? remove.error} />
        <Table rows={rows} empty="No templates match." columns={[
          { header: "Name", cell: (t: any) => t.name },
          { header: "Plan", cell: (t: any) => t.plan.name },
          { header: "Valid for", cell: (t: any) => `${t.validityDays} days` },
          { header: "Lines", cell: (t: any) => t.lines.map((l: any) => `${l.quantity} × ${l.product.name}${l.variant ? ` (${l.variant.value})` : ""}`).join(", ") },
          ...(admin ? [{ header: "", align: "right" as const, cell: (t: any) => (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(t)}>Edit</Button>
              <Button variant="danger" disabled={remove.isPending} onClick={() => { if (window.confirm(`Delete ${t.name}?`)) remove.mutate(t.id); }}>Delete</Button>
            </div>
          ) }] : []),
        ]} />
      </Card>
    </Page>
  );
}
