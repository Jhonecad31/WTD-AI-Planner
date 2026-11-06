import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getLeadStore } from "@/server/store";

/**
 * Public PDF link: /api/lead/{id}/pdf?t={token}. The token makes ids unguessable.
 * `&v=lead` serves the sales-team PDF instead of the traveler's itinerary (dev panel).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const store = getLeadStore();
  const lead = await store.getLead(id);
  if (!lead || !lead.pdfPath) return new Response("Not found", { status: 404 });

  const a = Buffer.from(token);
  const b = Buffer.from(lead.token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response("Not found", { status: 404 });
  }

  const variant = request.nextUrl.searchParams.get("v") === "lead" ? "lead" : "trip";
  const pdfPath = variant === "lead" ? lead.agentPdfPath : lead.pdfPath;
  if (!pdfPath) return new Response("Not found", { status: 404 });
  const bytes = await store.readPdf(pdfPath);
  if (!bytes) return new Response("Not found", { status: 404 });
  const filename =
    variant === "lead" ? `WhatToDo-lead-${lead.ref}.pdf` : `WhatToDo-itinerary-${lead.ref}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
