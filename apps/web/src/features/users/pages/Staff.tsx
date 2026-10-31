import { useQuery } from "@tanstack/react-query";
import { Button, Card, ErrorText, Field, Input, Page, Table, Toggle, useAction } from "../../../components/ui";
import { api } from "../../../lib/api";
import { label } from "../../../lib/format";
import { formValues } from "../../../lib/form";

export function Staff() {
  const { data, error } = useQuery({ queryKey: ["staff"], queryFn: () => api("/users/staff") });
  const create = useAction((body: object) => api("/users/staff", { body }));
  const toggle = useAction((u: any) => api(`/users/staff/${u.id}`, { method: "PATCH", body: { active: !u.active } }));
  return (
    <Page title="Staff">
      <Toggle label="Add staff member">
        {(close) => (
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { const v = formValues(e); create.mutate(v, { onSuccess: close }); }}>
            <Field label="Name"><Input name="name" required /></Field>
            <Field label="Email" hint="They get a link to set their password."><Input name="email" type="email" required /></Field>
            <div className="md:col-span-2"><ErrorText error={create.error} /></div>
            <div><Button type="submit" disabled={create.isPending}>Save</Button></div>
          </form>
        )}
      </Toggle>
      <Card>
        <ErrorText error={error ?? toggle.error} />
        <Table rows={data?.data as any[]} columns={[
          { header: "Name", cell: (u) => u.name },
          { header: "Email", cell: (u) => u.email },
          { header: "Role", cell: (u) => label(u.role) },
          { header: "Access", cell: (u) => (u.role === "STAFF" ? <Button variant="secondary" onClick={() => toggle.mutate(u)}>{u.active ? "Active, deactivate" : "Inactive, reactivate"}</Button> : "Active") },
        ]} />
      </Card>
    </Page>
  );
}
