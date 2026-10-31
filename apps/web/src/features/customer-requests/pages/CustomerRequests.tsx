import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, ErrorText, Page, Pager, Table } from "../../../components/ui";
import { api, qs } from "../../../lib/api";
import { customerName, date, planName } from "../../../lib/format";

export function CustomerRequests() {
  const [page, setPage] = useState(1);
  const { data, error } = useQuery({
    queryKey: ["subscriptions", "requested", page],
    queryFn: () => api(`/subscriptions${qs({ status: "DRAFT", requested: "true", page })}`),
  });
  return (
    <Page title="Customer requests">
      <Card>
        <p className="mb-3 text-sm text-slate-600">Plans customers have asked for. Open a request to review it and send a quotation.</p>
        <ErrorText error={error} />
        <Table rows={data?.data as any[]} empty="No requests are waiting." columns={[
          { header: "Number", cell: (s) => <Link className="font-semibold text-[#5b3fe8] hover:underline" to={`/subscriptions/${s.id}`}>{s.number}</Link> },
          { header: "Customer", cell: (s) => customerName(s.customer) },
          { header: "Plan", cell: (s) => planName(s.plan) },
          { header: "Requested", cell: (s) => date(s.requestedAt) },
          { header: "Start", cell: (s) => date(s.startDate) },
          { header: "Note", cell: (s) => s.requestNote ?? "—" },
        ]} />
        {data && <Pager page={page} limit={data.limit} total={data.total} onPage={setPage} />}
      </Card>
    </Page>
  );
}
