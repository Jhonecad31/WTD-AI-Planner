import type { Interest } from "@/server/catalog/types";
import type { HotelZone } from "./trip-schema";

const LIVELY: Interest[] = ["party", "food", "adventure", "shopping"];
const RELAX: Interest[] = ["chill", "couples"];
const LIVELY_ZONES: HotelZone[] = ["cancun", "playa_del_carmen", "tulum"];
const RELAX_ZONES: HotelZone[] = ["riviera_maya", "costa_mujeres"];

/**
 * Areas to suggest from the traveler's interests: night life, food and adventure
 * point to Cancún, Playa del Carmen and Tulum; rest points to the Riviera Maya
 * and Costa Mujeres. Mixed interests list the stronger side first.
 */
export function recommendedZones(interests: Interest[]): HotelZone[] {
  const lively = interests.filter((i) => LIVELY.includes(i)).length;
  const relax = interests.filter((i) => RELAX.includes(i)).length;
  if (!lively && !relax) return [];
  if (!relax) return LIVELY_ZONES;
  if (!lively) return RELAX_ZONES;
  return relax > lively ? [...RELAX_ZONES, ...LIVELY_ZONES] : [...LIVELY_ZONES, ...RELAX_ZONES];
}
