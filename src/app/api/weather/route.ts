import { NextRequest } from "next/server";
import { z } from "zod";
import { HOTEL_ZONES, ISO_DATE } from "@/lib/trip-schema";
import { seasonNotes } from "@/lib/weather";
import { getTripWeather } from "@/server/weather";

const QuerySchema = z
  .object({
    from: z.string().regex(ISO_DATE),
    to: z.string().regex(ISO_DATE),
    zone: z.enum(HOTEL_ZONES).optional(),
  })
  .refine((q) => q.from <= q.to, { message: "from must be on or before to" })
  .refine((q) => Date.parse(q.to) - Date.parse(q.from) <= 45 * 86_400_000, {
    message: "range too long",
  });

/** Weather for the trip dates (forecast when close, typical climate otherwise). No secrets. */
export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return Response.json({ error: "Invalid query", issues: parsed.error.issues }, { status: 400 });
  }
  const { from, to, zone } = parsed.data;
  const days = await getTripWeather({ from, to, zone });
  return Response.json(
    { days, seasons: seasonNotes(from, to) },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
