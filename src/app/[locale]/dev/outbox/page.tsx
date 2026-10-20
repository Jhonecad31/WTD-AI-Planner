import Link from "next/link";
import { getLeadStore } from "@/server/store";

export const instant = false;

/** Internal: emails the planner produced. With EMAIL_PROVIDER=db nothing is sent; preview here. */
export default async function OutboxPage() {
  const store = getLeadStore();
  const [emails, leads] = await Promise.all([store.listEmails(100), store.listLeads(100)]);
  const leadById = new Map(leads.map((l) => [l.id, l]));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Outbox</h1>
      <p className="mt-1 text-sm text-muted">
        {emails.length} emails · {leads.length} leads · provider shown per row
      </p>
      <table className="mt-6 w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="py-2">When</th>
            <th>Kind</th>
            <th>To</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Lead</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((e) => (
            <tr key={e.id} className="border-t border-line align-top">
              <td className="py-2 pr-3 whitespace-nowrap text-muted">
                {new Date(e.createdAt).toLocaleString()}
              </td>
              <td className="pr-3">
                <span
                  className={`rounded-pill px-2 py-0.5 text-xs font-bold ${e.kind === "agent" ? "bg-gray-100 text-heading" : "bg-primary-soft text-primary"}`}
                >
                  {e.kind}
                </span>
              </td>
              <td className="pr-3">{e.to}</td>
              <td className="pr-3">
                <Link
                  className="font-semibold text-primary hover:underline"
                  href={`/dev/outbox/${e.id}`}
                >
                  {e.subject}
                </Link>
              </td>
              <td className="pr-3">
                {e.status} <span className="text-xs text-muted">({e.provider})</span>
                {e.error ? <div className="text-xs text-red-700">{e.error}</div> : null}
              </td>
              <td>
                <Link className="text-primary hover:underline" href={`/dev/leads/${e.leadId}`}>
                  {leadById.get(e.leadId)?.ref ?? e.leadId.slice(0, 8)}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
