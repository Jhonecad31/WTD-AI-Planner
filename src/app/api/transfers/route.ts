import { NextRequest } from "next/server";
import { getPlannerProducts } from "@/server/catalog/service";
import { transferFor } from "@/server/ai/rules";
import { priceProductForParty } from "@/server/ai/pricing";
import { HOTEL_ZONES, type HotelZone, type TripRequest } from "@/lib/trip-schema";

export const maxDuration = 30;

export interface TransferQuote {
  /** Standard ride, per vehicle, one way. Null when the catalog has no ride for the zone. */
  perLegUsd: number | null;
  /** Luxury ride, per vehicle, one way. Null when there is none. */
  luxuryPerLegUsd: number | null;
}

/**
 * Airport transfer price for a hotel zone, so the wizard can show "+USD X" on the transfer
 * cards. `?zone=tulum` → { perLegUsd, luxuryPerLegUsd }. Transfers are priced per vehicle,
 * so the party size doesn't matter.
 */
export async function GET(request: NextRequest) {
  const zone = request.nextUrl.searchParams.get("zone") ?? "cancun";
  if (!(HOTEL_ZONES as readonly string[]).includes(zone)) {
    return Response.json({ error: "Unknown zone" }, { status: 400 });
  }
  try {
    const products = await getPlannerProducts();
    const quote = (luxury: boolean) => {
      const req = {
        hotel: { noHotel: false, zone: zone as HotelZone },
        transfers: { arrival: true, departure: true, luxury },
      } as TripRequest;
      const ride = transferFor(products, req);
      if (!ride) return null;
      // Only count a luxury price when the catalog really has a luxury ride for the zone.
      if (luxury && !/luxury|vip|premium|deluxe/i.test(ride.title)) return null;
      return priceProductForParty(ride, [{ age: 30 }]).priceTotalUsd;
    };
    const body: TransferQuote = { perLegUsd: quote(false), luxuryPerLegUsd: quote(true) };
    return Response.json(body, { headers: { "Cache-Control": "public, max-age=600" } });
  } catch {
    return Response.json({ perLegUsd: null, luxuryPerLegUsd: null } satisfies TransferQuote);
  }
}
