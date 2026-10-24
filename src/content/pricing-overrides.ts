/**
 * Bokun products whose ticket price covers more than one person (e.g. a shared ATV
 * sold as "Adult" at USD 126 for two riders). The planner divides that price by the
 * number of people it covers, so the party is charged per person.
 */
export const PEOPLE_PER_PRICE: Record<number, number> = {
  // ATV, Ziplining & Cenote Tour at Extreme Adventure Eco Park: USD 126 for 2 people.
  670333: 2,
};
