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
  dining: { cuisines: [], budgetPerMeal: 40 },
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

  it("drops tours when nothing cheaper fits, but keeps at least one", () => {
    const broke = { ...request, budgetPerPerson: 10 };
    const fixed = fitBudget(rich, broke, catalog);
    expect(tourIds(fixed).length).toBe(1);
    expect(fixed.days.flatMap((d) => d.items).some((i) => i.kind === "free")).toBe(true);
  });
});
