import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/server/catalog/types";
import type { TripRequest } from "@/lib/trip-schema";
import { buildRulesItinerary } from "./rules";
import { fitBudget } from "./budget";

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
  product({ bokunId: 1, title: "Chichen Itza Deluxe", interests: ["cultural"], priceFromUsd: 200 }),
  product({ bokunId: 2, title: "Xcaret Plus", interests: ["adventure"], priceFromUsd: 180 }),
  product({ bokunId: 3, title: "Coba Ruins", interests: ["cultural"], priceFromUsd: 60 }),
  product({ bokunId: 4, title: "Jungle ATV", interests: ["adventure"], priceFromUsd: 55 }),
  product({ bokunId: 5, title: "Sunset Sail", interests: ["couples"], priceFromUsd: 40 }),
];

const request: TripRequest = {
  locale: "es",
  inbound: { date: "2026-12-10", source: "manual" },
  outbound: { date: "2026-12-14", source: "manual" },
  hotel: { noHotel: false, zone: "cancun" },
  preferPrivate: false,
  dining: { skip: false, cuisines: [], budgetPerMeal: 40 },
  transfers: { arrival: false, departure: false, luxury: false },
  travelers: [{ age: 30 }, { age: 30 }],
  interests: ["cultural", "adventure"],
  chillDays: "none",
  tourDays: "all",
  budgetPerPerson: 1000,
};

const spent = (it: ReturnType<typeof fitBudget>) =>
  it.days
    .flatMap((d) => d.items)
    .filter((i) => i.kind === "tour" || i.kind === "transfer")
    .reduce((s, i) => s + i.priceTotalUsd, 0);
const tourIds = (it: ReturnType<typeof fitBudget>) =>
  it.days
    .flatMap((d) => d.items)
    .filter((i) => i.kind === "tour")
    .map((i) => i.bokunId);

describe("fitBudget", () => {
  // Generous budget so the plan picks the pricey tours first.
  const rich = buildRulesItinerary({ request, products: catalog });

  it("leaves a plan within budget untouched", () => {
    expect(fitBudget(rich, request, catalog)).toBe(rich);
  });

  it("swaps pricey tours for cheaper ones of the same interests until it fits", () => {
    const tight = { ...request, budgetPerPerson: 130 };
    expect(spent(rich)).toBeGreaterThan(130 * 2);
    const fixed = fitBudget(rich, tight, catalog);
    expect(spent(fixed)).toBeLessThanOrEqual(130 * 2);
    expect(tourIds(fixed)).not.toContain(1);
    expect(tourIds(fixed)).not.toContain(2);
    expect(tourIds(fixed)).not.toContain(5); // couples isn't one of their interests
    expect(fixed.warnings.some((w) => w.startsWith("Over budget"))).toBe(true);
  });

  it("prefers tours the traveler hasn't seen when asking for another version", () => {
    const tight = { ...request, budgetPerPerson: 160 };
    const wider = [
      ...catalog,
      product({ bokunId: 6, title: "Ek Balam Visit", interests: ["cultural"], priceFromUsd: 50 }),
      product({ bokunId: 7, title: "Buggy Trail", interests: ["adventure"], priceFromUsd: 45 }),
      product({ bokunId: 8, title: "Mayan Town Walk", interests: ["cultural"], priceFromUsd: 40 }),
      product({ bokunId: 9, title: "Izamal Visit", interests: ["cultural"], priceFromUsd: 41 }),
      product({ bokunId: 10, title: "Jungle Bike", interests: ["adventure"], priceFromUsd: 46 }),
      product({ bokunId: 11, title: "Valladolid Walk", interests: ["cultural"], priceFromUsd: 42 }),
    ];
    const before = tourIds(rich);
    const first = tourIds(fitBudget(rich, tight, wider)).filter((id) => !before.includes(id));
    expect(first.length).toBeGreaterThan(0);

    const fixed = fitBudget(rich, tight, wider, first as number[]);
    expect(spent(fixed)).toBeLessThanOrEqual(160 * 2);
    expect(tourIds(fixed).some((id) => first.includes(id))).toBe(false);
  });

  it("still uses an avoided tour when it's the only one that fits", () => {
    const tight = { ...request, budgetPerPerson: 130 };
    const fixed = fitBudget(rich, tight, catalog, [3, 4]);
    expect(spent(fixed)).toBeLessThanOrEqual(130 * 2);
    expect(tourIds(fixed).length).toBeGreaterThan(0);
  });

  it("drops tours when nothing cheaper fits, but keeps at least one", () => {
    const broke = { ...request, budgetPerPerson: 10 };
    const fixed = fitBudget(rich, broke, catalog);
    expect(tourIds(fixed).length).toBe(1);
    expect(fixed.days.flatMap((d) => d.items).some((i) => i.kind === "free")).toBe(true);
  });
});