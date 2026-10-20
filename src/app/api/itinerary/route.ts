import { NextRequest } from "next/server";
import { TripRequestSchema } from "@/lib/trip-schema";
import { generateItinerary } from "@/server/ai";

export const maxDuration = 60;

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
    const result = await generateItinerary(parsed.data);
    return Response.json(result);
  } catch (e) {
    console.error("[api/itinerary]", e);
    return Response.json(
      { error: "Could not build the itinerary. Please try again." },
      { status: 500 },
    );
  }
}
