import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadStore } from "@/server/store";
import { pdfUrlFor } from "@/server/email";

export const instant = false;

/** Internal lead view (the real admin panel with auth arrives in phase 5). */
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getLeadStore();
  const lead = await store.getLead(id);
  if (!lead) notFound();
  const emails = (await store.listEmails(200)).filter((e) => e.leadId === lead.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/dev/outbox" className="text-sm font-semibold text-primary hover:underline">
        ← Outbox
      </Link>
      <h1 className="mt-3 text-2xl font-bold">
        {lead.name} <span className="text-muted">· {lead.ref}</span>
      </h1>
      <p className="text-sm text-muted">
        {lead.email} · {lead.phone ?? "no phone"} · {lead.locale.toUpperCase()} · status{" "}
        {lead.status} · engine {lead.engine ?? "—"} · {new Date(lead.createdAt).toLocaleString()}
      </p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
        <a
          className="rounded-pill bg-primary px-4 py-2 text-white"
          href={pdfUrlFor(lead)}
          target="_blank"
          rel="noreferrer"
        >
          Open PDF
        </a>
        {lead.agentPdfPath ? (
          <a
            className="rounded-pill border border-line px-4 py-2"
            href={`${pdfUrlFor(lead)}&v=lead`}
            target="_blank"
            rel="noreferrer"
          >
            Sales PDF
          </a>
        ) : null}
        {emails.map((e) => (
          <Link
            key={e.id}
            className="rounded-pill border border-line px-4 py-2"
            href={`/dev/outbox/${e.id}`}
          >
            {e.kind} email ({e.status})
          </Link>
        ))}
      </div>
      <h2 className="mt-8 text-lg font-bold">Itinerary</h2>
      <ol className="mt-2 space-y-3 text-sm">
        {lead.itinerary.days.map((d) => (
          <li key={d.date} className="rounded-card border border-line bg-white p-3">
            <p className="font-bold">
              Day {d.dayNumber} · {d.date} · {d.title}
            </p>
            <ul className="mt-1 space-y-1">
              {d.items.map((i, k) => (
                <li key={k} className="flex flex-wrap gap-x-3">
                  <span className="w-12 text-muted">{i.startTime ?? "—"}</span>
                  <span className="font-semibold">{i.title}</span>
                  {i.bokunId ? (
                    <span className="font-mono text-xs text-muted">#{i.bokunId}</span>
                  ) : null}
                  <span className="ml-auto">${i.priceTotalUsd}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <h2 className="mt-8 text-lg font-bold">What the traveler asked for</h2>
      <p className="mt-2 text-sm">
        Interests: {lead.request.interests.join(", ")}
        {lead.request.avoidTypes?.length ? ` · skip: ${lead.request.avoidTypes.join(", ")}` : ""}
        {" · "}budget {lead.request.budgetPerPerson} USD pp · zone{" "}
        {lead.request.hotel.zone ?? "no hotel yet"}
      </p>
      {lead.request.notes ? (
        <p className="mt-1 whitespace-pre-wrap rounded-card bg-amber-50 p-3 text-sm">
          {lead.request.notes}
        </p>
      ) : null}
      <h2 className="mt-8 text-lg font-bold">
        System notes{" "}
        <span className="text-sm font-normal text-muted">
          (what the server changed and why: sold out, over budget, variety, weather)
        </span>
      </h2>
      {lead.itinerary.warnings.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {lead.itinerary.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">None: the plan came out as the engine chose it.</p>
      )}
      <h2 className="mt-8 text-lg font-bold">Raw request</h2>
      <pre className="mt-2 overflow-x-auto rounded-card bg-gray-100 p-3 text-xs">
        {JSON.stringify(lead.request, null, 2)}
      </pre>
    </main>
  );
}
