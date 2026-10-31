import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth, type Role } from "../lib/auth";
import { ForgotPassword, Login, ResetPassword, Signup } from "../features/auth/pages/Auth";
import { Customers } from "../features/customers/pages/Customers";
import { Dashboard } from "../features/dashboard/pages/Dashboard";
import { Discounts } from "../features/discounts/pages/Discounts";
import { InvoiceDetail, Invoices } from "../features/invoices/pages/Invoices";
import { Payments } from "../features/payments/pages/Payments";
import { Plans } from "../features/plans/pages/Plans";
import { Products } from "../features/products/pages/Products";
import { Staff } from "../features/users/pages/Staff";
import { NewSubscription, SubscriptionDetail, Subscriptions } from "../features/subscriptions/pages/Subscriptions";
import { Taxes } from "../features/taxes/pages/Taxes";
import { Templates } from "../features/quotations/pages/Templates";
import { CustomerRequests } from "../features/customer-requests/pages/CustomerRequests";
import { AppShell, CustomerShell, ICONS } from "../features/customer-portal/components";
import { CustomerPlans, RequestSubscription } from "../features/customer-portal/pages/BrowsePlans";
import { CustomerInvoiceDetail, CustomerInvoices } from "../features/customer-portal/pages/Invoices";
import { Overview } from "../features/customer-portal/pages/Overview";
import { CustomerPayments } from "../features/customer-portal/pages/Payments";
import { CustomerSubscriptionDetail, CustomerSubscriptions } from "../features/customer-portal/pages/Subscriptions";

const nav: { to: string; label: string; icon: string; adminOnly?: boolean }[] = [
  { to: "/dashboard", label: "Dashboard", icon: ICONS.home },
  { to: "/subscriptions", label: "Subscriptions", icon: ICONS.repeat },
  { to: "/requests", label: "Customer requests", icon: ICONS.inbox },
  { to: "/invoices", label: "Invoices", icon: ICONS.file },
  { to: "/payments", label: "Payments", icon: ICONS.card },
  { to: "/customers", label: "Customers", icon: ICONS.users },
  { to: "/products", label: "Products", icon: ICONS.box, adminOnly: true },
  { to: "/plans", label: "Plans", icon: ICONS.layers, adminOnly: true },
  { to: "/templates", label: "Quotation templates", icon: ICONS.template, adminOnly: true },
  { to: "/discounts", label: "Discounts", icon: ICONS.tag, adminOnly: true },
  { to: "/taxes", label: "Taxes", icon: ICONS.percent, adminOnly: true },
  { to: "/staff", label: "Staff", icon: ICONS.team, adminOnly: true },
];

function Shell() {
  const { user } = useAuth();
  return <AppShell wide items={nav.filter((n) => !n.adminOnly || user!.role === "ADMIN")} />;
}

const home = (role: Role) => (role === "CUSTOMER" ? "/overview" : "/dashboard");

/** Customers get the portal's own screen at a URL the team also uses. */
function ByRole({ team, customer }: { team: ReactNode; customer: ReactNode }) {
  const { user } = useAuth();
  return <>{user!.role === "CUSTOMER" ? customer : team}</>;
}

function Protected({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={home(user.role)} replace />;
  return <>{children}</>;
}

function Public({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to={home(user.role)} replace /> : <>{children}</>;
}

const TEAM: Role[] = ["ADMIN", "STAFF"];

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Public><Login /></Public>} />
      <Route path="/signup" element={<Public><Signup /></Public>} />
      <Route path="/forgot-password" element={<Public><ForgotPassword /></Public>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Protected><ByRole team={<Shell />} customer={<CustomerShell />} /></Protected>}>
        <Route path="/overview" element={<Protected roles={["CUSTOMER"]}><Overview /></Protected>} />
        <Route path="/dashboard" element={<Protected roles={TEAM}><Dashboard /></Protected>} />
        <Route path="/subscriptions" element={<ByRole team={<Subscriptions />} customer={<CustomerSubscriptions />} />} />
        <Route path="/subscriptions/new" element={<Protected roles={TEAM}><NewSubscription /></Protected>} />
        <Route path="/subscriptions/:id" element={<ByRole team={<SubscriptionDetail />} customer={<CustomerSubscriptionDetail />} />} />
        <Route path="/invoices" element={<ByRole team={<Invoices />} customer={<CustomerInvoices />} />} />
        <Route path="/invoices/:id" element={<ByRole team={<InvoiceDetail />} customer={<CustomerInvoiceDetail />} />} />
        <Route path="/payments" element={<ByRole team={<Payments />} customer={<CustomerPayments />} />} />
        <Route path="/customers" element={<Protected roles={TEAM}><Customers /></Protected>} />
        <Route path="/products" element={<Protected roles={["ADMIN"]}><Products /></Protected>} />
        <Route path="/requests" element={<Protected roles={TEAM}><CustomerRequests /></Protected>} />
        <Route path="/plans" element={<ByRole team={<Protected roles={["ADMIN"]}><Plans /></Protected>} customer={<CustomerPlans />} />} />
        <Route path="/plans/:id/request" element={<Protected roles={["CUSTOMER"]}><RequestSubscription /></Protected>} />
        <Route path="/templates" element={<Protected roles={["ADMIN"]}><Templates /></Protected>} />
        <Route path="/discounts" element={<Protected roles={["ADMIN"]}><Discounts /></Protected>} />
        <Route path="/taxes" element={<Protected roles={["ADMIN"]}><Taxes /></Protected>} />
        <Route path="/staff" element={<Protected roles={["ADMIN"]}><Staff /></Protected>} />
      </Route>
      <Route path="*" element={<Protected><RootRedirect /></Protected>} />
    </Routes>
  );
}

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={home(user!.role)} replace />;
}
