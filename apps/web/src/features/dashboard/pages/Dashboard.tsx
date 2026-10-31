import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, ErrorText, Field, Input, Page, Status, Table } from "../../../components/ui";
import { api, qs } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useAction } from "../../../components/ui";
import { date, label, money } from "../../../lib/format";

function Stat({ title, value, note, to }: { title: string; value: string; note?: string; to?: string }) {
  const body = (
    <div className="h-full rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300">
      <p className="text-sm text-slate-600">{title}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function RevenueChart({ rows }: { rows: { month: string; amountMinor: number }[] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500">No payments in this period.</p>;
  const max = Math.max(...rows.map((r) => r.amountMinor));
  return (
    <div>
      <div className="flex h-44 items-end gap-0.5 border-b border-slate-300" role="img" aria-label="Revenue collected per month; values are in the table below">
        {rows.map((r) => (
          <div key={r.month} className="group relative flex h-full flex-1 items-end justify-center" title={`${r.month}: ${money(r.amountMinor)}`}>
            <span className="pointer-events-none absolute -top-1 z-10 hidden whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
              {r.month}: {money(r.amountMinor)}
            </span>
            <div className="w-full max-w-6 rounded-t bg-indigo-600 group-hover:bg-indigo-800" style={{ height: `${Math.max(1, (r.amountMinor / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5">
        {rows.map((r) => (
          <span key={r.month} className="flex-1 text-center text-[11px] text-slate-500">{r.month.slice(5)}</span>
        ))}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-slate-600">Show as table</summary>
        <Table rows={rows as any[]} columns={[
          { header: "Month", cell: (r) => r.month },
          { header: "Collected", align: "right", cell: (r) => money(r.amountMinor) },
        ]} />
      </details>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState({ from: "", to: "" });
  const [asOf, setAsOf] = useState("");
  const { data, error } = useQuery({ queryKey: ["summary", range], queryFn: () => api(`/reports/summary${qs(range)}`) });
  const run = useAction(() => api("/billing/run", { body: asOf ? { asOf } : {} }));

  return (
    <Page title="Dashboard">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40"><Field label="From"><Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field></div>
        <div className="w-40"><Field label="To"><Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field></div>
        {data && <p className="pb-2 text-sm text-slate-500">Revenue shown for {data.from} to {data.to}</p>}
      </div>
      <ErrorText error={error} />
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat title="Active subscriptions" value={data.activeSubscriptions.toLocaleString("en-IN")} note={`${data.expiringSoon} expire within 30 days`} to="/subscriptions?status=ACTIVE" />
            <Stat title="Monthly recurring revenue" value={money(data.mrrMinor)} note="Before tax and discounts" />
            <Stat title="Revenue collected" value={money(data.revenueMinor)} note={`${data.paymentCount.toLocaleString("en-IN")} payments`} to="/payments" />
            <Stat title="Outstanding" value={money(data.outstandingMinor)} note="Confirmed and unpaid" to="/invoices?status=CONFIRMED" />
            <Stat title="Overdue" value={money(data.overdueMinor)} note={`${data.overdueCount.toLocaleString("en-IN")} invoices`} to="/invoices?overdue=true" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Revenue collected by month"><RevenueChart rows={data.revenueByMonth} /></Card>
            <Card title="Revenue by payment method">
              <Table rows={data.revenueByMethod as any[]} empty="No payments in this period." columns={[
                { header: "Method", cell: (r) => label(r.method) },
                { header: "Collected", align: "right", cell: (r) => money(r.amountMinor) },
              ]} />
            </Card>
          </div>
          <Card title="Oldest overdue invoices" actions={<Link className="text-sm text-indigo-700 hover:underline" to="/invoices?overdue=true">View all</Link>}>
            <Table rows={data.oldestOverdue as any[]} empty="Nothing overdue." columns={[
              { header: "Invoice", cell: (r) => <Link className="text-indigo-700 hover:underline" to={`/invoices/${r.id}`}>{r.number}</Link> },
              { header: "Customer", cell: (r) => r.billToName },
              { header: "Due", cell: (r) => date(r.dueDate) },
              { header: "Status", cell: () => <Status value="OVERDUE" /> },
              { header: "Owed", align: "right", cell: (r) => money(r.totalMinor - r.paidMinor) },
            ]} />
          </Card>
        </>
      )}
      {user?.role === "ADMIN" && (
        <Card title="Billing run">
          <p className="mb-3 text-sm text-slate-600">Billing runs by itself every hour. Run it now, or pick a future date to rehearse a billing day. A future date creates real invoices.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40"><Field label="Bill as of"><Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field></div>
            <Button disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? "Running…" : "Run billing"}</Button>
          </div>
          {!!run.data && (
            <p className="mt-3 text-sm text-slate-700">
              {(run.data as any).billed} invoices created, {(run.data as any).closed} subscriptions closed, {(run.data as any).failed} failed.{" "}
              <Link className="text-indigo-700 hover:underline" to="/invoices?status=DRAFT">Review drafts</Link>
            </p>
          )}
          <ErrorText error={run.error} />
        </Card>
      )}
    </Page>
  );
}
