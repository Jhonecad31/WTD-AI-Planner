import { NextRequest } from "next/server";
import { z } from "zod";
import { TripRequestSchema } from "@/lib/trip-schema";
import { ItinerarySchema } from "@/lib/itinerary-schema";
import { getPlannerProducts } from "@/server/catalog/service";
import { validateAndRepair } from "@/server/ai/validate";
import { renderTripPdf } from "@/server/pdf/trip-pdf";
import { clientIp, rateLimit, tooMany } from "@/server/ratelimit";

export const maxDuration = 60;

const BodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  ref: z.string().trim().min(1).max(20),
  request: TripRequestSchema,
  itinerary: ItinerarySchema,
});

/**
 * Renders the itinerary PDF from the payload the wizard already holds and streams it
 * back. Nothing is stored: on Vercel there is no writable disk, so the "Download PDF"
 * button posts here instead of linking to a saved file.
 */
export async function POST(request: NextRequest) {
  const limited = await rateLimit("pdf", clientIp(request), { limit: 20, windowSec: 3600 });
  if (!limited.ok) return tooMany(limited, "Too many downloads. Please try again later.");

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { name, ref, request: trip, itinerary: raw } = parsed.data;
  try {
    const products = await getPlannerProducts();
    const { itinerary } = validateAndRepair(raw, trip, products);
    const pdf = await renderTripPdf({ name, ref, request: trip, itinerary });
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="WhatToDo-itinerary-${ref}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[api/pdf]", e);
    return Response.json(
      { error: "We couldn't build the PDF. Please try again." },
      { status: 500 },
    );
  }
}
