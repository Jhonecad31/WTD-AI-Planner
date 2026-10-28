import { NextRequest } from "next/server";
import { z } from "zod";
import { TripRequestSchema } from "@/lib/trip-schema";
import { generateItinerary } from "@/server/ai";

export const maxDuration = 60;

/** "Try another version": tours of the current plan to leave out when possible. */
const AvoidSchema = z.array(z.number().int().positive()).max(40).optional().catch(undefined);

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = TripRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid trip request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const avoid = AvoidSchema.parse((body as { avoid?: unknown }).avoid);
    const result = await generateItinerary(parsed.data, { avoid });
    return Response.json(result);
  } catch (e) {
    console.error("[api/itinerary]", e);
    return Response.json(
      { error: "Could not build the itinerary. Please try again." },
      { status: 500 },
    );
  }
}