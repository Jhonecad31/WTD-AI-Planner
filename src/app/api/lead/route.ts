import { NextRequest } from "next/server";
import { LeadSubmissionSchema, type LeadRecord } from "@/lib/lead-schema";
import { getPlannerProducts } from "@/server/catalog/service";
import { validateAndRepair } from "@/server/ai/validate";
import { renderTripPdf } from "@/server/pdf/trip-pdf";
import { sendLeadEmails, pdfUrlFor } from "@/server/email";
import { getLeadStore, newId, newRef, newToken } from "@/server/store";
import { clientIp, rateLimit, tooMany } from "@/server/ratelimit";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // 5 submissions per IP per hour (shared across instances when Upstash is configured).
  const limited = await rateLimit("lead", clientIp(request), { limit: 5, windowSec: 3600 });
  if (!limited.ok) return tooMany(limited, "Too many submissions. Please try again later.");

  const parsed = LeadSubmissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid submission", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { lead: input, request: trip, itinerary: rawItinerary, engine } = parsed.data;

  try {
    // Never trust client-side prices: re-validate and re-price against the catalog.
    const products = await getPlannerProducts();
    const { itinerary } = validateAndRepair(rawItinerary, trip, products);

    const store = getLeadStore();
    // Vercel has no writable disk: there the lead is not written locally (the team's own
    // backend keeps it); in local dev it goes to .data/ as before.
    const isVercel = process.env.VERCEL === "1";
    const now = new Date().toISOString();
    const lead: LeadRecord = {
      id: newId(),
      ref: newRef(),
      token: newToken(),
      createdAt: now,
      status: "new",
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone || null,
      locale: input.locale,
      consentAt: now,
      request: trip,
      itinerary,
      engine: engine ?? null,
      totalUsd: itinerary.totals.totalUsd,
      pdfPath: null,
      notes: [],
      bokunConfirmationCodes: [],
    };
    if (!isVercel) await store.createLead(lead);

    const pdf = await renderTripPdf({ name: lead.name, ref: lead.ref, request: trip, itinerary });
    if (!isVercel) {
      lead.pdfPath = await store.savePdf(lead.id, pdf);
      await store.updateLead(lead.id, { pdfPath: lead.pdfPath });
    }

    const emails = await sendLeadEmails(lead, pdf);

    return Response.json({
      ok: true,
      leadId: lead.id,
      ref: lead.ref,
      pdfUrl: pdfUrlFor(lead),
      emails: emails.map((e) => ({ kind: e.kind, status: e.status, provider: e.provider })),
    });
  } catch (e) {
    console.error("[api/lead]", e);
    return Response.json(
      { error: "We couldn't save your itinerary. Please try again." },
      { status: 500 },
    );
  }
}
