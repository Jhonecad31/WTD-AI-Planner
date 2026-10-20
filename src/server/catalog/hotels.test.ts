import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "./types";
import { fold, searchHotels, zoneForPlace } from "./hotels";

const products = [
  {
    pickupPlaces: [
      { id: 1, title: "Hyatt Ziva Cancún", city: "Cancun" },
      { id: 2, title: "Grand Hyatt Playa del Carmen", city: "Playa del Carmen" },
      { id: 3, title: "Dreams Tulum", city: null },
      { id: 4, title: "Secrets Akumal", city: "Akumal" },
      { id: 5, title: "Hyatt Ziva Cancún", city: "Cancun" },
    ],
  },
] as unknown as CatalogProduct[];

describe("hotel search", () => {
  it("folds accents and case", () => {
    expect(fold("  Cancún ")).toBe("cancun");
  });
  it("maps cities and names to zones", () => {
    expect(zoneForPlace("Playa Mujeres", "x")).toBe("costa_mujeres");
    expect(zoneForPlace("Akumal", "x")).toBe("riviera_maya");
    expect(zoneForPlace(null, "Dreams Tulum")).toBe("tulum");
    expect(zoneForPlace("", "Somewhere")).toBeNull();
  });
  it("matches every word, accent-insensitive, deduplicated", () => {
    const hits = searchHotels(products, "hyatt cancun");
    expect(hits).toEqual([{ name: "Hyatt Ziva Cancún", city: "Cancun", zone: "cancun" }]);
    expect(searchHotels(products, "hyatt").map((h) => h.name)).toHaveLength(2);
    expect(searchHotels(products, "")).toEqual([]);
  });
});
