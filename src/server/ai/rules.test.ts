import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/server/catalog/types";
import type { TripRequest } from "@/lib/trip-schema";
import { ItinerarySchema } from "@/lib/itinerary-schema";
import {
  buildRulesItinerary,
  isRainyFavorite,
  isAvoided,
  isSeaTour,
  longTourOk,
  partyAllowed,
  planDays,
  withinBudget,
  scoreOpts,
  scoreProduct,
  toItem,
  transferFor,
} from "./rules";
import { validateAndRepair } from "./validate";
import { diversify } from "./diversify";
import { mainExperience } from "@/server/catalog/experience";
import type { DayWeather } from "@/lib/itinerary-schema";
import { categoryForAge, fitsAges, priceProductForParty } from "./pricing";
import { pickCandidates } from "./claude";

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
  dining: { skip: false, cuisines: [], budgetPerMeal: 40 },
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
    // The budget covers tours only; transfers are added on top.
    expect(it_.totals.toursUsd / request.travelers.length).toBeLessThanOrEqual(
      request.budgetPerPerson,
    );
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
      title: "Cenotes Adventuring Park",
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

  it("doesn't repeat an ATV day even when both rainy favorites are ATV parks", () => {
    const buggy = product({
      bokunId: 9,
      title: "Extreme Buggy Adventure with Ziplines",
      interests: ["adventure"],
      priceFromUsd: 100,
    });
    const it_ = buildRulesItinerary({
      request: generous,
      products: [...catalog, extreme[0], buggy],
      weather: { "2026-12-11": w("rainy"), "2026-12-13": w("rainy") },
    });
    const ids = ["2026-12-11", "2026-12-13"].map((d) => tourOn(it_, d)?.bokunId);
    expect(ids.filter((id) => id === 7 || id === 9)).toHaveLength(1);
  });
});

describe("scoreProduct follows what the tour mainly is", () => {
  it("ranks a focused tour of the asked interest above a many-tag park", () => {
    const ruins = product({ bokunId: 51, title: "Coba Ruins", interests: ["cultural"] });
    const park = product({
      bokunId: 52,
      title: "Xcaret Plus Admission",
      interests: ["parks", "adventure", "water", "cultural", "beach"],
    });
    const dolphins = product({
      bokunId: 53,
      title: "Dolphin Discovery Tulum",
      interests: ["water", "adventure", "cultural"],
    });
    const forCulture = (p: CatalogProduct) => scoreProduct(p, ["cultural"]);
    expect(forCulture(ruins)).toBeGreaterThan(forCulture(park));
    expect(forCulture(ruins)).toBeGreaterThan(forCulture(dolphins));
    // Still on the list (it touches the interest), just lower.
    expect(forCulture(dolphins)).toBeGreaterThan(0);
    expect(scoreProduct(ruins, ["water"])).toBe(0);
  });

  it("gives the main interest more than several secondary ones", () => {
    const atv = product({ bokunId: 54, title: "ATV Jungle Adventure", interests: ["adventure"] });
    const combo = product({
      bokunId: 55,
      title: "Chichen Itza with Cenote & Tequila",
      interests: ["cultural", "water", "food"],
    });
    // Asked for adventure + water + food: the ATV is what they mean by adventure.
    expect(scoreProduct(atv, ["adventure", "water", "food"])).toBeGreaterThan(
      scoreProduct(combo, ["adventure", "water", "food"]),
    );
  });
});

describe("variety", () => {
  it("never plans two tours of the same kind when others fit", () => {
    const products = [
      product({ bokunId: 31, title: "Jungle ATV & Zipline", interests: ["adventure"] }),
      product({ bokunId: 32, title: "ATV Private Signature", interests: ["adventure"] }),
      product({ bokunId: 33, title: "Hidden Cenotes Swim", interests: ["water", "adventure"] }),
      product({ bokunId: 34, title: "Semi-private 3 Cenotes", interests: ["water", "adventure"] }),
      product({ bokunId: 35, title: "Coba Ruins", interests: ["cultural"] }),
      product({ bokunId: 36, title: "Isla Mujeres Catamaran", interests: ["water"] }),
    ];
    const it_ = buildRulesItinerary({
      request: { ...request, budgetPerPerson: 1000, interests: ["adventure", "water"] },
      products,
    });
    const tours = it_.days.flatMap((d) => d.items).filter((i) => i.kind === "tour");
    const main = tours.map((t) => mainExperience(t));
    expect(tours).toHaveLength(3);
    expect(new Set(main).size).toBe(main.length);
  });

  it("swaps a repeated kind of day the engine chose for a different tour", () => {
    const products = [
      product({ bokunId: 41, title: "3 Hidden Cenotes", interests: ["water", "adventure"] }),
      product({ bokunId: 42, title: "Semi-private Cenotes", interests: ["water", "adventure"] }),
      product({ bokunId: 43, title: "Coba Ruins", interests: ["cultural"] }),
      product({ bokunId: 44, title: "Isla Mujeres Catamaran", interests: ["water"] }),
      product({ bokunId: 45, title: "Jungle ATV", interests: ["adventure"] }),
      product({ bokunId: 46, title: "Speedboat Safari", interests: ["adventure", "water"] }),
    ];
    const req = {
      ...request,
      budgetPerPerson: 1000,
      interests: ["adventure" as const, "water" as const],
    };
    const raw = buildRulesItinerary({ request: req, products });
    const tourDays = raw.days.filter((d) => d.items.some((i) => i.kind === "tour"));
    // Pretend the engine planned two cenote days in a row.
    const [a, b] = tourDays;
    const forced = {
      ...raw,
      days: raw.days.map((d) =>
        d === a || d === b
          ? {
              ...d,
              items: d.items.map((i) =>
                i.kind === "tour" ? toItem(products[d === a ? 0 : 1], req, d) : i,
              ),
            }
          : d,
      ),
    };
    const out = diversify(forced, req, products);
    const ids = out.days
      .flatMap((d) => d.items)
      .filter((i) => i.kind === "tour")
      .map((i) => i.bokunId);
    expect(ids).toContain(41);
    expect(ids).not.toContain(42);
    expect(out.warnings.some((w) => w.startsWith("Variety:"))).toBe(true);
  });

  it("plans different sites of the same family, not the same site twice", () => {
    const products = [
      product({
        bokunId: 71,
        title: "Chichen Itza Classic Cenote & Valladolid",
        interests: ["cultural", "water"],
      }),
      product({
        bokunId: 72,
        title: "Chichen Itza Deluxe with Cenote & Valladolid",
        interests: ["cultural", "water"],
      }),
      product({
        bokunId: 73,
        title: "Tulum, Coba and Cenote Kuxtal",
        interests: ["cultural", "water"],
      }),
      product({ bokunId: 74, title: "Ek Balam Mayan Traditions", interests: ["cultural"] }),
      product({ bokunId: 75, title: "Xcaret Plus Admission", interests: ["parks", "cultural"] }),
    ];
    const it_ = buildRulesItinerary({
      request: { ...request, budgetPerPerson: 1000, interests: ["cultural"] },
      products,
    });
    const ids = it_.days
      .flatMap((d) => d.items)
      .filter((i) => i.kind === "tour")
      .map((i) => i.bokunId);
    expect(ids.sort()).toEqual([71, 73, 74]);
  });

  it("ranks tours near the hotel zone above the same tour far down the coast", () => {
    const near = product({
      bokunId: 91,
      title: "Dolphin Discovery in Cancun",
      interests: ["water"],
    });
    const far = product({
      bokunId: 92,
      title: "Dolphin Discovery Tulum - Akumal",
      interests: ["water"],
    });
    const cancun = scoreOpts({ ...request, hotel: { noHotel: false, zone: "cancun" } });
    const tulum = scoreOpts({ ...request, hotel: { noHotel: false, zone: "tulum" } });
    expect(scoreProduct(near, ["water"], cancun)).toBeGreaterThan(
      scoreProduct(far, ["water"], cancun),
    );
    expect(scoreProduct(far, ["water"], tulum)).toBeGreaterThan(
      scoreProduct(near, ["water"], tulum),
    );
    // Distance never beats the interest itself.
    const ruins = product({ bokunId: 93, title: "Tulum Ruins", interests: ["cultural"] });
    const nearbyBoat = product({
      bokunId: 94,
      title: "Cancun Glass Boat",
      interests: ["water", "cultural"],
    });
    expect(scoreProduct(ruins, ["cultural"], cancun)).toBeGreaterThan(
      scoreProduct(nearbyBoat, ["cultural"], cancun),
    );
  });

  it("keeps night life out unless the traveler picked party, whatever else it's tagged", () => {
    const crawl = product({
      bokunId: 81,
      title: "Madness Tour with Nightclub Admission",
      interests: ["party", "cultural", "food"],
    });
    const it_ = buildRulesItinerary({
      request: {
        ...request,
        travelers: [{ age: 30 }, { age: 30 }],
        interests: ["cultural", "food"],
      },
      products: [...catalog, crawl],
    });
    const ids = it_.days.flatMap((d) => d.items).map((i) => i.bokunId);
    expect(ids).not.toContain(81);
  });

  it("never swaps back in a tour of the previous version", () => {
    const products = [
      product({ bokunId: 61, title: "3 Hidden Cenotes", interests: ["water"] }),
      product({ bokunId: 62, title: "Semi-private Cenotes", interests: ["water"] }),
      product({ bokunId: 63, title: "Isla Mujeres Catamaran", interests: ["water"] }),
    ];
    const req = { ...request, budgetPerPerson: 1000, interests: ["water" as const] };
    const raw = buildRulesItinerary({ request: req, products });
    const [a, b] = raw.days.filter((d) => d.items.some((i) => i.kind === "tour"));
    const forced = {
      ...raw,
      days: raw.days.map((d) =>
        d === a || d === b
          ? {
              ...d,
              items: d.items.map((i) =>
                i.kind === "tour" ? toItem(products[d === a ? 0 : 1], req, d) : i,
              ),
            }
          : d,
      ),
    };
    // The catamaran was in the previous version: the repeated cenote day stays as is.
    const out = diversify(forced, req, products, [63]);
    const ids = out.days
      .flatMap((d) => d.items)
      .filter((i) => i.kind === "tour")
      .map((i) => i.bokunId);
    expect(ids).not.toContain(63);
  });
});

describe("pickCandidates (Claude's menu)", () => {
  const adults = [{ age: 30 }, { age: 30 }];
  const ids = (r: TripRequest) => pickCandidates(r, catalog).tours.map((p) => p.bokunId);

  it("keeps night life off the menu when the traveler didn't pick party", () => {
    expect(ids({ ...request, travelers: adults, interests: ["cultural"] })).not.toContain(4);
    const crawl = product({
      bokunId: 82,
      title: "Madness Tour with Nightclub Admission",
      interests: ["party", "cultural"],
    });
    const menu = pickCandidates({ ...request, travelers: adults, interests: ["cultural"] }, [
      ...catalog,
      crawl,
    ]).tours.map((p) => p.bokunId);
    expect(menu).not.toContain(82);
  });

  it("offers night life when party is an interest", () => {
    expect(ids({ ...request, travelers: adults, interests: ["party"] })).toContain(4);
  });

  it("lists interest matches first, then tops up with other tours", () => {
    const tours = ids({ ...request, travelers: adults, interests: ["cultural"] });
    expect(tours[0]).toBe(1);
    expect(tours).toEqual(expect.arrayContaining([2, 3]));
  });

  it("never offers adults-only night life to a group with kids", () => {
    expect(ids({ ...request, interests: ["party"] })).not.toContain(4);
  });
});

describe("airport transfer by zone", () => {
  const ride = (id: number, title: string) =>
    product({ bokunId: id, title, kind: "transfer", interests: [], priceFromUsd: 100 });
  const rides = [
    ride(101, "Airport Transfer Cancun Airport to Akumal"),
    ride(102, "Airport Transfer Cancun Airport to Playa Paraiso"),
    ride(103, "Airport Transfer Cancun Airport to Hotel Zone"),
    ride(104, "Cancun Airport Deluxe Transportation to Hotel Zone"),
    ride(105, "Mera VIP Lounge at Cancun International Airport"),
  ];
  const at = (zone: TripRequest["hotel"]["zone"], luxury = false) => ({
    ...request,
    hotel: { noHotel: false, zone },
    transfers: { arrival: true, departure: true, luxury },
  });

  it("Riviera Maya rides to Playa Paraiso, not Akumal", () => {
    expect(transferFor(rides, at("riviera_maya"))?.bokunId).toBe(102);
  });

  it("picks the deluxe ride when the traveler asks for luxury", () => {
    expect(transferFor(rides, at("cancun", true))?.bokunId).toBe(104);
    expect(transferFor(rides, at("cancun"))?.bokunId).toBe(103);
  });

  it("validation swaps a transfer for another zone with the right one", () => {
    const req = at("riviera_maya");
    const products = [...catalog.filter((p) => p.kind !== "transfer"), ...rides];
    const raw = buildRulesItinerary({ request: req, products });
    const wrong = {
      ...raw,
      days: raw.days.map((d) => ({
        ...d,
        items: d.items.map((i) => (i.kind === "transfer" ? { ...i, bokunId: 101 } : i)),
      })),
    };
    const { itinerary } = validateAndRepair(wrong, req, products);
    const ids = itinerary.days
      .flatMap((d) => d.items)
      .filter((i) => i.kind === "transfer")
      .map((i) => i.bokunId);
    expect(ids).toEqual([102, 102]);
  });
});

describe("try another version", () => {
  it("leaves the previous version's tours out when others fit", () => {
    const first = buildRulesItinerary({ request, products: catalog });
    const used = first.days
      .flatMap((d) => d.items)
      .filter((i) => i.kind === "tour")
      .map((i) => i.bokunId!);
    const extra = [
      product({ bokunId: 201, title: "Cenote Swim", interests: ["adventure", "water"] }),
      product({ bokunId: 202, title: "Tulum Ruins", interests: ["cultural"] }),
      product({ bokunId: 203, title: "Reef Snorkel", interests: ["water"] }),
    ];
    const second = buildRulesItinerary({
      request,
      products: [...catalog, ...extra],
      avoid: used,
    });
    const again = second.days
      .flatMap((d) => d.items)
      .filter((i) => i.kind === "tour")
      .map((i) => i.bokunId!);
    expect(again.length).toBeGreaterThan(0);
    expect(again.some((id) => used.includes(id))).toBe(false);
  });
});

describe("shared tickets", () => {
  it("charges each traveler their share when one ticket covers two people", () => {
    // 670333: Extreme Adventure ATV, USD 126 for 2 riders.
    const atv = product({ bokunId: 670333, title: "ATV, Ziplining & Cenote", priceFromUsd: 126 });
    const p = priceProductForParty(atv, [{ age: 30 }, { age: 30 }]);
    expect(p.pricing[0]).toMatchObject({ count: 2, unitUsd: 63 });
    expect(p.priceTotalUsd).toBe(126);
  });
});

describe("fillEmptyDays", () => {
  it("gives a full day the engine skipped the best matching tour within budget", async () => {
    const { fillEmptyDays } = await import("./fill");
    const raw = buildRulesItinerary({
      request: { ...request, budgetPerPerson: 1000 },
      products: catalog,
    });
    // Pretend the engine left every full day empty (what Claude does on long, cheap trips).
    const emptied = {
      ...raw,
      days: raw.days.map((d) => (d.label === "full" ? { ...d, items: [] } : d)),
    };
    const out = fillEmptyDays(emptied, { ...request, budgetPerPerson: 1000 }, catalog);
    const tours = out.days.flatMap((d) => d.items).filter((i) => i.kind === "tour");
    expect(tours.length).toBe(out.days.filter((d) => d.label === "full").length);
    expect(new Set(tours.map((t) => t.bokunId)).size).toBe(tours.length);
    expect(tours.map((t) => t.bokunId)).not.toContain(4); // party not requested
    expect(out.warnings.some((w) => w.startsWith("Filled"))).toBe(true);
  });

  it("stops when the budget is gone and leaves the day free", async () => {
    const { fillEmptyDays } = await import("./fill");
    const tight = { ...request, budgetPerPerson: 90 }; // 270 total for tours; transfers are extra
    const raw = buildRulesItinerary({ request: tight, products: catalog });
    const emptied = {
      ...raw,
      days: raw.days.map((d) => (d.label === "full" ? { ...d, items: [] } : d)),
    };
    const out = fillEmptyDays(emptied, tight, catalog);
    const spent = out.days
      .flatMap((d) => d.items)
      .filter((i) => i.kind === "tour" || i.kind === "transfer")
      .reduce((s, i) => s + i.priceTotalUsd, 0);
    expect(spent).toBeLessThanOrEqual(360);
    expect(
      out.days.some((d) => d.label === "full" && !d.items.some((i) => i.kind === "tour")),
    ).toBe(true);
  });
});

describe("night life near the hotel", () => {
  const club = product({ bokunId: 95, title: "Coco Bongo Cancun", interests: ["party"] });
  const adults = [{ age: 30 }, { age: 30 }];
  const at = (zone: TripRequest["hotel"]["zone"]) => ({
    ...request,
    travelers: adults,
    interests: ["party", "water"] as TripRequest["interests"],
    hotel: { noHotel: false, zone },
  });

  it("allows a Cancun club from Cancun, Costa Mujeres and Puerto Morelos only", () => {
    expect(partyAllowed(club, at("cancun"))).toBe(true);
    expect(partyAllowed(club, at("costa_mujeres"))).toBe(true);
    expect(partyAllowed(club, at("puerto_morelos"))).toBe(true);
    expect(partyAllowed(club, at("playa_del_carmen"))).toBe(false);
    expect(partyAllowed(club, at("tulum"))).toBe(false);
    expect(partyAllowed(club, { ...at("cancun"), interests: ["water"] })).toBe(false);
  });

  it("keeps Cancun clubs out of a Playa del Carmen trip, in both engines' menus", () => {
    const products = [...catalog, club];
    const rules = buildRulesItinerary({ request: at("playa_del_carmen"), products });
    expect(rules.days.flatMap((d) => d.items).map((i) => i.bokunId)).not.toContain(95);
    const menu = pickCandidates(at("playa_del_carmen"), products).tours.map((p) => p.bokunId);
    expect(menu).not.toContain(95);
    expect(pickCandidates(at("cancun"), products).tours.map((p) => p.bokunId)).toContain(95);
  });
});

describe("transfers are extra, not part of the tour budget", () => {
  it("spends the whole budget on tours even with both transfers on", () => {
    // Catalog: Chichen 90, Cenotes ATV 110, Catamaran 80 for 2 adults + 1 child; transfer 45 x 2.
    const req = { ...request, budgetPerPerson: 100, chillDays: "none" as const };
    const it_ = buildRulesItinerary({ request: req, products: catalog });
    const tours = it_.days.flatMap((d) => d.items).filter((i) => i.kind === "tour");
    const transfers = it_.days.flatMap((d) => d.items).filter((i) => i.kind === "transfer");
    expect(transfers).toHaveLength(2);
    // 300 USD of tours fit without the 90 USD of transfers being subtracted first.
    expect(it_.totals.toursUsd).toBeGreaterThan(300 - 90);
    expect(it_.totals.toursUsd / req.travelers.length).toBeLessThanOrEqual(100);
    expect(it_.totals.withinBudget).toBe(true);
    expect(it_.totals.totalUsd).toBe(it_.totals.toursUsd + it_.totals.transfersUsd);
    expect(tours.length).toBeGreaterThan(0);
  });
});

describe("Claude's menu stays near the hotel", () => {
  it("lets only a few tours 4+ zones away onto the menu", () => {
    const cancunTours = Array.from({ length: 8 }, (_, i) =>
      product({ bokunId: 300 + i, title: `Cancun Reef Snorkel ${i}`, interests: ["water"] }),
    );
    const tulumTour = product({ bokunId: 320, title: "Tulum Lagoon Swim", interests: ["water"] });
    const req: TripRequest = {
      ...request,
      travelers: [{ age: 30 }, { age: 30 }],
      interests: ["water"],
      hotel: { noHotel: false, zone: "tulum" },
    };
    const menu = pickCandidates(req, [...cancunTours, tulumTour]).tours.map((p) => p.bokunId);
    expect(menu).toContain(320);
    expect(menu.filter((id) => id >= 300 && id < 320)).toHaveLength(4);
  });
});

describe("Claude's menu for another version", () => {
  it("drops the previous version's tours while enough others remain", () => {
    const many = Array.from({ length: 16 }, (_, i) =>
      product({ bokunId: 400 + i, title: `Reef Snorkel ${i}`, interests: ["water"] }),
    );
    const req: TripRequest = {
      ...request,
      travelers: [{ age: 30 }, { age: 30 }],
      interests: ["water"],
    };
    const avoid = [400, 401, 402];
    const menu = pickCandidates(req, many, { avoid }).tours.map((p) => p.bokunId);
    for (const id of avoid) expect(menu).not.toContain(id);
    // With too few alternatives the old tours stay on the menu (at the end).
    const few = many.slice(0, 6);
    const menu2 = pickCandidates(req, few, { avoid }).tours.map((p) => p.bokunId);
    expect(menu2.slice(-3)).toEqual(expect.arrayContaining(avoid));
  });
});

describe('"I\'d rather skip" (avoidTypes)', () => {
  const adults = [{ age: 30 }, { age: 30 }];
  const req: TripRequest = {
    ...request,
    travelers: adults,
    interests: ["water", "adventure"],
    avoidTypes: ["dolphin", "whale_shark", "atv", "horseback"],
  };
  const sea = [
    product({ bokunId: 501, title: "Dolphin Discovery in Cancun", interests: ["water"] }),
    product({ bokunId: 502, title: "ATV Jungle Adventure", interests: ["adventure"] }),
    product({ bokunId: 503, title: "Isla Mujeres Catamaran", interests: ["water"] }),
    product({ bokunId: 504, title: "Cenote Swim", interests: ["water", "adventure"] }),
  ];

  it("keeps avoided kinds out of the rules engine, Claude's menu and the editor", async () => {
    const plan = buildRulesItinerary({ request: req, products: sea });
    const ids = plan.days.flatMap((d) => d.items).map((i) => i.bokunId);
    expect(ids).not.toContain(501);
    expect(ids).not.toContain(502);
    expect(ids).toEqual(expect.arrayContaining([503, 504]));
    const menu = pickCandidates(req, sea).tours.map((p) => p.bokunId);
    expect(menu.sort()).toEqual([503, 504]);
    const { fillEmptyDays } = await import("./fill");
    const emptied = { ...plan, days: plan.days.map((d) => ({ ...d, items: [] })) };
    const filled = fillEmptyDays(emptied, req, sea);
    const filledIds = filled.days.flatMap((d) => d.items).map((i) => i.bokunId);
    expect(filledIds).not.toContain(501);
    expect(filledIds).not.toContain(502);
  });

  it("a combo that includes an avoided kind is out too", () => {
    expect(isAvoided({ title: "ATV, Ziplining & Cenote Tour" }, req)).toBe(true);
    expect(isAvoided({ title: "Catamaran tour & Dolphin Swim" }, req)).toBe(true);
    expect(isAvoided({ title: "Isla Mujeres Catamaran" }, req)).toBe(false);
    expect(isAvoided({ title: "Isla Mujeres Catamaran" }, { ...req, avoidTypes: undefined })).toBe(
      false,
    );
  });
});

describe("small kids: at most one long day trip", () => {
  const long = (id: number, title: string) =>
    product({
      bokunId: id,
      title,
      interests: ["cultural"],
      durationMinutes: 12 * 60,
      priceFromUsd: 50,
    });
  const family: TripRequest = {
    ...request,
    travelers: [{ age: 35 }, { age: 4 }],
    interests: ["cultural"],
    budgetPerPerson: 1000,
  };
  const products = [
    long(601, "Chichen Itza Classic"),
    long(602, "Ek Balam Mayan Traditions"),
    long(603, "Coba Ruins"),
  ];

  it("plans one long tour, then leaves the day free rather than a second 12-hour day", () => {
    const it_ = buildRulesItinerary({ request: family, products });
    const tours = it_.days.flatMap((d) => d.items).filter((i) => i.kind === "tour");
    expect(tours).toHaveLength(1);
    expect(longTourOk(products[1], family, [products[0]])).toBe(false);
    // Adults only: no such limit.
    expect(longTourOk(products[1], { travelers: [{ age: 30 }] }, [products[0]])).toBe(true);
  });
});

describe("budget tolerance", () => {
  it("accepts tours up to 5 % over the budget", () => {
    const req = { ...request, travelers: [{ age: 30 }, { age: 30 }], budgetPerPerson: 100 };
    expect(withinBudget(210, req)).toBe(true); // 105 pp
    expect(withinBudget(212, req)).toBe(false);
  });
});

describe("fillEmptyDays explains a day only the budget blocks", () => {
  it("writes what the cheapest fitting tour would add", async () => {
    const { fillEmptyDays } = await import("./fill");
    const tight = { ...request, travelers: [{ age: 30 }, { age: 30 }], budgetPerPerson: 60 };
    const raw = buildRulesItinerary({ request: tight, products: catalog });
    const emptied = {
      ...raw,
      days: raw.days.map((d) => ({ ...d, items: d.items.filter((i) => i.kind === "transfer") })),
    };
    const out = fillEmptyDays(emptied, tight, catalog);
    const notes = out.days
      .flatMap((d) => d.items)
      .filter((i) => i.kind === "free")
      .map((i) => i.note ?? "");
    expect(notes.some((n) => /\+USD \d+/.test(n))).toBe(true);
  });
});
