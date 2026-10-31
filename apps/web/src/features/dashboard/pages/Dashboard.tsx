import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Card, ErrorText, Field, Input, Status, Table, useAction } from "../../../components/ui";
import { api, qs } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { date, label, money, today } from "../../../lib/format";

const textLink = "font-semibold text-[#5b3fe8] hover:underline";

function Stat({ title, value, note, to, alert }: { title: string; value: string; note?: string; to?: string; alert?: boolean }) {
  const body = (
    <div className="h-full rounded-2xl bg-white p-5 shadow-[6px_6px_0_#e4dfff] transition hover:shadow-[6px_6px_0_#c9c0fb]">
      <p className="text-sm text-slate-600">{title}</p>
      <p className={`mt-1 text-lg font-extrabold tabular-nums tracking-tight ${alert ? "text-red-700" : "text-slate-950"}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function Task({ count, title, hint, to, alert }: { count?: number; title: string; hint: string; to: string; alert?: boolean }) {
  const done = count === 0;
  return (
    <li>
      <Link to={to} className={`flex h-full items-center gap-3 rounded-xl p-3 transition ${done ? "bg-slate-50 hover:bg-slate-100" : alert ? "bg-red-50 hover:bg-red-100" : "bg-[#f1eeff] hover:bg-[#e4dfff]"}`}>
        <span className={`flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg px-2 font-extrabold tabular-nums ${done ? "bg-white text-slate-500" : alert ? "bg-white text-red-700" : "bg-white text-[#2e1f8f]"}`}>{count ?? "…"}</span>
        <span className="min-w-0">
          <span className={`block text-sm font-bold ${done ? "text-slate-600" : "text-slate-950"}`}>{title}</span>
          <span className="block text-xs text-slate-600">{done ? "Nothing waiting" : hint}</span>
        </span>
      </Link>
    </li>
  );
}

function RevenueChart({ rows }: { rows: { month: string; amountMinor: number }[] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500">No payments in this period.</p>;
  const max = Math.max(...rows.map((r) => r.amountMinor));
  return (
    <div>
      <div className="flex h-44 items-end gap-0.5 border-b border-slate-200" role="img" aria-label="Revenue collected per month; values are in the table below">
        {rows.map((r) => (
          <div key={r.month} className="group relative flex h-full flex-1 items-end justify-center" title={`${r.month}: ${money(r.amountMinor)}`}>
            <span className="pointer-events-none absolute -top-1 z-10 hidden whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
              {r.month}: {money(r.amountMinor)}
            </span>
            <div className="w-full max-w-6 rounded-t bg-[#5b3fe8] group-hover:bg-[#2e1f8f]" style={{ height: `${Math.max(1, (r.amountMinor / max) * 100)}%` }} />
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
          { header: "Month", cell: (r: any) => r.month },
          { header: "Collected", align: "right", cell: (r: any) => money(r.amountMinor) },
        ]} />
      </details>
    </div>
  );
}

const STATUSES = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "PAUSED", "CLOSED"];

function SubscriptionStatus({ counts }: { counts: Record<string, number> }) {
  const max = Math.max(1, ...STATUSES.map((s) => counts[s] ?? 0));
  return (
    <ul className="space-y-1">
      {STATUSES.map((s) => (
        <li key={s}>
          <Link to={`/subscriptions?status=${s}`} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 rounded-md py-1 text-sm hover:bg-[#f1eeff]">
            <span className="text-slate-700">{label(s)}</span>
            <span className="h-2.5 rounded-full bg-slate-100"><span className="block h-full rounded-full bg-[#5b3fe8]" style={{ width: `${((counts[s] ?? 0) / max) * 100}%` }} /></span>
            <span className="text-right font-semibold tabular-nums text-slate-900">{(counts[s] ?? 0).toLocaleString("en-IN")}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const quickAction = (to: string, children: ReactNode) => (
  <Link to={to} className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-[#2e1f8f] transition hover:bg-[#e4dfff]">{children}</Link>
);

export function Dashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState({ from: "", to: "" });
  const [asOf, setAsOf] = useState("");
  const { data, error } = useQuery({ queryKey: ["summary", range], queryFn: () => api(`/reports/summary${qs(range)}`) });
  const requests = useQuery({ queryKey: ["subscriptions", "requested", "count"], queryFn: () => api(`/subscriptions${qs({ status: "DRAFT", requested: "true", limit: 1 })}`) });
  const drafts = useQuery({ queryKey: ["invoices", "DRAFT", "count"], queryFn: () => api(`/invoices${qs({ status: "DRAFT", limit: 1 })}`) });
  const run = useAction(() => api("/billing/run", { body: asOf ? { asOf } : {} }));
  const result = run.data as any;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-[#5b3fe8] p-6 text-white shadow-[6px_6px_0_#c9c0fb] md:p-8">
        <div className="absolute inset-0 bg-[#6d54ee] [clip-path:polygon(70%_0,100%_0,100%_100%,55%_100%)]" aria-hidden="true" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Hello, {user!.name.split(" ")[0]}</h1>
            <p className="mt-1 text-sm text-[#e4dfff]">Here's what needs doing, and how the business stands.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickAction("/subscriptions/new", "New subscription")}
            {quickAction("/customers", "Customers")}
          </div>
        </div>
      </section>

      <ErrorText error={error} />

      <Card title="Needs your attention">
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Task count={requests.data?.total} title="Customer requests" hint="Review them and send quotations" to="/requests" />
          <Task count={data?.statusCounts.CONFIRMED ?? (data ? 0 : undefined)} title="Ready to activate" hint="Customers have confirmed these" to="/subscriptions?status=CONFIRMED" />
          <Task count={drafts.data?.total} title="Draft invoices" hint="Confirm them so customers can see them" to="/invoices?status=DRAFT" />
          <Task count={data?.overdueCount} title="Overdue invoices" hint={data ? `${money(data.overdueMinor)} to chase` : ""} to="/invoices?overdue=true" alert />
          <Task count={data?.statusCounts.QUOTATION ?? (data ? 0 : undefined)} title="Quotations out" hint="Waiting for the customer's answer" to="/subscriptions?status=QUOTATION" />
          <Task count={data?.expiringSoon} title="Expiring within 30 days" hint="Check these for renewal" to="/subscriptions?status=ACTIVE" />
        </ul>
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            <Stat title="Active subscriptions" value={data.activeSubscriptions.toLocaleString("en-IN")} to="/subscriptions?status=ACTIVE" />
            <Stat title="Monthly recurring revenue" value={money(data.mrrMinor)} note="Before tax and discounts" />
            <Stat title="Revenue collected" value={money(data.revenueMinor)} note={`${data.paymentCount.toLocaleString("en-IN")} payments in this period`} to="/payments" />
            <Stat title="Outstanding" value={money(data.outstandingMinor)} note="Confirmed and unpaid" to="/invoices?status=CONFIRMED" />
            <Stat title="Overdue" value={money(data.overdueMinor)} note={`${data.overdueCount.toLocaleString("en-IN")} invoices`} to="/invoices?overdue=true" alert={data.overdueMinor > 0} />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40"><Field label="Revenue from"><Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field></div>
            <div className="w-40"><Field label="Revenue to"><Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field></div>
            <p className="pb-2 text-sm text-slate-600">Revenue collected and its charts cover {date(data.from)} to {date(data.to)}.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Revenue collected by month"><RevenueChart rows={data.revenueByMonth} /></Card>
            <Card title="Revenue by payment method">
              <Table rows={data.revenueByMethod as any[]} empty="No payments in this period." columns={[
                { header: "Method", cell: (r: any) => label(r.method) },
                { header: "Collected", align: "right", cell: (r: any) => money(r.amountMinor) },
              ]} />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            <Card title="Subscriptions by status"><SubscriptionStatus counts={data.statusCounts} /></Card>
            <Card title="Oldest overdue invoices" actions={<Link className={`text-sm ${textLink}`} to="/invoices?overdue=true">View all</Link>}>
              <Table rows={data.oldestOverdue as any[]} empty="Nothing overdue." columns={[
                { header: "Invoice", cell: (r: any) => <Link className={textLink} to={`/invoices/${r.id}`}>{r.number}</Link> },
                { header: "Customer", cell: (r: any) => r.billToName },
                { header: "Due", cell: (r: any) => date(r.dueDate) },
                { header: "Status", cell: () => <Status value="OVERDUE" /> },
                { header: "Owed", align: "right", cell: (r: any) => money(r.totalMinor - r.paidMinor) },
              ]} />
            </Card>
          </div>
        </>
      )}

      {user?.role === "ADMIN" && (
        <Card title="Billing run">
          <p className="mb-3 text-sm text-slate-600">Billing runs by itself every hour. Run it now, or pick a future date to rehearse a billing day. A future date creates real invoices.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40"><Field label="Bill as of"><Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field></div>
            <Button disabled={run.isPending} onClick={() => { if (!asOf || asOf <= today() || window.confirm(`Bill as of ${asOf}? This creates real invoices for every period up to that future date, and they can't be removed, only cancelled one by one.`)) run.mutate(); }}>{run.isPending ? "Running…" : "Run billing"}</Button>
          </div>
          {result && (
            <p className="mt-3 text-sm text-slate-700">
              {result.billed} invoices created, {result.closed} subscriptions closed, {result.failed} failed.{" "}
              <Link className={textLink} to="/invoices?status=DRAFT">Review drafts</Link>
            </p>
          )}
          <ErrorText error={run.error} />
        </Card>
      )}
    </div>
  );
}
