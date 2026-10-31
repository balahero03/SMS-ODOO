import { Link } from "react-router-dom";
import { useAuth } from "../../../lib/auth";
import { label, money } from "../../../lib/format";
import { Badge, DataTable, ErrorNote, invoiceBadge, Panel, prettyDate, Stat, subscriptionBadge, textLink, usePortalData } from "../components";

const NEXT_STEPS = [
  { title: "Choose a plan", text: "Pick a plan and products, and send us a request." },
  { title: "Review your quotation", text: "The Brightloop team replies with a quotation for you to confirm." },
  { title: "We activate it", text: "Once you've confirmed, the team starts your subscription." },
  { title: "Track it here", text: "See your invoices and payments, and manage your subscription." },
];

export function Overview() {
  const { user } = useAuth();
  const { subs, invoices, error, partial, unpaidMinor, overdue, overdueMinor } = usePortalData();
  const active = subs?.filter((s) => s.status === "ACTIVE") ?? [];
  const quotations = subs?.filter((s) => s.status === "QUOTATION") ?? [];
  const nextBill = active.map((s) => s.nextBillingDate).filter(Boolean).sort()[0];
  const company = subs?.[0]?.customer?.companyName;
  const loading = !subs || !invoices;
  const isNew = !loading && subs.length === 0 && invoices.length === 0;

  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-2xl bg-[#5b3fe8] p-6 text-white shadow-[6px_6px_0_#c9c0fb] md:p-8">
        <div className="absolute inset-0 bg-[#6d54ee] [clip-path:polygon(70%_0,100%_0,100%_100%,55%_100%)]" aria-hidden="true" />
        <div className="relative">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Hello, {user!.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-[#e4dfff]">{isNew ? "Welcome to Brightloop." : `${company ? `${company} · ` : ""}Here's where your subscriptions stand today.`}</p>
        </div>
      </section>

      <ErrorNote error={error} />

      {(overdue.length > 0 || quotations.length > 0) && (
        <section aria-label="Needs your attention" className="mb-6 space-y-2">
          {overdue.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              <span><strong>{overdue.length} overdue {overdue.length === 1 ? "invoice" : "invoices"}</strong> · {money(overdueMinor)} to pay</span>
              <Link className="font-semibold hover:underline" to="/invoices?overdue=true">View</Link>
            </div>
          )}
          {quotations.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#e4dfff] px-4 py-3 text-sm text-[#2e1f8f]">
              <span><strong>{quotations.length} {quotations.length === 1 ? "quotation is" : "quotations are"}</strong> waiting for your answer</span>
              <Link className="font-semibold hover:underline" to={quotations.length === 1 ? `/subscriptions/${quotations[0].id}` : "/subscriptions?status=QUOTATION"}>Review</Link>
            </div>
          )}
        </section>
      )}

      {isNew ? (
        <Panel title="How to get started">
          <p className="mb-4 text-sm text-slate-600">You don't have a subscription yet. Nothing is charged until you've confirmed a quotation.</p>
          <ol className="grid gap-4 md:grid-cols-4">
            {NEXT_STEPS.map((step, i) => (
              <li key={step.title} className="rounded-xl bg-[#f1eeff] p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5b3fe8] text-sm font-bold text-white">{i + 1}</span>
                <p className="mt-3 text-sm font-bold text-slate-950">{step.title}</p>
                <p className="mt-1 text-sm text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
          <Link to="/plans" className="mt-5 inline-block rounded-lg bg-[#5b3fe8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4c31d6]">Browse plans</Link>
        </Panel>
      ) : (
        <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat title="Active subscriptions" value={loading ? "…" : String(active.length)} />
        <Stat title="Amount to pay" value={loading ? "…" : money(unpaidMinor)} tone={overdue.length ? "alert" : "plain"} note={overdue.length ? `${money(overdueMinor)} overdue` : "Nothing overdue"} />
        <Stat title="Next bill" value={loading ? "…" : prettyDate(nextBill)} note={nextBill ? "Earliest across your subscriptions" : "No bills scheduled"} />
      </div>
      {partial && <p className="mb-4 text-xs text-slate-500">Totals are based on your latest 100 records.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="My subscriptions" action={<Link className={`text-sm ${textLink}`} to="/subscriptions">View all</Link>}>
          <DataTable
            rows={subs?.slice(0, 5)}
            empty="No subscriptions yet."
            columns={[
              { header: "Number", cell: (s: any) => <Link className={textLink} to={`/subscriptions/${s.id}`}>{s.number}</Link> },
              { header: "Plan", wide: true, cell: (s: any) => `${s.plan.name}${s.plan.name.toUpperCase() === s.plan.interval ? "" : ` (${label(s.plan.interval)})`}` },
              { header: "Status", cell: (s: any) => <Badge value={subscriptionBadge(s)} /> },
            ]}
          />
        </Panel>
        <Panel title="Recent invoices" action={<Link className={`text-sm ${textLink}`} to="/invoices">View all</Link>}>
          <DataTable
            rows={invoices?.slice(0, 5)}
            empty="You have no invoices yet."
            columns={[
              { header: "Invoice", cell: (i: any) => <Link className={textLink} to={`/invoices/${i.id}`}>{i.number}</Link> },
              { header: "Status", cell: (i: any) => <Badge value={invoiceBadge(i)} /> },
              { header: "Total", right: true, cell: (i: any) => money(i.totalMinor) },
            ]}
          />
        </Panel>
      </div>
        </>
      )}
    </>
  );
}
