import { describe, expect, it } from "vitest";
import type { CatalogSnapshot } from "./service";
import type { CatalogProduct } from "./types";
import { compactSnapshot, expandSnapshot, SNAPSHOT_FORMAT } from "./snapshot";

function product(bokunId: number, pickupPlaces: CatalogProduct["pickupPlaces"]): CatalogProduct {
  return {
    bokunId,
    title: `Tour ${bokunId}`,
    slug: null,
    siteUrl: null,
    onSite: true,
    extranetUrl: "",
    kind: "tour",
    excerpt: "",
    description: "",
    interests: [],
    bokunCategories: [],
    keywords: [],
    durationMinutes: null,
    durationText: null,
    isMultiDay: false,
    priceFromUsd: 10,
    currency: "USD",
    pricingCategories: [],
    startTimes: [],
    bookingType: null,
    pickupService: pickupPlaces.length > 0,
    pickupMinutesBefore: null,
    pickupPlaces,
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
  };
}

const hyatt = { id: 1, title: "Hyatt Ziva", city: "Cancun" };
const fiesta = { id: 2, title: "Fiesta Americana", city: "Cancun" };
const tulum = { id: 3, title: "Dreams Tulum", city: "Tulum" };

const snapshot: CatalogSnapshot = {
  fetchedAt: "2026-11-06T18:05:42.394Z",
  source: "bokun",
  scope: "site",
  products: [
    product(10, [hyatt, fiesta, tulum]),
    product(11, [hyatt, fiesta, tulum]),
    product(12, [tulum, hyatt]),
    product(13, []),
  ],
  errors: [{ bokunId: 99, message: "timeout" }],
};

describe("catalog snapshot compaction", () => {
  it("stores every pickup place and every distinct list once", () => {
    const compact = compactSnapshot(snapshot);
    expect(compact.format).toBe(SNAPSHOT_FORMAT);
    expect(compact.pickupPlaces).toHaveLength(3);
    expect(compact.pickupLists).toEqual([[1, 2, 3], [3, 1], []]);
    expect(compact.products.map((p) => p.pickupList)).toEqual([0, 0, 1, 2]);
    expect(compact.products[0]).not.toHaveProperty("pickupPlaces");
  });

  it("round-trips to the exact snapshot the app consumes", () => {
    expect(expandSnapshot(compactSnapshot(snapshot))).toEqual(snapshot);
  });

  it("is much smaller than the plain snapshot when lists repeat", () => {
    const hotels = Array.from({ length: 300 }, (_, i) => ({
      id: 1000 + i,
      title: `Hotel ${i}`,
      city: "Cancun",
    }));
    const big: CatalogSnapshot = {
      ...snapshot,
      products: Array.from({ length: 50 }, (_, i) => product(100 + i, hotels)),
    };
    const plain = JSON.stringify(big).length;
    const packed = JSON.stringify(compactSnapshot(big)).length;
    expect(packed).toBeLessThan(plain / 2);
  });

  it("drops pickup ids that are missing from the place table", () => {
    const compact = compactSnapshot(snapshot);
    compact.pickupLists[1].push(999);
    expect(expandSnapshot(compact).products[2].pickupPlaces).toEqual([tulum, hyatt]);
  });

  it("refuses an unknown format", () => {
    const compact = { ...compactSnapshot(snapshot), format: 2 } as unknown as ReturnType<
      typeof compactSnapshot
    >;
    expect(() => expandSnapshot(compact)).toThrow(/format/);
  });
});
