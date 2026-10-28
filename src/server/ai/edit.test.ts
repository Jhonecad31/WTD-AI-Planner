import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/server/catalog/types";
import type { AvailabilitySlot } from "@/server/catalog/availability";
import type { TripRequest } from "@/lib/trip-schema";
import { buildRulesItinerary } from "./rules";
import { alternativesForDay, checkDay, moveTour, replaceTour } from "./edit";

function product(
  partial: Partial<CatalogProduct> & { bokunId: number; title: string },
): CatalogProduct {
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
    durationMinutes: 6 * 60,
    durationText: null,
    isMultiDay: false,
    priceFromUsd: 100,
    currency: "USD",
    pricingCategories: [
      { id: 1, title: "Adult", ticketCategory: "ADULT", minAge: 13, maxAge: 99, isDefault: true },
    ],
    startTimes: [{ id: 10, time: "08:00", label: "08:00" }],
    bookingType: "DATE_AND_TIME",
    pickupService: true,
    pickupMinutesBefore: 30,
    pickupPlaces: [],
    imageUrl: null,
    imageUrls: [],
    rating: 4.8,
    reviewCount: 10,
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

const products = [
  product({ bokunId: 1, title: "Tour A", interests: ["adventure"] }),
  product({ bokunId: 2, title: "Tour B", interests: ["cultural"] }),
  product({ bokunId: 3, title: "Tour C", interests: ["water"] }),
  product({ bokunId: 4, title: "Tour D", interests: ["adventure", "water"] }),
];

const request: TripRequest = {
  locale: "en",
  inbound: { date: "2026-12-10", time: "13:40", source: "manual" },
  outbound: { date: "2026-12-14", time: "16:00", source: "manual" },
  hotel: { noHotel: false, zone: "cancun" },
  preferPrivate: false,
  dining: { skip: false, cuisines: [], budgetPerMeal: 40 },
  transfers: { arrival: false, departure: false, luxury: false },
  travelers: [{ age: 30 }, { age: 30 }],
  interests: ["adventure", "cultural", "water"],
  chillDays: "none",
  tourDays: "all",
  budgetPerPerson: 500,
};

const slot = (date: string, extra: Partial<AvailabilitySlot> = {}): AvailabilitySlot => ({
  date,
  startTimeId: 10,
  time: "08:00",
  seatsLeft: 10,
  soldOut: false,
  pricesByCategory: {},
  defaultPrice: null,
  pickupPrice: null,
  minParticipants: null,
  ...extra,
});

/** Tour 3 is sold out on the 12th; tour 2 has no departures on the 13th. */
const lookup = async (id: number, date: string) => {
  if (id === 3 && date === "2026-12-12") return [slot(date, { soldOut: true })];
  if (id === 2 && date === "2026-12-13") return [];
  return [slot(date)];
};

describe("checkDay", () => {
  it("rejects days outside the trip, sold-out days and short arrival days", async () => {
    expect((await checkDay(products[0], "2026-12-20", request, lookup)).reason).toBe("not_in_trip");
    expect((await checkDay(products[2], "2026-12-12", request, lookup)).reason).toBe("sold_out");
    expect((await checkDay(products[1], "2026-12-13", request, lookup)).reason).toBe("no_slots");
    expect((await checkDay(products[0], "2026-12-10", request, lookup)).reason).toBe(
      "does_not_fit",
    );
    expect((await checkDay(products[0], "2026-12-11", request, lookup)).ok).toBe(true);
  });
});

describe("edits", () => {
  const base = buildRulesItinerary({ request, products });
  const tourOn = (it: typeof base, date: string) =>
    it.days.find((d) => d.date === date)!.items.find((i) => i.kind === "tour")?.bokunId;

  it("moves a tour to another day and swaps the displaced one back", async () => {
    const a = tourOn(base, "2026-12-11");
    const b = tourOn(base, "2026-12-12");
    expect(a && b && a !== b).toBe(true);
    const r = await moveTour(
      base,
      request,
      products,
      { bokunId: a!, fromDate: "2026-12-11", toDate: "2026-12-12" },
      lookup,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(tourOn(r.itinerary, "2026-12-12")).toBe(a);
    expect(tourOn(r.itinerary, "2026-12-11")).toBe(b);
    expect(r.itinerary.totals.totalUsd).toBe(base.totals.totalUsd);
  });

  it("refuses a move when the target day is sold out", async () => {
    const r = await moveTour(
      base,
      request,
      products,
      { bokunId: 3, fromDate: "2026-12-13", toDate: "2026-12-12" },
      lookup,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.check.reason).toBe("sold_out");
  });

  it("turns a tour day into a chill day and back", async () => {
    const chill = await replaceTour(
      base,
      request,
      products,
      { date: "2026-12-11", bokunId: null },
      lookup,
    );
    expect(chill.ok).toBe(true);
    if (!chill.ok) return;
    const day = chill.itinerary.days.find((d) => d.date === "2026-12-11")!;
    expect(day.label).toBe("chill");
    // Chill days get a beach (or shopping) block; no tour, nothing charged.
    expect(day.items[0]).toEqual(expect.objectContaining({ kind: "beach", priceTotalUsd: 0 }));
    expect(day.items.some((i) => i.kind === "tour")).toBe(false);
    expect(chill.itinerary.totals.totalUsd).toBeLessThan(base.totals.totalUsd);

    const back = await replaceTour(
      chill.itinerary,
      request,
      products,
      { date: "2026-12-11", bokunId: 4 },
      lookup,
    );
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(tourOn(back.itinerary, "2026-12-11")).toBe(4);
    expect(back.itinerary.days.find((d) => d.date === "2026-12-11")!.label).toBe("full");
  });

  it("lists alternatives for a day with availability flags, excluding tours already used", async () => {
    const alts = await alternativesForDay(base, request, products, "2026-12-12", lookup);
    const ids = alts.map((a) => a.bokunId);
    expect(ids).not.toContain(tourOn(base, "2026-12-12"));
    for (const id of base.days.flatMap((d) => d.items.map((i) => i.bokunId))) {
      expect(ids).not.toContain(id);
    }
    expect(alts.every((a) => typeof a.available === "boolean")).toBe(true);
  });
});