import { useQueries } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../lib/api";
import { label, money } from "../../../lib/format";
import { DataTable, ErrorNote, PageTitle, Panel, control, prettyDate, Stat, textLink, usePortalData } from "../components";

const METHODS = ["BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "CASH"];

export function CustomerPayments() {
  const { invoices, error, partial } = usePortalData();
  const [filter, setFilter] = useState({ from: "", to: "", method: "" });
  const set = (patch: Partial<typeof filter>) => setFilter({ ...filter, ...patch });

  // Customers have no payments list in the API, so payments are gathered from each paid invoice.
  const paid = invoices?.filter((i) => i.paidMinor > 0) ?? [];
  const details = useQueries({ queries: paid.map((i) => ({ queryKey: ["invoice", i.id], queryFn: () => api(`/invoices/${i.id}`) })) });
  const loading = !invoices || details.some((d) => d.isPending);
  const failed = details.find((d) => d.error)?.error;

  const all = details.flatMap((d) => (d.data?.payments ?? []).map((p: any) => ({ ...p, invoice: d.data }))).sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  const rows = all.filter((p) => {
    const day = p.paidOn.slice(0, 10);
    return (!filter.method || p.method === filter.method) && (!filter.from || day >= filter.from) && (!filter.to || day <= filter.to);
  });

  return (
    <>
      <PageTitle title="Payment history" subtitle="Payments recorded against your invoices." />
      <ErrorNote error={error ?? failed} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Stat title="Total shown" value={loading ? "…" : money(rows.reduce((sum, p) => sum + p.amountMinor, 0))} />
        <Stat title="Payments shown" value={loading ? "…" : rows.length.toLocaleString("en-IN")} />
      </div>
      {partial && <p className="mb-4 text-xs text-slate-500">Showing payments from your latest 100 invoices.</p>}
      <Panel>
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-600">From<input type="date" className={`${control} mt-1`} value={filter.from} onChange={(e) => set({ from: e.target.value })} /></label>
          <label className="text-xs font-medium text-slate-600">To<input type="date" className={`${control} mt-1`} value={filter.to} onChange={(e) => set({ to: e.target.value })} /></label>
          <label className="text-xs font-medium text-slate-600">Method
            <select className={`${control} mt-1`} value={filter.method} onChange={(e) => set({ method: e.target.value })}>
              <option value="">All methods</option>
              {METHODS.map((m) => <option key={m} value={m}>{label(m)}</option>)}
            </select>
          </label>
        </div>
        <DataTable
          rows={loading ? undefined : rows}
          empty={all.length ? "No payments match these filters." : "No payments recorded yet."}
          columns={[
            { header: "Date", cell: (p: any) => prettyDate(p.paidOn) },
            { header: "Invoice", cell: (p: any) => <Link className={textLink} to={`/invoices/${p.invoice.id}`}>{p.invoice.number}</Link> },
            { header: "Method", wide: true, cell: (p: any) => label(p.method) },
            { header: "Amount", right: true, cell: (p: any) => money(p.amountMinor) },
          ]}
        />
      </Panel>
    </>
  );
}
