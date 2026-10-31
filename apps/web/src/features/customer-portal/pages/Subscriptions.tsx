import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAction } from "../../../components/ui";
import { api, qs } from "../../../lib/api";
import { money, percent, planName, today } from "../../../lib/format";
import { Badge, Btn, ConfirmDialog, control, DataTable, ErrorNote, invoiceBadge, PageTitle, Pages, Panel, prettyDate, SearchBox, subscriptionBadge, Tabs, textLink } from "../components";

export const PERIOD: Record<string, string> = { DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" };

const FILTERS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Requests" },
  { value: "QUOTATION", label: "Quotations" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "CLOSED", label: "Closed" },
];

export function CustomerSubscriptions() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useQuery({ queryKey: ["subscriptions", status, q, page], queryFn: () => api(`/subscriptions${qs({ status, q, page })}`) });
  return (
    <>
      <PageTitle
        title="My subscriptions"
        subtitle="Everything you're subscribed to, plus your requests and quotations."
        actions={<Link to="/plans" className="rounded-lg bg-[#5b3fe8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4c31d6]">Browse plans</Link>}
      />
      <ErrorNote error={error} />
      <Panel>
        <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <Tabs name="Filter by status" options={FILTERS} value={status} onChange={(v) => { setPage(1); setParams(v ? { status: v } : {}); }} />
          <SearchBox aria-label="Search by number" placeholder="Search by number" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </div>
        <DataTable
          rows={data?.data as any[] | undefined}
          empty={status || q ? "No subscriptions match." : "You have no subscriptions yet. Browse plans to send a request."}
          columns={[
            { header: "Number", cell: (s: any) => <Link className={textLink} to={`/subscriptions/${s.id}`}>{s.number}</Link> },
            { header: "Plan", wide: true, cell: (s: any) => planName(s.plan) },
            { header: "Status", cell: (s: any) => <Badge value={subscriptionBadge(s)} /> },
            { header: "Next bill", cell: (s: any) => (s.status === "ACTIVE" ? prettyDate(s.nextBillingDate) : "—") },
            { header: "Expires", wide: true, cell: (s: any) => prettyDate(s.expiryDate) },
          ]}
        />
        {data && <Pages page={page} limit={data.limit} total={data.total} onPage={setPage} />}
      </Panel>
    </>
  );
}

function Steps({ status, requested }: { status: string; requested: boolean }) {
  const steps = [...(requested ? ["DRAFT"] : []), "QUOTATION", "CONFIRMED", "ACTIVE", "CLOSED"];
  const names: Record<string, string> = { DRAFT: "Requested", QUOTATION: "Quotation", CONFIRMED: "Confirmed", ACTIVE: status === "PAUSED" ? "Paused" : "Active", CLOSED: "Closed" };
  const current = steps.indexOf(status === "PAUSED" ? "ACTIVE" : status);
  return (
    <ol className="mb-6 flex flex-wrap gap-1.5 text-xs font-semibold">
      {steps.map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined} className={`rounded-full px-3 py-1 ${i === current ? "bg-[#5b3fe8] text-white" : i < current ? "bg-[#e4dfff] text-[#2e1f8f]" : "bg-slate-100 text-slate-500"}`}>
          {names[s]}
        </li>
      ))}
    </ol>
  );
}

function Lines({ sub }: { sub: any }) {
  const rows = [
    ...sub.lines.map((l: any) => ({ name: l.description, quantity: l.quantity, unit: l.unitPriceMinor, tax: percent(l.taxRateBp), amount: l.quantity * l.unitPriceMinor })),
    ...(sub.plan.priceMinor > 0 ? [{ name: `${sub.plan.name} plan fee`, quantity: 1, unit: sub.plan.priceMinor, tax: "—", amount: sub.plan.priceMinor }] : []),
  ];
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  return (
    <>
      <DataTable
        rows={rows}
        empty="Nothing on this subscription yet."
        columns={[
          { header: "Item", cell: (r) => <span className="whitespace-normal">{r.name}</span> },
          { header: "Qty", right: true, cell: (r) => r.quantity },
          { header: "Unit price", right: true, wide: true, cell: (r) => money(r.unit) },
          { header: "Tax", right: true, wide: true, cell: (r) => r.tax },
          { header: "Amount", right: true, cell: (r) => money(r.amount) },
        ]}
      />
      <div className="mt-3 flex justify-between border-t border-[#e4dfff] px-2 pt-3 text-sm font-bold">
        <span>Each {PERIOD[sub.plan.interval]}, before tax and discounts</span>
        <span className="tabular-nums">{money(total)}</span>
      </div>
    </>
  );
}

function Fact({ name, value }: { name: string; value: string }) {
  return <div><dt className="text-xs text-slate-500">{name}</dt><dd className="mt-0.5 text-sm font-semibold text-slate-900">{value}</dd></div>;
}

function QuotationReview({ sub, act }: { sub: any; act: any }) {
  const [declining, setDeclining] = useState(false);
  const expired = sub.quotationValidUntil && sub.quotationValidUntil.slice(0, 10) < today();
  return (
    <>
      <PageTitle title={`Quotation ${sub.number}`} subtitle={expired ? undefined : `Valid until ${prettyDate(sub.quotationValidUntil)}`} back={{ to: "/subscriptions", label: "My subscriptions" }} />
      <ErrorNote error={act.error} />
      {expired && <p role="status" className="mb-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">This quotation expired on {prettyDate(sub.quotationValidUntil)}. Contact your Brightloop team for a new one.</p>}
      <div className="space-y-6">
        <Panel>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Fact name="Plan" value={planName(sub.plan)} />
            <Fact name="Starts" value={prettyDate(sub.startDate)} />
            <Fact name="Expires" value={prettyDate(sub.expiryDate)} />
            <Fact name="Payment terms" value={`${sub.paymentTermsDays} days`} />
          </dl>
        </Panel>
        <Panel title="What's included">
          <Lines sub={sub} />
          <p className="mt-2 px-2 text-xs text-slate-500">Tax is added on each invoice.</p>
        </Panel>
        {!expired && (
          <div className="flex flex-wrap justify-end gap-2">
            <Btn variant="danger" disabled={act.isPending} onClick={() => setDeclining(true)}>Decline</Btn>
            <Btn variant="primary" disabled={act.isPending} onClick={() => act.mutate({ name: "confirm" })}>{act.isPending ? "Saving…" : "Confirm quotation"}</Btn>
          </div>
        )}
      </div>
      {declining && (
        <ConfirmDialog title={`Decline ${sub.number}?`} confirmLabel="Yes, decline" danger busy={act.isPending} onCancel={() => setDeclining(false)} onConfirm={() => act.mutate({ name: "close" }, { onSettled: () => setDeclining(false) })}>
          This closes the quotation. To change your mind later, you'd need a new one from your Brightloop team.
        </ConfirmDialog>
      )}
    </>
  );
}

function defaultRenewal(sub: any) {
  const expiry = new Date(sub.expiryDate).getTime();
  return new Date(expiry + (expiry - new Date(sub.startDate).getTime())).toISOString().slice(0, 10);
}

export function CustomerSubscriptionDetail() {
  const { id } = useParams();
  const { data: sub, error } = useQuery({ queryKey: ["subscription", id], queryFn: () => api(`/subscriptions/${id}`) });
  const act = useAction((a: { name: string; body?: object }) => api(`/subscriptions/${id}/${a.name}`, { method: "POST", body: a.body ?? {} }));
  const [dialog, setDialog] = useState<"renew" | "close" | "pause" | "cancel" | null>(null);
  const [renewTo, setRenewTo] = useState("");

  if (error) return <ErrorNote error={error} />;
  if (!sub) return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
  if (sub.status === "QUOTATION") return <QuotationReview sub={sub} act={act} />;

  const { status, plan } = sub;
  const running = status === "ACTIVE" || status === "PAUSED";
  const finish = (a: { name: string; body?: object }) => act.mutate(a, { onSettled: () => setDialog(null) });

  return (
    <>
      <PageTitle
        title={sub.number}
        back={{ to: "/subscriptions", label: "My subscriptions" }}
        actions={
          <>
            {status === "DRAFT" && <Btn variant="danger" disabled={act.isPending} onClick={() => setDialog("cancel")}>Cancel request</Btn>}
            {status === "ACTIVE" && plan.pausable && <Btn disabled={act.isPending} onClick={() => setDialog("pause")}>Pause</Btn>}
            {status === "PAUSED" && <Btn variant="primary" disabled={act.isPending} onClick={() => act.mutate({ name: "resume" })}>Resume</Btn>}
            {running && plan.renewable && sub.expiryDate && <Btn disabled={act.isPending} onClick={() => { setRenewTo(defaultRenewal(sub)); setDialog("renew"); }}>Renew</Btn>}
            {running && plan.closable && <Btn variant="danger" disabled={act.isPending} onClick={() => setDialog("close")}>Close</Btn>}
          </>
        }
      />
      <ErrorNote error={act.error} />
      <Steps status={status} requested={!!sub.requestedAt} />
      {status === "DRAFT" && (
        <div role="status" className="mb-6 rounded-lg bg-[#e4dfff] px-4 py-3 text-sm text-[#2e1f8f]">
          <p>We've received your request. The Brightloop team will review it and send you a quotation. Nothing is charged until you confirm it.</p>
          {sub.requestNote && <p className="mt-1">Your note: {sub.requestNote}</p>}
        </div>
      )}
      {status === "CONFIRMED" && <p role="status" className="mb-6 rounded-lg bg-[#e4dfff] px-4 py-3 text-sm text-[#2e1f8f]">You've confirmed this quotation. Your Brightloop team will activate it next.</p>}
      {status === "PAUSED" && <p role="status" className="mb-6 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">Paused since {prettyDate(sub.pausedAt)}. Periods that start while it's paused aren't billed.</p>}
      {status === "CLOSED" && <p role="status" className="mb-6 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">Closed on {prettyDate(sub.closedAt)}.</p>}
      <div className="space-y-6">
        <Panel>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Fact name="Plan" value={planName(plan)} />
            <Fact name={status === "DRAFT" || status === "CONFIRMED" ? "Starts" : "Started"} value={prettyDate(sub.startDate)} />
            <Fact name="Expires" value={prettyDate(sub.expiryDate)} />
            <Fact name="Next bill" value={status === "ACTIVE" ? prettyDate(sub.nextBillingDate) : "—"} />
            <Fact name="Payment terms" value={`${sub.paymentTermsDays} days`} />
          </dl>
        </Panel>
        <Panel title="What you pay for"><Lines sub={sub} /></Panel>
        {sub.discounts.length > 0 && (
          <Panel title="Discounts">
            <DataTable
              rows={sub.discounts.map((d: any) => d.discount)}
              empty=""
              columns={[
                { header: "Discount", cell: (d: any) => <span className="whitespace-normal">{d.name}</span> },
                { header: "Value", cell: (d: any) => (d.type === "PERCENT" ? percent(d.value) : money(d.value)) },
                { header: "Ends", cell: (d: any) => prettyDate(d.endDate) },
              ]}
            />
          </Panel>
        )}
        <Panel title="Invoices">
          <DataTable
            rows={sub.invoices as any[]}
            empty="No invoices to show yet. They appear here once your Brightloop team has issued them."
            columns={[
              { header: "Invoice", cell: (i: any) => <Link className={textLink} to={`/invoices/${i.id}`}>{i.number}</Link> },
              { header: "Period", wide: true, cell: (i: any) => `${prettyDate(i.periodStart)} to ${prettyDate(i.periodEnd)}` },
              { header: "Status", cell: (i: any) => <Badge value={invoiceBadge(i)} /> },
              { header: "Total", right: true, cell: (i: any) => money(i.totalMinor) },
            ]}
          />
        </Panel>
      </div>
      {dialog === "cancel" && (
        <ConfirmDialog title={`Cancel request ${sub.number}?`} confirmLabel="Yes, cancel it" danger busy={act.isPending} onCancel={() => setDialog(null)} onConfirm={() => finish({ name: "close" })}>
          The Brightloop team won't send a quotation for it. You can send a new request at any time.
        </ConfirmDialog>
      )}
      {dialog === "pause" && (
        <ConfirmDialog title={`Pause ${sub.number}?`} confirmLabel="Yes, pause" busy={act.isPending} onCancel={() => setDialog(null)} onConfirm={() => finish({ name: "pause" })}>
          Periods that start while it's paused won't be billed. You can resume at any time.
        </ConfirmDialog>
      )}
      {dialog === "renew" && (
        <ConfirmDialog title={`Renew ${sub.number}?`} confirmLabel="Yes, renew" busy={act.isPending} onCancel={() => setDialog(null)} onConfirm={() => finish({ name: "renew", body: { expiryDate: renewTo } })}>
          <p>It currently expires on {prettyDate(sub.expiryDate)}. Billing continues until the new date.</p>
          <label className="mt-3 block font-medium text-slate-700">
            New expiry date
            <input type="date" className={`${control} mt-1`} min={new Date(new Date(sub.expiryDate).getTime() + 86_400_000).toISOString().slice(0, 10)} value={renewTo} onChange={(e) => setRenewTo(e.target.value)} />
          </label>
        </ConfirmDialog>
      )}
      {dialog === "close" && (
        <ConfirmDialog title={`Close ${sub.number}?`} confirmLabel="Yes, close it" danger busy={act.isPending} onCancel={() => setDialog(null)} onConfirm={() => finish({ name: "close" })}>
          This takes effect immediately and can't be undone.
        </ConfirmDialog>
      )}
    </>
  );
}
