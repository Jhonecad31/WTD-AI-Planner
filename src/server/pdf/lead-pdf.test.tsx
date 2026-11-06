import { describe, expect, it, vi } from "vitest";
import type { LeadRecord } from "@/lib/lead-schema";
import type { CatalogProduct } from "@/server/catalog/types";
import { buildLeadPdfModel, renderLeadPdf } from "./lead-pdf";

const product = (over: Partial<CatalogProduct>): CatalogProduct => ({
  bokunId: 1,
  title: "x",
  slug: null,
  siteUrl: null,
  onSite: true,
  extranetUrl: "https://extranet.bokun.io/experience/1",
  kind: "tour",
  excerpt: "",
  description: "",
  interests: [],
  bokunCategories: [],
  keywords: [],
  durationMinutes: null,
  durationText: null,
  isMultiDay: false,
  priceFromUsd: null,
  currency: "USD",
  pricingCategories: [],
  startTimes: [],
  bookingType: null,
  pickupService: false,
  pickupMinutesBefore: null,
  pickupPlaces: [],
  imageUrl: null,
  imageUrls: [],
  rating: null,
  reviewCount: 0,
  minAge: null,
  difficulty: null,
  included: null,
  excluded: null,
  knowBeforeYouGo: [],
  startLocation: null,
  bookingCutoffHours: null,
  published: true,
  lastModified: null,
  ...over,
});

const products: CatalogProduct[] = [
  product({
    bokunId: 725897,
    title: "Puerto Morelos tacos",
    siteUrl: "https://whattodoincancun.com/tour/city-taco-tour-puerto-morelos/",
    extranetUrl: "https://extranet.bokun.io/experience/725897",
    pickupService: true,
    pickupMinutesBefore: 30,
    bookingCutoffHours: 12,
  }),
  product({
    bokunId: 500,
    kind: "transfer",
    title: "Airport transfer",
    extranetUrl: "https://extranet.bokun.io/experience/500",
  }),
];

const lead: LeadRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  ref: "WTD-TEST1",
  token: "tok",
  createdAt: "2026-11-06T10:00:00.000Z",
  status: "new",
  name: "Ana García",
  email: "ana@example.com",
  phone: "+52 998 123 4567",
  locale: "es",
  consentAt: "2026-11-06T10:00:00.000Z",
  engine: "claude",
  totalUsd: 420,
  pdfPath: null,
  agentPdfPath: null,
  notes: [],
  bokunConfirmationCodes: [],
  request: {
    locale: "es",
    inbound: {
      date: "2027-01-10",
      time: "14:35",
      flightNumber: "AM123",
      otherAirport: "MEX",
      source: "manual",
    },
    outbound: { date: "2027-01-13", slot: "morning", source: "manual" },
    hotel: { noHotel: false, zone: "playa_del_carmen", name: "Hotel Xcaret" },
    transfers: { arrival: true, departure: false, luxury: false },
    travelers: [{ age: 35, name: "Ana" }, { age: 34 }, { age: 8 }, { age: 2 }],
    travelerTitle: "ms",
    interests: ["adventure", "food"],
    avoidTypes: ["dolphin", "whale_shark", "atv"],
    preferPrivate: true,
    chillDays: "one",
    tourDays: "all",
    budgetPerPerson: 200,
    dining: { skip: false, cuisines: ["mexican", "seafood"], budgetPerMeal: 45 },
    notes: "Celebrating our anniversary. Daughter is allergic to peanuts.",
  },
  itinerary: {
    version: 1,
    generatedBy: "claude",
    locale: "es",
    summary: "Tres noches en Playa.",
    introWarnings: ["Some activities are not suited to the 2-year-old."],
    warnings: ["no availability data for 725897"],
    totals: {
      toursUsd: 320,
      transfersUsd: 100,
      totalUsd: 420,
      perPersonUsd: 105,
      budgetPerPersonUsd: 200,
      withinBudget: true,
      diningEstimateUsd: 270,
    },
    days: [
      {
        date: "2027-01-10",
        dayNumber: 1,
        label: "arrival",
        title: "Llegada",
        items: [
          {
            kind: "transfer",
            bokunId: 500,
            title: "Airport transfer",
            priceTotalUsd: 100,
            pricing: [{ pricingCategoryId: 9, title: "Vehicle", count: 1, unitUsd: 100 }],
            pickup: false,
          },
        ],
      },
      {
        date: "2027-01-11",
        dayNumber: 2,
        label: "full",
        title: "Tacos",
        notices: ["Moved to 10:00 for availability."],
        items: [
          {
            kind: "tour",
            bokunId: 725897,
            title: "Puerto Morelos tacos",
            startTime: "10:00",
            startTimeId: 2291759,
            durationMinutes: 300,
            priceTotalUsd: 320,
            pricing: [
              { pricingCategoryId: 660641, title: "Adult", count: 2, unitUsd: 120 },
              { pricingCategoryId: 660642, title: "Child", count: 1, unitUsd: 80 },
            ],
            pickup: true,
            note: "Arranque tranquilo.",
          },
          {
            kind: "restaurant",
            bokunId: 999,
            title: "La Cueva del Chango",
            startTime: "19:30",
            priceTotalUsd: 0,
            pricing: [],
            pickup: false,
            cuisines: ["mexican"],
            priceLevel: 2,
            priceEstimatePpUsd: 45,
            siteUrl: "https://whattodoincancun.com/restaurant/la-cueva/",
          },
        ],
      },
      {
        date: "2027-01-12",
        dayNumber: 3,
        label: "chill",
        title: "Playa",
        items: [{ kind: "beach", title: "Playa", priceTotalUsd: 0, pricing: [], pickup: false }],
      },
    ],
  },
};

describe("buildLeadPdfModel", () => {
  const m = buildLeadPdfModel(lead, products);

  it("carries the contact data and reference", () => {
    expect(m.ref).toBe("WTD-TEST1");
    expect(m.contact).toEqual({
      name: "Ana García",
      email: "ana@example.com",
      phone: "+52 998 123 4567",
      language: "Spanish (ES)",
    });
    expect(m.engine).toBe("claude");
  });

  it("describes both flights with time or slot, flight number and airport", () => {
    expect(m.flights.arrival).toMatchObject({
      date: "2027-01-10",
      timeText: "14:35",
      flightNumber: "AM123",
      airport: "MEX",
      transfer: true,
    });
    expect(m.flights.departure).toMatchObject({
      date: "2027-01-13",
      timeText: "morning",
      flightNumber: null,
      transfer: false,
    });
    expect(m.trip.nights).toBe(3);
  });

  it("shows the hotel name and zone, or the planning zone when there is no hotel", () => {
    expect(m.hotel).toEqual({
      noHotel: false,
      name: "Hotel Xcaret",
      zone: "Playa del Carmen",
      planningZone: "Playa del Carmen",
    });
    const noHotel = buildLeadPdfModel(
      { ...lead, request: { ...lead.request, hotel: { noHotel: true } } },
      products,
    );
    expect(noHotel.hotel).toEqual({
      noHotel: true,
      name: null,
      zone: null,
      planningZone: "Cancun",
    });
  });

  it("counts adults and children with their ages", () => {
    expect(m.pax).toEqual({
      total: 4,
      adults: 2,
      children: 2,
      childAges: [8, 2],
      named: [{ name: "Ana", age: 35 }],
      travelerTitle: "ms",
    });
  });

  it("compares the itinerary spend with the budget", () => {
    expect(m.budget).toMatchObject({
      perPersonUsd: 200,
      totalUsd: 800,
      itineraryTotalUsd: 420,
      itineraryPerPersonUsd: 105,
      diffUsd: -380,
      withinBudget: true,
      diningEstimateUsd: 270,
    });
  });

  it("lists every tour and transfer with pricing lines, pickup and Bokun links", () => {
    expect(m.bookings.map((b) => b.kind)).toEqual(["transfer", "tour"]);
    const tour = m.bookings[1];
    expect(tour).toMatchObject({
      date: "2027-01-11",
      dayNumber: 2,
      startTime: "10:00",
      startTimeId: 2291759,
      bokunId: 725897,
      pickup: true,
      pickupMinutesBefore: 30,
      bookingCutoffHours: 12,
      priceTotalUsd: 320,
      extranetUrl: "https://extranet.bokun.io/experience/725897",
      siteUrl: "https://whattodoincancun.com/tour/city-taco-tour-puerto-morelos/",
      inCatalog: true,
    });
    expect(tour.pricing).toEqual([
      { pricingCategoryId: 660641, title: "Adult", count: 2, unitUsd: 120, subtotalUsd: 240 },
      { pricingCategoryId: 660642, title: "Child", count: 1, unitUsd: 80, subtotalUsd: 80 },
    ]);
  });

  it("lists restaurants apart, keeping the site link and falling back to the extranet URL", () => {
    expect(m.dinners).toHaveLength(1);
    expect(m.dinners[0]).toMatchObject({
      title: "La Cueva del Chango",
      startTime: "19:30",
      cuisines: ["mexican"],
      priceLevel: 2,
      priceEstimatePpUsd: 45,
      siteUrl: "https://whattodoincancun.com/restaurant/la-cueva/",
      // Not in the catalog passed in: the link is built from the Bokun id.
      extranetUrl: "https://extranet.bokun.io/experience/999",
      inCatalog: false,
    });
  });

  it("keeps the traveler's preferences, dinners and notes", () => {
    expect(m.preferences).toEqual({
      interests: ["Adventure", "Food & drinks"],
      avoid: ["Dolphins & whale sharks", "ATV"],
      preferPrivate: true,
      chillDays: "one chill day",
      tourDays: "all full days",
      restDates: [],
      dining: { skip: false, cuisines: ["Mexican", "Seafood"], budgetPerMealUsd: 45 },
      notes: "Celebrating our anniversary. Daughter is allergic to peanuts.",
    });
    expect(m.introWarnings).toEqual(["Some activities are not suited to the 2-year-old."]);
    expect(m.systemWarnings).toEqual(["no availability data for 725897"]);
    expect(m.dayNotices).toEqual([
      { date: "2027-01-11", notices: ["Moved to 10:00 for availability."] },
    ]);
  });
});

describe("renderLeadPdf", () => {
  it("renders a PDF document", async () => {
    const bytes = await renderLeadPdf(lead, products);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  }, 30_000);
});

describe("sendLeadEmails", () => {
  it("attaches the itinerary PDF to the traveler and the lead PDF to sales", async () => {
    vi.stubEnv("VERCEL", "1"); // no local outbox writes
    const { sendLeadEmails } = await import("@/server/email");
    const emails = await sendLeadEmails(lead, {
      customer: new Uint8Array([1]),
      agent: new Uint8Array([2]),
    });
    const customer = emails.find((e) => e.kind === "customer")!;
    const agent = emails.find((e) => e.kind === "agent")!;
    expect(customer.attachments.map((a) => a.filename)).toEqual([
      "WhatToDo-itinerary-WTD-TEST1.pdf",
    ]);
    expect(agent.attachments.map((a) => a.filename)).toEqual(["WhatToDo-lead-WTD-TEST1.pdf"]);
    vi.unstubAllEnvs();
  });
});
