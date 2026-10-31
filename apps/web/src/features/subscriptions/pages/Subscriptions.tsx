import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Card, ErrorText, Field, FormDialog, Input, Page, Pager, Select, Status, Table, useAction } from "../../../components/ui";
import { api, qs } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { customerName, date, label, money, percent, planName, today, toMinor } from "../../../lib/format";

const STATUSES = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "PAUSED", "CLOSED"];

export function Subscriptions() {
  const { user } = useAuth();
  const isCustomer = user!.role === "CUSTOMER";
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useQuery({
    queryKey: ["subscriptions", status, q, page],
    queryFn: () => api(`/subscriptions${qs({ status, q, page })}`),
  });
  return (
    <Page title={isCustomer ? "My subscriptions" : "Subscriptions"} actions={!isCustomer && <Link to="/subscriptions/new"><Button>New subscription</Button></Link>}>
      <Card>
        <div className="mb-3 flex flex-wrap gap-3">
          <div className="w-44">
            <Select aria-label="Status" value={status} onChange={(e) => { setPage(1); setParams(e.target.value ? { status: e.target.value } : {}); }}>
              <option value="">All statuses</option>
              {STATUSES.filter((s) => !isCustomer || s !== "DRAFT").map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </Select>
          </div>
          <div className="w-56"><Input aria-label="Search by number" placeholder="Search by number" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} /></div>
        </div>
        <ErrorText error={error} />
        <Table rows={data?.data as any[]} empty="No subscriptions match." columns={[
          { header: "Number", cell: (s) => <Link className="font-semibold text-[#5b3fe8] hover:underline" to={`/subscriptions/${s.id}`}>{s.number}</Link> },
          ...(isCustomer ? [] : [{ header: "Customer", cell: (s: any) => customerName(s.customer) }]),
          { header: "Plan", cell: (s) => planName(s.plan) },
          { header: "Status", cell: (s) => <Status value={s.status} /> },
          { header: "Start", cell: (s) => date(s.startDate) },
          { header: "Expiry", cell: (s) => date(s.expiryDate) },
          { header: "Next bill", cell: (s) => (s.status === "ACTIVE" ? date(s.nextBillingDate) : "—") },
        ]} />
        {data && <Pager page={page} limit={data.limit} total={data.total} onPage={setPage} />}
      </Card>
    </Page>
  );
}

interface DraftLine {
  productId: string;
  variantId: string;
  quantity: number;
  /** Rupees as typed. Blank means the catalogue price. */
  unit: string;
}

const blankLine = (): DraftLine => ({ productId: "", variantId: "", quantity: 1, unit: "" });

const lineBody = (lines: DraftLine[]) =>
  lines.filter((l) => l.productId).map((l) => ({
    productId: l.productId,
    variantId: l.variantId || null,
    quantity: Number(l.quantity),
    ...(l.unit !== "" ? { unitPriceMinor: toMinor(l.unit) } : {}),
  }));

function LineEditor({ lines, setLines, products }: { lines: DraftLine[]; setLines: (lines: DraftLine[]) => void; products: any[] }) {
  const setLine = (i: number, patch: Partial<DraftLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Lines</h3>
      {lines.map((l, i) => {
        const product = products.find((p) => p.id === l.productId);
        return (
          <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_1fr_5rem_8rem_auto]">
            <Select aria-label="Product" value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value, variantId: "", unit: "" })}>
              <option value="">Product…</option>
              {products.filter((p) => p.active || p.id === l.productId).map((p) => <option key={p.id} value={p.id}>{p.name} ({money(p.salesPriceMinor)})</option>)}
            </Select>
            <Select aria-label="Variant" value={l.variantId} disabled={!product?.variants.length} onChange={(e) => setLine(i, { variantId: e.target.value, unit: "" })}>
              <option value="">No variant</option>
              {product?.variants.map((v: any) => <option key={v.id} value={v.id}>{v.attribute}: {v.value} (+{money(v.extraPriceMinor)})</option>)}
            </Select>
            <Input aria-label="Quantity" type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
            <Input aria-label="Unit price (₹)" type="number" min={0} step="0.01" placeholder="Unit price" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} />
            <Button variant="secondary" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</Button>
          </div>
        );
      })}
      <Button variant="secondary" onClick={() => setLines([...lines, blankLine()])}>Add line</Button>
      <p className="text-xs text-slate-500">Leave unit price blank to use the catalogue price.</p>
    </div>
  );
}

function EditDraft({ sub, onDone }: { sub: any; onDone: () => void }) {
  const products = useQuery({ queryKey: ["products"], queryFn: () => api("/products") });
  const [form, setForm] = useState({ startDate: sub.startDate.slice(0, 10), expiryDate: sub.expiryDate?.slice(0, 10) ?? "", paymentTermsDays: sub.paymentTermsDays as number });
  const [lines, setLines] = useState<DraftLine[]>(sub.lines.map((l: any) => ({ productId: l.productId, variantId: l.variantId ?? "", quantity: l.quantity, unit: String(l.unitPriceMinor / 100) })));
  const save = useAction(() =>
    api(`/subscriptions/${sub.id}`, { method: "PUT", body: { startDate: form.startDate, expiryDate: form.expiryDate || null, paymentTermsDays: Number(form.paymentTermsDays), lines: lineBody(lines) } }),
  );
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined, { onSuccess: onDone }); }}>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Start date"><Input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
        <Field label="Expiry date (optional)"><Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></Field>
        <Field label="Payment terms (days)"><Input type="number" min={0} required value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: Number(e.target.value) })} /></Field>
      </div>
      <LineEditor lines={lines} setLines={setLines} products={products.data?.data ?? []} />
      <ErrorText error={save.error} />
      <Button type="submit" disabled={save.isPending}>Save draft</Button>
    </form>
  );
}

function RenewDialog({ sub, onDone }: { sub: any; onDone: () => void }) {
  const expiry = new Date(sub.expiryDate).getTime();
  const [expiryDate, setExpiryDate] = useState(new Date(expiry + (expiry - new Date(sub.startDate).getTime())).toISOString().slice(0, 10));
  const save = useAction(() => api(`/subscriptions/${sub.id}/renew`, { body: { expiryDate } }));
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined, { onSuccess: onDone }); }}>
      <p className="text-sm text-slate-600">It currently expires on {date(sub.expiryDate)}. The date below extends it by its original term, and you can change it.</p>
      <div className="w-48"><Field label="New expiry date"><Input type="date" required min={new Date(expiry + 86_400_000).toISOString().slice(0, 10)} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></Field></div>
      <ErrorText error={save.error} />
      <Button type="submit" disabled={save.isPending}>Renew</Button>
    </form>
  );
}

export function NewSubscription() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"template" | "scratch">("template");
  const [customerQuery, setCustomerQuery] = useState(params.get("find") ?? "");
  const [form, setForm] = useState({ customerId: params.get("customer") ?? "", templateId: "", planId: "", startDate: today(), expiryDate: "", paymentTermsDays: 30, validityDays: 30 });
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);

  const customers = useQuery({ queryKey: ["customers", "pick", customerQuery], queryFn: () => api(`/customers${qs({ q: customerQuery, limit: 50 })}`) });
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => api("/templates") });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => api("/plans") });
  const products = useQuery({ queryKey: ["products"], queryFn: () => api("/products") });
  const productList: any[] = products.data?.data ?? [];

  const save = useAction(
    () => {
      const common = {
        customerId: form.customerId,
        startDate: form.startDate,
        expiryDate: form.expiryDate || null,
        paymentTermsDays: Number(form.paymentTermsDays),
      };
      return mode === "template"
        ? api("/subscriptions/from-template", { body: { ...common, templateId: form.templateId } })
        : api("/subscriptions", {
            body: {
              ...common,
              planId: form.planId,
              validityDays: Number(form.validityDays),
              lines: lineBody(lines),
            },
          });
    },
    (sub) => navigate(`/subscriptions/${sub.id}`),
  );
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  return (
    <Page title="New subscription">
      <Card>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="flex gap-2">
            <Button variant={mode === "template" ? "primary" : "secondary"} onClick={() => setMode("template")}>From template</Button>
            <Button variant={mode === "scratch" ? "primary" : "secondary"} onClick={() => setMode("scratch")}>From scratch</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Find customer"><Input value={customerQuery} placeholder="Name, company or email" onChange={(e) => setCustomerQuery(e.target.value)} /></Field>
            <Field label="Customer">
              <Select required value={form.customerId} onChange={(e) => set({ customerId: e.target.value })}>
                <option value="">Select…</option>
                {(customers.data?.data as any[])?.map((c) => <option key={c.id} value={c.id}>{customerName(c)} ({c.user.email})</option>)}
              </Select>
            </Field>
            {mode === "template" ? (
              <Field label="Quotation template">
                <Select required value={form.templateId} onChange={(e) => set({ templateId: e.target.value })}>
                  <option value="">Select…</option>
                  {(templates.data?.data as any[])?.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.plan.name}, valid {t.validityDays} days)</option>)}
                </Select>
              </Field>
            ) : (
              <Field label="Plan">
                <Select required value={form.planId} onChange={(e) => set({ planId: e.target.value })}>
                  <option value="">Select…</option>
                  {(plans.data?.data as any[])?.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{planName(p)}, {money(p.priceMinor)}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Start date"><Input type="date" required value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
            <Field label="Expiry date (optional)"><Input type="date" value={form.expiryDate} onChange={(e) => set({ expiryDate: e.target.value })} /></Field>
            <Field label="Payment terms (days)"><Input type="number" min={0} required value={form.paymentTermsDays} onChange={(e) => set({ paymentTermsDays: Number(e.target.value) })} /></Field>
            {mode === "scratch" && <Field label="Quotation valid for (days)"><Input type="number" min={1} required value={form.validityDays} onChange={(e) => set({ validityDays: Number(e.target.value) })} /></Field>}
          </div>
          {mode === "scratch" && <LineEditor lines={lines} setLines={setLines} products={productList} />}
          <ErrorText error={save.error} />
          <Button type="submit" disabled={save.isPending}>Create draft</Button>
        </form>
      </Card>
    </Page>
  );
}

function Stepper({ status }: { status: string }) {
  const steps = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "CLOSED"];
  const current = steps.indexOf(status === "PAUSED" ? "ACTIVE" : status);
  return (
    <ol className="flex flex-wrap gap-1 text-xs">
      {steps.map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined} className={`rounded-full px-3 py-1 font-semibold ${i === current ? "bg-[#5b3fe8] text-white" : i < current ? "bg-[#e4dfff] text-[#2e1f8f]" : "bg-slate-100 text-slate-500"}`}>
          {label(s)}{i === current && status === "PAUSED" ? " (paused)" : ""}
        </li>
      ))}
    </ol>
  );
}

export function SubscriptionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isCustomer = user!.role === "CUSTOMER";
  const [discountId, setDiscountId] = useState("");
  const [dialog, setDialog] = useState<"edit" | "renew" | null>(null);
  const { data: sub, error } = useQuery({ queryKey: ["subscription", id], queryFn: () => api(`/subscriptions/${id}`) });
  const discounts = useQuery({ queryKey: ["discounts"], queryFn: () => api("/discounts"), enabled: !isCustomer });
  const act = useAction((action: string) => api(`/subscriptions/${id}/${action}`, { method: "POST", body: {} }));
  const attach = useAction(() => api(`/subscriptions/${id}/discounts`, { body: { discountId } }), () => setDiscountId(""));
  const detach = useAction((d: string) => api(`/subscriptions/${id}/discounts/${d}`, { method: "DELETE" }));

  if (error) return <ErrorText error={error} />;
  if (!sub) return <p className="text-sm text-slate-500">Loading…</p>;

  const { status, plan } = sub;
  const running = status === "ACTIVE" || status === "PAUSED";
  const action = (name: string, text: string, variant: "primary" | "secondary" | "danger" = "secondary", confirmText?: string) => (
    <Button key={name} variant={variant} disabled={act.isPending} onClick={() => { if (!confirmText || window.confirm(confirmText)) act.mutate(name); }}>{text}</Button>
  );
  const recurring = sub.lines.reduce((sum: number, l: any) => sum + l.quantity * l.unitPriceMinor, plan.priceMinor);

  return (
    <Page
      title={sub.number}
      actions={
        <>
          {!isCustomer && status === "DRAFT" && <Button variant="secondary" onClick={() => setDialog("edit")}>Edit draft</Button>}
          {!isCustomer && status === "DRAFT" && action("send", "Send quotation", "primary")}
          {status === "QUOTATION" && action("confirm", "Confirm quotation", "primary")}
          {!isCustomer && status === "CONFIRMED" && action("activate", "Activate", "primary")}
          {status === "ACTIVE" && plan.pausable && action("pause", "Pause", "secondary", `Pause ${sub.number}? Periods that start while it's paused aren't billed.`)}
          {status === "PAUSED" && action("resume", "Resume", "primary")}
          {running && plan.renewable && sub.expiryDate && <Button variant="secondary" onClick={() => setDialog("renew")}>Renew</Button>}
          {status !== "CLOSED" && (!running || plan.closable) && !(isCustomer && !running) &&
            action("close", "Close", "danger", `Close ${sub.number}? This can't be undone.`)}
        </>
      }
    >
      {dialog === "edit" && <FormDialog title={`Edit ${sub.number}`} onClose={() => setDialog(null)}><EditDraft sub={sub} onDone={() => setDialog(null)} /></FormDialog>}
      {dialog === "renew" && <FormDialog title={`Renew ${sub.number}`} onClose={() => setDialog(null)}><RenewDialog sub={sub} onDone={() => setDialog(null)} /></FormDialog>}
      <ErrorText error={act.error} />
      <Stepper status={status} />
      {sub.requestNote && <p className="rounded-lg bg-[#e4dfff] px-4 py-3 text-sm text-[#2e1f8f]">Customer's note: {sub.requestNote}</p>}
      <Card>
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {[
            ["Customer", customerName(sub.customer)],
            ["Plan", planName(plan)],
            ["Start", date(sub.startDate)],
            ["Expiry", date(sub.expiryDate)],
            ["Payment terms", `${sub.paymentTermsDays} days`],
            ["Next bill", status === "ACTIVE" ? date(sub.nextBillingDate) : "—"],
            ...(sub.quotationValidUntil ? [["Quotation valid until", date(sub.quotationValidUntil)]] : []),
            ["Recurring, before tax", money(recurring)],
          ].map(([k, v]) => (
            <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-900">{v}</dd></div>
          ))}
        </dl>
        {sub.closedReason && <p className="mt-3 text-sm text-slate-600">Closed {date(sub.closedAt)}: {sub.closedReason}</p>}
      </Card>
      <Card title="Lines">
        <Table rows={sub.lines as any[]} empty="Only the plan fee is billed." columns={[
          { header: "Product", cell: (l) => l.description },
          { header: "Quantity", align: "right", cell: (l) => l.quantity },
          { header: "Unit price", align: "right", cell: (l) => money(l.unitPriceMinor) },
          { header: "Taxes", align: "right", cell: (l) => percent(l.taxRateBp) },
          { header: "Amount", align: "right", cell: (l) => money(l.quantity * l.unitPriceMinor) },
        ]} />
        {plan.priceMinor > 0 && <p className="mt-2 text-sm text-slate-600">Plus the {plan.name} plan fee of {money(plan.priceMinor)} each period.</p>}
      </Card>
      {(!isCustomer || sub.discounts.length > 0) && (
        <Card title="Discounts">
          <Table rows={sub.discounts.map((d: any) => ({ ...d.discount }))} empty="No discounts applied." columns={[
            { header: "Name", cell: (d: any) => d.name },
            { header: "Value", cell: (d: any) => (d.type === "PERCENT" ? percent(d.value) : money(d.value)) },
            { header: "Applies to", cell: (d: any) => d.products.map((p: any) => p.name).join(", ") || "Whole subscription" },
            { header: "Ends", cell: (d: any) => date(d.endDate) },
            ...(isCustomer ? [] : [{ header: "", align: "right" as const, cell: (d: any) => <Button variant="secondary" onClick={() => detach.mutate(d.id)}>Remove</Button> }]),
          ]} />
          {!isCustomer && status !== "CLOSED" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="w-64">
                <Select aria-label="Discount" value={discountId} onChange={(e) => setDiscountId(e.target.value)}>
                  <option value="">Choose a discount…</option>
                  {(discounts.data?.data as any[])?.filter((d) => !sub.discounts.some((x: any) => x.discountId === d.id) && d.endDate.slice(0, 10) >= today() && (!d.usageLimit || d.usedCount < d.usageLimit)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </div>
              <Button disabled={!discountId || attach.isPending} onClick={() => attach.mutate()}>Apply</Button>
              <p className="text-xs text-slate-500">Appears on the next invoice automatically.</p>
            </div>
          )}
          <ErrorText error={attach.error ?? detach.error} />
        </Card>
      )}
      <Card title="Invoices">
        <Table rows={sub.invoices as any[]} empty="Not billed yet." columns={[
          { header: "Invoice", cell: (i) => <Link className="font-semibold text-[#5b3fe8] hover:underline" to={`/invoices/${i.id}`}>{i.number}</Link> },
          { header: "Period", cell: (i) => `${date(i.periodStart)} to ${date(i.periodEnd)}` },
          { header: "Status", cell: (i) => <Status value={i.status === "CONFIRMED" && i.dueDate.slice(0, 10) < today() ? "OVERDUE" : i.status} /> },
          { header: "Total", align: "right", cell: (i) => money(i.totalMinor) },
        ]} />
      </Card>
    </Page>
  );
}

