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
 *   to Isla Mujeres every day. Use "far" for places that are a long drive from
 *   every hotel zone (Chichén Itzá, Ek Balam, Holbox, Bacalar, Río Lagartos).
 *
 * Areas below come from the Bokun description (meeting point, park name) where
 * it says one; the ones marked "(check)" are our best guess for Jhonny to confirm.
 */
export const EXPERIENCE_OVERRIDES: Record<
  number,
  { type?: ExperienceType; interests?: Interest[]; area?: Area | "far" }
> = {
  // --- Ruta de los Cenotes / Extreme Adventure Eco Park (Puerto Morelos) ---
  // Horseback Riding & ATV Jungle Adventure: Extreme Adventure Eco Park.
  670328: { area: "puerto_morelos" },
  // 5x1 Adventure: ATV, Snorkel, Cenote, Ziplines & Beach club: Puerto Morelos.
  855545: { area: "puerto_morelos" },
  // Semi-private 3 waterfall Cenotes (Cenotes Adventuring): "Cancun's cenotes" in
  // the jungle, i.e. Ruta de los Cenotes (check).
  705158: { area: "puerto_morelos" },
  // ATV Jungle Adventure Zip-Line, Cenote & Tequila Tasting: Ruta de los Cenotes.
  1277988: { area: "puerto_morelos" },
  // ATV Private Signature Experience: WhatToDo's own park, Ruta de los Cenotes (check).
  1181148: { area: "puerto_morelos" },
  // Private Signature Beach Taco Tour: the beachside taco tour runs in Puerto Morelos (check).
  1181903: { area: "puerto_morelos" },

  // --- Cancun hotel zone / Nichupté lagoon / Isla Mujeres piers ---
  // Speedboat Jungle Safari Adventure: Nichupté lagoon.
  1169010: { area: "cancun" },
  // ATV Jungle Adventure Experience & Speedboat combo: Nichupté lagoon.
  885792: { area: "cancun" },
  // ATV Jungle Adventure & Premium Catamaran Combo: sails to Isla Mujeres from Cancun.
  885793: { area: "cancun" },
  // Catamaran tour & Dolphin Swim: Isla Mujeres.
  1021390: { area: "cancun" },
  // Private catamarans (20–30, 35–45, 60 passengers): Cancun hotel zone marina.
  1164687: { area: "cancun" },
  1166052: { area: "cancun" },
  1166270: { area: "cancun" },
};
