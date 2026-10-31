import { useMutation } from "@tanstack/react-query";
import { useState, type ButtonHTMLAttributes, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorText, Field } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { readable } from "../../../lib/form";

const PURPLE = "#5b3fe8";
const TINT = "#e4dfff";
const TINT_MID = "#c9c0fb";
const TINT_DEEP = "#a99bff";

const link = "font-semibold text-[#5b3fe8] hover:underline";
const marker = "font-['Permanent_Marker']";
const inked = "rounded-md shadow-sm";

function Icon({ children, className = "h-5 w-5", width = 1.75 }: { children: ReactNode; className?: string; width?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const icons = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="m3 3 18 18" /><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 4.4-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
  repeat: <><path d="M4 11a8 8 0 0 1 14-4l2 2" /><path d="M20 4v5h-5" /><path d="M20 13a8 8 0 0 1-14 4l-2-2" /><path d="M4 20v-5h5" /></>,
  file: <><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  chart: <path d="M5 20v-6M12 20V5M19 20v-9" />,
  home: <path d="m3 11 9-8 9 8v10h-6v-6H9v6H3V11Z" />,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></>,
  users: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 8M19 15a6 6 0 0 1 3 6" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2ZM10 21h4" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

const FEATURES = [
  { icon: icons.box, color: PURPLE, light: true, title: "Products & Plans", text: "Create and manage your offerings" },
  { icon: icons.repeat, color: TINT, title: "Recurring Billing", text: "Automate renewals and payments" },
  { icon: icons.file, color: TINT_MID, title: "Invoices & Payments", text: "Generate, send and track invoices" },
  { icon: icons.chart, color: TINT, title: "Analytics & Reports", text: "Get real-time revenue insights" },
];

function Logo({ large = false }: { large?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg className={`${large ? "h-10 w-10" : "h-9 w-9"} text-[#5b3fe8]`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden="true">
        <path d="M5 3v14" />
        <circle cx="12.5" cy="15" r="6.5" />
      </svg>
      <span className={`${large ? "text-2xl" : "text-xl"} font-bold tracking-tight text-slate-950`}>Brightloop</span>
    </div>
  );
}

/** Illustration of the product, not live data. */
function DashboardMock() {
  const nav = [
    [icons.home, "Dashboard"], [icons.repeat, "Subscriptions"], [icons.box, "Products"], [icons.file, "Payments"],
    [icons.card, "Customers"], [icons.users, "Reports"], [icons.gear, "Settings"],
  ] as const;
  const stats = [
    { title: "Active Subscriptions", value: "842", change: "↑ 12%", up: true, icon: icons.users, tone: "text-[#5b3fe8]" },
    { title: "Monthly Revenue", value: "₹12,34,560", change: "↑ 8%", up: true, icon: icons.chart, tone: "text-[#5b3fe8]" },
    { title: "Outstanding Amount", value: "₹2,48,900", change: "↓ 5%", up: false, icon: icons.file, tone: "text-[#5b3fe8]" },
    { title: "Overdue Invoices", value: "18", change: "↑ 3", up: false, icon: icons.clock, tone: "text-[#5b3fe8]" },
  ];
  const statuses = [["Active", "68%", "#5b3fe8"], ["Trial", "12%", TINT_DEEP], ["Paused", "8%", TINT_MID], ["Cancelled", "8%", TINT], ["Closed", "4%", "#94a3b8"]];
  return (
    <div aria-hidden="true" className="-mb-14 w-[43rem] max-w-full origin-bottom-left -rotate-2 select-none rounded-t-[2rem] border-[9px] border-b-0 border-[#2e1f8f] bg-white text-slate-900">
      <div className="flex h-[21rem] overflow-hidden rounded-t-3xl">
        <div className="w-28 shrink-0 bg-slate-50 p-3">
          <svg className="mb-3 h-6 w-6 text-[#5b3fe8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"><path d="M5 3v14" /><circle cx="12.5" cy="15" r="6.5" /></svg>
          {nav.map(([icon, name], i) => (
            <div key={name} className={`mb-1 flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[9px] font-medium ${i === 0 ? "bg-[#5b3fe8] text-white" : "text-slate-700"}`}>
              <Icon className="h-3 w-3">{icon}</Icon>{name}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-center justify-end gap-3">
            <div className="flex w-40 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[8px] text-slate-500"><Icon className="h-3 w-3">{icons.search}</Icon>Search anything…</div>
            <Icon className="h-4 w-4">{icons.bell}</Icon>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5b3fe8] text-[7px] font-semibold text-white">AD</span>
          </div>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold">Good morning, Admin 👋</p>
              <p className="text-[8px] text-slate-500">Here's what's happening with your subscriptions today.</p>
            </div>
            <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[8px]">Last 30 days ⌄</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {stats.map((s) => (
              <div key={s.title} className="rounded-lg border border-slate-100 p-2 shadow-sm">
                <div className="flex justify-between text-[7px] text-slate-600">{s.title}<Icon className={`h-3 w-3 ${s.tone}`}>{s.icon}</Icon></div>
                <p className="mt-0.5 text-[11px] font-bold">{s.value}</p>
                <p className={`text-[7px] font-semibold text-slate-500`}>{s.change}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-[1.5fr_1fr] gap-2">
            <div className="rounded-lg border border-slate-100 p-2 shadow-sm">
              <p className="text-[9px] font-bold">Revenue Overview</p>
              <svg viewBox="0 0 300 110" className="mt-1 w-full">
                <defs><linearGradient id="mock-area" x1="0" x2="0" y1="0" y2="1"><stop stopColor={PURPLE} stopOpacity=".35" /><stop offset="1" stopColor={PURPLE} stopOpacity=".03" /></linearGradient></defs>
                <path d="M0 95 30 78 55 84 85 62 110 68 140 50 165 58 195 36 215 42 245 22 270 28 300 8V110H0Z" fill="url(#mock-area)" />
                <path d="M0 95 30 78 55 84 85 62 110 68 140 50 165 58 195 36 215 42 245 22 270 28 300 8" fill="none" stroke={PURPLE} strokeWidth="2" />
                <circle cx="215" cy="42" r="3.5" fill={PURPLE} />
                <rect x="180" y="6" width="70" height="24" rx="4" fill="#020617" />
                <text x="215" y="16" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="700">₹14,20,000</text>
                <text x="215" y="26" textAnchor="middle" fontSize="7" fill="#cbd5e1">Aug 2026</text>
              </svg>
            </div>
            <div className="rounded-lg border border-slate-100 p-2 shadow-sm">
              <p className="text-[9px] font-bold">Subscription Status</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${PURPLE} 0 68%, ${TINT_DEEP} 0 80%, ${TINT_MID} 0 88%, ${TINT} 0 96%, #94a3b8 0)` }}>
                  <span className="flex h-10 w-10 flex-col items-center justify-center rounded-full bg-white text-[9px] font-bold leading-none">842<small className="mt-0.5 text-[6px] font-normal">Total</small></span>
                </div>
                <ul className="min-w-0 flex-1 space-y-0.5 text-[7px]">
                  {statuses.map(([name, value, color]) => (
                    <li key={name} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{name}<span className="ml-auto">{value}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tag({ color, rotate, children }: { color: string; rotate: string; children: string }) {
  return <span className={`${marker} ${inked} ${rotate} px-4 py-1.5 text-sm text-[#2e1f8f]`} style={{ background: color }}>{children}</span>;
}

function Frame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#5b3fe8] font-['Plus_Jakarta_Sans',sans-serif]">
      {/* React moves this stylesheet into the document head. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" precedence="default" />
      {/* Vertical points are in px because the hero copy above them has a fixed height. */}
      <div className="absolute inset-0 hidden bg-[#fbf8f1] [clip-path:polygon(0_0,63%_0,52%_230px,60%_465px,14%_505px,0_450px)] xl:block" aria-hidden="true" />
      <div className="relative mx-auto grid min-h-screen max-w-[90rem] gap-8 px-4 xl:grid-cols-[minmax(0,1fr)_27rem] xl:px-12">
        <section className="relative hidden min-h-screen min-w-0 flex-col pt-7 xl:flex" aria-label="About Brightloop">
          <div className="flex items-center gap-6">
            <Logo />
            <span className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-700">Subscription management system<span className="h-px w-14 bg-slate-500" /></span>
          </div>
          <div aria-hidden="true" className={`${marker} ${inked} absolute right-2 top-16 z-10 w-36 rotate-[-8deg] p-3 text-lg uppercase leading-tight text-[#2e1f8f]`} style={{ background: TINT }}>Recurring revenue real growth</div>
          <svg aria-hidden="true" className="absolute right-0 top-48 h-20 w-20 text-white" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4c-6 26 6 50 30 54 12 2 16-10 7-13-10-3-14 12 18 25M67 70l-13-2M67 70l-3-13" />
          </svg>
          <svg aria-hidden="true" className="absolute right-44 top-8 h-12 w-14 text-[#5b3fe8]" viewBox="0 0 56 48" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
            <path d="M6 16 17 26 28 6 39 26 50 16 46 42H10Z" fill="none" /><path d="M20 38 28 22 36 38Z" fill={TINT_DEEP} stroke="none" />
          </svg>
          <h1 className="mt-5 text-[3.4rem] font-extrabold leading-[1.08] tracking-tight text-slate-950">
            Subscriptions <br />
            <span className="relative inline-block rounded-sm bg-[#e4dfff] px-1.5 leading-[1.02]">made simple</span> <br />
            for modern businesses.
          </h1>
          <p className="mt-3 max-w-lg text-lg font-medium leading-snug text-slate-600">Manage plans, subscriptions, invoices, payments and revenue — all in one powerful platform.</p>
          <ul className="mt-5 grid max-w-2xl grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className={`${inked} flex h-10 w-10 items-center justify-center rounded-lg ${f.light ? "text-white" : "text-[#5b3fe8]"}`} style={{ background: f.color }}><Icon width={2.25}>{f.icon}</Icon></span>
                <p className="mt-2 text-[13px] font-bold text-slate-950">{f.title}</p>
                <p className="text-xs leading-snug text-slate-600">{f.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-6"><DashboardMock /></div>
        </section>
        <section className="flex min-h-screen flex-col items-center justify-center py-6 xl:items-stretch">
          <p aria-hidden="true" className={`${marker} mb-3 hidden rotate-[-4deg] self-end text-right text-sm uppercase leading-tight text-white xl:block`}>One platform <br />all subscriptions</p>
          <div className="w-full max-w-md rounded-2xl bg-[#fdfcf8] p-6 shadow-[12px_12px_0_#a99bff] sm:p-8 xl:max-w-none">
            <div className="flex justify-center"><Logo large /></div>
            <h2 className="mt-4 text-center text-[1.65rem] font-extrabold tracking-tight text-slate-950">{title}</h2>
            {subtitle && <p className="mt-1 text-center text-sm text-slate-600">{subtitle}</p>}
            <div className="mt-5">{children}</div>
          </div>
          <div aria-hidden="true" className="mt-8 hidden justify-center gap-3 xl:flex">
            <Tag color={TINT} rotate="-rotate-3">PLANS</Tag>
            <Tag color={TINT_MID} rotate="rotate-2">INVOICES</Tag>
            <Tag color={TINT} rotate="-rotate-2">PAYMENTS</Tag>
          </div>
        </section>
      </div>
    </div>
  );
}

const control = "w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-[#5b3fe8] focus:outline-2 focus:outline-[#5b3fe8]/30";

function EmailInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon>{icons.mail}</Icon></span>
      <input className={control} name="email" type="email" required autoComplete="email" {...props} />
    </div>
  );
}

function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon>{icons.lock}</Icon></span>
      <input className={`${control} pr-10!`} type={visible ? "text" : "password"} required {...props} />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        <Icon>{visible ? icons.eyeOff : icons.eye}</Icon>
      </button>
    </div>
  );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${control} pl-3!`} {...props} />;
}

// Mirrors passwordSchema in the API, which stays the final check.
const PASSWORD_RULES = [
  { label: "More than 8 characters", test: (p: string) => p.length > 8 && p.length <= 72 },
  { label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "A special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {PASSWORD_RULES.map((r) => {
        const met = r.test(password);
        return (
          <li key={r.label} className={`flex items-center gap-1.5 ${met ? "font-medium text-[#5b3fe8]" : "text-slate-500"}`}>
            <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${met ? "bg-[#5b3fe8] text-white" : "border border-slate-300"}`}>
              {met && <Icon className="h-2.5 w-2.5" width={3.5}><path d="m5 12 5 5 9-10" /></Icon>}
            </span>
            {r.label}
            <span className="sr-only">{met ? "(met)" : "(not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Submit({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="submit" className="w-full rounded-lg bg-[#5b3fe8] py-2.5 text-sm font-semibold text-white transition hover:bg-[#4c31d6] disabled:opacity-60" {...props}>
      {children}
    </button>
  );
}

function values(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
}

export function Login() {
  const { signIn } = useAuth();
  const m = useMutation({ mutationFn: (body: object) => api("/auth/login", { body }), onSuccess: (result) => signIn(result) });
  return (
    <Frame title="Welcome back" subtitle="Sign in to your account to continue">
      <form className="space-y-3.5" onSubmit={(e) => m.mutate(values(e))}>
        <Field label="Email address"><EmailInput placeholder="you@brightloop.com" /></Field>
        <Field label="Password"><PasswordInput name="password" placeholder="Enter your password" autoComplete="current-password" /></Field>
        <p className="text-right text-sm"><Link className={link} to="/forgot-password">Forgot password?</Link></p>
        <ErrorText error={readable(m.error)} />
        <Submit disabled={m.isPending}>{m.isPending ? "Signing in…" : "Sign in →"}</Submit>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">Don't have an account? <Link className={link} to="/signup">Create account</Link></p>
    </Frame>
  );
}

export function Signup() {
  const { signIn } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [problem, setProblem] = useState("");
  const m = useMutation({ mutationFn: (body: object) => api("/auth/signup", { body }), onSuccess: (result) => signIn(result) });
  const mismatch = confirm !== "" && confirm !== password;
  return (
    <Frame title="Create your account" subtitle="Manage your subscriptions and invoices in one place">
      <form
        className="space-y-3.5"
        onSubmit={(e) => {
          const { name, companyName, email } = values(e);
          if (!PASSWORD_RULES.every((r) => r.test(password))) return setProblem("Your password doesn't meet all the requirements yet");
          setProblem("");
          // The mismatch message already shows under the field.
          if (password !== confirm) return;
          // A blank company is left out, so invoices fall back to the customer's name.
          m.mutate({ name, email, password, companyName: companyName.trim() || undefined });
        }}
      >
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Your name"><TextInput name="name" required autoComplete="name" placeholder="Priya Shah" /></Field>
          <Field label="Company (optional)"><TextInput name="companyName" autoComplete="organization" placeholder="Shah Retail" /></Field>
        </div>
        <Field label="Email address"><EmailInput placeholder="you@company.com" /></Field>
        <div>
          <Field label="Password"><PasswordInput name="password" autoComplete="new-password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <PasswordChecklist password={password} />
        </div>
        <div>
          <Field label="Confirm password"><PasswordInput name="confirm" autoComplete="new-password" placeholder="Enter it again" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          {mismatch && <p className="mt-1 text-xs text-red-700">Those passwords don't match</p>}
        </div>
        <ErrorText error={problem || readable(m.error)} />
        <Submit disabled={m.isPending}>{m.isPending ? "Creating account…" : "Create account →"}</Submit>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">Already have an account? <Link className={link} to="/login">Sign in</Link></p>
    </Frame>
  );
}

export function ForgotPassword() {
  const m = useMutation({ mutationFn: (body: object) => api("/auth/forgot-password", { body }) });
  return (
    <Frame title="Reset your password" subtitle="We'll email you a link to choose a new one">
      {m.isSuccess ? (
        <p className="text-sm text-slate-700">{m.data.message}.</p>
      ) : (
        <form className="space-y-3.5" onSubmit={(e) => m.mutate(values(e))}>
          <Field label="Registered email"><EmailInput /></Field>
          <ErrorText error={readable(m.error)} />
          <Submit disabled={m.isPending}>{m.isPending ? "Sending…" : "Send reset link"}</Submit>
        </form>
      )}
      <p className="mt-5 text-center text-sm"><Link className={link} to="/login">Back to sign in</Link></p>
    </Frame>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const { clearSession } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [problem, setProblem] = useState("");
  // A reset ends every session, including one open in this browser.
  const m = useMutation({ mutationFn: (body: object) => api("/auth/reset-password", { body }), onSuccess: clearSession });
  const token = params.get("token");
  const newLink = <Link className={link} to="/forgot-password">Request a new link</Link>;
  const mismatch = confirm !== "" && confirm !== password;
  return (
    <Frame title="Choose a new password">
      {!token ? (
        <p className="text-sm text-slate-700">This reset link is incomplete. {newLink}</p>
      ) : m.isSuccess ? (
        <p className="text-sm text-slate-700">Password updated. <Link className={link} to="/login">Sign in</Link></p>
      ) : (
        <form
          className="space-y-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!PASSWORD_RULES.every((r) => r.test(password))) return setProblem("Your password doesn't meet all the requirements yet");
            setProblem("");
            if (password !== confirm) return;
            m.mutate({ token, password });
          }}
        >
          <div>
            <Field label="New password"><PasswordInput name="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <PasswordChecklist password={password} />
          </div>
          <div>
            <Field label="Confirm password"><PasswordInput name="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
            {mismatch && <p className="mt-1 text-xs text-red-700">Those passwords don't match</p>}
          </div>
          <ErrorText error={problem || readable(m.error)} />
          {m.isError && !problem && <p className="text-sm">{newLink}</p>}
          <Submit disabled={m.isPending}>{m.isPending ? "Updating…" : "Update password"}</Submit>
        </form>
      )}
    </Frame>
  );
}
