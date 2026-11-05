import type { Area, ExperienceType } from "@/server/catalog/experience";
import type { Interest } from "@/server/catalog/types";

/**
 * Hand-set planner data per Bokun product: what the title doesn't say. Anything set
 * here wins over what `experience.ts` reads from the title.
 *
 * EDIT FREELY. A product needs an entry when `/dev/catalog` flags it as "no type",
 * when its area is wrong or missing, or when its description includes activities the
 * title leaves out (so two tours that are really the same day never share a trip).
 *
 * - `type`: main kind of experience (atv, cenote, chichen, cave…). Decides the main
 *   interest and what counts as a repeat.
 * - `interests`: the full interest list, main interest first. Replaces the tags.
 * - `area`: where the tour happens along the coast (costa_mujeres → tulum), or "far"
 *   for a long drive from every zone (Chichén, Ek Balam, Holbox, Bacalar, Río Lagartos).
 * - `activities`: what the tour INCLUDES beyond its title, per the Bokun description
 *   (ziplines at a cenote park, snorkel on a catamaran). Optional extras the traveler
 *   pays separately (snorkel "available" at a dolphin park) are left out on purpose.
 * - `family`: tours that are the same experience under different titles (the three
 *   Río Secreto combos, the two clear-boat rides): never two of one family in a trip.
 *
 * Read from the Bokun descriptions on 2026-11-05; "(check)" marks our best guess.
 */
export interface ExperienceOverride {
  type?: ExperienceType;
  interests?: Interest[];
  area?: Area | "far";
  activities?: ExperienceType[];
  family?: string;
}

export const EXPERIENCE_OVERRIDES: Record<number, ExperienceOverride> = {
  // --- Jungle adventure parks on Ruta de los Cenotes (Puerto Morelos) ---
  // All ATV + ziplines + cenote (Verde Lucero / Extreme Adventure); main type "atv"
  // already makes any two of them a repeat.
  670328: { area: "puerto_morelos" }, // Horseback + ATV + 3 ziplines + cenote
  670333: { area: "puerto_morelos" }, // ATV + 6 ziplines + cenote
  1277988: { area: "puerto_morelos" }, // ATV + 3 ziplines + cenote
  855545: { area: "puerto_morelos" }, // 5x1: ATV, ziplines, cenote, reef snorkel, beach club
  1181148: { area: "puerto_morelos", activities: ["zipline", "cenote"] }, // private ATV park (check)
  // Cenotes Adventuring: 3 cenotes with zipline and jumping platform (check area).
  705158: { area: "puerto_morelos", activities: ["zipline"] },
  // 3 hidden cenotes + Puerto Morelos reef snorkel with beach club access.
  1229002: { activities: ["beach_club"] },
  // Beachside taco tours in Puerto Morelos (check).
  1181903: { area: "puerto_morelos" },
  // Private boat + reef snorkel in Puerto Morelos.
  1128683: { activities: ["boat"] },

  // --- Río Secreto (underground river near Playa del Carmen) ---
  // The headline of all three is the cave river; the ruins are the morning stop.
  1023136: { family: "rio-secreto" },
  1023182: { type: "cave", family: "rio-secreto" }, // + Tulum ruins
  1023186: { type: "cave", family: "rio-secreto" }, // + Cobá ruins

  // --- Ruins day trips (far) ---
  848479: { activities: ["cenote"] }, // Ek Balam + cenote Chichikan + Uayma
  1107394: { activities: ["cave"] }, // Casa Tortuga: 2 open + 2 cave cenotes, Tulum ruins
  // Chichén ×3 and Tulum/Cobá: the title already names the cenote stop.

  // --- Parks ---
  714415: { activities: ["snorkel", "cave"] }, // Xcaret Plus: underground rivers, reef aquarium
  1020645: { activities: ["snorkel", "cave"] }, // Xcaret: underground rivers
  714416: { activities: ["snorkel", "zipline", "cenote"] }, // Xel-Há all inclusive
  1028969: { activities: ["snorkel", "zipline", "beach_club"] }, // Garrafón: reef, zipline, kayak, temazcal
  1278089: { family: "jungala" }, // Jungala water park
  1241968: { family: "jungala" }, // Cirque du Soleil JOYÀ + Jungala
  876336: { activities: ["cave"] }, // Kaan Luum lagoon + 2 cenotes (one cavern)

  // --- Cancun hotel zone / Nichupté lagoon / Isla Mujeres ---
  1169010: { area: "cancun" }, // speedboat to Isla Blanca (Costa Mujeres)
  885792: { area: "cancun" }, // ATV + speedboat combo
  885793: { area: "cancun" }, // ATV + catamaran combo
  670335: { activities: ["boat"] }, // Columbus dinner cruise (galleon on the lagoon)
  714589: { activities: ["boat"] }, // Xoximilco gondola party
  742963: { activities: ["beach_club"] }, // Isla Mujeres catamaran + speedboat + snorkel
  1021390: { area: "cancun", activities: ["snorkel", "beach_club"] }, // catamaran + dolphin swim
  1164687: { area: "cancun", activities: ["snorkel"] }, // private catamarans: reef snorkel, sandbank swim
  1166052: { area: "cancun", activities: ["snorkel"] },
  1166270: { area: "cancun", activities: ["snorkel"] },
  1076229: { activities: ["snorkel", "boat"] }, // Baby Dancer party boat: snorkel at El Meco, grill, DJ
  764355: { activities: ["speedboat"] }, // whale shark by speedboat + Playa Norte snorkel
  // The two transparent-boat rides to the reef and the sandbar.
  746175: { family: "clear-boat" }, // parasailing + clear boat + sandbar swim
  1263404: { type: "boat", family: "clear-boat" }, // clearboat + reef + sandbar swim
  753803: { activities: ["beach_club"] }, // Coco Bongo Beach Party (daytime, on the beach)
  709416: { activities: ["show"] }, // Coco Bongo: show + club
  1049207: { activities: ["nightlife"] }, // MYST: show + nightclub after-party

  // --- Riviera Maya / south ---
  1028829: { activities: ["beach_club"] }, // Dolphin Discovery Playa del Carmen (Maroma beach club)
  // Dolphin Discovery Cozumel / Tulum-Akumal / Riviera Maya: snorkel, kayak or catamaran
  // are mentioned as nearby options at your own expense, so none are listed.
  1161986: { activities: ["boat"] }, // Bacalar: boat tour, pirates' canal, black cenote from the boat
  1252219: { activities: ["boat"] }, // Coloradas + Río Lagartos boat + Mayan mud bath
  // Cozumel Day Excursion: ferry + free time; snorkel and beach club are optional extras.
};
