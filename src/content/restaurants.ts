import type { Cuisine, HotelZone } from "@/lib/trip-schema";

/**
 * Restaurant details the planner needs and Bokun doesn't have. Keyed by Bokun
 * product id (the restaurant pages on whattodoincancun.com/restaurant/...).
 *
 * EDIT FREELY. Prices are estimates per person for dinner and must be confirmed
 * by the WhatToDo team, as must the Grupo Anderson flags. To add restaurants in
 * another zone (Playa del Carmen, Tulum…), create the product in Bokun, publish
 * its page on the site and add a row here.
 */
export interface RestaurantInfo {
  cuisines: Cuisine[];
  zone: HotelZone;
  /** 1 = $, 4 = $$$$ */
  priceLevel: 1 | 2 | 3 | 4;
  /** Rough dinner cost per person in USD (food + one drink). */
  avgPerPersonUsd: number;
  /** Grupo Anderson restaurants get priority in recommendations. */
  group?: "anderson";
  /** Fine for families with kids at dinner time. */
  kidFriendly: boolean;
}

export const RESTAURANTS: Record<number, RestaurantInfo> = {
  911208: {
    // Señor Frog's
    cuisines: ["mexican", "international"],
    zone: "cancun",
    priceLevel: 2,
    avgPerPersonUsd: 35,
    group: "anderson",
    kidFriendly: true,
  },
  913342: {
    // Latina (Latin American buffet, rodizio)
    cuisines: ["latin", "steakhouse"],
    zone: "cancun",
    priceLevel: 2,
    avgPerPersonUsd: 49,
    kidFriendly: true,
  },
  975240: {
    // Sonora Grill
    cuisines: ["steakhouse", "mexican"],
    zone: "cancun",
    priceLevel: 3,
    avgPerPersonUsd: 60,
    kidFriendly: true,
  },
  994794: {
    // Porfirio's
    cuisines: ["mexican"],
    zone: "cancun",
    priceLevel: 3,
    avgPerPersonUsd: 55,
    group: "anderson",
    kidFriendly: true,
  },
  994803: {
    // Ilios (Greek, with show)
    cuisines: ["greek", "mediterranean"],
    zone: "cancun",
    priceLevel: 3,
    avgPerPersonUsd: 60,
    kidFriendly: true,
  },
  994804: {
    // Tora (Japanese)
    cuisines: ["japanese", "asian"],
    zone: "cancun",
    priceLevel: 3,
    avgPerPersonUsd: 70,
    kidFriendly: true,
  },
  994805: {
    // Parole (Italian, seafood)
    cuisines: ["italian", "seafood"],
    zone: "cancun",
    priceLevel: 3,
    avgPerPersonUsd: 65,
    kidFriendly: true,
  },
  994806: {
    // Funky Geisha (Asian, lively)
    cuisines: ["asian", "japanese"],
    zone: "cancun",
    priceLevel: 3,
    avgPerPersonUsd: 55,
    kidFriendly: false,
  },
  994807: {
    // Kultura
    cuisines: ["mexican"],
    zone: "cancun",
    priceLevel: 3,
    avgPerPersonUsd: 50,
    kidFriendly: true,
  },
  994808: {
    // Chambao (grill)
    cuisines: ["steakhouse"],
    zone: "cancun",
    priceLevel: 4,
    avgPerPersonUsd: 75,
    kidFriendly: true,
  },
  994809: {
    // Taboo (Mediterranean, party vibe)
    cuisines: ["mediterranean", "italian"],
    zone: "cancun",
    priceLevel: 4,
    avgPerPersonUsd: 75,
    kidFriendly: false,
  },
  994812: {
    // Rosa Negra (Latin American, party vibe)
    cuisines: ["latin", "steakhouse"],
    zone: "cancun",
    priceLevel: 4,
    avgPerPersonUsd: 75,
    kidFriendly: false,
  },
  994813: {
    // Harry's (steakhouse and raw bar)
    cuisines: ["steakhouse", "seafood"],
    zone: "cancun",
    priceLevel: 4,
    avgPerPersonUsd: 100,
    group: "anderson",
    kidFriendly: true,
  },
  994814: {
    // Ryoshi (Japanese / Nikkei)
    cuisines: ["japanese", "asian", "seafood"],
    zone: "cancun",
    priceLevel: 3,
    avgPerPersonUsd: 60,
    kidFriendly: true,
  },
  994815: {
    // Thai Cancun & Elephanta (Thai, Indian)
    cuisines: ["asian"],
    zone: "cancun",
    priceLevel: 3,
    avgPerPersonUsd: 55,
    kidFriendly: true,
  },
};
