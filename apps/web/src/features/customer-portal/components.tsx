import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { api, qs } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { label, today } from "../../lib/format";

// Same look as the auth pages: one purple, lavender tints, cream ground, soft offset shadows.
export const textLink = "font-semibold text-[#5b3fe8] hover:underline";
export const control = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-[#5b3fe8] focus:outline-2 focus:outline-[#5b3fe8]/30";

export const prettyDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

export const isOverdue = (i: any) => i.status === "CONFIRMED" && i.dueDate.slice(0, 10) < today();

export const ICONS = {
  inbox: "M3 13l3-8h12l3 8v6H3v-6ZM3 13h5l1 3h6l1-3h5",
  users: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 8M19 15a6 6 0 0 1 3 6",
  layers: "m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5",
  template: "M5 3h14v18H5V3ZM9 8h6M9 12h6M9 16h3",
  tag: "M3 12V3h9l9 9-9 9-9-9ZM8 8h.01",
  percent: "M19 5 5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  team: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21a7 7 0 0 1 14 0",
  home: "m3 11 9-8 9 8v10h-6v-6H9v6H3V11Z",
  box: "m12 3 8 4.500v9L12 21l-8-4.500v-9L12 3ZM4 7.500l8 4.500 8-4.500M12 12v9",
  repeat: "M4 11a8 8 0 0 1 14-4l2 2M20 4v5h-5M20 13a8 8 0 0 1-14 4l-2-2M4 20v-5h5",
  file: "M6 3h8l4 4v14H6V3ZM14 3v4h4M9 12h6M9 16h6",
  card: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7ZM3 10h18",
};

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg className="h-8 w-8 text-[#5b3fe8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden="true">
        <path d="M5 3v14" />
        <circle cx="12.5" cy="15" r="6.5" />
      </svg>
      <span className="text-lg font-bold tracking-tight text-slate-950">Brightloop</span>
    </div>
  );
}

const NAV = [
  { to: "/overview", label: "Overview", icon: ICONS.home },
  { to: "/plans", label: "Browse plans", icon: ICONS.box },
  { to: "/subscriptions", label: "Subscriptions", icon: ICONS.repeat },
  { to: "/invoices", label: "Invoices", icon: ICONS.file },
  { to: "/payments", label: "Payments", icon: ICONS.card },
];

export const CustomerShell = () => <AppShell items={NAV} />;

/** The sidebar layout shared by the customer portal and the team's screens. */
export function AppShell({ items, wide }: { items: { to: string; label: string; icon: string }[]; wide?: boolean }) {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-[#fbf8f1] font-['Plus_Jakarta_Sans',sans-serif] text-slate-900 md:flex print:bg-white">
      {/* React moves this stylesheet into the document head. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" precedence="default" />
      <aside className="no-print border-b border-[#e4dfff] bg-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4 md:p-5">
          <Logo />
          <button type="button" className="text-sm font-semibold text-[#5b3fe8] md:hidden" onClick={signOut}>Sign out</button>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:pb-0">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-[#5b3fe8] text-white" : "text-slate-600 hover:bg-[#f1eeff] hover:text-[#2e1f8f]"}`}
            >
              <NavIcon d={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-[#e4dfff] p-4 md:block">
          <p className="truncate text-sm font-semibold text-slate-900">{user!.name}</p>
          <p className="truncate text-xs text-slate-500">{user!.email}</p>
          <button type="button" className={`mt-2 text-sm ${textLink}`} onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className={`mx-auto ${wide ? "max-w-7xl" : "max-w-5xl"}`}><Outlet /></div>
      </main>
    </div>
  );
}

export function PageTitle({ title, subtitle, back, actions }: { title: string; subtitle?: ReactNode; back?: { to: string; label: string }; actions?: ReactNode }) {
  return (
    <header className="no-print mb-6">
      {back && <Link className={`mb-3 inline-block text-sm ${textLink}`} to={back.to}>← {back.label}</Link>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Panel({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-[6px_6px_0_#e4dfff] print:p-0 print:shadow-none ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-bold text-slate-950">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ title, value, note, tone = "plain" }: { title: string; value: string; note?: string; tone?: "plain" | "alert" }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[6px_6px_0_#e4dfff]">
      <p className="text-sm text-slate-600">{title}</p>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums tracking-tight ${tone === "alert" ? "text-red-700" : "text-slate-950"}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

const BADGES: Record<string, string> = {
  ACTIVE: "bg-[#5b3fe8] text-white",
  REQUESTED: "bg-[#f1eeff] text-[#2e1f8f]",
  QUOTATION: "bg-[#c9c0fb] text-[#2e1f8f]",
  CONFIRMED: "bg-[#e4dfff] text-[#2e1f8f]",
  UNPAID: "bg-[#e4dfff] text-[#2e1f8f]",
  PAID: "bg-[#f1eeff] text-[#2e1f8f]",
  PAUSED: "bg-slate-100 text-slate-700",
  CLOSED: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-slate-100 text-slate-600",
  OVERDUE: "bg-red-50 text-red-700",
};

export function Badge({ value }: { value: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGES[value] ?? BADGES.CLOSED}`}>{label(value)}</span>;
}

/** The only drafts a customer can see are their own requests. */
export const subscriptionBadge = (s: any) => (s.status === "DRAFT" ? "REQUESTED" : s.status);

/** An invoice's status as a customer thinks of it: confirmed means it is waiting to be paid. */
export const invoiceBadge = (i: any) => (isOverdue(i) ? "OVERDUE" : i.status === "CONFIRMED" ? "UNPAID" : i.status);

const BUTTONS = {
  primary: "bg-[#5b3fe8] text-white hover:bg-[#4c31d6]",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-[#f1eeff]",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
};

export function Btn({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTONS }) {
  return <button type="button" className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${BUTTONS[variant]} ${className}`} {...props} />;
}

export function Tabs({ options, value, onChange, name }: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; name: string }) {
  return (
    <div role="group" aria-label={name} className="flex gap-1 overflow-x-auto">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${o.value === value ? "bg-[#5b3fe8] text-white" : "bg-[#f1eeff] text-[#2e1f8f] hover:bg-[#e4dfff]"}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const SearchBox = (props: InputHTMLAttributes<HTMLInputElement>) => <input type="search" className={`${control} sm:w-56`} {...props} />;

export interface Col<T> {
  header: string;
  cell: (row: T) => ReactNode;
  right?: boolean;
  /** Left out on small screens, so tables fit without sideways scrolling. */
  wide?: boolean;
}

export function DataTable<T>({ columns, rows, empty }: { columns: Col<T>[]; rows?: T[]; empty: string }) {
  if (!rows) return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
  if (!rows.length) return <p className="py-8 text-center text-sm text-slate-500">{empty}</p>;
  const hide = (c: Col<T>) => (c.wide ? "hidden md:table-cell print:table-cell" : "");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#e4dfff] text-xs text-slate-500">
            {columns.map((c) => <th key={c.header} className={`whitespace-nowrap px-2 py-2 font-semibold ${c.right ? "text-right" : ""} ${hide(c)}`}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              {columns.map((c) => <td key={c.header} className={`whitespace-nowrap px-2 py-3 ${c.right ? "text-right tabular-nums" : ""} ${hide(c)}`}>{c.cell(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pages({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <span>{total.toLocaleString("en-IN")} total</span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Btn disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Btn>
          <span>Page {page} of {pages}</span>
          <Btn disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Btn>
        </div>
      )}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error instanceof Error ? error.message : String(error)}</p>;
}

/** Confirmation dialog. The native element supplies the backdrop, focus trap and Escape key. */
export function ConfirmDialog({ title, children, confirmLabel, danger, busy, onConfirm, onCancel }: { title: string; children: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={onCancel} aria-labelledby="confirm-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-6 shadow-[8px_8px_0_#a99bff] backdrop:bg-[#2e1f8f]/40">
      <h2 id="confirm-title" className="text-lg font-bold text-slate-950">{title}</h2>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Btn onClick={onCancel}>Cancel</Btn>
        <Btn variant={danger ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>{confirmLabel}</Btn>
      </div>
    </dialog>
  );
}

const PORTAL_LIMIT = 100;

/** The customer's records for totals. The API caps a page at 100, so `partial` flags anything beyond that. */
export function usePortalData() {
  const subs = useQuery({ queryKey: ["portal", "subscriptions"], queryFn: () => api(`/subscriptions${qs({ limit: PORTAL_LIMIT })}`) });
  const invoices = useQuery({ queryKey: ["portal", "invoices"], queryFn: () => api(`/invoices${qs({ limit: PORTAL_LIMIT })}`) });
  const invoiceRows: any[] | undefined = invoices.data?.data;
  const owed = (i: any) => i.totalMinor - i.paidMinor;
  const unpaid = invoiceRows?.filter((i) => i.status === "CONFIRMED") ?? [];
  const overdue = unpaid.filter(isOverdue);
  return {
    subs: subs.data?.data as any[] | undefined,
    invoices: invoiceRows,
    error: subs.error ?? invoices.error,
    partial: (subs.data?.total ?? 0) > PORTAL_LIMIT || (invoices.data?.total ?? 0) > PORTAL_LIMIT,
    unpaidMinor: unpaid.reduce((sum, i) => sum + owed(i), 0),
    overdue,
    overdueMinor: overdue.reduce((sum, i) => sum + owed(i), 0),
    paidMinor: invoiceRows?.reduce((sum, i) => sum + i.paidMinor, 0) ?? 0,
  };
}
