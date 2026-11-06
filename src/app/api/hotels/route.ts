import { NextRequest } from "next/server";
import { searchHotels } from "@/server/catalog/hotels";

/**
 * Hotel autocomplete: `?q=hyatt` → up to 8 { name, city, zone }.
 * Searches the static pickup list (src/content/hotels.json), so it answers in
 * milliseconds and never waits for the Bokun catalog.
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  if (q.trim().length < 2) return Response.json({ hotels: [] });
  return Response.json(
    { hotels: searchHotels(q) },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
