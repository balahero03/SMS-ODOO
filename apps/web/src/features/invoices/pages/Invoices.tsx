import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button, Card, ErrorText, Field, Input, Page, Pager, Select, Status, Table, useAction } from "../../../components/ui";
import { api, qs } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { date, label, money, percent, today, toMinor } from "../../../lib/format";

const isOverdue = (i: any) => i.status === "CONFIRMED" && i.dueDate.slice(0, 10) < today();

export function Invoices() {
  const { user } = useAuth();
  const isCustomer = user!.role === "CUSTOMER";
  const [params, setParams] = useSearchParams();
  const filter = params.get("overdue") === "true" ? "OVERDUE" : (params.get("status") ?? "");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const query = filter === "OVERDUE" ? { overdue: "true" } : { status: filter };
  const { data, error } = useQuery({
    queryKey: ["invoices", filter, q, page],
    queryFn: () => api(`/invoices${qs({ ...query, q, page })}`),
  });
  const confirmAll = useAction(() => api("/invoices/confirm-drafts", { body: {} }));
  const options = ["DRAFT", "CONFIRMED", "OVERDUE", "PAID", "CANCELLED"].filter((s) => !isCustomer || s !== "DRAFT");

  return (
    <Page
      title={isCustomer ? "My invoices" : "Invoices"}
      actions={!isCustomer && <Button variant="secondary" disabled={confirmAll.isPending} onClick={() => { if (window.confirm("Confirm every draft invoice?")) confirmAll.mutate(); }}>Confirm all drafts</Button>}
    >
      <ErrorText error={confirmAll.error} />
      {confirmAll.data && <p className="text-sm text-slate-700">{(confirmAll.data as any).confirmed} invoices confirmed.</p>}
      <Card>
        <div className="mb-3 flex flex-wrap gap-3">
          <div className="w-44">
            <Select aria-label="Status" value={filter} onChange={(e) => {
              setPage(1);
              const v = e.target.value;
              setParams(v === "OVERDUE" ? { overdue: "true" } : v ? { status: v } : {});
            }}>
              <option value="">All statuses</option>
              {options.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </Select>
          </div>
          <div className="w-56"><Input aria-label="Search by number" placeholder="Search by number" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} /></div>
        </div>
        <ErrorText error={error} />
        <Table rows={data?.data as any[]} empty="No invoices match." columns={[
          { header: "Invoice", cell: (i) => <Link className="text-indigo-700 hover:underline" to={`/invoices/${i.id}`}>{i.number}</Link> },
          ...(isCustomer ? [] : [{ header: "Customer", cell: (i: any) => i.billToName }]),
          { header: "Subscription", cell: (i) => i.subscription.number },
          { header: "Status", cell: (i) => <Status value={isOverdue(i) ? "OVERDUE" : i.status} /> },
          { header: "Due", cell: (i) => date(i.dueDate) },
          { header: "Total", align: "right", cell: (i) => money(i.totalMinor) },
          { header: "Owed", align: "right", cell: (i) => (i.status === "CONFIRMED" ? money(i.totalMinor - i.paidMinor) : "—") },
        ]} />
        {data && <Pager page={page} limit={data.limit} total={data.total} onPage={setPage} />}
      </Card>
    </Page>
  );
}

function PaymentForm({ invoice }: { invoice: any }) {
  const outstanding = invoice.totalMinor - invoice.paidMinor;
  const pay = useAction((body: object) => api(`/payments/invoice/${invoice.id}`, { body }));
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    pay.mutate({ method: v.method, amountMinor: toMinor(v.amount), paidOn: v.paidOn, note: v.note || null });
  };
  return (
    <Card title="Record a payment">
      <form key={outstanding} className="grid items-end gap-3 md:grid-cols-5" onSubmit={submit}>
        <Field label="Method">
          <Select name="method">{["BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "CASH"].map((m) => <option key={m} value={m}>{label(m)}</option>)}</Select>
        </Field>
        <Field label="Amount (₹)"><Input name="amount" type="number" step="0.01" min="0.01" max={outstanding / 100} defaultValue={outstanding / 100} required /></Field>
        <Field label="Date"><Input name="paidOn" type="date" defaultValue={today()} required /></Field>
        <Field label="Note"><Input name="note" /></Field>
        <Button type="submit" disabled={pay.isPending}>Record</Button>
      </form>
      <div className="mt-2"><ErrorText error={pay.error} /></div>
    </Card>
  );
}

export function InvoiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isCustomer = user!.role === "CUSTOMER";
  const { data: inv, error } = useQuery({ queryKey: ["invoice", id], queryFn: () => api(`/invoices/${id}`) });
  const act = useAction((action: string) => api(`/invoices/${id}/${action}`, { method: "POST", body: {} }));
  if (error) return <ErrorText error={error} />;
  if (!inv) return <p className="text-sm text-slate-500">Loading…</p>;
  const canSend = inv.status === "CONFIRMED" || inv.status === "PAID";

  return (
    <Page
      title={inv.number}
      actions={
        <>
          {!isCustomer && inv.status === "DRAFT" && <Button disabled={act.isPending} onClick={() => act.mutate("confirm")}>Confirm</Button>}
          {!isCustomer && canSend && <Button variant="secondary" disabled={act.isPending} onClick={() => act.mutate("send")}>{inv.sentAt ? "Send again" : "Send"}</Button>}
          <Button variant="secondary" onClick={() => window.print()}>Print</Button>
          {!isCustomer && (inv.status === "DRAFT" || inv.status === "CONFIRMED") && inv.paidMinor === 0 && (
            <Button variant="danger" disabled={act.isPending} onClick={() => { if (window.confirm(`Cancel ${inv.number}? This period won't be billed again.`)) act.mutate("cancel"); }}>Cancel invoice</Button>
          )}
        </>
      }
    >
      <ErrorText error={act.error} />
      <Card>
        <div className="flex flex-wrap justify-between gap-4 text-sm">
          <div>
            <p className="text-lg font-semibold text-slate-900">Invoice {inv.number}</p>
            <p className="mt-1"><Status value={isOverdue(inv) ? "OVERDUE" : inv.status} /></p>
            <p className="mt-2 font-medium">{inv.billToName}</p>
            <p className="text-slate-600">{inv.billToEmail}</p>
            {inv.billToAddress && <p className="text-slate-600">{inv.billToAddress}</p>}
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
            <dt className="text-slate-500">Issued</dt><dd>{date(inv.issueDate)}</dd>
            <dt className="text-slate-500">Due</dt><dd>{date(inv.dueDate)}</dd>
            <dt className="text-slate-500">Period</dt><dd>{date(inv.periodStart)} to {date(inv.periodEnd)}</dd>
            <dt className="text-slate-500">Subscription</dt><dd><Link className="text-indigo-700 hover:underline" to={`/subscriptions/${inv.subscription.id}`}>{inv.subscription.number}</Link></dd>
            {inv.sentAt && <><dt className="text-slate-500">Sent</dt><dd>{date(inv.sentAt)}</dd></>}
          </dl>
        </div>
        <div className="mt-4">
          <Table rows={inv.lines as any[]} columns={[
            { header: "Description", cell: (l) => l.description },
            { header: "Qty", align: "right", cell: (l) => l.quantity },
            { header: "Unit price", align: "right", cell: (l) => money(l.unitPriceMinor) },
            { header: "Discount", align: "right", cell: (l) => (l.discountMinor ? `−${money(l.discountMinor)}` : "—") },
            { header: "Tax", align: "right", cell: (l) => `${money(l.taxMinor)} (${percent(l.taxRateBp)})` },
            { header: "Amount", align: "right", cell: (l) => money(l.amountMinor) },
          ]} />
        </div>
        <dl className="ml-auto mt-4 grid max-w-xs grid-cols-2 gap-y-1 text-sm tabular-nums">
          <dt className="text-slate-600">Subtotal</dt><dd className="text-right">{money(inv.subtotalMinor)}</dd>
          {inv.discounts.map((d: any) => (
            <div key={d.discountId} className="contents"><dt className="text-slate-600">{d.name}</dt><dd className="text-right">−{money(d.amountMinor)}</dd></div>
          ))}
          <dt className="text-slate-600">Tax</dt><dd className="text-right">{money(inv.taxMinor)}</dd>
          <dt className="font-semibold">Total</dt><dd className="text-right font-semibold">{money(inv.totalMinor)}</dd>
          <dt className="text-slate-600">Paid</dt><dd className="text-right">{money(inv.paidMinor)}</dd>
          <dt className="font-semibold">Balance</dt><dd className="text-right font-semibold">{money(inv.status === "CANCELLED" ? 0 : inv.totalMinor - inv.paidMinor)}</dd>
        </dl>
      </Card>
      {!isCustomer && inv.status === "CONFIRMED" && <div className="no-print"><PaymentForm invoice={inv} /></div>}
      {inv.payments.length > 0 && (
        <Card title="Payments">
          <Table rows={inv.payments as any[]} columns={[
            { header: "Date", cell: (p) => date(p.paidOn) },
            { header: "Method", cell: (p) => label(p.method) },
            { header: "Note", cell: (p) => p.note ?? "—" },
            { header: "Amount", align: "right", cell: (p) => money(p.amountMinor) },
          ]} />
        </Card>
      )}
    </Page>
  );
}
