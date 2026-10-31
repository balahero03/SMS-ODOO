const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export const money = (minor: number) => inr.format(minor / 100);
export const date = (value?: string | null) => (value ? value.slice(0, 10) : "—");
export const toMinor = (rupees: string | number) => Math.round(Number(rupees) * 100);
export const percent = (bp: number) => `${bp / 100}%`;
export const today = () => new Date().toISOString().slice(0, 10);
export const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
export const customerName = (c: any) => c?.companyName ?? c?.user?.name ?? "—";
