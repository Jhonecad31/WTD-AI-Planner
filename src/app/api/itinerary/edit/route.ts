import { NextRequest } from "next/server";
import { withTripAdvisor } from "@/server/tripadvisor";
import { z } from "zod";
import { TripRequestSchema, ISO_DATE } from "@/lib/trip-schema";
import { ItinerarySchema } from "@/lib/itinerary-schema";
import { getPlannerProducts } from "@/server/catalog/service";
import { getAvailability } from "@/server/catalog/availability";
import { alternativesForDay, moveTour, replaceTour } from "@/server/ai/edit";

export const maxDuration = 60;

const Body = z.object({
  request: TripRequestSchema,
  itinerary: ItinerarySchema,
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("alternatives"), date: z.string().regex(ISO_DATE) }),
    z.object({
      type: z.literal("move"),
      bokunId: z.number().int(),
      fromDate: z.string().regex(ISO_DATE),
      toDate: z.string().regex(ISO_DATE),
    }),
    z.object({
      type: z.literal("replace"),
      date: z.string().regex(ISO_DATE),
      bokunId: z.number().int().nullable(),
    }),
  ]),
});

const lookup = (bokunId: number, date: string) => getAvailability(bokunId, date, date);

export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid edit request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { request: trip, itinerary, action } = parsed.data;
  try {
    const products = await getPlannerProducts();
    if (action.type === "alternatives") {
      const alternatives = await alternativesForDay(itinerary, trip, products, action.date, lookup);
      return Response.json({ alternatives });
    }
    const result =
      action.type === "move"
        ? await moveTour(itinerary, trip, products, action, lookup)
        : await replaceTour(itinerary, trip, products, action, lookup);
    return Response.json(
      result.ok ? { ...result, itinerary: await withTripAdvisor(result.itinerary) } : result,
    );
  } catch (e) {
    console.error("[api/itinerary/edit]", e);
    return Response.json({ error: "Could not update the itinerary." }, { status: 500 });
  }
}
