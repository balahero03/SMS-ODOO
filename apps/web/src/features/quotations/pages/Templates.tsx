import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, ErrorText, Field, Input, Page, Select, Table, Toggle, useAction } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { money } from "../../../lib/format";
import { formValues } from "../../../lib/form";

export function Templates() {
  const { user } = useAuth();
  const admin = user!.role === "ADMIN";
  const [lines, setLines] = useState([{ productId: "", variantId: "", quantity: 1 }]);
  const { data, error } = useQuery({ queryKey: ["templates"], queryFn: () => api("/templates") });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => api("/plans") });
  const products = useQuery({ queryKey: ["products"], queryFn: () => api("/products") });
  const list: any[] = products.data?.data ?? [];
  const create = useAction((v: Record<string, string>) =>
    api("/templates", {
      body: {
        name: v.name,
        validityDays: Number(v.validityDays),
        planId: v.planId,
        lines: lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, variantId: l.variantId || null, quantity: l.quantity })),
      },
    }),
  );
  const remove = useAction((id: string) => api(`/templates/${id}`, { method: "DELETE" }));
  const setLine = (i: number, patch: object) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <Page title="Quotation templates">
      {admin && (
        <Toggle label="Add template">
          {(close) => (
            <form className="space-y-3" onSubmit={(e) => { const v = formValues(e); create.mutate(v, { onSuccess: () => { setLines([{ productId: "", variantId: "", quantity: 1 }]); close(); } }); }}>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Name"><Input name="name" required /></Field>
                <Field label="Valid for (days)"><Input name="validityDays" type="number" min="1" defaultValue="30" required /></Field>
                <Field label="Plan">
                  <Select name="planId" required>
                    <option value="">Select…</option>
                    {(plans.data?.data as any[])?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </Field>
              </div>
              {lines.map((l, i) => {
                const product = list.find((p) => p.id === l.productId);
                return (
                  <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_1fr_6rem_auto]">
                    <Select aria-label="Product" value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value, variantId: "" })}>
                      <option value="">Product…</option>
                      {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                    <Select aria-label="Variant" value={l.variantId} disabled={!product?.variants.length} onChange={(e) => setLine(i, { variantId: e.target.value })}>
                      <option value="">No variant</option>
                      {product?.variants.map((v: any) => <option key={v.id} value={v.id}>{v.attribute}: {v.value} (+{money(v.extraPriceMinor)})</option>)}
                    </Select>
                    <Input aria-label="Quantity" type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
                    <Button variant="secondary" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</Button>
                  </div>
                );
              })}
              <Button variant="secondary" onClick={() => setLines([...lines, { productId: "", variantId: "", quantity: 1 }])}>Add line</Button>
              <ErrorText error={create.error} />
              <div><Button type="submit" disabled={create.isPending}>Save</Button></div>
            </form>
          )}
        </Toggle>
      )}
      <Card>
        <ErrorText error={error ?? remove.error} />
        <Table rows={data?.data as any[]} empty="No templates yet." columns={[
          { header: "Name", cell: (t) => t.name },
          { header: "Plan", cell: (t) => t.plan.name },
          { header: "Valid for", cell: (t) => `${t.validityDays} days` },
          { header: "Lines", cell: (t) => t.lines.map((l: any) => `${l.quantity} × ${l.product.name}${l.variant ? ` (${l.variant.value})` : ""}`).join(", ") },
          ...(admin ? [{ header: "", align: "right" as const, cell: (t: any) => <Button variant="danger" onClick={() => { if (window.confirm(`Delete ${t.name}?`)) remove.mutate(t.id); }}>Delete</Button> }] : []),
        ]} />
      </Card>
    </Page>
  );
}
