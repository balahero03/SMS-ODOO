import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, ErrorText, Field, Input, Page, Pager, Select, Table } from "../../../components/ui";
import { api, qs } from "../../../lib/api";
import { date, label, money } from "../../../lib/format";

export function Payments() {
  const [filter, setFilter] = useState({ from: "", to: "", method: "" });
  const [page, setPage] = useState(1);
  const { data, error } = useQuery({ queryKey: ["payments", filter, page], queryFn: () => api(`/payments${qs({ ...filter, page })}`) });
  const set = (patch: Partial<typeof filter>) => { setPage(1); setFilter({ ...filter, ...patch }); };
  return (
    <Page title="Payments">
      <Card>
        <p className="mb-3 text-sm text-slate-600">To record a payment, open the invoice it belongs to.</p>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="w-40"><Field label="From"><Input type="date" value={filter.from} onChange={(e) => set({ from: e.target.value })} /></Field></div>
          <div className="w-40"><Field label="To"><Input type="date" value={filter.to} onChange={(e) => set({ to: e.target.value })} /></Field></div>
          <div className="w-44"><Field label="Method">
            <Select value={filter.method} onChange={(e) => set({ method: e.target.value })}>
              <option value="">All methods</option>
              {["BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "CASH"].map((m) => <option key={m} value={m}>{label(m)}</option>)}
            </Select>
          </Field></div>
        </div>
        <ErrorText error={error} />
        <Table rows={data?.data as any[]} empty="No payments match." columns={[
          { header: "Date", cell: (p) => date(p.paidOn) },
          { header: "Invoice", cell: (p) => <Link className="font-semibold text-[#5b3fe8] hover:underline" to={`/invoices/${p.invoice.id}`}>{p.invoice.number}</Link> },
          { header: "Customer", cell: (p) => p.invoice.billToName },
          { header: "Method", cell: (p) => label(p.method) },
          { header: "Note", cell: (p) => p.note ?? "—" },
          { header: "Amount", align: "right", cell: (p) => money(p.amountMinor) },
        ]} />
        {data && <Pager page={page} limit={data.limit} total={data.total} onPage={setPage} />}
      </Card>
    </Page>
  );
}
