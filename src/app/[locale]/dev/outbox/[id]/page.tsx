import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadStore } from "@/server/store";

export const instant = false;

/** Internal: renders one stored email exactly as the recipient would see it. */
export default async function OutboxEmailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const email = await getLeadStore().getEmail(id);
  if (!email) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/dev/outbox" className="text-sm font-semibold text-primary hover:underline">
        ← Outbox
      </Link>
      <dl className="mt-4 grid gap-x-6 gap-y-1 rounded-card border border-line bg-white p-4 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">To</dt>
        <dd>{email.to}</dd>
        <dt className="text-muted">Reply-To</dt>
        <dd>{email.replyTo ?? "—"}</dd>
        <dt className="text-muted">Subject</dt>
        <dd className="font-semibold">{email.subject}</dd>
        <dt className="text-muted">Attachments</dt>
        <dd>{email.attachments.map((a) => a.filename).join(", ") || "—"}</dd>
        <dt className="text-muted">Status</dt>
        <dd>
          {email.status} ({email.provider}){email.error ? ` — ${email.error}` : ""}
        </dd>
      </dl>
      <iframe
        title={email.subject}
        srcDoc={email.html}
        sandbox=""
        className="mt-4 h-[80vh] w-full rounded-card border border-line bg-white"
      />
    </main>
  );
}
