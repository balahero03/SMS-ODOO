import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Card, ErrorText, Field, FormDialog, Input, Page, Pager, Status, Table, Toggle, useAction } from "../../../components/ui";
import { api, qs } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { customerName, date, money, planName, today } from "../../../lib/format";
import { formValues, readable } from "../../../lib/form";

const link = "font-semibold text-[#5b3fe8] hover:underline";
// Mirrors the phone rule in the API, which stays the final check. Browsers ignore a pattern that's
// invalid under the regex v flag, which requires brackets and dashes in a character class to be escaped.
const phoneInput = { type: "tel", pattern: "(?=(?:\\D*\\d){7})\\+?[0-9 \\(\\)\\-]{7,20}", title: "At least 7 digits. Spaces, brackets, dashes and a leading + are fine, up to 20 characters" };

export function Customers() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useQuery({ queryKey: ["customers", q, page], queryFn: () => api(`/customers${qs({ q, page })}`) });
  const [notice, setNotice] = useState("");
  const create = useAction((body: object) => api("/customers", { body }), (c) =>
    setNotice(c.inviteSent ? `${c.user.name} was added. They've been sent a link to set a portal password.` : `${c.user.name} was added, but the email couldn't be sent. Ask them to use Forgot password.`),
  );
  return (
    <Page title="Customers">
      <Toggle label="Add customer">
        {(close) => (
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { const v = formValues(e); create.mutate(v, { onSuccess: close }); }}>
            <Field label="Contact name"><Input name="name" required /></Field>
            <Field label="Email" hint="They get a link to set a portal password."><Input name="email" type="email" required /></Field>
            <Field label="Company"><Input name="companyName" /></Field>
            <Field label="Phone"><Input name="phone" {...phoneInput} /></Field>
            <Field label="Address"><Input name="address" /></Field>
            <div className="md:col-span-2"><ErrorText error={readable(create.error)} /></div>
            <div><Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving…" : "Save"}</Button></div>
          </form>
        )}
      </Toggle>
      {notice && <p role="status" className="text-sm text-slate-700">{notice}</p>}
      <Card>
        <div className="mb-3 w-72"><Input aria-label="Search customers" placeholder="Search name, company or email" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} /></div>
        <ErrorText error={error} />
        <Table rows={data?.data as any[]} empty="No customers match." columns={[
          { header: "Name", cell: (c: any) => <Link className={link} to={`/customers/${c.id}`}>{c.user.name}</Link> },
          { header: "Company", cell: (c: any) => c.companyName ?? "—" },
          { header: "Email", cell: (c: any) => c.user.email },
          { header: "Phone", cell: (c: any) => c.phone ?? "—" },
          { header: "Joined", cell: (c: any) => date(c.createdAt) },
          { header: "Portal access", cell: (c: any) => (c.user.active ? "Active" : "Inactive") },
        ]} />
        {data && <Pager page={page} limit={data.limit} total={data.total} onPage={setPage} />}
      </Card>
    </Page>
  );
}

function EditCustomer({ customer, onDone }: { customer: any; onDone: () => void }) {
  const save = useAction((v: Record<string, string>) =>
    api(`/customers/${customer.id}`, { method: "PATCH", body: { name: v.name, companyName: v.companyName ?? null, phone: v.phone ?? null, address: v.address ?? null } }),
  );
  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { const v = formValues(e); save.mutate(v, { onSuccess: onDone }); }}>
      <Field label="Contact name"><Input name="name" required defaultValue={customer.user.name} /></Field>
      <Field label="Email" hint="Their sign-in, so it can't be changed here."><Input value={customer.user.email} disabled /></Field>
      <Field label="Company" hint="New invoices use the new details. Existing invoices don't change."><Input name="companyName" defaultValue={customer.companyName ?? ""} /></Field>
      <Field label="Phone"><Input name="phone" {...phoneInput} defaultValue={customer.phone ?? ""} /></Field>
      <div className="md:col-span-2"><Field label="Address"><Input name="address" defaultValue={customer.address ?? ""} /></Field></div>
      <div className="md:col-span-2"><ErrorText error={readable(save.error)} /></div>
      <div><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></div>
    </form>
  );
}

export function CustomerDetail() {
  const { id } = useParams();
  // The router reuses this page between customers, so the key resets its pages, dialogs and messages.
  return <CustomerPage key={id} id={id!} />;
}

function CustomerPage({ id }: { id: string }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const access = useAction((active: boolean) => api(`/customers/${id}/access`, { method: "PATCH", body: { active } }), (c) =>
    setNotice(c.user.active ? "Portal access restored." : "Portal access removed. Their records are kept."),
  );
  const [subPage, setSubPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const { data: customer, error } = useQuery({ queryKey: ["customer", id], queryFn: () => api(`/customers/${id}`) });
  const subs = useQuery({ queryKey: ["subscriptions", "customer", id, subPage], queryFn: () => api(`/subscriptions${qs({ customerId: id, page: subPage, limit: 10 })}`) });
  const invoices = useQuery({ queryKey: ["invoices", "customer", id, invoicePage], queryFn: () => api(`/invoices${qs({ customerId: id, page: invoicePage, limit: 10 })}`) });
  if (error) return <ErrorText error={error} />;
  if (!customer) return <p className="text-sm text-slate-500">Loading…</p>;
  const isOverdue = (i: any) => i.status === "CONFIRMED" && i.dueDate.slice(0, 10) < today();
  return (
    <Page
      title={customerName(customer)}
      actions={
        <>
          {user?.role === "ADMIN" && (
            <Button
              variant={customer.user.active ? "danger" : "secondary"}
              disabled={access.isPending}
              onClick={() => { if (!customer.user.active || window.confirm(`Deactivate ${customerName(customer)}? They'll be signed out and can't use the portal. Their subscriptions and invoices are kept.`)) access.mutate(!customer.user.active); }}
            >
              {customer.user.active ? "Deactivate" : "Reactivate"}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setEditing(true)}>Edit details</Button>
          <Link to={`/subscriptions/new${qs({ customer: id, find: customer.user.email })}`} className="rounded-lg bg-[#5b3fe8] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#4c31d6]">New subscription</Link>
        </>
      }
    >
      {editing && <FormDialog title={`Edit ${customerName(customer)}`} onClose={() => setEditing(false)}><EditCustomer customer={customer} onDone={() => { setEditing(false); setNotice("Details saved."); }} /></FormDialog>}
      <p className="text-sm"><Link className={link} to="/customers">← Customers</Link></p>
      <ErrorText error={readable(access.error)} />
      {notice && !access.error && <p role="status" className="text-sm text-slate-700">{notice}</p>}
      <Card>
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {[
            ["Contact", customer.user.name],
            ["Email", customer.user.email],
            ["Phone", customer.phone ?? "—"],
            ["Address", customer.address ?? "—"],
            ["Joined", date(customer.createdAt)],
            ["Portal access", customer.user.active ? "Active" : "Inactive"],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0"><dt className="text-slate-500">{k}</dt><dd className="break-words font-medium text-slate-900">{v}</dd></div>
          ))}
        </dl>
      </Card>
      <Card title="Subscriptions">
        <ErrorText error={subs.error} />
        <Table rows={subs.data?.data as any[]} empty="No subscriptions yet." columns={[
          { header: "Number", cell: (s: any) => <Link className={link} to={`/subscriptions/${s.id}`}>{s.number}</Link> },
          { header: "Plan", cell: (s: any) => planName(s.plan) },
          { header: "Status", cell: (s: any) => <Status value={s.status} /> },
          { header: "Start", cell: (s: any) => date(s.startDate) },
          { header: "Expiry", cell: (s: any) => date(s.expiryDate) },
          { header: "Next bill", cell: (s: any) => (s.status === "ACTIVE" ? date(s.nextBillingDate) : "—") },
        ]} />
        {subs.data && <Pager page={subPage} limit={subs.data.limit} total={subs.data.total} onPage={setSubPage} />}
      </Card>
      <Card title="Invoices and payments">
        <p className="mb-3 text-sm text-slate-600">Open an invoice to see or record its payments.</p>
        <ErrorText error={invoices.error} />
        <Table rows={invoices.data?.data as any[]} empty="No invoices yet." columns={[
          { header: "Invoice", cell: (i: any) => <Link className={link} to={`/invoices/${i.id}`}>{i.number}</Link> },
          { header: "Subscription", cell: (i: any) => i.subscription.number },
          { header: "Status", cell: (i: any) => <Status value={isOverdue(i) ? "OVERDUE" : i.status} /> },
          { header: "Due", cell: (i: any) => date(i.dueDate) },
          { header: "Total", align: "right", cell: (i: any) => money(i.totalMinor) },
          { header: "Paid", align: "right", cell: (i: any) => money(i.paidMinor) },
          { header: "Owed", align: "right", cell: (i: any) => (i.status === "CONFIRMED" ? money(i.totalMinor - i.paidMinor) : "—") },
        ]} />
        {invoices.data && <Pager page={invoicePage} limit={invoices.data.limit} total={invoices.data.total} onPage={setInvoicePage} />}
      </Card>
    </Page>
  );
}
