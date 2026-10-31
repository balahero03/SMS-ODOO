import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, ErrorText, Field, FormDialog, Input, Page, Select, Table, Toggle, useAction } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { label, percent } from "../../../lib/format";
import { formValues } from "../../../lib/form";

function TaxForm({ tax, onDone }: { tax?: any; onDone: () => void }) {
  const save = useAction((v: Record<string, string>) => {
    const body = { name: v.name, rateBp: Math.round(Number(v.rate) * 100), productType: v.productType ?? null };
    return tax ? api(`/taxes/${tax.id}`, { method: "PATCH", body }) : api("/taxes", { body });
  });
  return (
    <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { const v = formValues(e); save.mutate(v, { onSuccess: onDone }); }}>
      <Field label="Name"><Input name="name" required defaultValue={tax?.name} /></Field>
      <Field label="Rate (%)"><Input name="rate" type="number" step="0.01" min="0" max="100" required defaultValue={tax ? tax.rateBp / 100 : undefined} /></Field>
      <Field label="Applies to">
        <Select name="productType" defaultValue={tax?.productType ?? ""}>
          <option value="">Everything</option>
          {["SOFTWARE", "ADDON", "SERVICE"].map((t) => <option key={t} value={t}>{label(t)} products</option>)}
        </Select>
      </Field>
      <div className="md:col-span-3"><ErrorText error={save.error} /></div>
      <div><Button type="submit" disabled={save.isPending}>Save</Button></div>
    </form>
  );
}

export function Taxes() {
  const { user } = useAuth();
  const admin = user!.role === "ADMIN";
  const [editing, setEditing] = useState<any>(null);
  const { data, error } = useQuery({ queryKey: ["taxes"], queryFn: () => api("/taxes") });
  const toggle = useAction((t: any) => api(`/taxes/${t.id}`, { method: "PATCH", body: { active: !t.active } }));
  return (
    <Page title="Tax rules">
      {admin && <Toggle label="Add tax rule">{(close) => <TaxForm onDone={close} />}</Toggle>}
      {editing && <FormDialog title={`Edit ${editing.name}`} onClose={() => setEditing(null)}><TaxForm tax={editing} onDone={() => setEditing(null)} /></FormDialog>}
      <Card>
        <p className="mb-3 text-sm text-slate-600">Every active rule that matches a line is added together when an invoice is created. Existing invoices never change.</p>
        <ErrorText error={error ?? toggle.error} />
        <Table rows={data?.data as any[]} empty="No tax rules yet, so invoices carry no tax." columns={[
          { header: "Name", cell: (t: any) => t.name },
          { header: "Rate", align: "right", cell: (t: any) => percent(t.rateBp) },
          { header: "Applies to", cell: (t: any) => (t.productType ? `${label(t.productType)} products` : "Everything") },
          { header: "Status", cell: (t: any) => (t.active ? "Active" : "Off") },
          ...(admin ? [{ header: "", align: "right" as const, cell: (t: any) => (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(t)}>Edit</Button>
              <Button variant="secondary" disabled={toggle.isPending} onClick={() => toggle.mutate(t)}>{t.active ? "Turn off" : "Turn on"}</Button>
            </div>
          ) }] : []),
        ]} />
      </Card>
    </Page>
  );
}
