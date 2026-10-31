import { useQuery } from "@tanstack/react-query";
import { Button, Card, ErrorText, Field, Input, Page, Select, Table, Toggle, useAction } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { label, percent } from "../../../lib/format";
import { formValues } from "../../../lib/form";

export function Taxes() {
  const { user } = useAuth();
  const admin = user!.role === "ADMIN";
  const { data, error } = useQuery({ queryKey: ["taxes"], queryFn: () => api("/taxes") });
  const create = useAction((v: Record<string, string>) =>
    api("/taxes", { body: { name: v.name, rateBp: Math.round(Number(v.rate) * 100), productType: v.productType ?? null } }),
  );
  const toggle = useAction((t: any) => api(`/taxes/${t.id}`, { method: "PATCH", body: { active: !t.active } }));
  return (
    <Page title="Tax rules">
      {admin && (
        <Toggle label="Add tax rule">
          {(close) => (
            <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { const v = formValues(e); create.mutate(v, { onSuccess: close }); }}>
              <Field label="Name"><Input name="name" required /></Field>
              <Field label="Rate (%)"><Input name="rate" type="number" step="0.01" min="0" max="100" required /></Field>
              <Field label="Applies to">
                <Select name="productType">
                  <option value="">Everything</option>
                  {["SOFTWARE", "ADDON", "SERVICE"].map((t) => <option key={t} value={t}>{label(t)} products</option>)}
                </Select>
              </Field>
              <div className="md:col-span-3"><ErrorText error={create.error} /></div>
              <div><Button type="submit" disabled={create.isPending}>Save</Button></div>
            </form>
          )}
        </Toggle>
      )}
      <Card>
        <p className="mb-3 text-sm text-slate-600">Every active rule that matches a line is added together when an invoice is created. Existing invoices never change.</p>
        <ErrorText error={error ?? toggle.error} />
        <Table rows={data?.data as any[]} empty="No tax rules yet, so invoices carry no tax." columns={[
          { header: "Name", cell: (t) => t.name },
          { header: "Rate", align: "right", cell: (t) => percent(t.rateBp) },
          { header: "Applies to", cell: (t) => (t.productType ? `${label(t.productType)} products` : "Everything") },
          { header: "Active", cell: (t) => (admin ? <Button variant="secondary" onClick={() => toggle.mutate(t)}>{t.active ? "Yes, turn off" : "No, turn on"}</Button> : t.active ? "Yes" : "No") },
        ]} />
      </Card>
    </Page>
  );
}
