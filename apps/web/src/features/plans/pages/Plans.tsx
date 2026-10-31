import { useQuery } from "@tanstack/react-query";
import { Button, Card, Check, ErrorText, Field, Input, Page, Select, Table, Toggle, useAction } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { date, label, money, today, toMinor } from "../../../lib/format";
import { formValues } from "../../../lib/form";

export function Plans() {
  const { user } = useAuth();
  const admin = user!.role === "ADMIN";
  const { data, error } = useQuery({ queryKey: ["plans"], queryFn: () => api("/plans") });
  const create = useAction((v: Record<string, string>) =>
    api("/plans", {
      body: {
        name: v.name,
        priceMinor: toMinor(v.price),
        interval: v.interval,
        minQuantity: Number(v.minQuantity),
        availableFrom: v.availableFrom,
        availableUntil: v.availableUntil ?? null,
        autoClose: !!v.autoClose,
        closable: !!v.closable,
        pausable: !!v.pausable,
        renewable: !!v.renewable,
      },
    }),
  );
  return (
    <Page title="Plans">
      {admin && (
        <Toggle label="Add plan">
          {(close) => (
            <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { const v = formValues(e); create.mutate(v, { onSuccess: close }); }}>
              <Field label="Name"><Input name="name" required /></Field>
              <Field label="Plan fee per period (₹)" hint="Charged on top of product lines. Use 0 for per-seat pricing."><Input name="price" type="number" step="0.01" min="0" defaultValue="0" required /></Field>
              <Field label="Bills"><Select name="interval" defaultValue="MONTHLY">{["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].map((i) => <option key={i} value={i}>{label(i)}</option>)}</Select></Field>
              <Field label="Minimum quantity"><Input name="minQuantity" type="number" min="1" defaultValue="1" required /></Field>
              <Field label="Available from"><Input name="availableFrom" type="date" defaultValue={today()} required /></Field>
              <Field label="Available until (optional)"><Input name="availableUntil" type="date" /></Field>
              <div className="flex flex-wrap gap-4 md:col-span-3">
                <Check name="autoClose" label="Closes on its own at the end" />
                <Check name="closable" label="Can be closed early" defaultChecked />
                <Check name="pausable" label="Can be paused" defaultChecked />
                <Check name="renewable" label="Can be renewed" defaultChecked />
              </div>
              <div className="md:col-span-3"><ErrorText error={create.error} /></div>
              <div><Button type="submit" disabled={create.isPending}>Save</Button></div>
            </form>
          )}
        </Toggle>
      )}
      <Card>
        <ErrorText error={error} />
        <Table rows={data?.data as any[]} empty="No plans yet." columns={[
          { header: "Name", cell: (p) => p.name },
          { header: "Fee", align: "right", cell: (p) => money(p.priceMinor) },
          { header: "Bills", cell: (p) => label(p.interval) },
          { header: "Min qty", align: "right", cell: (p) => p.minQuantity },
          { header: "Available", cell: (p) => `${date(p.availableFrom)} to ${p.availableUntil ? date(p.availableUntil) : "open"}` },
          { header: "Rules", cell: (p) => [p.autoClose && "auto-closes", p.closable && "closable", p.pausable && "pausable", p.renewable && "renewable"].filter(Boolean).join(", ") || "none" },
        ]} />
      </Card>
    </Page>
  );
}
