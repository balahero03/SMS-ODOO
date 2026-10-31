import type { ReactNode } from "react";
import { Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { Button } from "../components/ui";
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
import { CustomerShell } from "../features/customer-portal/components";
import { CustomerPlans, RequestSubscription } from "../features/customer-portal/pages/BrowsePlans";
import { CustomerInvoiceDetail, CustomerInvoices } from "../features/customer-portal/pages/Invoices";
import { Overview } from "../features/customer-portal/pages/Overview";
import { CustomerPayments } from "../features/customer-portal/pages/Payments";
import { CustomerSubscriptionDetail, CustomerSubscriptions } from "../features/customer-portal/pages/Subscriptions";

const nav: { to: string; label: string; roles: Role[] }[] = [
  { to: "/dashboard", label: "Dashboard", roles: ["ADMIN", "STAFF"] },
  { to: "/subscriptions", label: "Subscriptions", roles: ["ADMIN", "STAFF", "CUSTOMER"] },
  { to: "/requests", label: "Customer requests", roles: ["ADMIN", "STAFF"] },
  { to: "/invoices", label: "Invoices", roles: ["ADMIN", "STAFF", "CUSTOMER"] },
  { to: "/payments", label: "Payments", roles: ["ADMIN", "STAFF"] },
  { to: "/customers", label: "Customers", roles: ["ADMIN", "STAFF"] },
  { to: "/products", label: "Products", roles: ["ADMIN", "STAFF"] },
  { to: "/plans", label: "Plans", roles: ["ADMIN", "STAFF"] },
  { to: "/templates", label: "Quotation templates", roles: ["ADMIN", "STAFF"] },
  { to: "/discounts", label: "Discounts", roles: ["ADMIN", "STAFF"] },
  { to: "/taxes", label: "Taxes", roles: ["ADMIN", "STAFF"] },
  { to: "/staff", label: "Staff", roles: ["ADMIN"] },
];

function Shell() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="no-print border-b border-slate-200 bg-white p-3 md:min-h-screen md:w-56 md:border-b-0 md:border-r">
        <p className="px-2 pb-3 font-semibold text-indigo-800">Brightloop</p>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {nav.filter((n) => n.roles.includes(user!.role)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `whitespace-nowrap rounded-md px-2 py-1.5 text-sm ${isActive ? "bg-indigo-50 font-medium text-indigo-800" : "text-slate-700 hover:bg-slate-100"}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-slate-200 px-2 pt-3 text-xs text-slate-500">
          <p className="truncate">{user!.email}</p>
          <p className="mb-2">{user!.role.toLowerCase()}</p>
          <Button variant="secondary" onClick={signOut}>Sign out</Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
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
        <Route path="/products" element={<Protected roles={TEAM}><Products /></Protected>} />
        <Route path="/requests" element={<Protected roles={TEAM}><CustomerRequests /></Protected>} />
        <Route path="/plans" element={<ByRole team={<Plans />} customer={<CustomerPlans />} />} />
        <Route path="/plans/:id/request" element={<Protected roles={["CUSTOMER"]}><RequestSubscription /></Protected>} />
        <Route path="/templates" element={<Protected roles={TEAM}><Templates /></Protected>} />
        <Route path="/discounts" element={<Protected roles={TEAM}><Discounts /></Protected>} />
        <Route path="/taxes" element={<Protected roles={TEAM}><Taxes /></Protected>} />
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
