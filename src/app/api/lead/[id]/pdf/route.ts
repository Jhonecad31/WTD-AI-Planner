import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getLeadStore } from "@/server/store";

/** Public PDF link: /api/lead/{id}/pdf?t={token}. The token makes ids unguessable. */
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

  const bytes = await store.readPdf(lead.pdfPath);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="WhatToDo-itinerary-${lead.ref}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
