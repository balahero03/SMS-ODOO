import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, ErrorText, Field, Input } from "../../../components/ui";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";

const PASSWORD_HINT = "More than eight characters, with an uppercase letter, a lowercase letter and a special character.";

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6">
        <p className="font-semibold text-indigo-800">Brightloop</p>
        <h1 className="mb-4 text-lg font-semibold text-slate-900">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function values(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
}

export function Login() {
  const { signIn } = useAuth();
  const m = useMutation({ mutationFn: (body: object) => api("/auth/login", { body }), onSuccess: signIn });
  return (
    <Frame title="Sign in">
      <form className="space-y-3" onSubmit={(e) => m.mutate(values(e))}>
        <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
        <Field label="Password"><Input name="password" type="password" required autoComplete="current-password" /></Field>
        <ErrorText error={m.error} />
        <Button type="submit" className="w-full" disabled={m.isPending}>Sign in</Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link className="text-indigo-700 hover:underline" to="/signup">Create account</Link>
        <Link className="text-indigo-700 hover:underline" to="/forgot-password">Forgot password?</Link>
      </div>
    </Frame>
  );
}

export function Signup() {
  const { signIn } = useAuth();
  const m = useMutation({ mutationFn: (body: object) => api("/auth/signup", { body }), onSuccess: signIn });
  return (
    <Frame title="Create your account">
      <form className="space-y-3" onSubmit={(e) => m.mutate(values(e))}>
        <Field label="Your name"><Input name="name" required /></Field>
        <Field label="Company (optional)"><Input name="companyName" /></Field>
        <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
        <Field label="Password" hint={PASSWORD_HINT}><Input name="password" type="password" required autoComplete="new-password" /></Field>
        <ErrorText error={m.error} />
        <Button type="submit" className="w-full" disabled={m.isPending}>Create account</Button>
      </form>
      <p className="mt-4 text-sm"><Link className="text-indigo-700 hover:underline" to="/login">Back to sign in</Link></p>
    </Frame>
  );
}

export function ForgotPassword() {
  const m = useMutation({ mutationFn: (body: object) => api("/auth/forgot-password", { body }) });
  return (
    <Frame title="Reset your password">
      {m.isSuccess ? (
        <p className="text-sm text-slate-700">{m.data.message}.</p>
      ) : (
        <form className="space-y-3" onSubmit={(e) => m.mutate(values(e))}>
          <Field label="Registered email"><Input name="email" type="email" required /></Field>
          <ErrorText error={m.error} />
          <Button type="submit" className="w-full" disabled={m.isPending}>Send reset link</Button>
        </form>
      )}
      <p className="mt-4 text-sm"><Link className="text-indigo-700 hover:underline" to="/login">Back to sign in</Link></p>
    </Frame>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [mismatch, setMismatch] = useState(false);
  const m = useMutation({ mutationFn: (body: object) => api("/auth/reset-password", { body }) });
  return (
    <Frame title="Choose a new password">
      {m.isSuccess ? (
        <p className="text-sm text-slate-700">Password updated. <Link className="text-indigo-700 hover:underline" to="/login">Sign in</Link></p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            const { password, confirm } = values(e);
            setMismatch(password !== confirm);
            if (password === confirm) m.mutate({ token: params.get("token"), password });
          }}
        >
          <Field label="New password" hint={PASSWORD_HINT}><Input name="password" type="password" required autoComplete="new-password" /></Field>
          <Field label="Confirm password"><Input name="confirm" type="password" required autoComplete="new-password" /></Field>
          <ErrorText error={mismatch ? "Those passwords don't match" : m.error} />
          <Button type="submit" className="w-full" disabled={m.isPending}>Update password</Button>
        </form>
      )}
    </Frame>
  );
}
