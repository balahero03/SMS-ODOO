import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, ErrorText, Field, Input, Page, Table, Toggle, useAction } from "../../../components/ui";
import { api } from "../../../lib/api";
import { date, label } from "../../../lib/format";
import { formValues } from "../../../lib/form";

export function Staff() {
  const [q, setQ] = useState("");
  const { data, error } = useQuery({ queryKey: ["staff"], queryFn: () => api("/users/staff") });
  const create = useAction((body: object) => api("/users/staff", { body }));
  const toggle = useAction((u: any) => api(`/users/staff/${u.id}`, { method: "PATCH", body: { active: !u.active } }));
  const needle = q.trim().toLowerCase();
  const rows = (data?.data as any[] | undefined)?.filter((u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle));
  return (
    <Page title="Staff">
      <Toggle label="Add staff member">
        {(close) => (
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { const v = formValues(e); create.mutate(v, { onSuccess: close }); }}>
            <Field label="Name"><Input name="name" required /></Field>
            <Field label="Email" hint="They get a link to set their password. It lasts 72 hours, and after that they can use Forgot password."><Input name="email" type="email" required /></Field>
            <div className="md:col-span-2"><ErrorText error={create.error} /></div>
            <div><Button type="submit" disabled={create.isPending}>Save</Button></div>
          </form>
        )}
      </Toggle>
      <Card>
        <div className="mb-3 w-64"><Input aria-label="Search staff" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <ErrorText error={error ?? toggle.error} />
        <Table rows={rows} empty="No staff match." columns={[
          { header: "Name", cell: (u: any) => u.name },
          { header: "Email", cell: (u: any) => u.email },
          { header: "Role", cell: (u: any) => label(u.role) },
          { header: "Added", cell: (u: any) => date(u.createdAt) },
          { header: "Access", cell: (u: any) => (u.active ? "Active" : "Inactive") },
          { header: "", align: "right", cell: (u: any) => u.role === "STAFF" && (
            <Button variant={u.active ? "danger" : "secondary"} disabled={toggle.isPending} onClick={() => { if (!u.active || window.confirm(`Deactivate ${u.name}? They'll be signed out and can't sign in until reactivated.`)) toggle.mutate(u); }}>{u.active ? "Deactivate" : "Reactivate"}</Button>
          ) },
        ]} />
      </Card>
    </Page>
  );
}
