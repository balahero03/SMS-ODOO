const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export const money = (minor: number) => inr.format(minor / 100);
export const date = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
export const toMinor = (rupees: string | number) => Math.round(Number(rupees) * 100);
export const percent = (bp: number) => `${bp / 100}%`;
export const today = () => new Date().toISOString().slice(0, 10);
export const label = (s: string) => (s === "UPI" ? s : s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " "));
/** "Monthly" rather than "Monthly (Monthly)" when the plan is named after its interval. */
export const planName = (plan: { name: string; interval: string }) =>
  plan.name.toUpperCase() === plan.interval ? plan.name : `${plan.name} (${label(plan.interval)})`;
export const customerName = (c: any) => c?.companyName ?? c?.user?.name ?? "—";
