import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, Check, ErrorText, Field, FormDialog, Input, Page, Select, Table, Toggle, useAction } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { date, label, money, today, toMinor } from "../../../lib/format";
import { formValues } from "../../../lib/form";

const INTERVALS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

function PlanForm({ plan, onDone }: { plan?: any; onDone: () => void }) {
  const save = useAction((v: Record<string, string>) => {
    const body = {
      name: v.name,
      priceMinor: toMinor(v.price),
      minQuantity: Number(v.minQuantity),
      availableFrom: v.availableFrom,
      availableUntil: v.availableUntil ?? null,
      autoClose: !!v.autoClose,
      closable: !!v.closable,
      pausable: !!v.pausable,
      renewable: !!v.renewable,
    };
    return plan ? api(`/plans/${plan.id}`, { method: "PATCH", body }) : api("/plans", { body: { ...body, interval: v.interval } });
  });
  return (
    <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { const v = formValues(e); save.mutate(v, { onSuccess: onDone }); }}>
      <Field label="Name"><Input name="name" required defaultValue={plan?.name} /></Field>
      <Field label="Plan fee per period (₹)" hint={plan ? "A new fee applies to the next invoice of every subscription on this plan." : "Charged on top of product lines. Use 0 for per-seat pricing."}>
        <Input name="price" type="number" step="0.01" min="0" required defaultValue={plan ? plan.priceMinor / 100 : "0"} />
      </Field>
      {plan ? (
        // Billing dates are worked out from the interval, so changing it on a live plan would corrupt billing.
        <Field label="Bills" hint="Can't be changed once a plan exists, because it would disturb billing dates. Create a new plan instead."><Input value={label(plan.interval)} disabled /></Field>
      ) : (
        <Field label="Bills"><Select name="interval" defaultValue="MONTHLY">{INTERVALS.map((i) => <option key={i} value={i}>{label(i)}</option>)}</Select></Field>
      )}
      <Field label="Minimum quantity"><Input name="minQuantity" type="number" min="1" required defaultValue={plan?.minQuantity ?? 1} /></Field>
      <Field label="Available from"><Input name="availableFrom" type="date" required defaultValue={plan ? plan.availableFrom.slice(0, 10) : today()} /></Field>
      <Field label="Available until (optional)" hint="Needed for a plan that closes on its own."><Input name="availableUntil" type="date" defaultValue={plan?.availableUntil?.slice(0, 10)} /></Field>
      <div className="flex flex-wrap gap-4 md:col-span-3">
        <Check name="autoClose" label="Closes on its own at the end" defaultChecked={plan?.autoClose ?? false} />
        <Check name="closable" label="Can be closed early" defaultChecked={plan?.closable ?? true} />
        <Check name="pausable" label="Can be paused" defaultChecked={plan?.pausable ?? true} />
        <Check name="renewable" label="Can be renewed" defaultChecked={plan?.renewable ?? true} />
      </div>
      <div className="md:col-span-3"><ErrorText error={save.error} /></div>
      <div><Button type="submit" disabled={save.isPending}>Save</Button></div>
    </form>
  );
}

export function Plans() {
  const { user } = useAuth();
  const admin = user!.role === "ADMIN";
  const [q, setQ] = useState("");
  const [interval, setInterval] = useState("");
  const [state, setState] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const { data, error } = useQuery({ queryKey: ["plans"], queryFn: () => api("/plans") });
  const toggle = useAction((p: any) => api(`/plans/${p.id}`, { method: "PATCH", body: { active: !p.active } }));
  const rows = (data?.data as any[] | undefined)?.filter((p) =>
    p.name.toLowerCase().includes(q.trim().toLowerCase()) && (!interval || p.interval === interval) && (!state || p.active === (state === "active")),
  );
  return (
    <Page title="Plans">
      {admin && <Toggle label="Add plan">{(close) => <PlanForm onDone={close} />}</Toggle>}
      {editing && <FormDialog title={`Edit ${editing.name}`} onClose={() => setEditing(null)}><PlanForm plan={editing} onDone={() => setEditing(null)} /></FormDialog>}
      <Card>
        <div className="mb-3 flex flex-wrap gap-3">
          <div className="w-56"><Input aria-label="Search plans" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="w-40"><Select aria-label="Billing interval" value={interval} onChange={(e) => setInterval(e.target.value)}><option value="">All intervals</option>{INTERVALS.map((i) => <option key={i} value={i}>{label(i)}</option>)}</Select></div>
          <div className="w-40"><Select aria-label="Status" value={state} onChange={(e) => setState(e.target.value)}><option value="">Any status</option><option value="active">Active</option><option value="retired">Retired</option></Select></div>
        </div>
        <ErrorText error={error ?? toggle.error} />
        <Table rows={rows} empty="No plans match." columns={[
          { header: "Name", cell: (p: any) => p.name },
          { header: "Fee", align: "right", cell: (p: any) => money(p.priceMinor) },
          { header: "Bills", cell: (p: any) => label(p.interval) },
          { header: "Min qty", align: "right", cell: (p: any) => p.minQuantity },
          { header: "Available", cell: (p: any) => `${date(p.availableFrom)} to ${p.availableUntil ? date(p.availableUntil) : "open"}` },
          { header: "Rules", cell: (p: any) => [p.autoClose && "auto-closes", p.closable && "closable", p.pausable && "pausable", p.renewable && "renewable"].filter(Boolean).join(", ") || "none" },
          { header: "Status", cell: (p: any) => (p.active ? "Active" : "Retired") },
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
