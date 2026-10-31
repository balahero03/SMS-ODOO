import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, qs } from "../../../lib/api";
import { label, money, percent } from "../../../lib/format";
import { Badge, Btn, DataTable, ErrorNote, invoiceBadge, PageTitle, Pages, Panel, prettyDate, SearchBox, Stat, Tabs, textLink, usePortalData } from "../components";

const FILTERS = [
  { value: "", label: "All" },
  { value: "CONFIRMED", label: "Unpaid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function CustomerInvoices() {
  const [params, setParams] = useSearchParams();
  const filter = params.get("overdue") === "true" ? "OVERDUE" : (params.get("status") ?? "");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const query = filter === "OVERDUE" ? { overdue: "true" } : { status: filter };
  const { data, error } = useQuery({ queryKey: ["invoices", filter, q, page], queryFn: () => api(`/invoices${qs({ ...query, q, page })}`) });
  const { invoices, partial, unpaidMinor, overdueMinor, paidMinor } = usePortalData();
  const loading = !invoices;
  return (
    <>
      <PageTitle title="My invoices" subtitle="What's been billed, what's paid and what's still to pay." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat title="To pay" value={loading ? "…" : money(unpaidMinor)} />
        <Stat title="Overdue" value={loading ? "…" : money(overdueMinor)} tone={overdueMinor > 0 ? "alert" : "plain"} />
        <Stat title="Paid so far" value={loading ? "…" : money(paidMinor)} />
      </div>
      {partial && <p className="mb-4 text-xs text-slate-500">Totals are based on your latest 100 invoices.</p>}
      <ErrorNote error={error} />
      <Panel>
        <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <Tabs
            name="Filter by status"
            options={FILTERS}
            value={filter}
            onChange={(v) => { setPage(1); setParams(v === "OVERDUE" ? { overdue: "true" } : v ? { status: v } : {}); }}
          />
          <SearchBox aria-label="Search by number" placeholder="Search by number" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </div>
        <DataTable
          rows={data?.data as any[] | undefined}
          empty="No invoices match."
          columns={[
            { header: "Invoice", cell: (i: any) => <Link className={textLink} to={`/invoices/${i.id}`}>{i.number}</Link> },
            { header: "Subscription", wide: true, cell: (i: any) => i.subscription.number },
            { header: "Status", cell: (i: any) => <Badge value={invoiceBadge(i)} /> },
            { header: "Due", wide: true, cell: (i: any) => prettyDate(i.dueDate) },
            { header: "Total", right: true, wide: true, cell: (i: any) => money(i.totalMinor) },
            { header: "To pay", right: true, cell: (i: any) => (i.status === "CONFIRMED" ? money(i.totalMinor - i.paidMinor) : "—") },
          ]}
        />
        {data && <Pages page={page} limit={data.limit} total={data.total} onPage={setPage} />}
      </Panel>
    </>
  );
}

export function CustomerInvoiceDetail() {
  const { id } = useParams();
  const { data: inv, error } = useQuery({ queryKey: ["invoice", id], queryFn: () => api(`/invoices/${id}`) });
  if (error) return <ErrorNote error={error} />;
  if (!inv) return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
  const balance = inv.status === "CANCELLED" ? 0 : inv.totalMinor - inv.paidMinor;
  return (
    <>
      <PageTitle title={inv.number} back={{ to: "/invoices", label: "My invoices" }} actions={<Btn variant="primary" onClick={() => window.print()}>Print / Save PDF</Btn>} />
      <div className="space-y-6">
        <Panel>
          <div className="flex flex-wrap justify-between gap-6 text-sm">
            <div>
              <p className="text-lg font-extrabold tracking-tight text-slate-950">Invoice {inv.number}</p>
              <p className="mt-1"><Badge value={invoiceBadge(inv)} /></p>
              <p className="mt-3 text-xs text-slate-500">Bill to</p>
              <p className="font-semibold">{inv.billToName}</p>
              {inv.billToAddress && <p className="text-slate-600">{inv.billToAddress}</p>}
              <p className="text-slate-600">{inv.billToEmail}</p>
            </div>
            <dl className="grid grid-cols-[auto_auto] content-start gap-x-4 gap-y-1">
              <dt className="text-slate-500">Issued</dt><dd className="font-medium">{prettyDate(inv.issueDate)}</dd>
              <dt className="text-slate-500">Due</dt><dd className="font-medium">{prettyDate(inv.dueDate)}</dd>
              <dt className="text-slate-500">Period</dt><dd className="font-medium">{prettyDate(inv.periodStart)} to {prettyDate(inv.periodEnd)}</dd>
              <dt className="text-slate-500">Subscription</dt><dd><Link className={textLink} to={`/subscriptions/${inv.subscription.id}`}>{inv.subscription.number}</Link></dd>
            </dl>
          </div>
          <div className="mt-6">
            <DataTable
              rows={inv.lines as any[]}
              empty=""
              columns={[
                { header: "Description", cell: (l: any) => <span className="whitespace-normal">{l.description}</span> },
                { header: "Qty", right: true, cell: (l: any) => l.quantity },
                { header: "Unit price", right: true, wide: true, cell: (l: any) => money(l.unitPriceMinor) },
                { header: "Discount", right: true, wide: true, cell: (l: any) => (l.discountMinor ? `−${money(l.discountMinor)}` : "—") },
                { header: "Tax", right: true, wide: true, cell: (l: any) => `${money(l.taxMinor)} (${percent(l.taxRateBp)})` },
                { header: "Amount", right: true, cell: (l: any) => money(l.amountMinor) },
              ]}
            />
          </div>
          <dl className="ml-auto mt-4 grid max-w-xs grid-cols-2 gap-y-1.5 border-t border-[#e4dfff] pt-3 text-sm tabular-nums">
            <dt className="text-slate-600">Subtotal</dt><dd className="text-right">{money(inv.subtotalMinor)}</dd>
            {inv.discounts.map((d: any) => (
              <div key={d.discountId} className="contents"><dt className="text-slate-600">{d.name}</dt><dd className="text-right">−{money(d.amountMinor)}</dd></div>
            ))}
            <dt className="text-slate-600">Tax</dt><dd className="text-right">{money(inv.taxMinor)}</dd>
            <dt className="font-bold">Total</dt><dd className="text-right font-bold">{money(inv.totalMinor)}</dd>
            <dt className="text-slate-600">Paid</dt><dd className="text-right">{money(inv.paidMinor)}</dd>
            <dt className="font-bold">Balance</dt><dd className="text-right font-bold">{money(balance)}</dd>
          </dl>
        </Panel>
        <Panel title="Payments">
          <DataTable
            rows={inv.payments as any[]}
            empty={balance > 0 ? "No payments recorded yet." : "No payments on this invoice."}
            columns={[
              { header: "Date", cell: (p: any) => prettyDate(p.paidOn) },
              { header: "Method", cell: (p: any) => label(p.method) },
              { header: "Note", wide: true, cell: (p: any) => p.note ?? "—" },
              { header: "Amount", right: true, cell: (p: any) => money(p.amountMinor) },
            ]}
          />
          {balance > 0 && <p className="no-print mt-3 text-sm text-slate-600">To pay this invoice, contact your Brightloop team. Payments appear here once they're recorded.</p>}
        </Panel>
      </div>
    </>
  );
}
