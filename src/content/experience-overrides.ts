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
 * - `activities`: what the tour includes beyond its title, so two tours that are
 *   really the same day (ATV + zipline + cenote vs. a cenote park with ziplines)
 *   never land in one trip.
 *
 * Areas below come from the Bokun description (meeting point, park name) where
 * it says one; the ones marked "(check)" are our best guess for Jhonny to confirm.
 */
export const EXPERIENCE_OVERRIDES: Record<
  number,
  {
    type?: ExperienceType;
    interests?: Interest[];
    area?: Area | "far";
    /** Activities the description adds to the title (zipline at a cenote park…). */
    activities?: ExperienceType[];
  }
> = {
  // --- Ruta de los Cenotes / Extreme Adventure Eco Park (Puerto Morelos) ---
  // Horseback Riding & ATV Jungle Adventure: Extreme Adventure Eco Park.
  670328: { area: "puerto_morelos" },
  // 5x1 Adventure: ATV, Snorkel, Cenote, Ziplines & Beach club: Puerto Morelos.
  855545: { area: "puerto_morelos" },
  // Semi-private 3 waterfall Cenotes (Cenotes Adventuring): "Cancun's cenotes" in
  // the jungle, i.e. Ruta de los Cenotes (check).
  705158: { area: "puerto_morelos", activities: ["zipline"] },
  // ATV Jungle Adventure Zip-Line, Cenote & Tequila Tasting: Ruta de los Cenotes.
  1277988: { area: "puerto_morelos" },
  // ATV Private Signature Experience: WhatToDo's own park, Ruta de los Cenotes (check).
  1181148: { area: "puerto_morelos", activities: ["zipline", "cenote"] },
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
  1021390: { area: "cancun", activities: ["snorkel", "beach_club"] },
  // Private catamarans (20–30, 35–45, 60 passengers): Cancun hotel zone marina.
  1164687: { area: "cancun", activities: ["snorkel"] },
  1166052: { area: "cancun", activities: ["snorkel", "beach_club"] },
  1166270: { area: "cancun", activities: ["snorkel", "beach_club"] },

  // --- What the description adds to the title (read from Bokun on 2026-11-05) ---
  // Xcaret Plus Admission From Cancun & Playa del Carmen (Optional Transport
  714415: { activities: ["snorkel", "cave"] },
  // Xelha All Inclusive From Cancun & Riviera Maya
  714416: { activities: ["zipline", "cenote", "snorkel"] },
  // Isla Mujeres Catamaran Combo Tour with Snorkeling and Speedboat
  742963: { activities: ["beach_club"] },
  // Whale Shark Experience with Isla Mujeres Snorkel & Transportation
  764355: { activities: ["speedboat"] },
  // Ek Balam Mayan Traditions
  848479: { activities: ["cenote"] },
  // Akumal Reef & Turtles Sanctuary from Riviera Maya
  870550: { activities: ["snorkel"] },
  // Kaan Luum Lagoon Day Trip with Cenotes and Mayan Traditions
  876336: { activities: ["cave"] },
  // Xcaret Tickets Admission From Cancun & Playa del Carmen (Optional Transp
  1020645: { activities: ["cave"] },
  // Rio Secreto Admission (With Optional Transportation)
  1023136: { activities: ["cave"] },
  // Rio Secreto + Tulum Mayan Ruins
  1023182: { activities: ["cave"] },
  // Rio Secreto + Coba Mayan Ruins
  1023186: { activities: ["cenote", "cave"] },
  // Dolphin Discovery in Cozumel
  1026428: { activities: ["snorkel"] },
  // Dolphin Discovery Tulum - Akumal
  1028486: { activities: ["snorkel"] },
  // Dolphin Discovery in Playa del Carmen
  1028829: { activities: ["snorkel", "beach_club"] },
  // Dolphin Discovery in Riviera Maya
  1028842: { activities: ["catamaran"] },
  // Garrafon Natural Reef Park in Isla Mujeres
  1028969: { activities: ["zipline", "snorkel"] },
  // Cozumel Day Excursion Essentials
  1063989: { activities: ["snorkel", "beach_club"] },
  // Baby Dancer Cruise Party Boat Cancun
  1076229: { activities: ["snorkel"] },
  // Cenotes Casa Tortuga with Tulum Ruins Day Trip
  1107394: { activities: ["cave"] },
  // Bacalar Lagoon Day Trip
  1161986: { activities: ["cenote"] },
  // 3 Hidden Cenotes Experience & Puerto Morelos Reef Snorkeling
  1229002: { activities: ["beach_club"] },
};
