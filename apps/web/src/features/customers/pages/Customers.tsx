import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, ErrorText, Field, Input, Page, Pager, Table, Toggle, useAction } from "../../../components/ui";
import { api, qs } from "../../../lib/api";
import { formValues } from "../../../lib/form";

export function Customers() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useQuery({ queryKey: ["customers", q, page], queryFn: () => api(`/customers${qs({ q, page })}`) });
  const create = useAction((body: object) => api("/customers", { body }));
  return (
    <Page title="Customers">
      <Toggle label="Add customer">
        {(close) => (
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { const v = formValues(e); create.mutate(v, { onSuccess: close }); }}>
            <Field label="Contact name"><Input name="name" required /></Field>
            <Field label="Email" hint="They get a link to set a portal password."><Input name="email" type="email" required /></Field>
            <Field label="Company"><Input name="companyName" /></Field>
            <Field label="Phone"><Input name="phone" /></Field>
            <Field label="Address"><Input name="address" /></Field>
            <div className="md:col-span-2"><ErrorText error={create.error} /></div>
            <div><Button type="submit" disabled={create.isPending}>Save</Button></div>
          </form>
        )}
      </Toggle>
      <Card>
        <div className="mb-3 w-72"><Input aria-label="Search customers" placeholder="Search name, company or email" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} /></div>
        <ErrorText error={error} />
        <Table rows={data?.data as any[]} empty="No customers match." columns={[
          { header: "Name", cell: (c) => c.user.name },
          { header: "Company", cell: (c) => c.companyName ?? "—" },
          { header: "Email", cell: (c) => c.user.email },
          { header: "Phone", cell: (c) => c.phone ?? "—" },
        ]} />
        {data && <Pager page={page} limit={data.limit} total={data.total} onPage={setPage} />}
      </Card>
    </Page>
  );
}
