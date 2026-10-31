import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useState } from "react";

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-[#5b3fe8] text-white hover:bg-[#4c31d6]",
    secondary: "bg-white text-slate-800 border border-slate-300 hover:bg-[#f1eeff]",
    danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
  };
  return <button type="button" className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50 ${styles[variant]} ${className}`} {...props} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const control = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-[#5b3fe8] focus:outline-2 focus:outline-[#5b3fe8]/30";
export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input className={control} {...props} />;
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select className={control} {...props} />;

export function Check({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" {...props} /> {label}
    </label>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[6px_6px_0_#e4dfff] print:p-0 print:shadow-none">
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-slate-950">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Page({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">{title}</h1>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      {children}
    </div>
  );
}

const tones: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  QUOTATION: "bg-[#c9c0fb] text-[#2e1f8f]",
  CONFIRMED: "bg-[#e4dfff] text-[#2e1f8f]",
  ACTIVE: "bg-[#5b3fe8] text-white",
  PAID: "bg-[#f1eeff] text-[#2e1f8f]",
  PAUSED: "bg-slate-100 text-slate-700",
  OVERDUE: "bg-red-50 text-red-700",
  CLOSED: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-slate-100 text-slate-600",
};

export function Status({ value }: { value: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[value] ?? tones.DRAFT}`}>{value.charAt(0) + value.slice(1).toLowerCase()}</span>;
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
}

export function Table<T extends { id?: string }>({ columns, rows, empty = "Nothing here yet." }: { columns: Column<T>[]; rows?: T[]; empty?: string }) {
  if (!rows) return <p className="py-6 text-center text-sm text-slate-500">Loading…</p>;
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            {columns.map((c) => (
              <th key={c.header} className={`whitespace-nowrap px-2 py-2 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="border-b border-slate-100 last:border-0">
              {columns.map((c) => (
                <td key={c.header} className={`px-2 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
      <span>{total.toLocaleString("en-IN")} total</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span>Page {page} of {pages}</span>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export const ErrorText = ({ error }: { error: unknown }) =>
  error ? <p role="alert" className="text-sm text-red-700">{error instanceof Error ? error.message : String(error)}</p> : null;

/** A mutation that refreshes all cached data on success, since most writes touch several screens. */
export function useAction<V = void>(fn: (vars: V) => Promise<unknown>, onDone?: (result: any) => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      client.invalidateQueries();
      onDone?.(result);
    },
  });
}

export function Toggle({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <Button variant={open ? "secondary" : "primary"} onClick={() => setOpen(!open)}>{open ? "Cancel" : label}</Button>
      {open && <div className="rounded-lg border border-slate-200 bg-white p-4">{children(() => setOpen(false))}</div>}
    </div>
  );
}
