import { NextRequest } from "next/server";
import { LeadSubmissionSchema, type LeadRecord } from "@/lib/lead-schema";
import { getPlannerProducts } from "@/server/catalog/service";
import { validateAndRepair } from "@/server/ai/validate";
import { renderTripPdf } from "@/server/pdf/trip-pdf";
import { sendLeadEmails, pdfUrlFor } from "@/server/email";
import { getLeadStore, newId, newRef, newToken } from "@/server/store";

export const maxDuration = 60;

/** Very small in-memory throttle: 5 submissions per IP per hour (Upstash in production). */
const hits = new Map<string, number[]>();
function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (throttled(ip)) {
    return Response.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 },
    );
  }

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
    const now = new Date().toISOString();
    const lead: LeadRecord = {
      id: newId(),
      ref: newRef(),
      token: newToken(),
      createdAt: now,
      status: "new",
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone ? input.phone : null,
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
    await store.createLead(lead);

    const pdf = await renderTripPdf({ name: lead.name, ref: lead.ref, request: trip, itinerary });
    lead.pdfPath = await store.savePdf(lead.id, pdf);
    await store.updateLead(lead.id, { pdfPath: lead.pdfPath });

    const emails = await sendLeadEmails(lead);

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
