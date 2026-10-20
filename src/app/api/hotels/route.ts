import { NextRequest } from "next/server";
import { getPlannerProducts } from "@/server/catalog/service";
import { searchHotels } from "@/server/catalog/hotels";

export const maxDuration = 60;

/** Hotel autocomplete from Bokun pickup places. `?q=hyatt` → up to 8 { name, city, zone }. */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  if (q.trim().length < 2) return Response.json({ hotels: [] });
  try {
    const products = await getPlannerProducts();
    return Response.json(
      { hotels: searchHotels(products, q) },
      { headers: { "Cache-Control": "public, max-age=600" } },
    );
  } catch {
    return Response.json({ hotels: [] });
  }
}
