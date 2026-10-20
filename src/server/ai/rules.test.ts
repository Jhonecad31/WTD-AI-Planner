import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/server/catalog/types";
import type { TripRequest } from "@/lib/trip-schema";
import { ItinerarySchema } from "@/lib/itinerary-schema";
import { buildRulesItinerary, isRainyFavorite, isSeaTour, planDays } from "./rules";
import type { DayWeather } from "@/lib/itinerary-schema";
import { categoryForAge, fitsAges, priceProductForParty } from "./pricing";

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
    durationMinutes: 6 * 60,
    durationText: null,
    isMultiDay: false,
    priceFromUsd: 100,
    currency: "USD",
    pricingCategories: [
      { id: 1, title: "Adult", ticketCategory: "ADULT", minAge: 13, maxAge: 99, isDefault: true },
      { id: 2, title: "Child", ticketCategory: "CHILD", minAge: 4, maxAge: 12, isDefault: false },
    ],
    startTimes: [{ id: 10, time: "08:00", label: "08:00" }],
    bookingType: "DATE_AND_TIME",
    pickupService: true,
    pickupMinutesBefore: 30,
    pickupPlaces: [],
    imageUrl: null,
    imageUrls: [],
    rating: 4.8,
    reviewCount: 100,
    minAge: null,
    difficulty: null,
    included: null,
    excluded: null,
    knowBeforeYouGo: [],
    startLocation: null,
    bookingCutoffHours: null,
    published: true,
    lastModified: null,
    ...partial,
  };
}

const catalog: CatalogProduct[] = [
  product({ bokunId: 1, title: "Chichen Itza", interests: ["cultural"], priceFromUsd: 90 }),
  product({
    bokunId: 2,
    title: "Cenotes ATV",
    interests: ["adventure", "water"],
    priceFromUsd: 110,
  }),
  product({
    bokunId: 3,
    title: "Isla Mujeres Catamaran",
    interests: ["water", "couples"],
    priceFromUsd: 80,
  }),
  product({
    bokunId: 4,
    title: "Coco Bongo",
    interests: ["party"],
    priceFromUsd: 95,
    minAge: 18,
    pricingCategories: [
      { id: 9, title: "Adult", ticketCategory: "ADULT", minAge: 18, maxAge: 99, isDefault: true },
    ],
  }),
  product({
    bokunId: 5,
    title: "Airport Transfer Cancun Airport to Hotel Zone",
    kind: "transfer",
    interests: [],
    priceFromUsd: 45,
    pricingCategories: [
      {
        id: 7,
        title: "Transportation Price for Vehicle",
        ticketCategory: "OTHER",
        minAge: null,
        maxAge: null,
        isDefault: true,
      },
    ],
  }),
  product({ bokunId: 6, title: "Marketplace only", interests: ["cultural"], onSite: false }),
];

const request: TripRequest = {
  locale: "en",
  inbound: { date: "2026-12-10", time: "13:40", source: "manual" },
  outbound: { date: "2026-12-15", time: "16:00", source: "manual" },
  hotel: { noHotel: false, zone: "cancun" },
  preferPrivate: false,
  dining: { cuisines: [], budgetPerMeal: 40 },
  transfers: { arrival: true, departure: true, luxury: false },
  travelers: [{ age: 30 }, { age: 30 }, { age: 8 }],
  interests: ["adventure", "cultural", "water"],
  chillDays: "one",
  tourDays: "all",
  budgetPerPerson: 300,
};

describe("planDays", () => {
  it("labels arrival/departure and spreads chill days on full days only", () => {
    const days = planDays(request);
    expect(days.map((d) => d.label)).toEqual([
      "arrival",
      "full",
      "chill",
      "full",
      "full",
      "departure",
    ]);
    expect(days[0].dayNumber).toBe(1);
  });
  it("alternates chill days", () => {
    const days = planDays({ ...request, chillDays: "alternate" });
    expect(days.filter((d) => d.label === "chill")).toHaveLength(2);
  });
});

describe("pricing", () => {
  it("maps ages to Bokun pricing categories", () => {
    expect(categoryForAge(catalog[0].pricingCategories, 30)?.title).toBe("Adult");
    expect(categoryForAge(catalog[0].pricingCategories, 8)?.title).toBe("Child");
  });
  it("prices transfers once per vehicle, not per traveler", () => {
    const p = priceProductForParty(catalog[4], request.travelers);
    expect(p.priceTotalUsd).toBe(45);
    expect(p.pricing).toEqual([
      { pricingCategoryId: 7, title: "Transportation Price for Vehicle", count: 1, unitUsd: 45 },
    ]);
  });

  it("prices the party with a child estimate", () => {
    const p = priceProductForParty(catalog[0], request.travelers);
    expect(p.pricing).toEqual([
      { pricingCategoryId: 1, title: "Adult", count: 2, unitUsd: 90 },
      { pricingCategoryId: 2, title: "Child", count: 1, unitUsd: 63 },
    ]);
    expect(p.priceTotalUsd).toBe(243);
  });
});

describe("fitsAges", () => {
  it("excludes 18+ products when a child travels, even if party was requested", () => {
    expect(fitsAges(catalog[3], request.travelers)).toBe(false);
    expect(fitsAges(catalog[3], [{ age: 30 }, { age: 25 }])).toBe(true);
    expect(fitsAges(catalog[0], request.travelers)).toBe(true);
    const party = buildRulesItinerary({
      request: { ...request, interests: ["party"] },
      products: catalog,
    });
    const ids = party.days.flatMap((d) => d.items.map((i) => i.bokunId));
    expect(ids).not.toContain(4);
  });
});

describe("buildRulesItinerary", () => {
  const it_ = buildRulesItinerary({ request, products: catalog });

  it("produces a schema-valid itinerary", () => {
    expect(ItinerarySchema.safeParse(it_).success).toBe(true);
    expect(it_.generatedBy).toBe("rules");
  });

  it("never uses products that are not on the website", () => {
    const ids = it_.days.flatMap((d) => d.items.map((i) => i.bokunId));
    expect(ids).not.toContain(6);
  });

  it("adds transfers on arrival and departure days, without a fixed time", () => {
    expect(it_.days[0].items[0]).toMatchObject({ kind: "transfer", bokunId: 5 });
    expect(it_.days[0].items[0].startTime).toBeUndefined();
    const last = it_.days[it_.days.length - 1];
    expect(last.items.at(-1)).toMatchObject({ kind: "transfer", bokunId: 5 });
  });

  it("skips tours on the arrival day and keeps the chill day free", () => {
    expect(it_.days[0].items.some((i) => i.kind === "tour")).toBe(false);
    const chill = it_.days.find((d) => d.label === "chill")!;
    expect(chill.items).toEqual([
      { kind: "free", title: "Chill day", priceTotalUsd: 0, pricing: [], pickup: false },
    ]);
  });

  it("covers every requested interest before repeating and respects budget", () => {
    const tours = it_.days.flatMap((d) => d.items).filter((i) => i.kind === "tour");
    const covered = new Set(
      tours.flatMap((t) => catalog.find((p) => p.bokunId === t.bokunId)!.interests),
    );
    for (const i of request.interests) expect(covered.has(i)).toBe(true);
    expect(tours.map((t) => t.bokunId)).not.toContain(4); // party not requested
    expect(it_.totals.perPersonUsd).toBeLessThanOrEqual(request.budgetPerPerson);
    expect(it_.totals.withinBudget).toBe(true);
    expect(it_.totals.totalUsd).toBe(it_.totals.toursUsd + it_.totals.transfersUsd);
  });

  it("respects an availability callback", () => {
    const blocked = buildRulesItinerary({
      request,
      products: catalog,
      isAvailable: (id) => id !== 2,
    });
    const ids = blocked.days.flatMap((d) => d.items.map((i) => i.bokunId));
    expect(ids).not.toContain(2);
  });
});

describe("buildRulesItinerary with dates only (no flight times)", () => {
  const datesOnly: TripRequest = {
    ...request,
    inbound: { date: "2026-12-10", source: "manual" },
    outbound: { date: "2026-12-15", source: "manual" },
  };
  const it_ = buildRulesItinerary({ request: datesOnly, products: catalog });

  it("is schema-valid", () => {
    expect(ItinerarySchema.safeParse(it_).success).toBe(true);
  });

  it("keeps arrival and departure days for transfers only, without a time", () => {
    const first = it_.days[0];
    const last = it_.days[it_.days.length - 1];
    for (const day of [first, last]) {
      expect(day.items.some((i) => i.kind === "tour")).toBe(false);
      const transfer = day.items.find((i) => i.kind === "transfer");
      expect(transfer?.startTime).toBeUndefined();
    }
  });
});

describe("weather-aware picking", () => {
  const extreme = [
    product({
      bokunId: 7,
      title: "ATV, Ziplining & Cenote Tour at Extreme Adventure Eco Park",
      interests: ["adventure", "water"],
      priceFromUsd: 100,
    }),
    product({
      bokunId: 8,
      title: "Extreme Buggy Adventure with Ziplines & Cenote",
      interests: ["adventure"],
      priceFromUsd: 100,
    }),
  ];
  const withExtreme = [...catalog, ...extreme];
  const w = (kind: DayWeather["kind"]): DayWeather => ({
    source: "forecast",
    kind,
    tMaxC: 29,
    tMinC: 23,
  });
  const generous: TripRequest = { ...request, budgetPerPerson: 1000 };
  const tourOn = (it: ReturnType<typeof buildRulesItinerary>, date: string) =>
    it.days.find((d) => d.date === date)!.items.find((i) => i.kind === "tour");

  it("tells sea tours from cenote and park tours", () => {
    expect(isSeaTour({ title: "Isla Mujeres Catamaran" })).toBe(true);
    expect(isSeaTour({ title: "Puerto Morelos Reef Snorkeling" })).toBe(true);
    expect(isSeaTour({ title: "Cenote Snorkel Adventure" })).toBe(false);
    expect(isSeaTour(extreme[0])).toBe(false);
    expect(isRainyFavorite(extreme[1])).toBe(true);
  });

  it("puts Extreme Adventure on a rainy day and avoids sea tours on a windy one", () => {
    // Dec 12 is the chill day; tours land on 11, 13 and 14.
    const it_ = buildRulesItinerary({
      request: generous,
      products: withExtreme,
      weather: { "2026-12-11": w("rainy"), "2026-12-13": w("windy"), "2026-12-14": w("good") },
    });
    expect([7, 8]).toContain(tourOn(it_, "2026-12-11")?.bokunId);
    expect(tourOn(it_, "2026-12-13")?.bokunId).not.toBe(3);
    expect(it_.days.find((d) => d.date === "2026-12-11")?.weather?.kind).toBe("rainy");
  });

  it("uses both park tours on two rainy days and avoids the sea on the third", () => {
    const it_ = buildRulesItinerary({
      request: generous,
      products: withExtreme,
      weather: { "2026-12-11": w("rainy"), "2026-12-13": w("rainy"), "2026-12-14": w("rainy") },
    });
    const ids = ["2026-12-11", "2026-12-13", "2026-12-14"].map((d) => tourOn(it_, d)?.bokunId);
    expect(ids.filter((id) => id === 7 || id === 8)).toHaveLength(2);
    expect(ids).not.toContain(3);
  });
});
