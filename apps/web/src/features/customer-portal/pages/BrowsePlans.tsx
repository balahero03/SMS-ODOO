import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAction } from "../../../components/ui";
import { api } from "../../../lib/api";
import { money, today } from "../../../lib/format";
import { Btn, control, ErrorNote, PageTitle, Panel, prettyDate, textLink } from "../components";
import { PERIOD } from "./Subscriptions";

const useCatalog = () => useQuery({ queryKey: ["catalog"], queryFn: () => api("/catalog") });

const Unavailable = () => <p role="alert" className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">Plans can't be loaded right now. Please try again later.</p>;

const planRules = (p: any) => [p.pausable && "Can be paused", p.renewable && "Can be renewed", p.closable && "Can be closed early", p.autoClose && p.availableUntil && `Ends ${prettyDate(p.availableUntil)}`].filter(Boolean) as string[];

export function CustomerPlans() {
  const { data, error, isPending } = useCatalog();
  const plans: any[] = data?.plans ?? [];
  return (
    <>
      <PageTitle title="Browse plans" subtitle="Choose a plan and send a request. The Brightloop team will reply with a quotation for you to confirm." />
      {error && <Unavailable />}
      {isPending && <p className="py-8 text-center text-sm text-slate-500">Loading…</p>}
      {data && !plans.length && <Panel><p className="py-4 text-center text-sm text-slate-500">No plans are available right now.</p></Panel>}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <section key={p.id} className="flex flex-col rounded-2xl bg-white p-6 shadow-[6px_6px_0_#e4dfff]">
            <h2 className="text-lg font-extrabold tracking-tight text-slate-950">{p.name}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {p.priceMinor > 0
                ? <><span className="text-2xl font-extrabold tracking-tight text-slate-950">{money(p.priceMinor)}</span> plan fee each {PERIOD[p.interval]}, plus your products</>
                : <>Billed each {PERIOD[p.interval]}. You pay for the products you choose.</>}
            </p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-600">
              {p.minQuantity > 1 && <li>Minimum quantity: {p.minQuantity}</li>}
              {planRules(p).map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
            <Link to={`/plans/${p.id}/request`} className="mt-5 rounded-lg bg-[#5b3fe8] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-[#4c31d6]">Request this plan</Link>
          </section>
        ))}
      </div>
    </>
  );
}

interface RequestLine {
  productId: string;
  variantId: string;
  quantity: number;
}

export function RequestSubscription() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, isPending } = useCatalog();
  const plan = data?.plans.find((p: any) => p.id === id);
  const products: any[] = data?.products ?? [];
  const minQuantity: number = plan?.minQuantity ?? 1;
  const blank = (): RequestLine => ({ productId: "", variantId: "", quantity: minQuantity });
  const [startDate, setStartDate] = useState(today());
  const [note, setNote] = useState("");
  const [edited, setEdited] = useState<RequestLine[] | null>(null);
  const lines = edited ?? [blank()];
  const send = useAction(
    (body: object) => api("/subscriptions/request", { body }),
    (sub) => navigate(`/subscriptions/${sub.id}`),
  );

  const back = { to: "/plans", label: "Browse plans" };
  if (isPending) return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
  if (error) return <><PageTitle title="Request a plan" back={back} /><Unavailable /></>;
  if (!plan) return <><PageTitle title="Request a plan" back={back} /><Panel><p className="py-4 text-center text-sm text-slate-500">This plan is no longer available. <Link className={textLink} to="/plans">See available plans</Link></p></Panel></>;

  const setLine = (i: number, patch: Partial<RequestLine>) => setEdited(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const unitPrice = (l: RequestLine) => {
    const product = products.find((p) => p.id === l.productId);
    if (!product) return 0;
    return product.salesPriceMinor + (product.variants.find((v: any) => v.id === l.variantId)?.extraPriceMinor ?? 0);
  };
  const chosen = lines.filter((l) => l.productId);
  const estimate = plan.priceMinor + chosen.reduce((sum, l) => sum + unitPrice(l) * l.quantity, 0);
  const canSend = (chosen.length > 0 || plan.priceMinor > 0) && chosen.every((l) => l.quantity >= minQuantity);

  return (
    <>
      <PageTitle title={`Request ${plan.name}`} subtitle="Nothing is charged yet. You'll get a quotation to review first." back={back} />
      <ErrorNote error={send.error} />
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate({
            planId: plan.id,
            startDate,
            note: note.trim() || null,
            lines: chosen.map((l) => ({ productId: l.productId, variantId: l.variantId || null, quantity: l.quantity })),
          });
        }}
      >
        <Panel title="Products">
          <div className="space-y-3">
            {lines.map((l, i) => {
              const product = products.find((p) => p.id === l.productId);
              return (
                <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_6rem_auto]">
                  <select aria-label={`Product ${i + 1}`} className={control} value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value, variantId: "" })}>
                    <option value="">Choose a product…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({money(p.salesPriceMinor)})</option>)}
                  </select>
                  <select aria-label={`Variant ${i + 1}`} className={control} value={l.variantId} disabled={!product?.variants.length} onChange={(e) => setLine(i, { variantId: e.target.value })}>
                    <option value="">{product?.variants.length ? "Standard" : "No variants"}</option>
                    {product?.variants.map((v: any) => <option key={v.id} value={v.id}>{v.attribute}: {v.value} (+{money(v.extraPriceMinor)})</option>)}
                  </select>
                  <input aria-label={`Quantity ${i + 1}`} className={control} type="number" min={minQuantity} required value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
                  <Btn disabled={lines.length === 1} onClick={() => setEdited(lines.filter((_, j) => j !== i))}>Remove</Btn>
                </div>
              );
            })}
          </div>
          <Btn className="mt-3" onClick={() => setEdited([...lines, blank()])}>Add another product</Btn>
          {minQuantity > 1 && <p className="mt-2 text-xs text-slate-500">This plan needs a quantity of at least {minQuantity} on each product.</p>}
        </Panel>
        <Panel title="Details">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Preferred start date
              <input type="date" className={`${control} mt-1`} min={today()} required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">Note for the team (optional)
              <textarea className={`${control} mt-1`} rows={2} maxLength={500} placeholder="Anything we should know?" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
        </Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-600">Estimate each {PERIOD[plan.interval]}, before tax and discounts: <strong className="tabular-nums text-slate-950">{money(estimate)}</strong></p>
          <Btn type="submit" variant="primary" disabled={!canSend || send.isPending}>{send.isPending ? "Sending…" : "Send request"}</Btn>
        </div>
      </form>
    </>
  );
}
