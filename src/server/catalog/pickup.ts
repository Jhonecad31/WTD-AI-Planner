import type { HotelZone } from "@/lib/trip-schema";
import type { CatalogProduct } from "./types";

/**
 * Where a tour picks travelers up, from Bokun's pickup places. Most tours ride the whole
 * coast (Cancun → Tulum); some only part of it (Ek Balam from Cancun only, Akumal turtles
 * from the Riviera Maya only); boat trips, clubs and dolphin parks have no pickup at all
 * (the traveler gets to the marina or park on their own).
 */

/** Bokun pickup-place city → hotel zone. Cities that are none of our zones are ignored. */
const CITY_ZONE: [RegExp, HotelZone][] = [
  [
    /^(cancun|canc[uú]n|hotel zone|zona hotelera|puerto juarez|alfredo v\.? bonfil|caracol)$/i,
    "cancun",
  ],
  [/^(costa mujeres|playa mujeres|punta sam)$/i, "costa_mujeres"],
  [/^puerto morelos$/i, "puerto_morelos"],
  [/^(playa del carmen|solidaridad|playacar)$/i, "playa_del_carmen"],
  [/^(playa para[ií]so|playa maroma|playa del secreto|riviera maya)$/i, "riviera_maya"],
  [/^(puerto aventuras|akumal|xpu-?ha|chemuyil|soliman bay|balam canche)$/i, "puerto_aventuras"],
  [/^(tulum|tulum beach|punta allen)$/i, "tulum"],
];

export function zoneOfPickupCity(city: string | null | undefined): HotelZone | null {
  const c = (city ?? "").trim();
  if (!c) return null;
  return CITY_ZONE.find(([re]) => re.test(c))?.[1] ?? null;
}

/** Hotel zones a tour picks up from (empty when it has no pickup service). */
export function pickupZones(
  p: Pick<CatalogProduct, "pickupService" | "pickupPlaces">,
): HotelZone[] {
  if (!p.pickupService) return [];
  const zones = new Set<HotelZone>();
  for (const place of p.pickupPlaces) {
    const z = zoneOfPickupCity(place.city);
    if (z) zones.add(z);
  }
  return [...zones];
}

export type PickupCoverage =
  /** Pickup from the traveler's zone is included. */
  | "included"
  /** The tour has pickup, but not from this zone: the agent can't book it for them. */
  | "not_here"
  /** No pickup service: the traveler gets to the meeting point on their own. */
  | "self"
  /** Pickup service with no usable place list: unknown, treated like "self". */
  | "unknown";

export function pickupCoverage(
  p: Pick<CatalogProduct, "kind" | "pickupService" | "pickupPlaces">,
  zone: HotelZone,
): PickupCoverage {
  if (p.kind === "transfer") return "included";
  if (!p.pickupService) return "self";
  const zones = pickupZones(p);
  if (!zones.length) return "unknown";
  return zones.includes(zone) ? "included" : "not_here";
}
