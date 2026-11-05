import type { Area, ExperienceType } from "@/server/catalog/experience";
import type { Interest } from "@/server/catalog/types";

/**
 * Hand-set planner data per Bokun product, for the cases the title doesn't say
 * enough. Anything set here wins over what `experience.ts` reads from the title.
 *
 * EDIT FREELY. A product needs an entry when `/dev/catalog` flags it as
 * "no type" (the planner can't tell what kind of day it is, so it has no main
 * interest and never ranks first), or when its area is wrong or missing.
 *
 * - `type`: main kind of experience (atv, cenote, chichen, catamaran, dolphin…).
 *   Decides the tour's main interest and what counts as a repeat.
 * - `interests`: the full interest list, main interest first. Replaces the tags.
 * - `area`: where the tour happens along the coast, so a Tulum hotel isn't sent
 *   to Isla Mujeres every day. Leave it out for places that are far from every
 *   hotel zone (Chichén Itzá, Holbox, Bacalar).
 */
export const EXPERIENCE_OVERRIDES: Record<
  number,
  { type?: ExperienceType; interests?: Interest[]; area?: Area }
> = {
  // Semi-private 3 waterfall Cenotes experience (Cenotes Adventuring): Ruta de los
  // Cenotes, Puerto Morelos.
  705158: { area: "puerto_morelos" },
  // Speedboat Jungle Safari Adventure: Nichupté lagoon, Cancun hotel zone.
  1169010: { area: "cancun" },
  // Horseback Riding & ATV Jungle Adventure: jungle park on the Cancun side.
  670328: { area: "cancun" },
  // 5x1 Adventure: ATV, Snorkel, Cenote, Ziplines & Beach club: Puerto Morelos.
  855545: { area: "puerto_morelos" },
};
