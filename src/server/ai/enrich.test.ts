import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/server/catalog/types";
import type { TripRequest } from "@/lib/trip-schema";
import { ItinerarySchema } from "@/lib/itinerary-schema";
import { buildRulesItinerary, isRainyFavorite, scoreProduct } from "./rules";
import { enrichItinerary, kidWarnings, placePartyNights, rankRestaurants } from "./enrich";
import { validateAndRepair } from "./validate";

function product(
  partial: Partial<CatalogProduct> & { bokunId: number; title: string },
): CatalogProduct {
  return {
    slug: null,
    siteUrl: `https://whattodoincancun.com/tour/${partial.bokunId}/`,
    onSite: true,
    extranetUrl: `https://extranet.bokun.io/experience/${partial.bokunId}`,
    kind: "tour",
    excerpt: "",
    description: "",
    interests: [],
    bokunCategories: [],
    keywords: [],
    durationMinutes: 5 * 60,
    durationText: null,
    isMultiDay: false,
    priceFromUsd: 100,
    currency: "USD",
    pricingCategories: [
      { id: 1, title: "Adult", ticketCategory: "ADULT", minAge: 13, maxAge: 99, isDefault: true },
      { id: 2, title: "Child", ticketCategory: "CHILD", minAge: 4, maxAge: 12, isDefault: false },
    ],
    prices: [],
    startTimes: [],
    pickupService: false,
    pickupMinutesBefore: null,
    pickupPlaces: [],
    imageUrl: null,
    imageUrls: [],
    rating: null,
    reviewCount: 0,
    minAge: null,
    ...partial,
  } as CatalogProduct;
}

const restaurant = (bokunId: number, title: string) =>
  product({
    bokunId,
    title,
    kind: "restaurant",
    priceFromUsd: null,
    siteUrl: `https://whattodoincancun.com/restaurant/${bokunId}/`,
  });

const catalog: CatalogProduct[] = [
  product({
    bokunId: 1,
    title: "Chichen Itza Day Trip",
    interests: ["cultural"],
    durationMinutes: 12 * 60,
  }),
  product({ bokunId: 2, title: "Jungle ATV", interests: ["adventure"] }),
  product({ bokunId: 3, title: "Isla Mujeres Catamaran", interests: ["water"] }),
  product({ bokunId: 4, title: "Coco Bongo Show", interests: ["party"], minAge: 18 }),
  product({ bokunId: 7, title: "Party Boat Night", interests: ["party"] }),
  product({ bokunId: 8, title: "Private ATV Signature", interests: ["adventure"] }),
  product({ bokunId: 9, title: "Coba Ruins", interests: ["cultural"] }),
  product({
    bokunId: 5,
    title: "Airport Transfer Cancun Airport to Hotel Zone",
    kind: "transfer",
    priceFromUsd: 50,
  }),
  // Real ids from src/content/restaurants.ts
  restaurant(911208, "Señor Frog's"), // anderson, mexican, $35, kids ok
  restaurant(994805, "Parole"), // italian, $65
  restaurant(994813, "Harry's"), // anderson, steakhouse, $100
  restaurant(994809, "Taboo"), // mediterranean, $75, not kid friendly
];

const base: TripRequest = {
  locale: "es",
  inbound: { date: "2026-12-10", source: "manual" },
  outbound: { date: "2026-12-15", source: "manual" },
  hotel: { noHotel: false, zone: "cancun" },
  transfers: { arrival: true, departure: true, luxury: false },
  travelers: [{ age: 30 }, { age: 30 }],
  interests: ["adventure", "cultural"],
  preferPrivate: false,
  chillDays: "one",
  tourDays: "all",
  budgetPerPerson: 1500,
  dining: { cuisines: [], budgetPerMeal: 120 },
};

function plan(req: TripRequest, products = catalog) {
  const raw = buildRulesItinerary({ request: req, products });
  const enriched = enrichItinerary(raw, req, products);
  return validateAndRepair(enriched, req, products).itinerary;
}
const day = (it: ReturnType<typeof plan>, date: string) => it.days.find((d) => d.date === date)!;
const kinds = (it: ReturnType<typeof plan>, date: string) => day(it, date).items.map((i) => i.kind);

describe("enrichItinerary", () => {
  it("produces a schema-valid itinerary", () => {
    expect(ItinerarySchema.safeParse(plan(base)).success).toBe(true);
  });

  it("arrival: rest at the hotel unless landing before 4 pm, then dinner", () => {
    expect(kinds(plan(base), "2026-12-10")).toEqual(["transfer", "rest"]);
    const early = plan({ ...base, inbound: { ...base.inbound, slot: "early" } });
    expect(kinds(early, "2026-12-10")).toEqual(["transfer", "restaurant"]);
  });

  it("departure: no tours; beach or shopping before the transfer on a night flight", () => {
    expect(kinds(plan(base), "2026-12-15")).toEqual(["transfer"]);
    const night = plan({
      ...base,
      interests: ["adventure", "shopping"],
      outbound: { ...base.outbound, slot: "night" },
    });
    expect(kinds(night, "2026-12-15")).toEqual(["shopping", "transfer"]);
  });

  it("chill days get beach (or shopping) plus dinner, all in the traveler's zone", () => {
    const it_ = plan({ ...base, hotel: { noHotel: false, zone: "tulum" } });
    const chill = it_.days.find((d) => d.label === "chill")!;
    expect(chill.items[0]).toMatchObject({ kind: "beach", placeId: "playa-paraiso-tulum" });
    // No restaurants in Tulum yet: no dinner and a note instead.
    expect(it_.days.flatMap((d) => d.items).some((i) => i.kind === "restaurant")).toBe(false);
    expect(it_.diningNote).toBeTruthy();
  });

  it("one dinner per tour night, Grupo Anderson first, rotating without repeats", () => {
    const it_ = plan(base);
    const dinners = it_.days.flatMap((d) => d.items).filter((i) => i.kind === "restaurant");
    expect(dinners.length).toBeGreaterThanOrEqual(3);
    expect([911208, 994813]).toContain(dinners[0].bokunId);
    expect(new Set(dinners.slice(0, 4).map((d) => d.bokunId)).size).toBe(
      Math.min(4, dinners.length),
    );
    expect(it_.totals.diningEstimateUsd).toBeGreaterThan(0);
    expect(it_.totals.totalUsd).toBe(it_.totals.toursUsd + it_.totals.transfersUsd);
  });

  it("restaurants follow cuisine, budget and kids", () => {
    const italian = rankRestaurants(
      { ...base, dining: { cuisines: ["italian"], budgetPerMeal: 80 } },
      catalog,
    );
    expect(italian[0].p.bokunId).toBe(994805);
    expect(italian.map((r) => r.p.bokunId)).not.toContain(994813); // $100 > budget
    const kids = rankRestaurants({ ...base, travelers: [{ age: 35 }, { age: 6 }] }, catalog);
    expect(kids.map((r) => r.p.bokunId)).not.toContain(994809); // Taboo not kid friendly
  });

  it("party nights only before a chill day or the departure day, never before a tour", () => {
    const it_ = plan({ ...base, interests: ["party", "adventure"], chillDays: "one" });
    const party = new Set([4, 7]);
    const idx = it_.days.findIndex((d) => d.items.some((i) => party.has(i.bokunId ?? 0)));
    expect(idx).toBeGreaterThan(0);
    expect(["chill", "departure"]).toContain(it_.days[idx + 1].label);
    // Party night skips dinner.
    expect(it_.days[idx].items.some((i) => i.kind === "restaurant")).toBe(false);
  });

  it("moves a misplaced party night from another engine to a valid day", () => {
    const req = { ...base, interests: ["party", "adventure"] as TripRequest["interests"] };
    const raw = buildRulesItinerary({ request: req, products: catalog });
    // Force the party tour onto the first full day (followed by a tour day).
    const days = raw.days.map((d) => ({ ...d, items: d.items.filter((i) => i.bokunId !== 7) }));
    const first = days.findIndex((d) => d.label === "full");
    days[first].items = [{ ...raw.days.flatMap((d) => d.items).find((i) => i.bokunId === 7)! }];
    const fixed = placePartyNights(days, req, catalog);
    const idx = fixed.findIndex((d) => d.items.some((i) => i.bokunId === 7));
    if (idx >= 0) expect(["chill", "departure"]).toContain(fixed[idx + 1].label);
  });

  it("warns neutrally about night clubs, and about Chichén Itzá only when it's in the plan", () => {
    expect(kidWarnings(base)).toEqual([]);
    const withKids = {
      ...base,
      travelers: [{ age: 35 }, { age: 7 }],
      interests: ["party", "cultural"],
    } as typeof base;
    expect(kidWarnings(withKids)).toEqual([expect.stringMatching(/Coco Bongo/)]);
    const day = {
      date: "2026-12-11",
      dayNumber: 2,
      label: "full" as const,
      title: "",
      items: [
        {
          kind: "tour" as const,
          title: "Chichen Itza Plus",
          priceTotalUsd: 1,
          pricing: [],
          pickup: true,
        },
      ],
    };
    const lines = kidWarnings(withKids, [day]);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/Chich[eé]n Itz[aá]/);
  });
});

describe("tour ranking rules", () => {
  it("ranks private tours higher when asked and long tours lower with young kids", () => {
    const priv = catalog.find((p) => p.bokunId === 8)!;
    const atv = catalog.find((p) => p.bokunId === 2)!;
    expect(scoreProduct(priv, ["adventure"], { preferPrivate: true })).toBeGreaterThan(
      scoreProduct(atv, ["adventure"], { preferPrivate: true }),
    );
    const chichen = catalog.find((p) => p.bokunId === 1)!;
    const coba = catalog.find((p) => p.bokunId === 9)!;
    expect(scoreProduct(chichen, ["cultural"], { youngKids: true })).toBeLessThan(
      scoreProduct(coba, ["cultural"], { youngKids: true }),
    );
  });

  it("counts Cenote Adventuring as a rainy-day favorite", () => {
    expect(
      isRainyFavorite({
        title: "Semi-private 3 waterfall Cenotes experience",
        siteUrl: "https://whattodoincancun.com/tour/cenotes-adventuring-tour/",
      }),
    ).toBe(true);
    expect(isRainyFavorite({ title: "Coba Ruins", siteUrl: null })).toBe(false);
  });
});

describe("tour days and rain", () => {
  it("caps tour days and turns the rest into easy days", () => {
    const it_ = plan({ ...base, chillDays: "none", tourDays: "2" });
    const full = it_.days.filter((d) => d.label === "full");
    expect(full).toHaveLength(2);
    expect(it_.days.filter((d) => d.label === "chill")).toHaveLength(2);
  });

  it("never sends people to the beach on a rainy day, and warns on a rainy trip", () => {
    const req = { ...base, chillDays: "one" as const };
    const raw = buildRulesItinerary({ request: req, products: catalog });
    const rainy = {
      source: "forecast" as const,
      kind: "rainy" as const,
      tMaxC: 27,
      tMinC: 24,
      rainChance: 90,
    };
    const wet = { ...raw, days: raw.days.map((d) => ({ ...d, weather: rainy })) };
    const it_ = enrichItinerary(wet, req, catalog);
    const chill = it_.days.find((d) => d.label === "chill")!;
    expect(chill.items[0].kind).toBe("shopping");
    expect(it_.days.flatMap((d) => d.items).some((i) => i.kind === "beach")).toBe(false);
    expect(it_.weatherNote).toMatch(/playa/);
    // One rainy day is not a rainy trip.
    const once = { ...raw, days: raw.days.map((d, i) => (i === 2 ? { ...d, weather: rainy } : d)) };
    expect(enrichItinerary(once, req, catalog).weatherNote).toBeUndefined();
  });
});
