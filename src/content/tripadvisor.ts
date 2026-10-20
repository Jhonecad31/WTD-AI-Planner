/**
 * Bokun product id → Tripadvisor location id, for the rating and review count
 * shown on tours and restaurants. EDIT FREELY.
 *
 * The location id is the number after "-d" in a Tripadvisor URL, e.g.
 * https://www.tripadvisor.com/Restaurant_Review-g150807-d1234567-Reviews-...  →  "1234567".
 * A tour without its own listing can point to the park's or to WhatToDo's listing.
 *
 * Nothing is shown until TRIPADVISOR_API_KEY is set in the environment.
 */
export const TRIPADVISOR_LOCATIONS: Record<number, string> = {
  // 994813: "1234567", // Harry's Cancún (example, replace with the real id)
};
