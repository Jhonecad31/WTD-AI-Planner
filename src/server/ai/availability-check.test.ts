import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/server/catalog/types";
import type { AvailabilitySlot } from "@/server/catalog/availability";
import type { TripRequest } from "@/lib/trip-schema";
import { buildRulesItinerary } from "./rules";
import { verifyAvailability } from "./availability-check";

function product(p: Partial<CatalogProduct> & { bokunId: number; title: string }): CatalogProduct {
  return {
    slug: null,
    siteUrl: null,
    onSite: true,
    extranetUrl: "",
    kind: "tour",
    excerpt: "",
    description: "",
    interests: ["adventure"],
    bokunCategories: [],
    keywords: [],
    durationMinutes: 300,
    durationText: null,
    isMultiDay: false,
    priceFromUsd: 100,
    currency: "USD",
    pricingCategories: [
      { id: 1, title: "Adult", ticketCategory: "ADULT", minAge: 13, maxAge: 99, isDefault: true },
    ],
    prices: [],
    startTimes: [{ id: 9, time: "08:00", label: "08:00" }],
    pickupService: false,
    pickupMinutesBefore: null,
    pickupPlaces: [],
    imageUrl: null,
    imageUrls: [],
    rating: null,
    reviewCount: 0,
    minAge: null,
    bookingType: "DATE_AND_TIME",
    ...p,
  } as CatalogProduct;
}

const catalog = [
  product({ bokunId: 1, title: "Jungle ATV", reviewCount: 900 }),
  product({ bokunId: 2, title: "Zipline Park", reviewCount: 500 }),
  product({ bokunId: 3, title: "Cenote Swim", reviewCount: 100 }),
];
const request: TripRequest = {
  locale: "es",
  inbound: { date: "2026-12-10", source: "manual" },
  outbound: { date: "2026-12-13", source: "manual" },
  hotel: { noHotel: false, zone: "cancun" },
  transfers: { arrival: false, departure: false, luxury: false },
  travelers: [{ age: 30 }, { age: 30 }],
  interests: ["adventure"],
  preferPrivate: false,
  chillDays: "none",
  tourDays: "all",
  budgetPerPerson: 1000,
  dining: { cuisines: [], budgetPerMeal: 40 },
};
const slot = (date: string, extra: Partial<AvailabilitySlot> = {}): AvailabilitySlot => ({
  date,
  startTimeId: 77,
  time: "09:15",
  seatsLeft: 10,
  soldOut: false,
  pricesByCategory: {},
  defaultPrice: null,
  pickupPrice: null,
  minParticipants: null,
  ...extra,
});
const tourOn = (
  it: {
    days: {
      date: string;
      items: { kind: string; bokunId?: number; startTime?: string; note?: string }[];
      notices?: string[];
    }[];
  },
  date: string,
) => it.days.find((d) => d.date === date)!.items.find((i) => i.kind === "tour");

describe("verifyAvailability", () => {
  const raw = buildRulesItinerary({ request, products: catalog });
  const firstTourDate = raw.days.find((d) => d.items.some((i) => i.kind === "tour"))!.date;
  const firstId = tourOn(raw, firstTourDate)!.bokunId!;

  it("keeps available tours and uses Bokun's real start time", async () => {
    const { itinerary, report } = await verifyAvailability(
      raw,
      request,
      catalog,
      async (_id, d) => [slot(d)],
    );
    expect(report.replaced).toBe(0);
    expect(tourOn(itinerary, firstTourDate)?.startTime).toBe("09:15");
  });

  it("moves a tour to another trip day where it runs before replacing it", async () => {
    const lookup = async (id: number, d: string) =>
      id === firstId && d === firstTourDate ? [] : [slot(d)];
    const { itinerary, report } = await verifyAvailability(raw, request, catalog, lookup);
    expect(report.moved).toBe(1);
    expect(report.replaced).toBe(0);
    expect(tourOn(itinerary, firstTourDate)?.bokunId).not.toBe(firstId);
    const ids = itinerary.days.flatMap((d) => d.items.map((i) => i.bokunId)).filter(Boolean);
    expect(ids).toContain(firstId);
    expect(itinerary.days.filter((d) => d.notices?.length)).toHaveLength(2);
  });

  it("swaps a tour sold out on every day for an available one and explains why", async () => {
    const lookup = async (id: number, d: string) =>
      id === firstId ? [slot(d, { soldOut: true })] : [slot(d)];
    const { itinerary, report } = await verifyAvailability(raw, request, catalog, lookup);
    expect(report.replaced).toBe(1);
    const t = tourOn(itinerary, firstTourDate)!;
    expect(t.bokunId).not.toBe(firstId);
    const day = itinerary.days.find((d) => d.date === firstTourDate)!;
    expect(day.notices?.[0]).toMatch(/Cambiamos .* porque/);
    const ids = itinerary.days.flatMap((d) => d.items.map((i) => i.bokunId)).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("drops Bokun's 00:00 placeholder time for all-day admissions", async () => {
    const { itinerary } = await verifyAvailability(raw, request, catalog, async (_id, d) => [
      slot(d, { time: "00:00" }),
    ]);
    expect(tourOn(itinerary, firstTourDate)?.startTime).toBeUndefined();
  });

  it("leaves the day free when nothing has seats, and keeps tours when Bokun fails", async () => {
    const none = await verifyAvailability(raw, request, catalog, async () => []);
    expect(none.itinerary.days.flatMap((d) => d.items).some((i) => i.kind === "tour")).toBe(false);
    const down = await verifyAvailability(raw, request, catalog, async () => {
      throw new Error("timeout");
    });
    expect(down.report.unverified).toBeGreaterThan(0);
    expect(tourOn(down.itinerary, firstTourDate)?.bokunId).toBe(firstId);
  });
});
